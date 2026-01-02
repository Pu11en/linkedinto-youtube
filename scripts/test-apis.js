
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} else {
    console.error("Could not find .env.local at " + envPath);
    process.exit(1);
}

// Minimal fetch polyfill for Node environment if needed, or use node's fetch if available (Node 18+)
// Assuming Node 18+ for this environment.

async function testPerplexity() {
    console.log('\n--- Testing Perplexity API ---');
    if (!process.env.PERPLEXITY_API_KEY) {
        console.error('❌ PERPLEXITY_API_KEY is missing');
        return;
    }

    // Use a small transcript to test
    const testTranscript = "This is a short test transcript about artificial intelligence. AI is changing the world by automating tasks and generating creative content. It is important to use AI responsibly.";

    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant.'
                    },
                    {
                        role: 'user',
                        content: `Summarize this text: ${testTranscript}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 100,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Perplexity API call successful!');
            console.log('Response excerpt:', data.choices[0]?.message?.content?.substring(0, 100) + '...');
        } else {
            const err = await response.text();
            console.error('❌ Perplexity API call failed:', response.status, err);
        }

    } catch (error) {
        console.error('❌ Perplexity connection error:', error);
    }
}

async function testBlotato() {
    console.log('\n--- Testing Blotato API (Video Creation) ---');
    if (!process.env.BLOTATO_API_KEY) {
        console.error('❌ BLOTATO_API_KEY is missing');
        return;
    }

    // NOTE: This actually creates a video on Blotato. We should be careful not to spam too much if it costs money or rate limits.
    // The user asked to "test it a bunch of times", so we will verify it works at least once here.

    const templateId = '/base/v2/quote-card/77f65d2b-48cc-4adb-bfbb-5bc86f8c01bd/v1'; // Standard quote card
    const inputs = {
        quotes: [
            "AI is the new electricity.",
            "It will transform every industry.",
            "Adapt or get left behind."
        ],
        title: "AI Revolution",
        font: "Philosopher"
    };

    try {
        const response = await fetch('https://backend.blotato.com/v2/videos/from-templates', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.BLOTATO_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                templateId: templateId,
                inputs: inputs,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Blotato Video Creation successful!');
            console.log('Full Response Data:', JSON.stringify(data, null, 2));
            return data.id;
        } else {
            const err = await response.text();
            console.error('❌ Blotato API call failed:', response.status, err);
        }

    } catch (error) {
        console.error('❌ Blotato connection error:', error);
    }
    return null;
}

async function runDocs() {
    console.log("Running stress test (3 iterations)...");
    for (let i = 1; i <= 3; i++) {
        console.log(`\n\n=== ITERATION ${i} ===`);
        await testPerplexity();
        // Add delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        await testBlotato();
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

runDocs();
