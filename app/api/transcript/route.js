import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function decodeHtml(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  console.log(`[Transcript] Processing video: ${videoId}`);

  try {
    // LAYER 1: Manual HTML Parsing
    try {
      console.log('[Transcript] Layer 1: Attempting manual HTML scraping...');
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store'
      });
      const html = await response.text();
      console.log(`[Transcript] Layer 1: Fetched HTML (Length: ${html.length})`);

      let tracks = null;

      // Strategy A: Direct Regex for "captionTracks"
      const match = html.match(/"captionTracks":(\[.*?\])/);
      if (match) {
        try {
          tracks = JSON.parse(match[1]);
          console.log(`[Transcript] Strategy A found ${tracks.length} tracks.`);
        } catch (e) { console.error('Strategy A parse error', e); }
      }

      // Strategy B: Search inside player_response JSON object if A fails
      if (!tracks) {
        console.log('[Transcript] Strategy A failed. Trying Strategy B (player_response)...');
        const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
        if (playerResponseMatch) {
          try {
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (captions) {
              tracks = captions;
              console.log(`[Transcript] Strategy B found ${tracks.length} tracks.`);
            }
          } catch (e) { console.error('Strategy B parse error', e); }
        }
      }

      if (tracks) {
        // Find best track (English preferred)
        let bestTrack = tracks.find(t => t.languageCode === 'en' && !t.kind);
        if (!bestTrack) bestTrack = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
        if (!bestTrack) bestTrack = tracks.find(t => t.languageCode?.startsWith('en'));
        if (!bestTrack) bestTrack = tracks[0];

        if (bestTrack) {
          console.log(`[Transcript] Found track: ${bestTrack.name?.simpleText} (${bestTrack.languageCode})`);
          const xmlResponse = await fetch(bestTrack.baseUrl);
          const xml = await xmlResponse.text();

          const regex = /<text[^>]*>(.*?)<\/text>/g;
          let transcriptText = '';
          let match;
          while ((match = regex.exec(xml)) !== null) {
            transcriptText += decodeHtml(match[1]) + ' ';
          }

          if (transcriptText.trim().length > 0) {
            return NextResponse.json({
              transcript: transcriptText.trim(),
              type: 'manual_scraping',
              videoId,
              method: 'manual_layer_1'
            });
          }
        }
      } else {
        console.log('[Transcript] Layer 1: No captionTracks found via any strategy.');
      }
    } catch (e) {
      console.error('[Transcript] Layer 1 Failed:', e.message);
    }

    // LAYER 2: Library Fallback
    try {
      console.log('[Transcript] Layer 2: Attempting youtube-transcript library...');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

      if (transcriptItems && transcriptItems.length > 0) {
        const transcript = transcriptItems.map(item => item.text).join(' ');
        return NextResponse.json({
          transcript,
          type: 'library_transcript',
          videoId,
          method: 'library_layer_2'
        });
      }
    } catch (e) {
      console.warn('[Transcript] Layer 2 Failed:', e.message);
    }

    // LAYER 3: Metadata Fallback
    console.log('[Transcript] Layer 3: Falling back to metadata.');
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const html = await pageResponse.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/) || html.match(/"title":\{"runs":\[\{"text":"(.*?)"\}\]/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Video';
    const descMatch = html.match(/"shortDescription":"(.*?)"/) || html.match(/<meta name="description" content="(.*?)">/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n') : 'No description available.';

    const metadataSummary = `
VIDEO TITLE: ${title}

VIDEO DESCRIPTION:
${description}

[Note: Audio transcript unavailable. This content is generated from the video metadata.]
    `.trim();

    return NextResponse.json({
      transcript: metadataSummary,
      type: 'metadata',
      videoId,
      warning: 'Using metadata fallback.'
    });

  } catch (error) {
    console.error('[Transcript] Critical Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch video content',
      details: error.message
    }, { status: 500 });
  }
}
