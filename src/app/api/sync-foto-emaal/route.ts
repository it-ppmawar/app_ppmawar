import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// Script satu kali: update kolom foto di tabel murid dari folder EMAAL2
// Hanya untuk keperluan sync, hapus file ini setelah dijalankan
export async function GET() {
  const updates = [
    { nis: '2023080538', foto: 'foto_2023080538.jpg' },
    { nis: '2023080636', foto: 'foto_2023080636.jpg' },
    { nis: '2025080670', foto: 'foto_2025080670.jpg' },
    { nis: '2026050011', foto: 'foto_2026050011.jpg' },
    { nis: '2026050050', foto: 'foto_2026050050.jpg' },
    { nis: '2026050116', foto: 'foto_2026050116.jpg' },
    { nis: '2026050122', foto: 'foto_2026050122.jpg' },
    { nis: '2026060151', foto: 'foto_2026060151.jpg' },
    { nis: '2026060158', foto: 'foto_2026060158.jpg' },
    { nis: '2026060162', foto: 'foto_2026060162.jpg' },
    { nis: '2026060173', foto: 'foto_2026060173.jpg' },
    { nis: '2026060181', foto: 'foto_2026060181.jpg' },
    { nis: '2026060195', foto: 'foto_2026060195.jpg' },
    { nis: '2026060204', foto: 'foto_2026060204.jpg' },
    { nis: '2026060229', foto: 'foto_2026060229.jpg' },
    { nis: '2026060248', foto: 'foto_2026060248.jpg' },
    { nis: '2026060254', foto: 'foto_2026060254.jpg' },
    { nis: '2026060278', foto: 'foto_2026060278.jpg' },
    { nis: '2026060284', foto: 'foto_2026060284.jpg' },
    { nis: '2026060294', foto: 'foto_2026060294.jpg' },
    { nis: '2026060295', foto: 'foto_2026060295.jpg' },
    { nis: '2026060296', foto: 'foto_2026060296.jpg' },
    { nis: '2026060299', foto: 'foto_2026060299.jpg' },
    { nis: '2026070322', foto: 'foto_2026070322.jpg' },
    { nis: '2026070341', foto: 'foto_2026070341.jpg' },
    { nis: '2026070354', foto: 'foto_2026070354.jpg' },
    { nis: '2026070358', foto: 'foto_2026070358.jpg' },
    { nis: '2026070361', foto: 'foto_2026070361.jpg' },
    { nis: '2026070390', foto: 'foto_2026070390.jpg' },
    { nis: '2026070391', foto: 'foto_2026070391.jpg' },
    { nis: '2026070392', foto: 'foto_2026070392.jpg' },
    { nis: '2026070410', foto: 'foto_2026070410.jpg' },
    { nis: '2026070420', foto: 'foto_2026070420.jpg' },
    { nis: '2026070421', foto: 'foto_2026070421.jpg' },
    { nis: '2026070426', foto: 'foto_2026070426.jpg' },
    { nis: '2026070428', foto: 'foto_2026070428.jpg' },
    { nis: '2026070429', foto: 'foto_2026070429.jpg' },
    { nis: '2026070430', foto: 'foto_2026070430.jpg' },
    { nis: '2026070500', foto: 'foto_2026070500.jpg' },
    { nis: '2026070501', foto: 'foto_2026070501.jpg' },
    { nis: '2026070581', foto: 'foto_2026070581.jpg' },
    { nis: '2026070621', foto: 'foto_2026070621.jpg' },
    { nis: '2026070625', foto: 'foto_2026070625.jpg' },
    { nis: '2026080632', foto: 'foto_2026080632.jpg' },
    { nis: '2506020001', foto: 'foto_2506020001.jpg' },
    { nis: '2506020002', foto: 'foto_2506020002.jpg' },
    { nis: '2506020003', foto: 'foto_2506020003.jpg' },
  ];

  let updated = 0;
  let notFound = 0;
  const notFoundList: string[] = [];

  for (const row of updates) {
    const [result]: any = await pool.execute(
      'UPDATE murid SET foto = ? WHERE nis = ?',
      [row.foto, row.nis]
    );
    if (result.affectedRows > 0) {
      updated++;
    } else {
      notFound++;
      notFoundList.push(row.nis);
    }
  }

  return NextResponse.json({
    success: true,
    total: updates.length,
    updated,
    notFound,
    notFoundList,
    message: `✅ ${updated} foto berhasil disinkronkan ke database. ${notFound} NIS tidak ditemukan di tabel murid.`
  });
}
