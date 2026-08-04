import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/kartu-image/[nis]
 * Serves the student photo image either from:
 * 1. D:\koding\app.ppmawar\KARTU EMAAL 2026 2027\[nis].jpg (Local PC)
 * 2. public/uploads/[filename]
 * 3. Fallback online sekretariat URL
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ nis: string }> }
) {
  try {
    const { nis } = await params;
    if (!nis) {
      return new NextResponse('NIS required', { status: 400 });
    }

    const cleanNis = nis.replace(/[^a-zA-Z0-9_-]/g, '');

    // 1. Cek folder lokal KARTU EMAAL 2026 2027
    const localEmaalPath = path.join(process.cwd(), 'KARTU EMAAL 2026 2027', `${cleanNis}.jpg`);
    if (fs.existsSync(localEmaalPath)) {
      const buffer = fs.readFileSync(localEmaalPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // 2. Cek folder public/uploads
    const publicUploadPath = path.join(process.cwd(), 'public', 'uploads', `${cleanNis}.jpg`);
    if (fs.existsSync(publicUploadPath)) {
      const buffer = fs.readFileSync(publicUploadPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // 3. Fallback online URL
    const remoteUrl = `https://mawar.smartpesantren.id/sekretariat/berkas/Berkas_2026_${cleanNis}.jpg`;
    const res = await fetch(remoteUrl);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return new NextResponse(Buffer.from(arrayBuffer), {
        headers: {
          'Content-Type': res.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new NextResponse('Image not found', { status: 404 });
  } catch (error: any) {
    return new NextResponse('Server error: ' + error.message, { status: 500 });
  }
}
