/**
 * Debug youtube-transcript.io API response
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VIDEO_ID = 'd-PZDQlO4m4'; // AI topic video

async function debug() {
    const apiKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY;
    console.log('Using API Key:', apiKey);

    try {
        const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [VIDEO_ID] })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Detailed Response Body:');
        console.log(JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

debug();
