/**
 * Verification script for the new transcription logic in app/api/transcript/route.js
 */
const fetch = require('node-fetch');

const TEST_VIDEOS = [
    'd-PZDQlO4m4', // Known good
    'q2ZCTOh5uak', // Known good
    'jYD9d0PFZcA'  // Known good
];

const INNERTUBE_CLIENT = {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
};

async function fetchTranscriptViaInnertube(videoId) {
    console.log(`[Testing] ${videoId}...`);
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    const html = await response.text();
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!playerMatch) {
        console.log('  [FAIL] Player response not found');
        return null;
    }

    const startIdx = html.indexOf('var ytInitialPlayerResponse = ') + 'var ytInitialPlayerResponse = '.length;
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = startIdx;

    for (let i = startIdx; i < html.length; i++) {
        const char = html[i];
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"' && !escape) { inString = !inString; continue; }
        if (inString) continue;
        if (char === '{') depth++;
        if (char === '}') {
            depth--;
            if (depth === 0) { endIdx = i + 1; break; }
        }
    }

    const playerResponse = JSON.parse(html.substring(startIdx, endIdx));
    const cfgMatch = html.match(/ytcfg\.set\(\{.*?"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    const apiKey = cfgMatch ? cfgMatch[1] : null;

    if (!apiKey) {
        console.log('  [FAIL] API Key not found');
        return null;
    }

    const body = {
        context: { client: INNERTUBE_CLIENT },
        params: Buffer.from(`\n\u000b${videoId}`).toString('base64')
    };

    try {
        const transcriptResponse = await fetch(
            `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                body: JSON.stringify(body)
            }
        );

        const data = await transcriptResponse.json();
        const segments = data?.actions?.[0]?.updateEngagementPanelAction
            ?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer
            ?.body?.transcriptSegmentListRenderer?.initialSegments;

        if (segments && segments.length > 0) {
            const text = segments.map(s =>
                s.transcriptSegmentRenderer?.snippet?.runs?.map(r => r.text).join('') || ''
            ).filter(Boolean).join(' ');
            console.log(`  [SUCCESS] Got ${text.length} characters`);
            return text;
        } else {
            console.log('  [FAIL] No segments found in Innertube response');
        }
    } catch (e) {
        console.log(`  [ERROR] ${e.message}`);
    }
    return null;
}

async function run() {
    console.log('Verifying Innertube logic logic...\n');
    for (const id of TEST_VIDEOS) {
        await fetchTranscriptViaInnertube(id);
    }
}

run();
