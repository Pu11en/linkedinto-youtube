/**
 * Custom YouTube Transcript Fetcher using Innertube API
 * Based on the approach described in https://medium.com/@punithatrivedi/fetch-youtube-transcripts-javascript-guide-2024-future-proof-solution-e8fbb4d88082
 */

const fetch = require('node-fetch');

const TEST_VIDEOS = [
    'd-PZDQlO4m4',
    'q2ZCTOh5uak',
    'jYD9d0PFZcA'
];

const INNERTUBE_CLIENT = {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
};

async function getInnertubeData(videoId) {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    const html = await response.text();

    // Extract ytInitialPlayerResponse
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!playerMatch) throw new Error('Could not find player response');

    // Find the end of the JSON
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

    // Also extract ytcfg for API key
    const cfgMatch = html.match(/ytcfg\.set\(\{.*?"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    const apiKey = cfgMatch ? cfgMatch[1] : 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

    return { playerResponse, apiKey, html };
}

async function fetchTranscriptViaInnertube(videoId) {
    const { playerResponse, apiKey } = await getInnertubeData(videoId);

    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
        throw new Error('No captions available for this video');
    }

    // Find best English caption
    let track = captions.find(t => t.languageCode === 'en' && !t.kind);
    if (!track) track = captions.find(t => t.languageCode === 'en');
    if (!track) track = captions[0];

    console.log(`    Using track: ${track.name?.simpleText || track.languageCode}`);

    // Try the Innertube get_transcript endpoint
    const body = {
        context: {
            client: INNERTUBE_CLIENT
        },
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

        // Extract transcript from response
        const transcriptRenderer = data?.actions?.[0]?.updateEngagementPanelAction
            ?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer
            ?.body?.transcriptSegmentListRenderer?.initialSegments;

        if (transcriptRenderer && transcriptRenderer.length > 0) {
            const segments = transcriptRenderer.map(s =>
                s.transcriptSegmentRenderer?.snippet?.runs?.map(r => r.text).join('') || ''
            ).filter(Boolean);

            return segments.join(' ');
        }
    } catch (e) {
        console.log(`    Innertube endpoint failed: ${e.message}`);
    }

    // Fallback: try the timedtext URL directly with different params
    let captionUrl = track.baseUrl;

    // Try adding tlang parameter and different format
    const urls = [
        captionUrl,
        captionUrl + '&fmt=srv3',
        captionUrl + '&fmt=json3',
        captionUrl.replace(/&fmt=[^&]+/, '') // Remove any fmt param
    ];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': `https://www.youtube.com/watch?v=${videoId}`,
                }
            });

            const text = await response.text();
            if (text.length > 0) {
                // Try JSON3 format
                try {
                    const json = JSON.parse(text);
                    if (json.events) {
                        const segments = json.events
                            .filter(e => e.segs)
                            .flatMap(e => e.segs.map(s => s.utf8).filter(Boolean));
                        if (segments.length > 0) {
                            return segments.join(' ').replace(/\n/g, ' ');
                        }
                    }
                } catch (e) {
                    // Try XML format
                    const regex = /<text[^>]*>(.*?)<\/text>/gs;
                    const segments = [];
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        segments.push(match[1]
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                        );
                    }
                    if (segments.length > 0) {
                        return segments.join(' ');
                    }
                }
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error('Could not fetch transcript from any source');
}

async function testVideo(videoId) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: ${videoId}`);
    console.log('='.repeat(50));

    try {
        console.log('[1] Fetching transcript via Innertube...');
        const transcript = await fetchTranscriptViaInnertube(videoId);

        if (transcript && transcript.length > 0) {
            console.log(`[SUCCESS] Got ${transcript.length} chars`);
            console.log('Preview:', transcript.substring(0, 200) + '...');
            return { videoId, success: true, chars: transcript.length };
        } else {
            console.log('[WARN] Empty transcript returned');
            return { videoId, success: false, reason: 'Empty transcript' };
        }
    } catch (error) {
        console.log(`[ERROR] ${error.message}`);
        return { videoId, success: false, reason: error.message };
    }
}

async function main() {
    console.log('Custom Innertube Transcript Fetcher\n');

    const results = [];
    for (const id of TEST_VIDEOS) {
        results.push(await testVideo(id));
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('SUMMARY');
    console.log('='.repeat(50));
    for (const r of results) {
        const status = r.success ? '✓ PASS' : '✗ FAIL';
        const detail = r.success ? `${r.chars} chars` : r.reason;
        console.log(`${status} | ${r.videoId} | ${detail}`);
    }
}

main().catch(console.error);
