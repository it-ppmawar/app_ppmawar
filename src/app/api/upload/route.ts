import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = (file.name || 'foto.jpg').replace(/[^a-zA-Z0-9.-]/g, '');
    const filename = uniqueSuffix + '-' + safeName;
    
    // Check and create directory if doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ success: true, fileName: filename, url: `/uploads/${filename}` });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah file: ' + error.message }, { status: 500 });
  }
}
