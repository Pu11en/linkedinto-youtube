import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Force dynamic to prevent caching of "past URLs"
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow more time for audio processing

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  try {
    console.log(`[Transcript] Processing video: ${videoId}`);
    let transcriptData = null;

    // LAYER 1: Whisper Audio Transcription (PRIMARY)
    // We prioritize this because it's 100% reliable and avoids "disabled caption" errors.
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('[Transcript] Layer 1: Attempting Whisper transcription (Primary)...');

        // 1. Get Audio Stream URL
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(videoUrl);
        const format = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio' });

        if (!format) throw new Error('No audio format found');

        // 2. Download audio to temp file
        const tempPath = path.join(os.tmpdir(), `${videoId}_${Date.now()}.mp3`);
        console.log(`[Transcript] Downloading audio to ${tempPath}...`);

        await new Promise((resolve, reject) => {
          const stream = ytdl(videoUrl, { format });
          const writeStream = fs.createWriteStream(tempPath);
          stream.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          stream.on('error', reject);
        });

        // 3. Send to Whisper
        console.log('[Transcript] File written. Sending to OpenAI Whisper...');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'whisper-1',
          response_format: 'text',
        });

        // Cleanup temp file
        fs.unlinkSync(tempPath);

        console.log('[Transcript] Layer 1 Success: Audio transcribed.');

        return NextResponse.json({
          transcript: transcription,
          type: 'generated_transcript',
          videoId,
        });

      } catch (whisperError) {
        console.error('[Transcript] Layer 1 Failed:', whisperError.message);
        // Fallthrough to Layer 2
      }
    } else {
      console.warn('[Transcript] Layer 1 Skipped: No OPENAI_API_KEY provided.');
    }

    // LAYER 2: Standard Captions (Fallback)
    try {
      console.log('[Transcript] Layer 2: Attempting youtube-transcript fallback...');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      const transcript = transcriptItems.map(item => item.text).join(' ');

      console.log('[Transcript] Layer 2 Success: Captions found.');
      return NextResponse.json({
        transcript,
        type: 'transcript',
        videoId
      });
    } catch (transcriptError) {
      console.warn('[Transcript] Layer 2 Failed:', transcriptError.message);
    }

    // LAYER 3: Metadata Fallback (Last Resort)
    console.log('[Transcript] Layer 3: Falling back to metadata.');

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoUrl);
    const html = await pageResponse.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/) ||
      html.match(/"title":\{"runs":\[\{"text":"(.*?)"\}\]/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Video';

    const descMatch = html.match(/"shortDescription":"(.*?)"/) ||
      html.match(/<meta name="description" content="(.*?)">/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n') : '';

    const metadataSummary = `
VIDEO TITLE: ${title}

VIDEO DESCRIPTION:
${description}

Note: This video does not have closed captions available. This content is based on the video's metadata summary.
    `.trim();

    return NextResponse.json({
      transcript: metadataSummary,
      type: 'metadata',
      videoId,
      warning: 'No transcripts or audio could be extracted. Using video summary.'
    });

  } catch (error) {
    console.error('Transcript/Metadata extraction error:', error);
    return NextResponse.json({
      error: 'Failed to fetch video content',
      details: error.message
    }, { status: 500 });
  }
}
