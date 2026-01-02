import { NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import ytdl from '@distube/ytdl-core';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // AssemblyAI needs more time for large videos

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_AI_API_KEY
});

// Create agent for ytdl-core to bypass bot detection
// If YOUTUBE_COOKIES is set (JSON array format), use it.
const getAgent = () => {
  try {
    if (process.env.YOUTUBE_COOKIES) {
      const cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
      return ytdl.createAgent(cookies);
    }
  } catch (e) {
    console.error('[Transcript] Failed to parse YOUTUBE_COOKIES:', e.message);
  }
  return ytdl.createAgent(); // Returns a default agent with better headers
};

const agent = getAgent();

/**
 * AssemblyAI-powered YouTube Transcript API
 * Downloads audio via ytdl and transcribes via AssemblyAI.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[Transcript] AssemblyAI Processing: ${videoId}`);

  try {
    // 1. Get the audio stream URL
    console.log('[Transcript] Step 1: Getting audio stream URL...');

    // Use the hardened agent to bypass bot detection
    const info = await ytdl.getInfo(videoUrl, { agent });

    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: 'lowestaudio',
      filter: 'audioonly'
    });

    if (!audioFormat || !audioFormat.url) {
      throw new Error('Could not find a valid audio stream for this video.');
    }

    // 2. Transcribe with AssemblyAI
    console.log('[Transcript] Step 2: Transmitting to AssemblyAI...');
    const transcript = await client.transcripts.transcribe({
      audio: audioFormat.url,
      language_detection: true // Auto-detect language
    });

    if (transcript.status === 'error') {
      throw new Error(`AssemblyAI Error: ${transcript.error}`);
    }

    console.log(`[Transcript] Success! (${transcript.text?.length || 0} chars)`);

    return NextResponse.json({
      transcript: transcript.text,
      type: 'assembly_ai',
      videoId,
      method: 'assemblyai'
    });

  } catch (error) {
    console.error('[Transcript] Critical Error:', error);

    // Metadata Fallback if transcription fails
    try {
      console.log('[Transcript] Falling back to metadata...');
      // Basic info is usually more resilient
      const info = await ytdl.getBasicInfo(videoUrl, { agent });

      const title = info.videoDetails.title;
      const description = info.videoDetails.description;

      const metadataSummary = `
VIDEO TITLE: ${title}

VIDEO DESCRIPTION:
${description}

[Note: Audio transcription failed due to bot detection or API error. Using metadata fallback.]
      `.trim();

      return NextResponse.json({
        transcript: metadataSummary,
        type: 'metadata',
        videoId,
        warning: `Transcription failed: ${error.message}. Using metadata fallback.`
      });
    } catch (fallbackError) {
      console.error('[Transcript] Fallback also failed:', fallbackError);
      return NextResponse.json({
        error: 'Failed to fetch video content or metadata',
        details: error.message,
        fallbackError: fallbackError.message
      }, { status: 500 });
    }
  }
}
