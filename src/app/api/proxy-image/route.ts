import { NextResponse } from 'next/server';

/**
 * GET /api/proxy-image?url=...
 * Proxies cross-origin images to bypass browser CORS restrictions when loading
 * student photos for face-api descriptor extraction.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return new NextResponse('Image URL parameter required', { status: 400 });
    }

    const cleanUrl = decodeURIComponent(imageUrl);

    // Keamanan: hanya izinkan domain mawar.smartpesantren.id atau URL yang valid
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return new NextResponse('Invalid URL scheme', { status: 400 });
    }

    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return new NextResponse(`Remote image HTTP error ${res.status}`, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('proxy-image error:', error.message);
    return new NextResponse('Proxy error: ' + error.message, { status: 500 });
  }
}
