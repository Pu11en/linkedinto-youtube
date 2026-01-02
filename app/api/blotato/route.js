import { NextResponse } from 'next/server';

const BLOTATO_API_BASE = 'https://backend.blotato.com/v2';

export async function POST(request) {
  try {
    const {
      apiKey: requestApiKey,
      templateId,
      quotes,
      title,
      authorName,
      handle,
      profileImage,
      theme,
      aspectRatio
    } = await request.json();

    const apiKey = request.headers.get('x-api-key') || requestApiKey || process.env.BLOTATO_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Blotato API key required' }, { status: 400 });
    }

    if (!quotes || !quotes.length) {
      return NextResponse.json({ error: 'Quotes required' }, { status: 400 });
    }

    // Build the template inputs based on the template type
    let templateInputs = {
      quotes: quotes,
    };

    // Add common fields for tweet card templates
    if (templateId.includes('tweet-card')) {
      templateInputs = {
        ...templateInputs,
        authorName: authorName || 'AI Creator',
        handle: handle || 'ai_creator',
        verified: true,
        theme: theme || 'dark',
        aspectRatio: aspectRatio || '4:5',
      };

      if (profileImage) {
        templateInputs.profileImage = profileImage;
      }
    }

    // Add fields for quote card templates
    if (templateId.includes('quote-card')) {
      templateInputs = {
        ...templateInputs,
        title: title || 'AI Insights',
        font: 'Philosopher',
      };

      // Add paper background for paper-based templates
      if (templateId.includes('f941e306')) {
        templateInputs.paperBackground = 'Light paper';
      }
    }

    const response = await fetch(`${BLOTATO_API_BASE}/videos/from-templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: templateId,
        inputs: templateInputs,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Blotato API error:', errorData);
      return NextResponse.json({
        error: 'Blotato API error',
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      id: data.id || data.item?.id,
      status: data.status || data.item?.status,
    });

  } catch (error) {
    console.error('Blotato creation error:', error);
    return NextResponse.json({
      error: 'Failed to create carousel',
      details: error.message
    }, { status: 500 });
  }
}
