import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Force dynamic to prevent caching of "past URLs"
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  try {
    console.log(`[Transcript] Processing video: ${videoId}`);

    // LAYER 1: Standard Captions (Fastest, Free)
    try {
      console.log('[Transcript] Layer 1: Attempting youtube-transcript...');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      const transcript = transcriptItems.map(item => item.text).join(' ');

      console.log('[Transcript] Layer 1 Success: Captions found.');
      return NextResponse.json({
        transcript,
        type: 'transcript',
        videoId
      });
    } catch (transcriptError) {
      console.warn('[Transcript] Layer 1 Failed:', transcriptError.message);
    }

    // LAYER 2: Whisper Audio Transcription (Slower, Paid, Reliable)
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('[Transcript] Layer 2: Attempting Whisper transcription...');

        // 1. Get Audio Stream URL
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(videoUrl);
        const format = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio' });

        if (!format) throw new Error('No audio format found');

        // 2. Download audio to temp file
        // We must write to file because OpenAI SDK needs a file stream with path/name
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
          response_format: 'text', // just get plain text
        });

        // Cleanup temp file
        fs.unlinkSync(tempPath);

        console.log('[Transcript] Layer 2 Success: Audio transcribed.');
        return NextResponse.json({
          transcript: transcription,
          type: 'generated_transcript',
          videoId,
          warning: 'Captions were disabled. This content was auto-generated from the video audio (took ~30s).'
        });

      } catch (whisperError) {
        console.error('[Transcript] Layer 2 Failed:', whisperError);
        // Fallthrough to Layer 3
      }
    } else {
      console.warn('[Transcript] Layer 2 Skipped: No OPENAI_API_KEY provided.');
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
      warning: 'No captions or audio could be extracted. Using video summary.'
    });

  } catch (error) {
    console.error('Transcript/Metadata extraction error:', error);
    return NextResponse.json({
      error: 'Failed to fetch video content',
      details: error.message
    }, { status: 500 });
  }
}
