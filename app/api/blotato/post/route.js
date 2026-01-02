import { NextResponse } from 'next/server';

const BLOTATO_API_BASE = 'https://backend.blotato.com/v2';

export async function POST(request) {
  try {
    const {
      apiKey: requestApiKey,
      platform,
      accountId,
      pageId,
      text,
      mediaUrls
    } = await request.json();

    const apiKey = requestApiKey || process.env.BLOTATO_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Blotato API key required' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // Construct the V2 payload structure
    // https://help.blotato.com/api/api-reference/publish-post
    const target = {
      targetType: platform || 'linkedin'
    };

    if (pageId) {
      target.pageId = pageId;
    }

    const payload = {
      post: {
        accountId: accountId,
        content: {
          text: text,
          mediaUrls: mediaUrls || [],
          platform: platform || 'linkedin',
        },
        target: target
      }
    };

    const response = await fetch(`${BLOTATO_API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Blotato post error:', errorData);
      return NextResponse.json({
        error: 'Failed to post to LinkedIn',
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      postId: data.id || data.postId,
    });

  } catch (error) {
    console.error('LinkedIn post error:', error);
    return NextResponse.json({
      error: 'Failed to post',
      details: error.message
    }, { status: 500 });
  }
}
