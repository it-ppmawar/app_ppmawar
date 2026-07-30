import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import db from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Jimp = require('jimp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsQR = require('jsqr');

export const runtime = 'nodejs';

interface PairingResult {
  filename: string;
  nis: string;
  status: 'success' | 'failed' | 'qr_not_found' | 'nis_not_found' | 'error';
  barcode_id?: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Autentikasi
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Tidak terautentikasi.' }, { status: 401 });
    }
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Token tidak valid.' }, { status: 401 });
    }
    const allowedRoles = ['admin', 'staff', 'pengurus_asrama', 'kepala_sekolah'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ success: false, message: 'Akses ditolak.' }, { status: 403 });
    }

    // 2. Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, message: 'Tidak ada file yang diupload.' }, { status: 400 });
    }

    const results: PairingResult[] = [];

    for (const file of files) {
      const filename = file.name;
      // Ekstrak NIS dari nama file (hapus ekstensi)
      const nis = filename.replace(/\.[^/.]+$/, '').trim();

      if (!nis) {
        results.push({ filename, nis: '-', status: 'error', message: 'Nama file tidak valid untuk dijadikan NIS.' });
        continue;
      }

      try {
        // 3. Konversi file ke Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 4. Load gambar dengan Jimp
        let image;
        try {
          image = await Jimp.read(buffer);
        } catch {
          results.push({ filename, nis, status: 'error', message: 'File tidak bisa dibaca sebagai gambar.' });
          continue;
        }

        // 5. Decode QR dari gambar
        const { width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(image.bitmap.data);
        
        const qrCode = jsQR(imageData, width, height, { inversionAttempts: 'dontInvert' });
        const qrCodeInverted = !qrCode?.data 
          ? jsQR(imageData, width, height, { inversionAttempts: 'onlyInvert' }) 
          : null;
        
        const decoded = qrCode?.data || qrCodeInverted?.data;

        if (!decoded) {
          results.push({ filename, nis, status: 'qr_not_found', message: 'QR code tidak ditemukan di gambar ini.' });
          continue;
        }

        // 6. Update database
        const barcodeId = decoded.trim();
        const updateResult = await updateBarcodeId(nis, barcodeId);
        results.push({ filename, nis, status: updateResult.status, barcode_id: barcodeId, message: updateResult.message });

      } catch (fileErr: any) {
        results.push({ filename, nis, status: 'error', message: `Error: ${fileErr.message}` });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      message: `Selesai: ${successCount} berhasil, ${failedCount} gagal dari ${results.length} file.`,
      total: results.length,
      berhasil: successCount,
      gagal: failedCount,
      results,
    });

  } catch (error: any) {
    console.error('API upload-kartu Error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server: ' + error.message }, { status: 500 });
  }
}

async function updateBarcodeId(nis: string, barcodeId: string): Promise<{ status: 'success' | 'nis_not_found' | 'failed'; message: string }> {
  try {
    const [result] = await db.query<ResultSetHeader>(
      'UPDATE murid SET barcode_id = ? WHERE nis = ?',
      [barcodeId, nis]
    );

    if (result.affectedRows > 0) {
      return { status: 'success', message: `Berhasil dipasangkan.` };
    } else {
      return { status: 'nis_not_found', message: `NIS "${nis}" tidak ditemukan di database.` };
    }
  } catch (dbErr: any) {
    return { status: 'failed', message: `Gagal update DB: ${dbErr.message}` };
  }
}
