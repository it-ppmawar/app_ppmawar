import { NextRequest, NextResponse } from 'next/server';

function splitTextIntoChunks(text: string, maxLength = 180): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLength) return [clean];

  const sentences = clean.split(/(?<=[.!?,\u06D4\u060C])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxLength) {
      currentChunk = (currentChunk + ' ' + sentence).trim();
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (sentence.length > maxLength) {
        // Fallback: split long sentence by words
        const words = sentence.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if ((wordChunk + ' ' + word).trim().length <= maxLength) {
            wordChunk = (wordChunk + ' ' + word).trim();
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        if (wordChunk) currentChunk = wordChunk;
        else currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter(c => c.length > 0);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text') || searchParams.get('q') || '';
  const lang = searchParams.get('lang') || searchParams.get('tl') || 'id';

  if (!text.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  const chunks = splitTextIntoChunks(text, 180);

  try {
    const buffers: Buffer[] = [];

    for (const chunk of chunks) {
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
      const res = await fetch(googleTtsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'audio/mpeg, audio/*',
        },
      });

      if (!res.ok) {
        console.error(`[TTS Proxy Error] Chunk fetch failed with status: ${res.status}`);
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      buffers.push(Buffer.from(arrayBuffer));
    }

    if (buffers.length === 0) {
      return NextResponse.json({ error: 'Failed to generate audio chunks' }, { status: 500 });
    }

    const mergedBuffer = Buffer.concat(buffers);

    return new NextResponse(mergedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('[TTS Proxy Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch TTS' }, { status: 500 });
  }
}
