import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

const NAMA_BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token rekapitulasi Kepala Madin tidak ditemukan' }, { status: 400 });
    }

    const payload = verifyToken(token) as any;
    if (!payload || payload.type !== 'rekap_kepala_madin') {
      return NextResponse.json({ error: 'Tautan laporan telah kedaluwarsa atau tidak valid' }, { status: 401 });
    }

    const bulan = Number(payload.bulan || new Date().getMonth() + 1);
    const tahun = Number(payload.tahun || new Date().getFullYear());
    const targetWilayah: 'putra' | 'putri' | 'all' = payload.target_wilayah || 'all';

    let targetWhere = '';
    if (targetWilayah === 'putra') {
      targetWhere = `WHERE (km.nama_kelas LIKE '%PUTRA%' OR km.nama_kelas LIKE '%PA%')`;
    } else if (targetWilayah === 'putri') {
      targetWhere = `WHERE (km.nama_kelas LIKE '%PUTRI%' OR km.nama_kelas LIKE '%PI%')`;
    }

    // 1. Ambil guru yang memiliki jadwal Madin aktif sesuai sasaran wilayah
    const [madinTeachers] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT g.guru_id, g.nama, g.nip, g.no_hp, g.foto, g.jabatan, g.jenis_kelamin,
              km.nama_kelas as kelas_nama, jm.mata_pelajaran, jm.hari, jm.jam_mulai, jm.jam_selesai
       FROM jadwal_madin jm
       JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
       JOIN guru g ON jm.guru_id = g.guru_id
       ${targetWhere}
       ORDER BY g.nama ASC, km.nama_kelas ASC`
    );

    // Grouping per guru
    const teacherMap = new Map<number, {
      guru_id: number;
      nama: string;
      nip: string;
      no_hp: string;
      foto: string;
      jabatan: string;
      jenis_kelamin: string;
      classes: { kelas_nama: string; mata_pelajaran: string; jadwal: string }[];
    }>();

    for (const row of madinTeachers) {
      const gid = row.guru_id;
      if (!teacherMap.has(gid)) {
        teacherMap.set(gid, {
          guru_id: gid,
          nama: row.nama,
          nip: row.nip,
          no_hp: row.no_hp,
          foto: row.foto,
          jabatan: row.jabatan || 'Guru Madin',
          jenis_kelamin: row.jenis_kelamin,
          classes: [],
        });
      }
      teacherMap.get(gid)!.classes.push({
        kelas_nama: row.kelas_nama,
        mata_pelajaran: row.mata_pelajaran,
        jadwal: `${row.hari} (${row.jam_mulai?.slice(0, 5)} - ${row.jam_selesai?.slice(0, 5)})`,
      });
    }

    const teacherList = Array.from(teacherMap.values());
    if (teacherList.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          periode: { bulan, tahun, bulan_nama: NAMA_BULAN[bulan] || `Bulan ${bulan}` },
          summary: { total_guru: 0, total_hadir: 0, total_izin: 0, total_sakit: 0, total_alpha: 0, avg_attendance_pct: 0 },
          teachers: [],
        }
      });
    }

    // 2. Ambil absensi seluruh guru Madin ini di bulan & tahun terpilih
    const guruIds = teacherList.map(t => t.guru_id);
    const placeholders = guruIds.map(() => '?').join(',');
    const [attRows] = await pool.execute<RowDataPacket[]>(
      `SELECT guru_id,
        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
        COUNT(*) as total_sesi
       FROM absensi_guru
       WHERE guru_id IN (${placeholders}) AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?
       GROUP BY guru_id`,
      [...guruIds, bulan, tahun]
    );

    const attMap = new Map<number, any>();
    for (const r of attRows) {
      attMap.set(r.guru_id, r);
    }

    let grandHadir = 0;
    let grandIzin = 0;
    let grandSakit = 0;
    let grandAlpha = 0;
    let grandSesi = 0;

    const teachersWithAtt = teacherList.map(t => {
      const a = attMap.get(t.guru_id) || { hadir: 0, izin: 0, sakit: 0, alpha: 0, total_sesi: 0 };
      const hadir = Number(a.hadir || 0);
      const izin = Number(a.izin || 0);
      const sakit = Number(a.sakit || 0);
      const alpha = Number(a.alpha || 0);
      const totalSesi = hadir + izin + sakit + alpha;
      const pct = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 0;

      grandHadir += hadir;
      grandIzin += izin;
      grandSakit += sakit;
      grandAlpha += alpha;
      grandSesi += totalSesi;

      return {
        ...t,
        attendance: {
          hadir,
          izin,
          sakit,
          alpha,
          total_sesi: totalSesi,
          percentage: pct,
        }
      };
    });

    const avgPct = grandSesi > 0 ? Math.round((grandHadir / grandSesi) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        periode: {
          bulan,
          tahun,
          bulan_nama: NAMA_BULAN[bulan] || `Bulan ${bulan}`,
          wilayah: targetWilayah,
        },
        summary: {
          total_guru: teachersWithAtt.length,
          total_sesi: grandSesi,
          total_hadir: grandHadir,
          total_izin: grandIzin,
          total_sakit: grandSakit,
          total_alpha: grandAlpha,
          avg_attendance_pct: avgPct,
        },
        teachers: teachersWithAtt,
      }
    });

  } catch (error: any) {
    console.error('[rekapitulasi/kepala-madin] Error:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
