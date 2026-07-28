import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    if (payload.role !== 'admin' && payload.role !== 'staff') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tanggal = searchParams.get('tanggal');
    const targetDate = tanggal || new Date().toLocaleDateString('en-CA');

    const d = new Date(targetDate + 'T00:00:00');
    const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hari = days[d.getDay()];

    // Ambil semua guru
    const [guruRows] = await pool.execute<RowDataPacket[]>(
      `SELECT g.guru_id, g.nip, g.nama, g.foto FROM guru g ORDER BY g.nama ASC`
    );

    // Jadwal Madin
    const [jadwalMadin] = await pool.execute<RowDataPacket[]>(
      `SELECT j.jadwal_id, j.guru_id, j.hari, j.jam_mulai, j.jam_selesai,
              j.mata_pelajaran, m.nama_kelas, 'madin' as tipe, NULL as nama_asrama
       FROM jadwal_madin j
       JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
       WHERE j.hari = ?
       ORDER BY j.jam_mulai ASC`,
      [hari]
    );

    // Jadwal Quran
    const [jadwalQuran] = await pool.execute<RowDataPacket[]>(
      `SELECT j.id as jadwal_id, j.guru_id, j.hari, j.jam_mulai, j.jam_selesai,
              j.mata_pelajaran, q.nama_kelas, 'quran' as tipe, NULL as nama_asrama
       FROM jadwal_quran j
       JOIN kelas_quran q ON j.kelas_quran_id = q.id
       WHERE j.hari = ?
       ORDER BY j.jam_mulai ASC`,
      [hari]
    );

    // Jadwal Kegiatan Asrama
    let jadwalKegiatan: RowDataPacket[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.kegiatan_id as jadwal_id, j.guru_id, j.hari, j.jam_mulai, j.jam_selesai,
                j.nama_kegiatan as mata_pelajaran, k.nama_kamar as nama_kelas,
                'kegiatan' as tipe, k.nama_asrama
         FROM jadwal_kegiatan j
         JOIN kamar k ON j.kamar_id = k.kamar_id
         WHERE j.hari = ?
         ORDER BY j.jam_mulai ASC`,
        [hari]
      );
      jadwalKegiatan = rows;
    } catch (e: any) {
      console.error('[absen-guru] Error fetching jadwal_kegiatan:', e.message);
    }

    // Absensi guru hari ini
    const [absensiRows] = await pool.execute<RowDataPacket[]>(
      `SELECT ag.guru_id, ag.status, ag.keterangan, ag.tanggal,
              j.mata_pelajaran, j.jam_mulai, j.jam_selesai, m.nama_kelas,
              'madin' as tipe
       FROM absensi_guru ag
       JOIN jadwal_madin j ON ag.jadwal_madin_id = j.jadwal_id
       JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
       WHERE ag.tanggal = ?
       UNION ALL
       SELECT ag.guru_id, ag.status, ag.keterangan, ag.tanggal,
              j.mata_pelajaran, j.jam_mulai, j.jam_selesai, q.nama_kelas,
              'quran' as tipe
       FROM absensi_guru ag
       JOIN jadwal_quran j ON ag.jadwal_quran_id = j.id
       JOIN kelas_quran q ON j.kelas_quran_id = q.id
       WHERE ag.tanggal = ?
       UNION ALL
       SELECT ag.guru_id, ag.status, ag.keterangan, ag.tanggal,
              j.nama_kegiatan as mata_pelajaran, j.jam_mulai, j.jam_selesai, k.nama_kamar as nama_kelas,
              'kegiatan' as tipe
       FROM absensi_guru ag
       JOIN jadwal_kegiatan j ON ag.kegiatan_id = j.kegiatan_id
       JOIN kamar k ON j.kamar_id = k.kamar_id
       WHERE ag.tanggal = ?`,
      [targetDate, targetDate, targetDate]
    );

    const allJadwal = [
      ...(jadwalMadin as any[]),
      ...(jadwalQuran as any[]),
      ...(jadwalKegiatan as any[]),
    ];

    const guruMap = (guruRows as any[]).map((guru: any) => {
      const jadwalGuru = allJadwal.filter((j: any) => j.guru_id === guru.guru_id);
      const absensiGuru = (absensiRows as any[]).filter((a: any) => a.guru_id === guru.guru_id);

      const jadwalWithStatus = jadwalGuru.map((j: any) => {
        const match = absensiGuru.find(
          (a: any) =>
            a.mata_pelajaran === j.mata_pelajaran &&
            a.jam_mulai === j.jam_mulai &&
            a.tipe === j.tipe
        );
        return {
          jadwal_id: j.jadwal_id,
          tipe: j.tipe,
          jam_mulai: j.jam_mulai,
          jam_selesai: j.jam_selesai,
          mata_pelajaran: j.mata_pelajaran,
          nama_kelas: j.nama_kelas,
          nama_asrama: j.nama_asrama || null,
          status: match?.status || null,
          keterangan: match?.keterangan || null,
        };
      });

      const totalJadwal = jadwalGuru.length;
      const hadirCount = jadwalWithStatus.filter((j: any) => j.status === 'Hadir').length;
      const izinCount = jadwalWithStatus.filter((j: any) => j.status === 'Izin').length;
      const sakitCount = jadwalWithStatus.filter((j: any) => j.status === 'Sakit').length;
      const alphaCount = jadwalWithStatus.filter((j: any) => j.status === 'Alpha').length;
      const belumAbsenCount = jadwalWithStatus.filter((j: any) => j.status === null).length;

      return {
        guru_id: guru.guru_id,
        nip: guru.nip,
        nama: guru.nama,
        foto: guru.foto,
        totalJadwal,
        hadirCount,
        izinCount,
        sakitCount,
        alphaCount,
        belumAbsenCount,
        jadwal: jadwalWithStatus,
      };
    });

    // Build flat kegiatanJadwal list (ALL entries, including those with no guru)
    const kegiatanJadwal = (jadwalKegiatan as any[]).map((j: any) => {
      const guru = (guruRows as any[]).find((g: any) => g.guru_id === j.guru_id);
      const match = (absensiRows as any[]).find(
        (a: any) =>
          a.mata_pelajaran === j.mata_pelajaran &&
          a.jam_mulai === j.jam_mulai &&
          a.tipe === j.tipe
      );
      return {
        jadwal_id: j.jadwal_id,
        tipe: 'kegiatan',
        jam_mulai: j.jam_mulai,
        jam_selesai: j.jam_selesai,
        mata_pelajaran: j.mata_pelajaran || '—',
        nama_kelas: j.nama_kelas || '—',
        nama_asrama: j.nama_asrama || null,
        status: match?.status || null,
        keterangan: match?.keterangan || null,
        guru_id: guru?.guru_id || 0,
        guru_nama: guru?.nama || 'Belum Ditugaskan',
        guru_foto: guru?.foto || null,
        guru_nip: guru?.nip || '',
      };
    });

    return NextResponse.json({ success: true, tanggal: targetDate, hari, data: guruMap, kegiatanJadwal });
  } catch (error: any) {
    console.error('[absen-guru] Error:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
