import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow 60s for slow AI responses
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { transcript, apiKey: requestApiKey } = await request.json();
    const apiKey = requestApiKey || process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Perplexity API key required' }, { status: 400 });
    }

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript required' }, { status: 400 });
    }

    const systemPrompt = `You are an expert LinkedIn content creator specializing in transforming AI and technology YouTube video content into viral LinkedIn carousel posts.

Your task is to analyze the video transcript and create LinkedIn-optimized carousel content that:
1. Captures the most valuable, actionable insights
2. Is optimized for LinkedIn's professional audience and algorithm
3. Uses punchy, scannable text (each slide readable in 3-5 seconds)
4. Builds curiosity and encourages swiping through all slides
5. Positions the content for thought leadership

Output your response as a JSON object with exactly this structure:
{
  "analysis": "A 2-3 sentence summary of the video's main topic and key insights",
  "title": "An attention-grabbing carousel title (8 words max, use power words)",
  "slides": [
    "Slide 1: Hook/attention grabber - a bold claim, surprising stat, or question",
    "Slide 2: Key insight with specific detail",
    "Slide 3: Key insight with specific detail",
    "Slide 4: Key insight with specific detail",
    "Slide 5: Key insight with specific detail",
    "Slide 6: Conclusion/main takeaway"
  ],
  "hook": "A compelling 1-2 sentence hook that appears BEFORE the carousel. This is crucial - it's what people see in their feed before clicking 'see more'. Use pattern interrupts, bold claims, questions, or contrarian takes. Examples: 'I spent 100 hours studying AI tools. Here's what nobody tells you.' or 'Stop using ChatGPT like this. (It's killing your productivity)'",
  "cta": "A clear call-to-action. Examples: '♻️ Repost if this was helpful\\n🔔 Follow for daily AI insights\\n💬 Drop a comment: Which tip will you try first?'",
  "hashtags": "5-7 relevant LinkedIn hashtags separated by spaces. Mix popular and niche. Example: #AI #ArtificialIntelligence #Productivity #TechTips #FutureOfWork #AITools",
  "fullCaption": "The complete LinkedIn post caption combining: hook + line breaks + brief context about the carousel + line breaks + CTA + line breaks + hashtags. Use line breaks strategically for readability. Keep under 2500 characters."
}

Rules for slides:
- Each slide should be 15-40 words maximum
- Use simple, direct language - write at 8th grade reading level
- Include specific numbers, stats, tips, or examples when available
- First slide must stop the scroll (use contrarian take, surprising stat, or provocative question)
- Last slide should drive engagement or provide a memorable takeaway
- Aim for 6-8 slides total
- Use "you" language to make it personal

Rules for LinkedIn caption:
- The hook is THE most important part - it determines if people click "see more"
- Use short paragraphs (1-2 sentences max)
- Add strategic line breaks for mobile readability
- Include a clear value proposition
- End with engagement-driving CTA
- Hashtags go at the very end`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Analyze this AI/technology video transcript and create Instagram carousel content:\n\n${transcript.slice(0, 15000)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Perplexity API error:', errorData);
      return NextResponse.json({
        error: 'Perplexity API error',
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content generated' }, { status: 500 });
    }

    // Parse the JSON response
    try {
      // Try to extract JSON from the response (in case it's wrapped in markdown)
      let jsonContent = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonContent);

      return NextResponse.json({
        analysis: parsed.analysis || 'Content analyzed successfully',
        title: parsed.title || 'AI Insights',
        slides: parsed.slides || [],
        hook: parsed.hook || '',
        cta: parsed.cta || '♻️ Repost if you found this helpful\n🔔 Follow for more AI insights',
        hashtags: parsed.hashtags || '#AI #Technology #Innovation #TechTips #Productivity',
        fullCaption: parsed.fullCaption || `${parsed.hook || ''}\n\n${parsed.cta || ''}\n\n${parsed.hashtags || ''}`
      });
    } catch (parseError) {
      // If JSON parsing fails, create structured content from the text
      console.error('JSON parse error. Raw content:', content);
      console.error('Parse error:', parseError);

      // Check for refusal messages
      const lowerContent = content.toLowerCase();
      if (lowerContent.startsWith("i'm unable") ||
        lowerContent.startsWith("i cannot") ||
        lowerContent.startsWith("i can't") ||
        lowerContent.startsWith("i am sorry")) {
        return NextResponse.json({
          error: 'Perplexity refused to generate content',
          details: content,
          refusal: true
        }, { status: 422 });
      }

      // Split content into slides manually as fallback
      const lines = content.split('\n').filter(line => line.trim());
      const slides = lines.slice(0, 8).map(line =>
        line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim()
      );

      return NextResponse.json({
        analysis: 'Content analyzed from video transcript',
        title: 'AI Insights You Need to Know',
        slides: slides.length > 0 ? slides : ['Key insight from the video'],
        hook: 'I just discovered something interesting about AI...',
        cta: '♻️ Repost if you found this helpful\n🔔 Follow for more AI insights',
        hashtags: '#AI #Technology #Innovation #TechTips #Productivity',
        fullCaption: 'I just discovered something interesting about AI...\n\nSwipe through to see the key insights →\n\n♻️ Repost if you found this helpful\n🔔 Follow for more AI insights\n\n#AI #Technology #Innovation #TechTips #Productivity'
      });
    }

  } catch (error) {
    console.error('Perplexity enrichment error:', error);
    return NextResponse.json({
      error: 'Failed to enrich content',
      details: error.message
    }, { status: 500 });
  }
}
