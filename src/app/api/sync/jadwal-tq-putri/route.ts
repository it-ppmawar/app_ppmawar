import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

const SCHEDULES = [
  // Hj. Iffaturohmah (guru_id: 115)
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Hj. Iffaturohmah' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Hj. Iffaturohmah' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Hj. Iffaturohmah' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Hj. Iffaturohmah' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Hj. Iffaturohmah' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Hj. Iffaturohmah' },

  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Hj. Iffaturohmah' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Hj. Iffaturohmah' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Hj. Iffaturohmah' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Hj. Iffaturohmah' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Hj. Iffaturohmah' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Hj. Iffaturohmah' },

  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Hj. Iffaturohmah' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Hj. Iffaturohmah' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Hj. Iffaturohmah' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Hj. Iffaturohmah' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Hj. Iffaturohmah' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Hj. Iffaturohmah' },

  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Hj. Iffaturohmah' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Hj. Iffaturohmah' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Hj. Iffaturohmah' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Hj. Iffaturohmah' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Hj. Iffaturohmah' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Hj. Iffaturohmah' },

  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Hj. Iffaturohmah' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Hj. Iffaturohmah' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Hj. Iffaturohmah' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Hj. Iffaturohmah' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Hj. Iffaturohmah' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Hj. Iffaturohmah' },

  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Hj. Iffaturohmah' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Hj. Iffaturohmah' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Hj. Iffaturohmah' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Hj. Iffaturohmah' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Hj. Iffaturohmah' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Hj. Iffaturohmah' },

  // Agus H. Abdulloh Faisol (guru_id: 4)
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Senin', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Agus H. Abdulloh Faisol' },

  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Selasa', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Agus H. Abdulloh Faisol' },

  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Rabu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Agus H. Abdulloh Faisol' },

  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Kamis', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Agus H. Abdulloh Faisol' },

  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Sabtu', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Agus H. Abdulloh Faisol' },

  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 1', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 2', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 3', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 4', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 5', guru: 'Agus H. Abdulloh Faisol' },
  { hari: 'Ahad', jam_mulai: '05:00:00', jam_selesai: '06:00:00', kegiatan: 'QUR AN', tempat: 'TQ PUTRI 6', guru: 'Agus H. Abdulloh Faisol' },
];

const TEMPAT_MAP: Record<string, number> = {
  'TQ PUTRI 1': 49,
  'TQ PUTRI 2': 50,
  'TQ PUTRI 3': 51,
  'TQ PUTRI 4': 52,
  'TQ PUTRI 5': 53,
  'TQ PUTRI 6': 54,
};

const GURU_MAP: Record<string, number> = {
  'Hj. Iffaturohmah': 115,
  'Agus H. Abdulloh Faisol': 4,
};

export async function GET() {
  try {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of SCHEDULES) {
      const kelasQuranId = TEMPAT_MAP[item.tempat];
      const guruId = GURU_MAP[item.guru];

      if (!kelasQuranId || !guruId) {
        errors.push(`Mapping gagal untuk: ${item.tempat} / ${item.guru}`);
        skipped++;
        continue;
      }

      const [existing] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM jadwal_quran 
         WHERE kelas_quran_id = ? AND hari = ? AND jam_mulai = ? AND guru_id = ? LIMIT 1`,
        [kelasQuranId, item.hari, item.jam_mulai, guruId]
      );

      if (existing.length > 0) {
        await pool.execute(
          `UPDATE jadwal_quran SET mata_pelajaran = ?, jam_selesai = ? WHERE id = ?`,
          [item.kegiatan, item.jam_selesai, existing[0].id]
        );
        updated++;
      } else {
        await pool.execute(
          `INSERT INTO jadwal_quran (kelas_quran_id, hari, jam_mulai, jam_selesai, mata_pelajaran, guru_id) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [kelasQuranId, item.hari, item.jam_mulai, item.jam_selesai, item.kegiatan, guruId]
        );
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: SCHEDULES.length,
        inserted,
        updated,
        skipped,
        errors
      },
      message: `✅ Sync Jadwal TQ Putri Pagi (05:00 - 06:00) berhasil! ${inserted} ditambahkan, ${updated} diperbarui.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
