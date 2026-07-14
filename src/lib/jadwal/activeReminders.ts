import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export interface ActivePendingReminder {
  jadwal_id: number;
  tipe: 'madin' | 'quran' | 'kamar';
  mata_pelajaran: string;
  kelas_nama: string;
  jam_mulai: string;
  jam_selesai: string;
  guru_id: number;
  guru_nama: string;
  guru_whatsapp: string;
  hari: string;
}

export async function getActivePendingReminders(): Promise<ActivePendingReminder[]> {
  try {
    const localISOTime = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
    const currentTime = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }); // HH:mm:ss

    const formatterDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    let currentDay = formatterDay.format(new Date());
    if (currentDay === 'Minggu') currentDay = 'Ahad';

    const parseTime = (timeStr: string) => {
      const [h, m, s] = timeStr.split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };

    const currentSecs = parseTime(currentTime);

    // 1. Fetch all schedules for today
    // Madin
    const queryMadin = `
      SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
             m.nama_kelas as kelas_nama, j.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
      FROM jadwal_madin j
      JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
      LEFT JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ? AND j.guru_id IS NOT NULL
    `;

    // Quran
    const queryQuran = `
      SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
             q.nama_kelas as kelas_nama, j.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
      FROM jadwal_quran j
      JOIN kelas_quran q ON j.kelas_quran_id = q.id
      LEFT JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ? AND j.guru_id IS NOT NULL
    `;

    // Kegiatan (dorm kamar activities)
    const queryKegiatan = `
      SELECT jk.kegiatan_id as jadwal_id, jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran, jk.hari,
             k.nama_kamar as kelas_nama, jk.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
      FROM jadwal_kegiatan jk
      JOIN kamar k ON jk.kamar_id = k.kamar_id
      LEFT JOIN guru g ON jk.guru_id = g.guru_id
      WHERE jk.hari = ? AND jk.guru_id IS NOT NULL
    `;

    const [madinRows] = await pool.execute<RowDataPacket[]>(queryMadin, [currentDay]);
    const [quranRows] = await pool.execute<RowDataPacket[]>(queryQuran, [currentDay]);
    const [kegiatanRows] = await pool.execute<RowDataPacket[]>(queryKegiatan, [currentDay]);

    const allActiveSchedules: ActivePendingReminder[] = [];

    const processRows = (rows: any[], tipe: 'madin' | 'quran' | 'kamar') => {
      for (const row of rows) {
        const mulaiSecs = parseTime(row.jam_mulai);
        const selesaiSecs = parseTime(row.jam_selesai);

        // Window: 30 minutes before to 3 hours after
        const windowStart = mulaiSecs - 30 * 60;
        const windowEnd = selesaiSecs + 3 * 3600;

        if (currentSecs >= windowStart && currentSecs <= windowEnd) {
          allActiveSchedules.push({
            jadwal_id: row.jadwal_id,
            tipe,
            mata_pelajaran: row.mata_pelajaran || '',
            kelas_nama: row.kelas_nama || '',
            jam_mulai: row.jam_mulai,
            jam_selesai: row.jam_selesai,
            guru_id: row.guru_id,
            guru_nama: row.guru_nama || 'Tanpa Nama',
            guru_whatsapp: row.guru_whatsapp || '',
            hari: row.hari
          });
        }
      }
    };

    processRows(madinRows, 'madin');
    processRows(quranRows, 'quran');
    processRows(kegiatanRows, 'kamar');

    if (allActiveSchedules.length === 0) {
      return [];
    }

    // 2. Batch check attendance for these active schedules
    const madinIds = allActiveSchedules.filter(s => s.tipe === 'madin').map(s => s.jadwal_id);
    const quranIds = allActiveSchedules.filter(s => s.tipe === 'quran').map(s => s.jadwal_id);
    const kamarIds = allActiveSchedules.filter(s => s.tipe === 'kamar').map(s => s.jadwal_id);

    const attendedMadin = new Set<number>();
    const attendedQuran = new Set<number>();
    const attendedKamar = new Set<number>();

    if (madinIds.length > 0) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT jadwal_madin_id FROM absensi WHERE tanggal = ? AND jadwal_madin_id IN (${madinIds.join(',')})`,
        [localISOTime]
      );
      rows.forEach(r => attendedMadin.add(r.jadwal_madin_id));
    }

    if (quranIds.length > 0) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT jadwal_quran_id FROM absensi_quran WHERE tanggal = ? AND jadwal_quran_id IN (${quranIds.join(',')})`,
        [localISOTime]
      );
      rows.forEach(r => attendedQuran.add(r.jadwal_quran_id));
    }

    if (kamarIds.length > 0) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT kegiatan_id FROM absensi_kegiatan WHERE tanggal = ? AND kegiatan_id IN (${kamarIds.join(',')})`,
        [localISOTime]
      );
      rows.forEach(r => attendedKamar.add(r.kegiatan_id));
    }

    // 3. Keep only those schedules that do NOT have attendance recorded
    const pendingReminders = allActiveSchedules.filter(s => {
      if (s.tipe === 'madin') return !attendedMadin.has(s.jadwal_id);
      if (s.tipe === 'quran') return !attendedQuran.has(s.jadwal_id);
      if (s.tipe === 'kamar') return !attendedKamar.has(s.jadwal_id);
      return true;
    });

    return pendingReminders;
  } catch (error) {
    console.error('Error calculating active pending reminders:', error);
    return [];
  }
}
