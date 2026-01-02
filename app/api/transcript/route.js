import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  try {
    // Use youtube-transcript API or fallback to YouTube's timedtext API
    // First try the unofficial transcript endpoint
    const transcriptUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Fetch the video page to get transcript data
    const pageResponse = await fetch(transcriptUrl);
    const pageHtml = await pageResponse.text();

    // Extract captions URL from the page
    const captionMatch = pageHtml.match(/"captionTracks":\s*\[(.*?)\]/);

    if (!captionMatch) {
      // Fallback: try to get auto-generated captions
      const autoMatch = pageHtml.match(/"playerCaptionsTracklistRenderer":\s*\{[^}]*"captionTracks":\s*\[(.*?)\]/s);

      if (!autoMatch) {
        return NextResponse.json({
          error: 'No captions available for this video'
        }, { status: 404 });
      }
    }

    // Try to extract transcript using a more reliable method
    // Parse for timedtext URL
    const timedTextMatch = pageHtml.match(/https:\/\/www\.youtube\.com\/api\/timedtext[^"]+/);

    if (timedTextMatch) {
      let timedTextUrl = timedTextMatch[0].replace(/\\u0026/g, '&');

      const transcriptResponse = await fetch(timedTextUrl);
      const transcriptXml = await transcriptResponse.text();

      // Parse XML transcript
      const textMatches = transcriptXml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
      const transcriptParts = [];

      for (const match of textMatches) {
        let text = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n/g, ' ')
          .trim();
        if (text) transcriptParts.push(text);
      }

      const transcript = transcriptParts.join(' ');

      return NextResponse.json({
        transcript: transcript || 'Transcript extracted but appears empty.',
        videoId
      });
    }

    // If no transcript found, return helpful message
    // If no transcript found, return error
    return NextResponse.json({
      error: 'Could not automatically extract transcript. Please ensure the video has captions enabled.',
      videoId
    }, { status: 404 });

  } catch (error) {
    console.error('Transcript extraction error:', error);
    return NextResponse.json({
      error: 'Failed to fetch transcript',
      details: error.message
    }, { status: 500 });
  }
}
