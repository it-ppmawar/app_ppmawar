import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const queryToken = searchParams.get("token") || searchParams.get("t");
    const token = queryToken || cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: "Token invalid atau telah kedaluwarsa" }, { status: 401, headers: noCacheHeaders });

    const tipe = payload.tipe || searchParams.get("tipe") || "madin";
    const isGuruTipe = tipe === "guru" || tipe === "dewan_guru";
    let murid_id = !isGuruTipe && tipe !== 'guru_mapel'
      ? ((payload.muridId ? String(payload.muridId) : null) || (payload.murid_id ? String(payload.murid_id) : null) || searchParams.get("murid_id"))
      : null;
    let guru_id = (isGuruTipe || tipe === 'guru_mapel' || payload.guru_id)
      ? ((payload.guru_id ? String(payload.guru_id) : null) || (payload.guruId ? String(payload.guruId) : null) || (payload.muridId ? String(payload.muridId) : null) || searchParams.get("guru_id"))
      : searchParams.get("guru_id");

    const isGuruMapel = tipe === 'guru_mapel' || payload.tipe === 'guru_mapel' || (!murid_id && !!guru_id && (payload.purpose === 'rekap_preview' || payload.role === 'guru'));

    let effectiveTipe = tipe;
    if (guru_id && !murid_id && !isGuruTipe && !isGuruMapel) {
      effectiveTipe = 'guru';
    }

    const now = new Date();
    const bulan = payload.bulan || searchParams.get("bulan") || String(now.getMonth() + 1);
    const tahun = payload.tahun || searchParams.get("tahun") || String(now.getFullYear());
    const tanggal_dari = payload.tanggal_dari || searchParams.get("tanggal_dari");
    const tanggal_sampai = payload.tanggal_sampai || searchParams.get("tanggal_sampai");
    const sub_filter = payload.sub_filter || searchParams.get("sub_filter") || "";
    const kategori = payload.kategori || searchParams.get("kategori") || "all";

    if ((payload.role === 'wali_murid' || payload.role === 'wali_alumni') && !isGuruTipe && !isGuruMapel) {
      if (!payload.muridId && !murid_id) {
        return NextResponse.json({ error: "Murid ID tidak valid" }, { status: 400, headers: noCacheHeaders });
      }
      if (payload.muridId) murid_id = String(payload.muridId);
      guru_id = null; // Wali murid tidak boleh mengakses detail presensi guru
    }

    if (!murid_id && !guru_id) {
      return NextResponse.json({ error: "murid_id atau guru_id diperlukan" }, { status: 400, headers: noCacheHeaders });
    }

    const isRentang = !!(tanggal_dari && tanggal_sampai);

    // =========================================================================
    // KHUSUS GURU MAPEL: Tampilkan daftar santri per mapel & kelas yang diampu guru
    // Jika guru mengajar >1 mapel/kelas, seluruhnya digabung dalam 1 halaman dengan pemisah
    // =========================================================================
    if (isGuruMapel && guru_id) {
      const [gRows]: any = await pool.execute(
        `SELECT guru_id, nama, nip, no_hp, foto, alamat FROM guru WHERE guru_id = ? LIMIT 1`,
        [guru_id]
      );
      const guruData = gRows && gRows[0] ? gRows[0] : { guru_id, nama: 'Guru Pengajar', nip: '-', no_hp: '', foto: '' };

      const dateCond = isRentang ? 'a.tanggal BETWEEN ? AND ?' : 'MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?';
      const dateParams = isRentang ? [tanggal_dari, tanggal_sampai] : [bulan, tahun];

      const schedulesList: any[] = [];

      // A. Madin
      if (kategori === 'all' || kategori === 'madin') {
        const [madinSchedules]: any = await pool.execute(
          `SELECT jm.jadwal_id, jm.mata_pelajaran, jm.kelas_madin_id as kelas_id, km.nama_kelas, 'madin' as kategori, 'Madrasah Diniyah' as kategori_label
           FROM jadwal_madin jm
           JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
           WHERE jm.guru_id = ?
           ORDER BY km.nama_kelas ASC, jm.mata_pelajaran ASC`,
          [guru_id]
        );
        schedulesList.push(...(madinSchedules || []));
      }

      // B. Quran
      if (kategori === 'all' || kategori === 'quran') {
        const [quranSchedules]: any = await pool.execute(
          `SELECT jq.id as jadwal_id, COALESCE(jq.mata_pelajaran, "Majlis Al-Qur'an") as mata_pelajaran, jq.kelas_quran_id as kelas_id, kq.nama_kelas, 'quran' as kategori, "Al-Qur'an" as kategori_label
           FROM jadwal_quran jq
           JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
           WHERE jq.guru_id = ?
           ORDER BY kq.nama_kelas ASC, jq.mata_pelajaran ASC`,
          [guru_id]
        );
        schedulesList.push(...(quranSchedules || []));
      }

      // C. Kegiatan
      if (kategori === 'all' || kategori === 'kegiatan') {
        const [kegiatanSchedules]: any = await pool.execute(
          `SELECT jk.kegiatan_id as jadwal_id, jk.nama_kegiatan as mata_pelajaran, jk.kamar_id as kelas_id, k.nama_kamar as nama_kelas, 'kegiatan' as kategori, 'Asrama' as kategori_label
           FROM jadwal_kegiatan jk
           JOIN kamar k ON jk.kamar_id = k.kamar_id
           WHERE jk.guru_id = ?
           ORDER BY k.nama_kamar ASC, jk.nama_kegiatan ASC`,
          [guru_id]
        );
        schedulesList.push(...(kegiatanSchedules || []));
      }

      interface MapelSection {
        section_key: string;
        section_title: string;
        kategori: string;
        kategori_label: string;
        kelas_id: any;
        kelas_nama: string;
        mata_pelajaran: string;
        jadwal_ids: any[];
      }
      const sectionsMap = new Map<string, MapelSection>();

      for (const s of schedulesList) {
        const secKey = `${s.kategori}_${s.kelas_id}_${String(s.mata_pelajaran || '').trim().toLowerCase()}`;
        if (!sectionsMap.has(secKey)) {
          sectionsMap.set(secKey, {
            section_key: secKey,
            section_title: `--- KELAS ${String(s.nama_kelas || '').toUpperCase()} • MAPEL: ${String(s.mata_pelajaran || '').toUpperCase()} ---`,
            kategori: s.kategori,
            kategori_label: s.kategori_label,
            kelas_id: s.kelas_id,
            kelas_nama: s.nama_kelas,
            mata_pelajaran: s.mata_pelajaran,
            jadwal_ids: [s.jadwal_id],
          });
        } else {
          sectionsMap.get(secKey)!.jadwal_ids.push(s.jadwal_id);
        }
      }

      const allStudentsRows: any[] = [];
      let totalSemuaSantri = 0;
      let grandHadir = 0;
      let grandIzin = 0;
      let grandSakit = 0;
      let grandAlpha = 0;

      for (const sec of Array.from(sectionsMap.values())) {
        let studentsInClass: any[] = [];
        if (sec.kategori === 'madin') {
          const [mList]: any = await pool.execute(
            `SELECT murid_id, nis, nama, foto, jenis_kelamin FROM murid WHERE (kelas_madin_id = ? OR kelas_madin_2_id = ?) ORDER BY nama ASC`,
            [sec.kelas_id, sec.kelas_id]
          );
          studentsInClass = mList || [];
        } else if (sec.kategori === 'quran') {
          const [mList]: any = await pool.execute(
            `SELECT murid_id, nis, nama, foto, jenis_kelamin FROM murid WHERE kelas_quran_id = ? ORDER BY nama ASC`,
            [sec.kelas_id]
          );
          studentsInClass = mList || [];
        } else if (sec.kategori === 'kegiatan') {
          const [mList]: any = await pool.execute(
            `SELECT murid_id, nis, nama, foto, jenis_kelamin FROM murid WHERE kamar_id = ? ORDER BY nama ASC`,
            [sec.kelas_id]
          );
          studentsInClass = mList || [];
        }

        const placeholders = sec.jadwal_ids.map(() => '?').join(',');
        const attMap: Record<string, any> = {};

        if (placeholders) {
          let attQuery = '';
          if (sec.kategori === 'madin') {
            attQuery = `SELECT a.murid_id,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
              COUNT(*) as total
            FROM absensi a
            WHERE a.jadwal_madin_id IN (${placeholders}) AND ${dateCond}
            GROUP BY a.murid_id`;
          } else if (sec.kategori === 'quran') {
            attQuery = `SELECT a.murid_id,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
              COUNT(*) as total
            FROM absensi_quran a
            WHERE a.jadwal_quran_id IN (${placeholders}) AND ${dateCond}
            GROUP BY a.murid_id`;
          } else if (sec.kategori === 'kegiatan') {
            attQuery = `SELECT a.murid_id,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
              COUNT(*) as total
            FROM absensi_kegiatan a
            WHERE a.kegiatan_id IN (${placeholders}) AND ${dateCond}
            GROUP BY a.murid_id`;
          }

          if (attQuery) {
            const [attRows]: any = await pool.execute(attQuery, [...sec.jadwal_ids, ...dateParams]);
            for (const r of (attRows || [])) {
              attMap[String(r.murid_id)] = r;
            }
          }
        }

        totalSemuaSantri += studentsInClass.length;

        studentsInClass.forEach((st: any, idxSantri: number) => {
          const att = attMap[String(st.murid_id)] || { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 };
          const h = Number(att.hadir || 0);
          const i = Number(att.izin || 0);
          const s = Number(att.sakit || 0);
          const a = Number(att.alpha || 0);
          const tot = Number(att.total || (h + i + s + a));
          const persentase = tot > 0 ? Math.round((h / tot) * 100) : 0;

          grandHadir += h;
          grandIzin += i;
          grandSakit += s;
          grandAlpha += a;

          allStudentsRows.push({
            no_urut: idxSantri + 1,
            section_key: sec.section_key,
            section_title: sec.section_title,
            section_total_santri: studentsInClass.length,
            kategori: sec.kategori,
            kategori_label: sec.kategori_label,
            kelas_id: sec.kelas_id,
            kelas_nama: sec.kelas_nama,
            mata_pelajaran: sec.mata_pelajaran,
            guru_nama: guruData.nama,
            murid_id: st.murid_id,
            nis: st.nis || '-',
            nama: st.nama,
            foto: st.foto,
            hadir: h,
            izin: i,
            sakit: s,
            alpha: a,
            total: tot,
            persentase,
            status: tot > 0 ? (persentase >= 75 ? 'Hadir' : persentase >= 50 ? 'Izin' : 'Alpha') : 'Belum Ada Sesi',
          });
        });
      }

      // Kumpulkan trend per tanggal sesi
      const allJadwalIdsMadin = Array.from(sectionsMap.values()).filter(s => s.kategori === 'madin').flatMap(s => s.jadwal_ids);
      const allJadwalIdsQuran = Array.from(sectionsMap.values()).filter(s => s.kategori === 'quran').flatMap(s => s.jadwal_ids);
      const allJadwalIdsKegiatan = Array.from(sectionsMap.values()).filter(s => s.kategori === 'kegiatan').flatMap(s => s.jadwal_ids);

      const trendMap = new Map<string, { hadir: number; izin: number; sakit: number; alpha: number; total: number }>();

      const addTrendRows = (tRows: any[]) => {
        for (const tr of tRows) {
          const tgl = tr.tanggal;
          if (!tgl) continue;
          if (!trendMap.has(tgl)) {
            trendMap.set(tgl, { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 });
          }
          const rec = trendMap.get(tgl)!;
          rec.hadir += Number(tr.hadir || 0);
          rec.izin += Number(tr.izin || 0);
          rec.sakit += Number(tr.sakit || 0);
          rec.alpha += Number(tr.alpha || 0);
          rec.total += Number(tr.total || 0);
        }
      };

      try {
        if (allJadwalIdsMadin.length > 0) {
          const ph = allJadwalIdsMadin.map(() => '?').join(',');
          const [tr]: any = await pool.execute(
            `SELECT DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
              COUNT(*) as total
            FROM absensi a
            WHERE a.jadwal_madin_id IN (${ph}) AND ${dateCond}
            GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')`,
            [...allJadwalIdsMadin, ...dateParams]
          );
          addTrendRows(tr || []);
        }
        if (allJadwalIdsQuran.length > 0) {
          const ph = allJadwalIdsQuran.map(() => '?').join(',');
          const [tr]: any = await pool.execute(
            `SELECT DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
              COUNT(*) as total
            FROM absensi_quran a
            WHERE a.jadwal_quran_id IN (${ph}) AND ${dateCond}
            GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')`,
            [...allJadwalIdsQuran, ...dateParams]
          );
          addTrendRows(tr || []);
        }
        if (allJadwalIdsKegiatan.length > 0) {
          const ph = allJadwalIdsKegiatan.map(() => '?').join(',');
          const [tr]: any = await pool.execute(
            `SELECT DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
              COUNT(*) as total
            FROM absensi_kegiatan a
            WHERE a.kegiatan_id IN (${ph}) AND ${dateCond}
            GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')`,
            [...allJadwalIdsKegiatan, ...dateParams]
          );
          addTrendRows(tr || []);
        }
      } catch (err) {
        console.warn('Trend map build error:', err);
      }

      const trendDataList = Array.from(trendMap.keys()).sort().map(tgl => {
        const rec = trendMap.get(tgl)!;
        const tot = rec.total || 1;
        return {
          tanggal: tgl,
          hadir: rec.hadir,
          izin: rec.izin,
          sakit: rec.sakit,
          alpha: rec.alpha,
          total: rec.total,
          pctHadir: Math.round((rec.hadir / tot) * 1000) / 10,
          pctIzin: Math.round((rec.izin / tot) * 1000) / 10,
          pctSakit: Math.round((rec.sakit / tot) * 1000) / 10,
          pctAlpha: Math.round((rec.alpha / tot) * 1000) / 10,
        };
      });

      const grandTotalAtt = grandHadir + grandIzin + grandSakit + grandAlpha;
      const grandAvgPersen = grandTotalAtt > 0 ? Math.round((grandHadir / grandTotalAtt) * 100) : 0;

      const muridInfo = {
        murid_id: guruData.guru_id,
        nama: guruData.nama,
        nis: guruData.nip || '-',
        kelas_madin: `Pengajar ${sectionsMap.size} Mapel / Kelas`,
        kelas_quran: `${totalSemuaSantri} Santri Terbina`,
        no_hp_wali: guruData.no_hp || '',
        foto: guruData.foto || '',
        jenis_kelamin: 'Guru Mapel',
        is_guru_mapel: true,
        total_mapel: sectionsMap.size,
        total_santri: totalSemuaSantri,
        avg_persentase: grandAvgPersen,
        hadir: grandHadir,
        izin: grandIzin,
        sakit: grandSakit,
        alpha: grandAlpha,
        total: grandTotalAtt,
      };

      const daftarMapelList = Array.from(sectionsMap.values()).map(s => `${s.kelas_nama} (${s.mata_pelajaran})`);
      const daftarMapelTeks = daftarMapelList.join(', ');

      let kategoriLabelDisplay = "Semua Kategori (Madin, Qur'an, Asrama)";
      if (kategori === 'madin') kategoriLabelDisplay = 'Madrasah Diniyah (Madin)';
      else if (kategori === 'quran') kategoriLabelDisplay = "Al-Qur'an (Tahfidz/Tartil)";
      else if (kategori === 'kegiatan') kategoriLabelDisplay = 'Kegiatan Asrama / Pesantren';

      return NextResponse.json({
        success: true,
        data: allStudentsRows,
        trend: trendDataList,
        murid: muridInfo,
        meta: {
          tipe: 'guru_mapel',
          is_guru_mapel: true,
          kategori,
          kategori_label: kategoriLabelDisplay,
          bulan,
          tahun,
          tanggal_dari,
          tanggal_sampai,
          isRentang,
          sub_filter,
          total_mapel: sectionsMap.size,
          total_santri: totalSemuaSantri,
          daftar_mapel_list: daftarMapelList,
          daftar_mapel_teks: daftarMapelTeks,
          expires_at: payload.exp ? payload.exp * 1000 : null,
        }
      }, { headers: noCacheHeaders });
    }
    let rows: RowDataPacket[] = [];

    // Mapping nama asli guru dan user
    const nameMap: Record<string, string> = {};
    try {
      const [guruList] = await pool.execute<RowDataPacket[]>(
        `SELECT g.guru_id, g.nip, g.nama, g.user_id, u.username, u.nama as user_nama
         FROM guru g
         LEFT JOIN users u ON g.user_id = u.id`
      );
      for (const g of guruList) {
        if (g.nama) {
          const realName = g.nama.trim();
          if (g.nip) nameMap[String(g.nip).toLowerCase()] = realName;
          if (g.guru_id) {
            nameMap[String(g.guru_id).toLowerCase()] = realName;
            nameMap[`guru_${g.guru_id}`.toLowerCase()] = realName;
          }
          if (g.user_id) {
            nameMap[String(g.user_id).toLowerCase()] = realName;
            nameMap[`user_${g.user_id}`.toLowerCase()] = realName;
            // Mapping hex representation dari user_id (misal user_id=177936 → hex '2b710')
            const hexId = Number(g.user_id).toString(16).toLowerCase();
            if (hexId && !nameMap[hexId]) nameMap[hexId] = realName;
          }
          if (g.username) {
            nameMap[String(g.username).toLowerCase()] = realName;
          }
        }
      }

      const [usersList] = await pool.execute<RowDataPacket[]>(
        `SELECT id, username, nama, role FROM users`
      );
      for (const u of usersList) {
        if (u.nama && u.nama.trim()) {
          const realName = u.nama.trim();
          if (u.username && !nameMap[String(u.username).toLowerCase()]) {
            nameMap[String(u.username).toLowerCase()] = realName;
          }
          if (u.id && !nameMap[String(u.id).toLowerCase()]) {
            nameMap[String(u.id).toLowerCase()] = realName;
            // Juga mapping hex dari user id
            const hexUserId = Number(u.id).toString(16).toLowerCase();
            if (hexUserId && !nameMap[hexUserId]) nameMap[hexUserId] = realName;
          }
        }
      }
    } catch (e) {
      console.warn("Name map build error:", e);
    }

    const resolveNamaPenginput = (raw: string, fallbackNamaGuru?: string) => {
      if (!raw || raw.trim() === '') return fallbackNamaGuru || 'Pengajar';
      const clean = raw.trim();
      const lower = clean.toLowerCase();

      if (lower === 'sistem otomatis') return 'Sistem Otomatis';
      if (lower === 'admin' || lower === 'administrator') return nameMap['admin'] || 'Administrator';
      
      // Coba langsung dari nameMap
      if (nameMap[lower]) return nameMap[lower];

      // Coba ekstrak angka dari akhir string (untuk format 'guru_130', 'user_79', dll)
      const numSuffixMatch = lower.match(/^[a-z_]*(\d+)$/);
      if (numSuffixMatch && nameMap[numSuffixMatch[1]]) return nameMap[numSuffixMatch[1]];

      // Coba semua angka yang ada dalam string (lebih longgar)
      const allNums = lower.match(/\d+/g);
      if (allNums) {
        for (const num of allNums) {
          if (nameMap[num]) return nameMap[num];
          if (nameMap[`guru_${num}`]) return nameMap[`guru_${num}`];
          if (nameMap[`user_${num}`]) return nameMap[`user_${num}`];
        }
      }

      // Coba parse sebagai hex lalu lookup desimalnya (untuk format hex-like seperti '2b310')
      if (/^[0-9a-f]+$/i.test(lower) && lower.length >= 3) {
        const decFromHex = String(parseInt(lower, 16));
        if (nameMap[decFromHex]) return nameMap[decFromHex];
      }

      // Fallback ke nama guru dari jadwal (lebih reliable dari audit_log)
      if (fallbackNamaGuru && fallbackNamaGuru.trim() !== '') return fallbackNamaGuru;
      return clean;
    };

    // Audit map untuk menelusuri siapa yang menginput absensi santri
    let auditMap: Record<string, string> = {};
    if (murid_id) {
      try {
        const [auditRows] = await pool.execute<RowDataPacket[]>(
          `SELECT user_nama, user_role, keterangan, created_at
           FROM audit_log
           WHERE tabel IN ('absensi', 'absensi_quran', 'absensi_kegiatan')
           ORDER BY id DESC LIMIT 500`
        );
        for (const a of auditRows) {
          const match = (a.keterangan || "").match(/(\d{4}-\d{2}-\d{2})/);
          if (match && match[1]) {
            const key = match[1];
            if (!auditMap[key]) {
              const rawName = a.user_nama ? String(a.user_nama).trim() : "";
              auditMap[key] = resolveNamaPenginput(rawName);
            }
          }
        }
      } catch (err) {
        console.warn("Audit map error:", err);
      }
    }

    if (effectiveTipe === "madin" && murid_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [murid_id, tanggal_dari, tanggal_sampai] : [murid_id, bulan, tahun];
      let subFilterWhere = "";
      if (sub_filter && sub_filter.trim() !== "") {
        subFilterWhere = " AND jm.mata_pelajaran = ?";
        dateParams.push(sub_filter.trim());
      }
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(jm.hari, "") as hari,
          COALESCE(jm.jam_mulai, "") as jam_mulai,
          COALESCE(jm.jam_selesai, "") as jam_selesai,
          COALESCE(jm.mata_pelajaran, "Madin") as mata_pelajaran,
          COALESCE(km_murid.nama_kelas, km.nama_kelas, "-") as kelas_nama,
          COALESCE(g.nama, "") as guru_nama,
          "Madin" as tipe_label
         FROM absensi a
         LEFT JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
         LEFT JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
         LEFT JOIN murid mrd ON a.murid_id = mrd.murid_id
         LEFT JOIN kelas_madin km_murid ON mrd.kelas_madin_id = km_murid.kelas_id
         LEFT JOIN guru g ON jm.guru_id = g.guru_id
         WHERE a.murid_id = ? AND ${dateWhere}${subFilterWhere}
         ORDER BY a.tanggal DESC, jm.jam_mulai ASC`,
        dateParams
      );
      rows = result;
    } else if (effectiveTipe === "quran" && murid_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [murid_id, tanggal_dari, tanggal_sampai] : [murid_id, bulan, tahun];
      let subFilterWhere = "";
      if (sub_filter && sub_filter.trim() !== "") {
        subFilterWhere = " AND jq.mata_pelajaran = ?";
        dateParams.push(sub_filter.trim());
      }
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(jq.hari, "") as hari,
          COALESCE(jq.jam_mulai, "") as jam_mulai,
          COALESCE(jq.jam_selesai, "") as jam_selesai,
          COALESCE(jq.mata_pelajaran, "Tahfidz / Tilawah") as mata_pelajaran,
          COALESCE(kq_murid.nama_kelas, kq.nama_kelas, "-") as kelas_nama,
          COALESCE(g.nama, "") as guru_nama,
          "Quran" as tipe_label
         FROM absensi_quran a
         LEFT JOIN jadwal_quran jq ON a.jadwal_quran_id = jq.id
         LEFT JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
         LEFT JOIN murid mrd ON a.murid_id = mrd.murid_id
         LEFT JOIN kelas_quran kq_murid ON mrd.kelas_quran_id = kq_murid.id
         LEFT JOIN guru g ON jq.guru_id = g.guru_id
         WHERE a.murid_id = ? AND ${dateWhere}${subFilterWhere}
         ORDER BY a.tanggal DESC, jq.jam_mulai ASC`,
        dateParams
      );
      rows = result;
    } else if (effectiveTipe === "kegiatan" && murid_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [murid_id, tanggal_dari, tanggal_sampai] : [murid_id, bulan, tahun];
      let subFilterWhere = "";
      if (sub_filter && sub_filter.trim() !== "") {
        subFilterWhere = " AND jk.nama_kegiatan = ?";
        dateParams.push(sub_filter.trim());
      }
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(jk.hari, "") as hari,
          COALESCE(jk.jam_mulai, "") as jam_mulai,
          COALESCE(jk.jam_selesai, "") as jam_selesai,
          COALESCE(jk.nama_kegiatan, "Kegiatan Asrama") as mata_pelajaran,
          COALESCE(k_murid.nama_kamar, k.nama_kamar, "-") as kelas_nama,
          COALESCE(g.nama, "") as guru_nama,
          "Kegiatan" as tipe_label
         FROM absensi_kegiatan a
         LEFT JOIN jadwal_kegiatan jk ON a.kegiatan_id = jk.kegiatan_id
         LEFT JOIN kamar k ON jk.kamar_id = k.kamar_id
         LEFT JOIN murid mrd ON a.murid_id = mrd.murid_id
         LEFT JOIN kamar k_murid ON mrd.kamar_id = k_murid.kamar_id
         LEFT JOIN guru g ON jk.guru_id = g.guru_id
         WHERE a.murid_id = ? AND ${dateWhere}${subFilterWhere}
         ORDER BY a.tanggal DESC, jk.jam_mulai ASC`,
        dateParams
      );
      rows = result;
    } else if (effectiveTipe === "guru" && guru_id) {
      // Ambil daftar jadwal tetap guru untuk mapping jika data foreign key di absensi_guru null
      const [jadwalGuru] = await pool.execute<RowDataPacket[]>(
        `SELECT 'Madin' as tipe, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, km.nama_kelas
         FROM jadwal_madin j JOIN kelas_madin km ON j.kelas_madin_id = km.kelas_id WHERE j.guru_id = ?
         UNION ALL
         SELECT 'Quran' as tipe, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, kq.nama_kelas
         FROM jadwal_quran j JOIN kelas_quran kq ON j.kelas_quran_id = kq.id WHERE j.guru_id = ?
         UNION ALL
         SELECT 'Kegiatan' as tipe, j.hari, j.jam_mulai, j.jam_selesai, j.nama_kegiatan as mata_pelajaran, k.nama_kamar as nama_kelas
         FROM jadwal_kegiatan j JOIN kamar k ON j.kamar_id = k.kamar_id WHERE j.guru_id = ?`,
        [guru_id, guru_id, guru_id]
      ).catch(() => [[] as RowDataPacket[]]);

      const sf = (sub_filter || '').toLowerCase().trim();
      let subFilterWhere = '';
      if (sf === 'madin' || sf === 'jadwal madin') {
        subFilterWhere = ' AND a.jadwal_madin_id IS NOT NULL';
      } else if (sf === 'quran' || sf === "qur'an" || sf === 'jadwal quran' || sf === "jadwal qur'an" || sf === 'jadwal qur an') {
        subFilterWhere = ' AND a.jadwal_quran_id IS NOT NULL';
      } else if (sf === 'kegiatan' || sf === 'jadwal kegiatan') {
        subFilterWhere = ' AND a.kegiatan_id IS NOT NULL';
      }

      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [guru_id, tanggal_dari, tanggal_sampai] : [guru_id, bulan, tahun];
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT a.absensi_id, DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(a.waktu_absensi, jm.jam_mulai, jq.jam_mulai, jk.jam_mulai, "") as jam_mulai,
          COALESCE(jm.jam_selesai, jq.jam_selesai, jk.jam_selesai, "") as jam_selesai,
          COALESCE(jm.hari, jq.hari, jk.hari, "") as hari,
          COALESCE(jm.mata_pelajaran, jq.mata_pelajaran, jk.nama_kegiatan, "") as mata_pelajaran,
          COALESCE(km.nama_kelas, kq.nama_kelas, k.nama_kamar, "") as kelas_nama,
          COALESCE(a.is_otomatis, 0) as is_otomatis,
          COALESCE(g.nama, "") as guru_nama,
          CASE 
            WHEN a.jadwal_madin_id IS NOT NULL THEN 'Madin'
            WHEN a.jadwal_quran_id IS NOT NULL THEN 'Quran'
            WHEN a.kegiatan_id IS NOT NULL THEN 'Kegiatan'
            ELSE 'Guru'
          END as tipe_label
         FROM absensi_guru a
         LEFT JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
         LEFT JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
         LEFT JOIN jadwal_quran jq ON a.jadwal_quran_id = jq.id
         LEFT JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
         LEFT JOIN jadwal_kegiatan jk ON a.kegiatan_id = jk.kegiatan_id
         LEFT JOIN kamar k ON jk.kamar_id = k.kamar_id
         LEFT JOIN guru g ON a.guru_id = g.guru_id
         WHERE a.guru_id = ? AND ${dateWhere}${subFilterWhere}
         ORDER BY a.tanggal DESC, a.absensi_id DESC`,
        dateParams
      );

      const hariNamesMap = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      rows = (result || []).map((r: any) => {
        if (!r.mata_pelajaran || r.mata_pelajaran.trim() === "") {
          const tgl = r.tanggal ? new Date(r.tanggal) : null;
          const dayName = tgl ? hariNamesMap[tgl.getDay()] : "";
          const matchJadwal = (jadwalGuru as any[]).find((jg: any) => (jg.hari || "").toLowerCase() === dayName.toLowerCase());
          if (matchJadwal) {
            r.mata_pelajaran = matchJadwal.mata_pelajaran || "Mengajar";
            r.kelas_nama = matchJadwal.nama_kelas || "-";
            r.tipe_label = matchJadwal.tipe || "Guru";
            if (!r.jam_mulai) r.jam_mulai = matchJadwal.jam_mulai;
            if (!r.jam_selesai) r.jam_selesai = matchJadwal.jam_selesai;
          } else {
            r.mata_pelajaran = "Pengajaran / Tugas";
            r.kelas_nama = "-";
          }
        }
        return r;
      });

      if (sf) {
        rows = rows.filter((r: any) => {
          const t = (r.tipe_label || '').toLowerCase();
          if (sf === 'madin' || sf === 'jadwal madin') return t === 'madin';
          if (sf === 'quran' || sf === "qur'an" || sf === 'jadwal quran' || sf === "jadwal qur'an" || sf === 'jadwal qur an') return t === 'quran';
          if (sf === 'kegiatan' || sf === 'jadwal kegiatan') return t === 'kegiatan';
          return true;
        });
      }
    } else if (effectiveTipe === "dewan_guru" && guru_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [guru_id, tanggal_dari, tanggal_sampai] : [guru_id, bulan, tahun];
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT a.id as absensi_id, DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(a.jam_absen, "") as jam_mulai,
          "" as jam_selesai,
          "" as hari,
          COALESCE(j.nama_sesi, "Presensi Kehadiran") as mata_pelajaran,
          COALESCE(dg.homebase, "-") as kelas_nama,
          0 as is_otomatis,
          COALESCE(dg.nama, "") as guru_nama,
          COALESCE(a.metode, "QR_Scan") as metode,
          COALESCE(a.dicatat_oleh, "") as dicatat_oleh,
          "Dewan Guru" as tipe_label
         FROM absensi_dewan_guru a
         LEFT JOIN dewan_guru dg ON a.guru_id = dg.id
         LEFT JOIN jadwal_dewan_guru j ON a.jadwal_id = j.id
         WHERE a.guru_id = ? AND ${dateWhere}
         ORDER BY a.tanggal DESC, a.jam_absen DESC`,
        dateParams
      );
      rows = result;
    }

    const hariNames = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const formatted = rows.map((r: any) => {
      let tglStr = "-";
      let hariLabel = (r.hari && r.hari.trim() !== "") ? r.hari : "";

      if (r.tanggal) {
        if (typeof r.tanggal === 'string' && r.tanggal.length >= 10) {
          tglStr = r.tanggal.slice(0, 10);
        } else {
          try {
            tglStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(r.tanggal));
          } catch (_) {
            tglStr = String(r.tanggal).slice(0, 10);
          }
        }
        if (!hariLabel || hariLabel === "-") {
          try {
            const parts = tglStr.split('-').map(Number);
            if (parts.length === 3) {
              const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
              hariLabel = hariNames[dObj.getDay()] || "-";
            }
          } catch (_) {
            hariLabel = "-";
          }
        }
      }

      const statusRaw = (r.status || "").toString();
      const sl = statusRaw.toLowerCase();
      let statusNorm = "Alpha";
      if (sl === "hadir") statusNorm = "Hadir";
      else if (sl === "izin") statusNorm = "Izin";
      else if (sl === "sakit") statusNorm = "Sakit";

      const fmtTime = (t: any) => {
        if (!t || t === "") return "";
        const s = typeof t === "string" ? t : String(t);
        return s.slice(0, 5);
      };

      // Siapa yang menginput data ini
      // Prioritas: 1) Sistem Otomatis, 2) guru_nama dari tabel jadwal (nama resmi), 3) auditMap (username)
      let penginput = r.guru_nama || "Pengajar Kelas";
      if (r.is_otomatis === 1) {
        penginput = "Sistem Otomatis";
      } else if (effectiveTipe === "guru") {
        if (r.status === "Izin" || r.status === "Sakit" || statusNorm === "Izin" || statusNorm === "Sakit") {
          penginput = "Pengajuan Izin";
        } else if ((r.keterangan || "").toLowerCase().includes("scan")) {
          penginput = "Scan Mandiri (Guru)";
        } else if ((r.keterangan || "").toLowerCase().includes("menginput absensi")) {
          penginput = "Input Mandiri (Guru)";
        } else {
          penginput = r.guru_nama || "Guru";
        }
      } else if (effectiveTipe === "dewan_guru") {
        if (r.dicatat_oleh && r.dicatat_oleh.trim() !== '') {
          penginput = `${r.metode === 'QR_Scan' ? 'Scan QR' : (r.metode || 'Presensi')} (${r.dicatat_oleh})`;
        } else {
          penginput = r.metode === 'QR_Scan' ? 'Scan Mandiri (QR)' : (r.metode || 'Presensi Dewan Guru');
        }
      } else if (murid_id) {
        // Prioritaskan guru_nama dari JOIN jadwal (nama resmi dari Data Guru & Pembina)
        // Gunakan auditMap hanya jika guru_nama kosong
        const guruNamaFromJadwal = (r.guru_nama || "").trim();
        if (guruNamaFromJadwal) {
          penginput = guruNamaFromJadwal;
        } else {
          // Fallback ke audit_log, resolve username ke nama lengkap
          penginput = auditMap[tglStr] || "Pengajar Kelas";
        }
      }

      return {
        tanggal: tglStr,
        hari: hariLabel,
        jam_mulai: fmtTime(r.jam_mulai),
        jam_selesai: fmtTime(r.jam_selesai),
        status: statusNorm,
        keterangan: (r.keterangan || "").trim(),
        mata_pelajaran: r.mata_pelajaran || "-",
        kelas_nama: r.kelas_nama || "-",
        tipe_label: r.tipe_label || tipe,
        penginput,
      };
    });

    // Deduplikasi: hapus baris ganda yang terjadi akibat input absensi bersamaan/berulang
    // Menggunakan key yang 100% konsisten dengan tabel rekapitulasi utama: tanggal + jam_mulai + mata_pelajaran
    const dedupSet = new Set<string>();
    const dedupedData = formatted.filter((row: any) => {
      const key = `${row.tanggal}_${row.jam_mulai || '00:00'}_${row.mata_pelajaran || ''}`;
      if (dedupSet.has(key)) return false;
      dedupSet.add(key);
      return true;
    });

    let muridInfo: any = null;
    if (murid_id) {
      try {
        const [mRows]: any = await pool.execute(
          `SELECT m.murid_id, m.nama, m.nis, m.nama_wali, m.no_wali as no_hp_wali, m.foto, m.jenis_kelamin,
                  km.nama_kelas as kelas_madin, kq.nama_kelas as kelas_quran, k.nama_kamar
           FROM murid m
           LEFT JOIN kelas_madin km ON (m.kelas_madin_id = km.kelas_id OR m.kelas_madin_2_id = km.kelas_id)
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
           WHERE m.murid_id = ? LIMIT 1`,
          [murid_id]
        );
        if (mRows.length > 0) muridInfo = mRows[0];
      } catch (_) {}
    } else if (guru_id && (isGuruTipe || effectiveTipe === 'guru')) {
      try {
        if (effectiveTipe === 'guru') {
          const [gRows]: any = await pool.execute(
            `SELECT guru_id as murid_id, nama, COALESCE(nip, '-') as nis, no_hp as no_hp_wali, foto, COALESCE(alamat, 'Guru Pengajar') as kelas_madin, 'Guru' as jenis_kelamin FROM guru WHERE guru_id = ? LIMIT 1`,
            [guru_id]
          );
          if (gRows.length > 0) muridInfo = gRows[0];
        } else if (effectiveTipe === 'dewan_guru') {
          const [dgRows]: any = await pool.execute(
            `SELECT id as murid_id, nama, COALESCE(nip, '-') as nis, no_hp as no_hp_wali, foto, COALESCE(homebase, 'Dewan Guru YPMA') as kelas_madin, 'Dewan Guru' as jenis_kelamin FROM dewan_guru WHERE id = ? LIMIT 1`,
            [guru_id]
          );
          if (dgRows.length > 0) muridInfo = dgRows[0];
        }
      } catch (_) {}
    }

    return NextResponse.json({ 
      success: true, 
      data: dedupedData,
      murid: muridInfo,
      meta: {
        tipe: effectiveTipe,
        bulan,
        tahun,
        tanggal_dari,
        tanggal_sampai,
        isRentang,
        sub_filter,
        expires_at: payload.exp ? payload.exp * 1000 : null,
      }
    }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("[rekapitulasi/detail] error:", error.message);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500, headers: noCacheHeaders });
  }
}
