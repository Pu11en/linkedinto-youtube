import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Helper to clean XML text
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
    // LAYER 1: Manual HTML Parsing (Most Robust for Text)
    // We scrape the page to find captionTracks in the player response.
    try {
      console.log('[Transcript] Layer 1: Attempting manual HTML scraping...');
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const html = await response.text();

      // Extract captionTracks
      const match = html.match(/"captionTracks":(\[.*?\])/);
      if (match) {
        const tracks = JSON.parse(match[1]);

        // Prioritize English
        let bestTrack = tracks.find(t => t.languageCode === 'en' && !t.kind); // Manual English
        if (!bestTrack) bestTrack = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr'); // Auto English
        if (!bestTrack) bestTrack = tracks.find(t => t.languageCode === 'en'); // Any English
        if (!bestTrack) bestTrack = tracks[0]; // Any track

        if (bestTrack) {
          console.log(`[Transcript] Found track: ${bestTrack.name.simpleText} (${bestTrack.languageCode})`);

          // Fetch XML
          const xmlResponse = await fetch(bestTrack.baseUrl);
          const xml = await xmlResponse.text();

          // Simple XML Parse
          // Matches <text start="123" dur="5">Hello world</text>
          const regex = /<text[^>]*>(.*?)<\/text>/g;
          let transcriptText = '';
          let match;
          while ((match = regex.exec(xml)) !== null) {
            transcriptText += decodeHtml(match[1]) + ' ';
          }

          if (transcriptText.trim().length > 0) {
            console.log('[Transcript] Layer 1 Success: Extracted text.');
            return NextResponse.json({
              transcript: transcriptText.trim(),
              type: 'manual_scraping',
              videoId
            });
          }
        }
      } else {
        console.log('[Transcript] Layer 1: No captionTracks found in HTML.');
      }
    } catch (e) {
      console.error('[Transcript] Layer 1 Failed:', e.message);
    }

    // LAYER 2: Library Fallback (youtube-transcript)
    try {
      console.log('[Transcript] Layer 2: Attempting youtube-transcript library...');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

      if (transcriptItems && transcriptItems.length > 0) {
        const transcript = transcriptItems.map(item => item.text).join(' ');
        console.log('[Transcript] Layer 2 Success: Library returned captions.');
        return NextResponse.json({
          transcript,
          type: 'library_transcript',
          videoId
        });
      } else {
        console.log('[Transcript] Layer 2: Library returned empty array.');
      }
    } catch (e) {
      console.warn('[Transcript] Layer 2 Failed:', e.message);
    }

    // LAYER 3: Metadata Fallback
    console.log('[Transcript] Layer 3: Falling back to metadata.');

    // Re-fetch HTML if strictly needed, or reuse if we could pass it down (but independent block is safer)
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
