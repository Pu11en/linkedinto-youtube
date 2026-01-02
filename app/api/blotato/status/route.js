import { NextResponse } from 'next/server';

const BLOTATO_API_BASE = 'https://backend.blotato.com/v2';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const carouselId = searchParams.get('id');
  const apiKey = searchParams.get('apiKey');

  if (!carouselId || !apiKey) {
    return NextResponse.json({ error: 'Carousel ID and API key required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${BLOTATO_API_BASE}/videos/${carouselId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ 
        error: 'Failed to get carousel status',
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({
      id: data.id || data.item?.id,
      status: data.status || data.item?.status,
      imageUrls: data.imageUrls || data.item?.imageUrls,
      videoUrl: data.videoUrl || data.item?.videoUrl,
    });

  } catch (error) {
    console.error('Blotato status error:', error);
    return NextResponse.json({ 
      error: 'Failed to check carousel status',
      details: error.message 
    }, { status: 500 });
  }
}
