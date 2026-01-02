const VIDEO_ID = 't3xu9pzfj8Q';

async function debugVideo() {
    console.log(`Debugging video ${VIDEO_ID}...`);
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${VIDEO_ID}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        const html = await response.text();

        console.log('HTML Length:', html.length);

        // Check for captionTracks
        const match = html.match(/"captionTracks":(\[.*?\])/);
        if (match) {
            const tracks = JSON.parse(match[1]);
            console.log('✅ Found captionTracks:', tracks.length);
            console.log(JSON.stringify(tracks, null, 2));
        } else {
            console.log('❌ No "captionTracks" string found in HTML.');

            // Check for other clues
            if (html.includes('captionTracks')) {
                console.log('⚠️ "captionTracks" word exists but regex match failed.');
                // extract context
                const idx = html.indexOf('captionTracks');
                console.log('Context:', html.substring(idx - 50, idx + 200));
            } else {
                console.log('❌ "captionTracks" word NOT found at all.');
            }

            // Check if it's age restricted or plays inline
            if (html.includes('UNPLAYABLE')) console.log('⚠️ Video might be unplayable/embedded only.');
            if (html.includes('requires login')) console.log('⚠️ Video might require login.');
        }

    } catch (e) {
        console.error('Fetch error:', e);
    }
}

debugVideo();
