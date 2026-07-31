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

    const { role, guruId, muridId, userId, username } = payload;
    const tokenAsrama = payload.namaAsrama || null;

    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // madin | quran | kamar
    const aggregate = searchParams.get('aggregate') === 'true'; // hanya inject extra options jika true
    
    if (!type || !['madin', 'quran', 'kamar', 'kegiatan', 'guru'].includes(type)) {
      return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
    }

    const actualType = type === 'kegiatan' ? 'kamar' : type;

    let whereClause = '';
    let params: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        if (actualType === 'madin') {
          whereClause = `WHERE k.guru_id = ? OR k.kelas_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)`;
          params = [guruId, guruId];
        } else if (actualType === 'quran') {
          whereClause = `WHERE k.guru_id = ? OR k.id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?)`;
          params = [guruId, guruId];
        } else if (actualType === 'kamar') {
          whereClause = `WHERE k.guru_id = ? OR k.kamar_id IN (SELECT kamar_id FROM jadwal_kegiatan WHERE guru_id = ?)`;
          params = [guruId, guruId];
        }
      } else {
        whereClause = `WHERE 0=1`;
      }
    } else if (role === 'pengurus_asrama' || role === 'pengasuh') {
      if (namaAsrama) {
        if (actualType === 'madin') {
          if (role === 'pengasuh') {
            whereClause = `WHERE 0=1`;
          } else {
            whereClause = `WHERE k.kelas_id IN (SELECT DISTINCT m.kelas_madin_id FROM murid m JOIN kamar km ON m.kamar_id = km.kamar_id WHERE km.nama_asrama = ? AND m.kelas_madin_id IS NOT NULL)`;
            params = [namaAsrama];
          }
        } else if (actualType === 'quran') {
          if (role === 'pengasuh') {
            whereClause = `WHERE 0=1`;
          } else {
            // Pengurus asrama hanya dapat melihat kelas quran yang ada santri dari asramanya ATAU nama_kelas mengandung nama asrama
            whereClause = `WHERE k.id IN (
              SELECT DISTINCT m.kelas_quran_id FROM murid m
              JOIN kamar km ON m.kamar_id = km.kamar_id
              WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
            ) OR k.nama_kelas LIKE ?`;
            params = [namaAsrama, `%${namaAsrama}%`];
          }
        } else if (actualType === 'kamar') {
          whereClause = `WHERE k.nama_asrama = ?`;
          params = [namaAsrama];
        }
      } else {
        whereClause = `WHERE 0=1`;
      }
    } else if (role !== 'admin' && role !== 'staff') {
      if (muridId) {
        if (actualType === 'madin') {
          whereClause = `WHERE k.kelas_id = (SELECT kelas_madin_id FROM murid WHERE murid_id = ? LIMIT 1)`;
          params = [muridId];
        } else if (actualType === 'quran') {
          whereClause = `WHERE k.id = (SELECT kelas_quran_id FROM murid WHERE murid_id = ? LIMIT 1)`;
          params = [muridId];
        } else if (actualType === 'kamar') {
          whereClause = `WHERE k.kamar_id = (SELECT kamar_id FROM murid WHERE murid_id = ? LIMIT 1)`;
          params = [muridId];
        }
      } else {
        whereClause = `WHERE 0=1`;
      }
    }

    // Auto-merge & Standarisasi duplikasi nama kamar (misal: A1 [id 1] vs A-1 [id 74])
    if (actualType === 'kamar') {
      try {
        const [allKamar] = await pool.execute<RowDataPacket[]>('SELECT kamar_id, nama_kamar, guru_id, nama_asrama FROM kamar');
        const groups: Record<string, any[]> = {};
        for (const k of allKamar) {
          const norm = (k.nama_kamar || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (!norm) continue;
          if (!groups[norm]) groups[norm] = [];
          groups[norm].push(k);
        }

        for (const norm in groups) {
          const list = groups[norm];
          if (list.length > 1) {
            // Urutkan: utamakan yang punya guru_id/pembina, atau yang memiliki dash ('-'), atau ID terkecil
            list.sort((a, b) => {
              if (a.guru_id && !b.guru_id) return -1;
              if (!a.guru_id && b.guru_id) return 1;
              if (a.nama_kamar.includes('-') && !b.nama_kamar.includes('-')) return -1;
              if (!a.nama_kamar.includes('-') && b.nama_kamar.includes('-')) return 1;
              return a.kamar_id - b.kamar_id;
            });

            const primary = list[0];
            const secondaryList = list.slice(1);

            let targetName = primary.nama_kamar;
            if (!targetName.includes('-') && /^[A-F][0-9]+$/i.test(targetName)) {
              targetName = targetName.charAt(0).toUpperCase() + '-' + targetName.slice(1);
            }

            let namaAsramaVal = primary.nama_asrama;
            const firstChar = targetName.charAt(0).toUpperCase();
            if (!namaAsramaVal && ['A','B','C','D','E','F'].includes(firstChar)) {
              namaAsramaVal = firstChar;
            }

            await pool.execute(
              'UPDATE kamar SET nama_kamar = ?, nama_asrama = ? WHERE kamar_id = ?',
              [targetName, namaAsramaVal, primary.kamar_id]
            );

            for (const sec of secondaryList) {
              await pool.execute('UPDATE murid SET kamar_id = ? WHERE kamar_id = ?', [primary.kamar_id, sec.kamar_id]);
              await pool.execute('UPDATE absensi_kamar SET kamar_id = ? WHERE kamar_id = ?', [primary.kamar_id, sec.kamar_id]);
              await pool.execute('UPDATE jadwal_kegiatan SET kamar_id = ? WHERE kamar_id = ?', [primary.kamar_id, sec.kamar_id]);
              if (sec.guru_id && !primary.guru_id) {
                await pool.execute('UPDATE kamar SET guru_id = ? WHERE kamar_id = ?', [sec.guru_id, primary.kamar_id]);
                primary.guru_id = sec.guru_id;
              }
              await pool.execute('DELETE FROM kamar WHERE kamar_id = ?', [sec.kamar_id]);
            }
          } else {
            const single = list[0];
            if (!single.nama_kamar.includes('-') && /^[A-F][0-9]+$/i.test(single.nama_kamar)) {
              const targetName = single.nama_kamar.charAt(0).toUpperCase() + '-' + single.nama_kamar.slice(1);
              const asr = targetName.charAt(0).toUpperCase();
              await pool.execute(
                'UPDATE kamar SET nama_kamar = ?, nama_asrama = COALESCE(nama_asrama, ?) WHERE kamar_id = ?',
                [targetName, asr, single.kamar_id]
              );
            }
          }
        }
      } catch (cleanErr: any) {
        console.error('Auto-merge kamar error:', cleanErr.message);
      }
    }

    let query = '';
    if (actualType === 'madin') {
      query = `
        SELECT k.kelas_id as id, k.nama_kelas as nama, g.nama as pembina,
               (SELECT COUNT(*) FROM murid m WHERE m.kelas_madin_id = k.kelas_id) as jumlah_murid
        FROM kelas_madin k
        LEFT JOIN guru g ON k.guru_id = g.guru_id
        ${whereClause}
        ORDER BY k.nama_kelas ASC
      `;
    } else if (actualType === 'quran') {
      query = `
        SELECT k.id as id, k.nama_kelas as nama, g.nama as pembina,
               (SELECT COUNT(*) FROM murid m WHERE m.kelas_quran_id = k.id) as jumlah_murid
        FROM kelas_quran k
        LEFT JOIN guru g ON k.guru_id = g.guru_id
        ${whereClause}
        ORDER BY k.nama_kelas ASC
      `;
    } else if (actualType === 'kamar') {
      query = `
        SELECT k.kamar_id as id, k.nama_kamar as nama, k.nama_asrama, g.nama as pembina,
               (SELECT COUNT(*) FROM murid m WHERE m.kamar_id = k.kamar_id) as jumlah_murid
        FROM kamar k
        LEFT JOIN guru g ON k.guru_id = g.guru_id
        ${whereClause}
        ORDER BY
          REGEXP_SUBSTR(k.nama_kamar, '^[A-Za-z]+') ASC,
          CAST(REGEXP_SUBSTR(k.nama_kamar, '[0-9]+') AS UNSIGNED) ASC,
          k.nama_kamar ASC
      `;
    } else if (actualType === 'guru') {
      query = `SELECT guru_id as id, nama FROM guru ORDER BY nama ASC`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    let optionsList = rows;

    // Inject aggregate filter options hanya jika ?aggregate=true (untuk halaman filter/rekapitulasi)
    const extraOptions: any[] = [];

    if (aggregate) {
      if (actualType === 'kamar') {
        if (role === 'admin' || role === 'staff') {
          extraOptions.push({ id: 'all', nama: '✨ Semua Kamar (Semua Asrama)' });
          ['A', 'B', 'C', 'D', 'E', 'F'].forEach(asr => {
            extraOptions.push({ id: `asrama_${asr}`, nama: `🏢 Seluruh Kamar - Asrama ${asr}` });
          });
        } else if ((role === 'pengurus_asrama' || role === 'pengasuh') && namaAsrama) {
          extraOptions.push({ id: `asrama_${namaAsrama}`, nama: `🏢 Seluruh Kamar - Asrama ${namaAsrama}` });
        }
      } else if (actualType === 'madin' || actualType === 'quran') {
        if (role === 'admin' || role === 'staff') {
          extraOptions.push({ id: 'all', nama: '✨ Semua Kelas' });
          extraOptions.push({ id: 'putra', nama: '👦 Semua Kelas Putra' });
          extraOptions.push({ id: 'putri', nama: '👧 Semua Kelas Putri' });
        } else if ((role === 'pengurus_asrama' || role === 'pengasuh') && namaAsrama) {
          extraOptions.push({ id: 'all', nama: `✨ Semua Kelas (${namaAsrama})` });
        }
      }
    }

    const finalData = [...extraOptions, ...optionsList];
    return NextResponse.json({ success: true, data: finalData });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    if (!payload || ((payload as any).role !== 'admin' && (payload as any).role !== 'staff')) {
      return NextResponse.json({ error: 'Hanya admin/staff yang dapat mengedit' }, { status: 403 });
    }

    const data = await request.json();
    const { id, nama, type } = data; // type: madin, quran, kamar
    if (!id || !nama || !type) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

    if (type === 'madin') {
      await pool.execute('UPDATE kelas_madin SET nama_kelas = ? WHERE kelas_id = ?', [nama, id]);
    } else if (type === 'quran') {
      await pool.execute('UPDATE kelas_quran SET nama_kelas = ? WHERE id = ?', [nama, id]);
    } else if (type === 'kamar') {
      await pool.execute('UPDATE kamar SET nama_kamar = ? WHERE kamar_id = ?', [nama, id]);
    }

    return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    if (!payload || ((payload as any).role !== 'admin' && (payload as any).role !== 'staff')) {
      return NextResponse.json({ error: 'Hanya admin/staff yang dapat menambahkan' }, { status: 403 });
    }

    const data = await request.json();
    const { nama, type } = data; // type: madin, quran, kamar
    if (!nama || !type) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

    if (type === 'madin') {
      await pool.execute('INSERT INTO kelas_madin (nama_kelas) VALUES (?)', [nama]);
    } else if (type === 'quran') {
      await pool.execute('INSERT INTO kelas_quran (nama_kelas) VALUES (?)', [nama]);
    } else if (type === 'kamar') {
      let namaAsrama = null;
      const cleanNama = nama.trim().toUpperCase();
      if (cleanNama.startsWith('ASRAMA A') || cleanNama.startsWith('A ')) {
        namaAsrama = 'A';
      } else if (cleanNama.startsWith('ASRAMA B') || cleanNama.startsWith('B ')) {
        namaAsrama = 'B';
      } else if (cleanNama.startsWith('ASRAMA C') || cleanNama.startsWith('C ')) {
        namaAsrama = 'C';
      } else if (cleanNama.startsWith('ASRAMA D') || cleanNama.startsWith('D ')) {
        namaAsrama = 'D';
      } else if (cleanNama.startsWith('ASRAMA E') || cleanNama.startsWith('E ')) {
        namaAsrama = 'E';
      } else if (cleanNama.startsWith('ASRAMA F') || cleanNama.startsWith('F ')) {
        namaAsrama = 'F';
      } else {
        // Fallback check single char
        const firstChar = cleanNama.charAt(0);
        if (['A', 'B', 'C', 'D', 'E', 'F'].includes(firstChar)) {
          namaAsrama = firstChar;
        }
      }
      await pool.execute('INSERT INTO kamar (nama_kamar, nama_asrama) VALUES (?, ?)', [nama, namaAsrama]);
    }

    return NextResponse.json({ success: true, message: 'Data berhasil ditambahkan' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

