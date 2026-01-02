import { NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import ytdl from '@distube/ytdl-core';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // AssemblyAI needs more time for large videos

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_AI_API_KEY
});

const APIFY_TOKEN = process.env.APIFY_TOKEN;

/**
 * Apify-powered YouTube Transcript Fetcher
 * Uses professional proxies to bypass YouTube bot detection.
 */
async function fetchTranscriptFromApify(videoId) {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[Transcript] Running Apify scraper for: ${videoId}`);

  const response = await fetch(
    `https://api.apify.com/v2/acts/pintostudio~youtube-transcript-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: videoUrl
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Apify Error: ${response.status} - ${errText}`);
  }

  const items = await response.json();
  // Items will be an array of segments: [{start, dur, text}, ...]
  if (items && items.length > 0) {
    const fullText = items.map(item => item.text).join(' ');
    if (fullText.trim().length > 0) {
      return fullText;
    }
  }

  throw new Error('Apify succeeded but returned no transcript text');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[Transcript] Starting multi-layer fetch for: ${videoId}`);

  // LAYER 1: APIFY (Primary - Most Robust)
  try {
    const transcript = await fetchTranscriptFromApify(videoId);
    console.log(`[Transcript] Success via Apify! (${transcript.length} chars)`);
    return NextResponse.json({
      transcript: transcript,
      type: 'apify',
      videoId,
      method: 'apify'
    });
  } catch (apifyError) {
    console.warn(`[Transcript] Apify failed: ${apifyError.message}`);

    // LAYER 2: AssemblyAI (Fallback - High Quality Audio Processing)
    try {
      console.log('[Transcript] Fallback: Trying AssemblyAI Audio Extraction...');
      const agent = ytdl.createAgent(); // Fresh agent
      const info = await ytdl.getInfo(videoUrl, { agent });
      const audioFormat = ytdl.chooseFormat(info.formats, {
        quality: 'lowestaudio',
        filter: 'audioonly'
      });

      if (audioFormat?.url) {
        const transcript = await client.transcripts.transcribe({
          audio: audioFormat.url,
          language_detection: true
        });

        if (transcript.status !== 'error') {
          console.log(`[Transcript] Success via AssemblyAI! (${transcript.text?.length || 0} chars)`);
          return NextResponse.json({
            transcript: transcript.text,
            type: 'assembly_ai',
            videoId,
            method: 'assemblyai'
          });
        }
      }
    } catch (assemblyError) {
      console.warn(`[Transcript] AssemblyAI/YTDL failed: ${assemblyError.message}`);
    }

    // LAYER 3: METADATA FALLBACK (Last Resort)
    try {
      console.log('[Transcript] Final Fallback: Fetching video metadata...');
      // Use a simpler approach for metadata if ytdl is completely blocked
      const metaRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`);
      const meta = await metaRes.json();

      const title = meta.title || 'Unknown Video';
      const author = meta.author_name || 'Unknown Creator';

      const metadataSummary = `
VIDEO TITLE: ${title}
CREATOR: ${author}

[Note: Full transcription failed due to bot detection. No detailed transcript available for this video currently.]
      `.trim();

      return NextResponse.json({
        transcript: metadataSummary,
        type: 'metadata',
        videoId,
        warning: `Transcription failed across all providers. Using basic metadata.`
      });
    } catch (metaError) {
      return NextResponse.json({
        error: 'Failed to fetch video content or metadata',
        details: apifyError.message
      }, { status: 500 });
    }
  }
}
