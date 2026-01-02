/**
 * Test Transcription with youtube-transcript.io
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const TEST_VIDEOS = [
    'https://youtu.be/d-PZDQlO4m4',
    'https://www.youtube.com/watch?v=q2ZCTOh5uak',
    'https://www.youtube.com/watch?v=jYD9d0PFZcA'
];

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return url;
}

async function testTranscript(videoUrl) {
    const videoId = extractVideoId(videoUrl);
    const apiKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Video ID: ${videoId}`);
    console.log(`URL: ${videoUrl}`);

    if (!apiKey) {
        console.log('[ERROR] YOUTUBE_TRANSCRIPT_API_KEY not found in .env.local');
        return { success: false, videoId, reason: 'Missing API Key' };
    }

    try {
        console.log('[1] Fetching from youtube-transcript.io API...');

        const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [videoId] })
        });

        if (response.ok) {
            const data = await response.json();
            const transcriptData = data[0];

            if (transcriptData && transcriptData.transcript) {
                const transcript = transcriptData.transcript;
                console.log(`[SUCCESS] Got transcript! (${transcript.length} chars)`);
                console.log(`[PREVIEW] ${transcript.substring(0, 300)}...`);
                return { success: true, videoId, chars: transcript.length };
            } else {
                console.log('[WARN] API returned but transcript is missing/empty.');
                return { success: false, videoId, reason: 'Empty transcript' };
            }
        } else {
            const errText = await response.text();
            console.log(`[FAILED] API Status: ${response.status} - ${errText}`);
            return { success: false, videoId, reason: `API Error ${response.status}` };
        }
    } catch (error) {
        console.log(`[FAILED] Exception: ${error.message}`);
        return { success: false, videoId, reason: error.message };
    }
}

async function main() {
    console.log('Verifying Transcription Service (Option A)\n');

    const results = [];
    for (const url of TEST_VIDEOS) {
        results.push(await testTranscript(url));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log('='.repeat(60));
    results.forEach(r => {
        const status = r.success ? '✓ PASS' : '✗ FAIL';
        console.log(`${status} | ${r.videoId} | ${r.success ? r.chars + ' chars' : r.reason}`);
    });
}

main().catch(console.error);
