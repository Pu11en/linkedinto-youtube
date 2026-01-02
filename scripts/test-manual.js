const VIDEO_ID = 'dQw4w9WgXcQ';

async function manualExtract() {
    console.log(`Manual extraction for ${VIDEO_ID}...`);
    try {
        const page = await fetch(`https://www.youtube.com/watch?v=${VIDEO_ID}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await page.text();

        // Look for captionTracks
        const match = html.match(/"captionTracks":(\[.*?\])/);
        if (match) {
            const tracks = JSON.parse(match[1]);
            console.log('✅ Found caption tracks manually:', tracks.length);
            console.log('Tracks:', tracks.map(t => t.name.simpleText + ' (' + t.languageCode + ')'));

            if (tracks.length > 0) {
                const firstTrack = tracks[0];
                console.log('Fetching first track URL:', firstTrack.baseUrl);
                const xmlRes = await fetch(firstTrack.baseUrl);
                const xml = await xmlRes.text();
                console.log('✅ Fetched XML caption preview:', xml.substring(0, 200));
            }

        } else {
            console.log('❌ No captionTracks found in HTML.');
            // Dump a bit of HTML to see if we got blocked
            console.log('HTML Preview:', html.substring(0, 500));
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

manualExtract();
