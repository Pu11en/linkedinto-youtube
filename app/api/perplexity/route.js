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

    const systemPrompt = `You are a world-class LinkedIn Content Strategist who specializes in turning long-form tech/AI videos into high-engagement viral carousels.

Your goal is to extract the TOP 1% of insights from a transcript and package them for a professional LinkedIn audience.

STRUCTURE OF THE OUTPUT JSON:
{
  "analysis": "Brief summary of the video's value proposition.",
  "title": "SCROLL-STOPPING CAROUSEL TITLE (e.g., 'ChatGPT is dead. Try this.', '7 AI tools to save 20h/week')",
  "slides": [
    "Slide 1: THE HOOK. Must be a pattern interrupt. Bold claim, shocking stat, or massive promise.",
    "Slide 2-7: HIGH-VALUE INSIGHTS. One specific tip per slide. Use specific numbers. No fluff.",
    "Slide 8: CONTEXT/ACTION. The 'So What?' and next step."
  ],
  "hook": "A viral LinkedIn hook (first 2 lines of the post). This MUST stop the scroll. Use a 'cliffhanger' style.",
  "cta": "Engagement hack. '♻️ Repost this to help your network.' or a polarizing question.",
  "hashtags": "#AI #Productivity #Tech #FutureOfWork #Automation #AITools",
  "fullCaption": "The ultimate LinkedIn post: Hook + Context + CTA + Hashtags. Use whitespace aggressively. 1-2 sentences per paragraph max."
}

RULES FOR PERFORMANCE:
- Slide text must be PUNCHY. Max 25 words per slide.
- Use 'You' and 'Your' to make it personal.
- Focus on ACTION over theory.
- The Title Slide (Slide 1) is the most important. Make it provocative.
- Avoid corporate jargon. Use 'Plain English'.`;

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
