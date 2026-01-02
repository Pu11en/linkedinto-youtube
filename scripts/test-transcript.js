const { YoutubeTranscript } = require('youtube-transcript');
const ytdl = require('@distube/ytdl-core');

const VIDEO_ID = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up (Known to have captions)

async function testYoutubeTranscript() {
    console.log(`Testing youtube-transcript for ${VIDEO_ID}...`);
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(VIDEO_ID);
        console.log('✅ youtube-transcript SUCCESS:', transcript.length, 'items');
        if (transcript.length > 0) {
            console.log('Sample:', transcript[0]);
        }
    } catch (error) {
        console.error('❌ youtube-transcript FAILED:', error.message);
    }
}

async function testYtdl() {
    console.log(`Testing @distube/ytdl-core for ${VIDEO_ID}...`);
    try {
        const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
        console.log('✅ ytdl-core SUCCESS: Title =', info.videoDetails.title);
        // Check formats
        const format = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio' });
        if (format) {
            console.log('✅ Audio format found:', format.mimeType);
        } else {
            console.log('❌ No audio format found');
        }
    } catch (error) {
        console.error('❌ ytdl-core FAILED:', error.message);
    }
}

async function run() {
    await testYoutubeTranscript();
    await testYtdl();
}

run();
