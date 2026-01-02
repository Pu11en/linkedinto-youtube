/**
 * Verification script for AssemblyAI transcription
 */
const { AssemblyAI } = require('assemblyai');
const ytdl = require('@distube/ytdl-core');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLY_AI_API_KEY
});

const VIDEO_ID = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up (Short and reliable)

async function testAssemblyAI() {
    console.log(`Testing AssemblyAI with Video ID: ${VIDEO_ID}`);
    const videoUrl = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

    try {
        // 1. Get the audio stream URL
        console.log('[1/2] Getting audio stream URL...');
        const info = await ytdl.getInfo(videoUrl);
        const audioFormat = ytdl.chooseFormat(info.formats, {
            quality: 'lowestaudio',
            filter: 'audioonly'
        });

        if (!audioFormat || !audioFormat.url) {
            throw new Error('Could not find a valid audio stream for this video.');
        }

        console.log('      Audio URL found (starts with):', audioFormat.url.substring(0, 50) + '...');

        // 2. Transcribe with AssemblyAI
        console.log('[2/2] Transmitting to AssemblyAI (this may take a minute)...');
        const transcript = await client.transcripts.transcribe({
            audio: audioFormat.url,
            language_detection: true
        });

        if (transcript.status === 'error') {
            throw new Error(`AssemblyAI Error: ${transcript.error}`);
        }

        console.log('\n✅ SUCCESS!');
        console.log('Transcript Length:', transcript.text.length, 'characters');
        console.log('Preview:', transcript.text.substring(0, 200) + '...');

    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
    }
}

testAssemblyAI();
