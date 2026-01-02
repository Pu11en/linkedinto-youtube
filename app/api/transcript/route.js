import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  try {
    // 1. Try to fetch the actual closed captions (most reliable source)
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

      const transcript = transcriptItems.map(item => item.text).join(' ');

      return NextResponse.json({
        transcript,
        type: 'transcript',
        videoId
      });
    } catch (transcriptError) {
      console.warn('Transcript fetch failed, falling back to metadata:', transcriptError.message);
      // Fallthrough to metadata extraction
    }

    // 2. Fallback: Extract Title, Description, and Keywords from the video page
    // This ensures we always have *some* content to work with, even if captions are missing.
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoUrl);
    const html = await pageResponse.text();

    // Extract Title
    const titleMatch = html.match(/<title>(.*?)<\/title>/) ||
      html.match(/"title":\{"runs":\[\{"text":"(.*?)"\}\]/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Video';

    // Extract Description
    // YouTube stores description in complex JSON objects in the HTML, or sometimes simple meta tags
    const descMatch = html.match(/"shortDescription":"(.*?)"/) ||
      html.match(/<meta name="description" content="(.*?)">/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n') : '';

    // Extract Keywords
    const keywordsMatch = html.match(/<meta name="keywords" content="(.*?)">/);
    const keywords = keywordsMatch ? keywordsMatch[1] : '';

    const metadataSummary = `
VIDEO TITLE: ${title}

VIDEO DESCRIPTION:
${description}

KEYWORDS:
${keywords}

Note: This video does not have closed captions available. This content is based on the video's metadata summary.
    `.trim();

    return NextResponse.json({
      transcript: metadataSummary,
      type: 'metadata',
      videoId,
      warning: 'No closed captions found. Content generated from video summary.'
    });

  } catch (error) {
    console.error('Transcript/Metadata extraction error:', error);
    return NextResponse.json({
      error: 'Failed to fetch video content',
      details: error.message
    }, { status: 500 });
  }
}
