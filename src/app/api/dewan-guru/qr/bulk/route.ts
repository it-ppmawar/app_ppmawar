import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import QRCode from 'qrcode';
import { RowDataPacket } from 'mysql2';
import AdmZip from 'adm-zip';
import { jsPDF } from 'jspdf';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && payload.role !== 'staff' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'zip'; // 'zip' or 'pdf'
    const homebase = searchParams.get('homebase');

    let query = `SELECT id, nip, nama, homebase, qr_token FROM dewan_guru WHERE aktif = 1`;
    const params: any[] = [];
    if (homebase && homebase !== 'SEMUA') {
      query += ` AND homebase = ?`;
      params.push(homebase);
    }
    query += ` ORDER BY homebase ASC, nama ASC`;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data guru yang ditemukan.' }, { status: 404 });
    }

    const host = request.headers.get('host') || 'app.ppmawar.or.id';
    const proto = request.headers.get('x-forwarded-proto') || 'https';

    // ─────────────────────────────────────────────────────────────
    // 1. TYPE = ZIP
    // ─────────────────────────────────────────────────────────────
    if (type === 'zip') {
      const zip = new AdmZip();

      for (let i = 0; i < rows.length; i++) {
        const g = rows[i];
        const qrValue = `${proto}://${host}/absen/guru?token=${encodeURIComponent(g.qr_token)}`;
        const qrBuffer = await QRCode.toBuffer(qrValue, {
          width: 400,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' }
        });

        const safeHomebase = (g.homebase || 'LAINNYA').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeName = (g.nama || 'guru').replace(/[^a-zA-Z0-9_-]/g, '_');
        const noPad = String(i + 1).padStart(3, '0');
        const entryPath = `${safeHomebase}/${noPad}_${safeName}.png`;

        zip.addFile(entryPath, qrBuffer);
      }

      const zipBuffer = zip.toBuffer();
      const zipName = `QR_Dewan_Guru_${homebase && homebase !== 'SEMUA' ? homebase.replace(/[^a-zA-Z0-9_-]/g, '_') : 'YPMA_Lengkap'}.zip`;

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipName}"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. TYPE = PDF (Printable A4 Sheet: 3 columns x 3 rows per page)
    // ─────────────────────────────────────────────────────────────
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

    const cols = 3;
    const rowsPerPage = 3;
    const cardWidth = 58;
    const cardHeight = 82;
    const marginX = (pageWidth - cols * cardWidth) / (cols + 1); // ~9mm
    const marginY = 16;
    const gapY = (pageHeight - marginY * 2 - rowsPerPage * cardHeight) / (rowsPerPage - 1); // ~8mm

    for (let i = 0; i < rows.length; i++) {
      const pageIndex = Math.floor(i / (cols * rowsPerPage));
      const cardIndexInPage = i % (cols * rowsPerPage);
      const colIndex = cardIndexInPage % cols;
      const rowIndex = Math.floor(cardIndexInPage / cols);

      if (i > 0 && cardIndexInPage === 0) {
        doc.addPage();
      }

      // Header halaman
      if (cardIndexInPage === 0) {
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text("KARTU PRESENSI QR DEWAN GURU - PP. MATHOLI'UL ANWAR", pageWidth / 2, 9, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const subTitle = homebase && homebase !== 'SEMUA' ? `Unit: ${homebase} | Halaman ${pageIndex + 1}` : `Halaman ${pageIndex + 1}`;
        doc.text(subTitle, pageWidth / 2, 13, { align: 'center' });
      }

      const x = marginX + colIndex * (cardWidth + marginX);
      const y = marginY + rowIndex * (cardHeight + gapY);

      const g = rows[i];
      const qrValue = `${proto}://${host}/absen/guru?token=${encodeURIComponent(g.qr_token)}`;
      const qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 300,
        margin: 1,
        color: { dark: '#042f2e', light: '#ffffff' }
      });

      // Card Container (Rounded rectangle with border)
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

      // Card Header Banner
      doc.setFillColor(15, 118, 110); // Teal 700
      doc.roundedRect(x, y, cardWidth, 12, 3, 3, 'F');
      doc.rect(x, y + 8, cardWidth, 4, 'F'); // Fill bottom corners of header

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text("PP. MATHOLI'UL ANWAR", x + cardWidth / 2, y + 5.5, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(g.homebase || 'YPMA', x + cardWidth / 2, y + 9.5, { align: 'center' });

      // QR Code Image in center
      const qrSize = 42;
      const qrX = x + (cardWidth - qrSize) / 2;
      const qrY = y + 14;
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // Guru Name below QR
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);

      // Split name if too long
      const splitName = doc.splitTextToSize(g.nama || 'Dewan Guru', cardWidth - 6);
      doc.text(splitName, x + cardWidth / 2, y + 60, { align: 'center' });

      // Bottom footer info
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      if (g.nip) {
        doc.text(`NIP: ${g.nip}`, x + cardWidth / 2, y + 74, { align: 'center' });
      } else {
        doc.text('Kartu Presensi Resmi', x + cardWidth / 2, y + 74, { align: 'center' });
      }
      doc.text('Scan untuk Absensi Kehadiran', x + cardWidth / 2, y + 77.5, { align: 'center' });
    }

    const pdfBuffer = doc.output('arraybuffer');
    const pdfName = `Katalog_QR_Guru_${homebase && homebase !== 'SEMUA' ? homebase.replace(/[^a-zA-Z0-9_-]/g, '_') : 'YPMA'}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfName}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error: any) {
    console.error('[dewan-guru-qr-bulk] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
