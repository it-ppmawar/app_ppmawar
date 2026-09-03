import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { resolveAsrama } from '@/lib/auth/resolveAsrama';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, userId, username } = payload as any;
    const tokenAsrama = (payload as any).namaAsrama || null;
    const namaAsrama = (role === 'pengurus_asrama' || role === 'pengasuh')
      ? await resolveAsrama(userId, role, username || '', tokenAsrama)
      : tokenAsrama;

    if (role === 'wali_murid' || role === 'wali_alumni') {
      return NextResponse.json({ error: 'Akses ditolak. Wali murid/alumni tidak memiliki akses ke fitur absensi.' }, { status: 403 });
    }

    if (role === 'guru' && !guruId) {
      return NextResponse.json({ error: 'Guru ID tidak ditemukan' }, { status: 400 });
    }

    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentTime = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }); // HH:mm:ss WIB
    const rawDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentDay = rawDay === 'Minggu' ? 'Ahad' : rawDay;

    let queryMadin = `
      SELECT j.jadwal_id, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, 
             j.kelas_madin_id as kelas_id, m.nama_kelas, 'madin' as tipe,
             j.guru_id, g.nama as nama_guru
      FROM jadwal_madin j
      JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
      LEFT JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ?
    `;
    
    let queryQuran = `
      SELECT j.id as jadwal_id, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, 
             j.kelas_quran_id as kelas_id, q.nama_kelas, 'quran' as tipe,
             j.guru_id, g.nama as nama_guru
      FROM jadwal_quran j
      JOIN kelas_quran q ON j.kelas_quran_id = q.id
      LEFT JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ?
    `;

    let queryKegiatan = `
      SELECT j.kegiatan_id as jadwal_id, j.hari, j.jam_mulai, j.jam_selesai, j.nama_kegiatan as mata_pelajaran, 
             j.kamar_id as kelas_id, k.nama_kamar as nama_kelas, 'kegiatan' as tipe,
             j.guru_id, g.nama as nama_guru
      FROM jadwal_kegiatan j
      JOIN kamar k ON j.kamar_id = k.kamar_id
      LEFT JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ?
    `;

    let paramsMadin: any[] = [currentDay];
    let paramsQuran: any[] = [currentDay];
    let paramsKegiatan: any[] = [currentDay];

    if (role === 'guru') {
      queryMadin += ` AND j.guru_id = ?`;
      paramsMadin.push(guruId);
      
      queryQuran += ` AND j.guru_id = ?`;
      paramsQuran.push(guruId);

      queryKegiatan += ` AND j.guru_id = ?`;
      paramsKegiatan.push(guruId);
    } else if (role === 'pengurus_asrama' || role === 'pengasuh') {
      if (namaAsrama) {
        if (role === 'pengasuh') {
          // Pengasuh hanya untuk asrama/kegiatan pesantren, bukan madrasah (madin/quran)
          queryMadin += ` AND 0=1`;
          queryQuran += ` AND 0=1`;
        } else {
          // Hanya jadwal madin yang ada santri dari asrama ini
          queryMadin += ` AND j.kelas_madin_id IN (
            SELECT DISTINCT m.kelas_madin_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_madin_id IS NOT NULL
          )`;
          paramsMadin.push(namaAsrama);

          // Hanya jadwal quran yang ada santri dari asrama ini (filter per asrama) OR nama_kelas mengandung nama asrama
          queryQuran += ` AND (j.kelas_quran_id IN (
            SELECT DISTINCT m.kelas_quran_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
          ) OR j.kelas_quran_id IN (
            SELECT id FROM kelas_quran WHERE nama_kelas LIKE ?
          ))`;
          paramsQuran.push(namaAsrama, `%${namaAsrama}%`);
        }

        // Hanya kegiatan untuk kamar di asrama ini
        queryKegiatan += ` AND j.kamar_id IN (
          SELECT kamar_id FROM kamar WHERE nama_asrama = ?
        )`;
        paramsKegiatan.push(namaAsrama);
      } else {
        // Jika namaAsrama tidak ada, tidak ada jadwal yang ditampilkan
        queryMadin += ` AND 0=1`;
        queryQuran += ` AND 0=1`;
        queryKegiatan += ` AND 0=1`;
      }
    }

    const [madinRows] = await pool.execute<RowDataPacket[]>(queryMadin, paramsMadin);
    const [quranRows] = await pool.execute<RowDataPacket[]>(queryQuran, paramsQuran);
    const [kegiatanRows] = await pool.execute<RowDataPacket[]>(queryKegiatan, paramsKegiatan);

    const allSchedules = [...madinRows, ...quranRows, ...kegiatanRows];

    // Helper to parse HH:mm:ss to seconds
    const parseTime = (timeStr: string) => {
      const [h, m, s] = timeStr.split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };

    const currentSecs = parseTime(currentTime);
    // Cek absensi yang sudah diisi hari ini untuk setiap jadwal
    const schedulesWithStatus = await Promise.all(allSchedules.map(async (sched) => {
      const mulaiSecs = parseTime(sched.jam_mulai);
      const selesaiSecs = parseTime(sched.jam_selesai);
      const windowStart = mulaiSecs - 30 * 60;
      const windowEnd = selesaiSecs + 3 * 3600;
      const isActive = currentSecs >= windowStart && currentSecs <= windowEnd;
      const isPast = currentSecs > windowEnd;

      // Cek apakah sudah ada record absensi hari ini
      let sudah_absen = false;
      try {
        let checkQuery = '';
        let checkParams: any[] = [sched.jadwal_id, todayStr];
        if (sched.tipe === 'madin') checkQuery = 'SELECT 1 FROM absensi WHERE jadwal_madin_id = ? AND tanggal = ? LIMIT 1';
        else if (sched.tipe === 'quran') checkQuery = 'SELECT 1 FROM absensi_quran WHERE jadwal_quran_id = ? AND tanggal = ? LIMIT 1';
        else if (sched.tipe === 'kegiatan') checkQuery = 'SELECT 1 FROM absensi_kegiatan WHERE kegiatan_id = ? AND tanggal = ? LIMIT 1';
        if (checkQuery) {
          const [checkRows] = await pool.execute<RowDataPacket[]>(checkQuery, checkParams);
          sudah_absen = checkRows.length > 0;
        }
      } catch (e) { /* abaikan error cek */ }

      return {
        ...sched,
        status: isActive ? 'aktif' : (isPast ? 'selesai' : 'menunggu'),
        sudah_absen,
      };
    }));

    // Sort by jam_mulai
    schedulesWithStatus.sort((a: any, b: any) => a.jam_mulai.localeCompare(b.jam_mulai));

    // ===== MERGE KELAS GABUNGAN =====
    // Guru yang mengajar lebih dari 1 kelas pada jam & tipe yang sama → digabung jadi 1 kartu
    const mergedMap = new Map<string, any>();
    for (const sched of schedulesWithStatus as any[]) {
      const effGuru = sched.guru_id || (role === 'guru' ? guruId : null);
      const guruKey = effGuru
        ? `${sched.tipe}_${effGuru}_${sched.hari}_${sched.jam_mulai}_${sched.jam_selesai}`
        : `${sched.tipe}_${(sched.mata_pelajaran || '').trim()}_${sched.hari}_${sched.jam_mulai}_${sched.jam_selesai}`;

      if (mergedMap.has(guruKey)) {
        const existing = mergedMap.get(guruKey)!;
        // Gabungkan nama kelas (hindari duplikat)
        if (!existing._kelas_names.includes(sched.nama_kelas)) {
          existing._kelas_names.push(sched.nama_kelas);
          existing.nama_kelas = existing._kelas_names.join(' & ');
        }
        // Gabungkan mata pelajaran (hindari duplikat)
        if (sched.mata_pelajaran && !existing._mapel_names.includes(sched.mata_pelajaran)) {
          existing._mapel_names.push(sched.mata_pelajaran);
          existing.mata_pelajaran = existing._mapel_names.join(' & ');
        }
        // Gabungkan jadwal_ids dan kelas_ids
        if (!existing.jadwal_ids.includes(sched.jadwal_id)) existing.jadwal_ids.push(sched.jadwal_id);
        if (!existing.kelas_ids.includes(sched.kelas_id)) existing.kelas_ids.push(sched.kelas_id);
        if (!existing.nama_guru && sched.nama_guru) existing.nama_guru = sched.nama_guru;
        // Jika salah satu sudah diisi, anggap sudah diisi
        if (sched.sudah_absen) existing.sudah_absen = true;
      } else {
        mergedMap.set(guruKey, {
          ...sched,
          jadwal_ids: [sched.jadwal_id],
          kelas_ids: [sched.kelas_id],
          _kelas_names: [sched.nama_kelas],
          _mapel_names: sched.mata_pelajaran ? [sched.mata_pelajaran] : [],
        });
      }
    }

    const mergedSchedules = Array.from(mergedMap.values()).map(({ _kelas_names, _mapel_names, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      hari: currentDay,
      waktu: currentTime,
      data: mergedSchedules
    });

  } catch (error: any) {
    console.error('Error API Jadwal Absen:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
