import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';

export const dynamic = 'force-dynamic';

// Helper: Evaluasi Cerdas Berbasis Kata Kunci & Semantik (Fallback jika tanpa Gemini API Key)
function evaluateWithKeywords(
  pertanyaan: string,
  kunciIdeal: string,
  rubrikKataKunci: string,
  jawabanSantri: string,
  bobotMax: number
): { skor: number; feedback: string; kataKunciDitemukan: string[] } {
  const ansLower = (jawabanSantri || '').toLowerCase().trim();
  if (!ansLower || ansLower.length < 3) {
    return {
      skor: 0,
      feedback: 'Santri tidak memberikan jawaban atau jawaban terlalu singkat.',
      kataKunciDitemukan: [],
    };
  }

  // Kumpulkan daftar kata kunci
  const rawKeywords: string[] = [];
  if (rubrikKataKunci) {
    rubrikKataKunci
      .split(/[,;\n]/)
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 1)
      .forEach(k => rawKeywords.push(k));
  }

  // Jika rubrik kosong, ambil kata-kata penting dari kunci jawaban ideal
  if (rawKeywords.length === 0 && kunciIdeal) {
    const stopwords = ['dan', 'yang', 'di', 'ke', 'dari', 'ini', 'itu', 'adalah', 'yaitu', 'atau', 'pada', 'untuk', 'dengan', 'dalam', 'sebagai'];
    kunciIdeal
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.includes(w))
      .slice(0, 8)
      .forEach(w => rawKeywords.push(w));
  }

  const uniqueKeywords = Array.from(new Set(rawKeywords));
  const foundKeywords: string[] = [];

  for (const kw of uniqueKeywords) {
    // Normalisasi variasi kata fiqih umum (contoh hadas vs hadats, shalat vs sholat)
    const kwRegex = new RegExp(kw.replace(/ts/g, '[ts]+').replace(/sh/g, '[s]+').replace(/o/g, '[ou]'), 'i');
    if (ansLower.includes(kw) || kwRegex.test(ansLower)) {
      foundKeywords.push(kw);
    }
  }

  const totalKw = Math.max(uniqueKeywords.length, 1);
  const matchRatio = foundKeywords.length / totalKw;

  // Skor dihitung dari persentase kata kunci + kelengkapan kalimat
  let ratioSkor = matchRatio;
  if (ansLower.length >= 40 && ratioSkor > 0) {
    ratioSkor = Math.min(1.0, ratioSkor + 0.15); // bonus elaborasi kalimat
  }

  const skor = Math.round(ratioSkor * bobotMax * 10) / 10;
  const feedback = foundKeywords.length > 0
    ? `Asisten AI (Analisis Kata Kunci): Santri memuat ${foundKeywords.length} dari ${totalKw} konsep/kata kunci pokok (${foundKeywords.slice(0, 4).join(', ')}). Jawaban dinilai relevan dengan bobot saran ${skor}/${bobotMax}.`
    : `Asisten AI: Konsep kunci belum terdeteksi secara jelas pada jawaban santri. Mohon review lebih lanjut oleh asatidz.`;

  return { skor, feedback, kataKunciDitemukan: foundKeywords };
}

// Handler POST: Koreksi dengan AI
export async function POST(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const userRoleLower = (payload.role || '').toLowerCase();
    const canReview = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!canReview) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const body = await request.json();
    const { ujian_id, murid_id, essay_id } = body;

    if (!ujian_id) {
      return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });
    }

    let whereClause = 'ej.ujian_id = ?';
    const params: any[] = [ujian_id];

    if (essay_id) {
      whereClause += ' AND ej.id = ?';
      params.push(essay_id);
    } else if (murid_id) {
      whereClause += ' AND ej.murid_id = ?';
      params.push(murid_id);
    }

    // Ambil data jawaban essay santri yang perlu dinilai
    const [essayRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         ej.id,
         ej.ujian_id,
         ej.murid_id,
         ej.soal_id,
         ej.jawaban_santri,
         ej.bobot_maksimal,
         s.pertanyaan,
         s.kunci_jawaban AS kunci_ideal,
         s.rubrik_kata_kunci
       FROM ujian_essay_jawaban ej
       JOIN ujian_soal s ON ej.soal_id = s.id
       WHERE ${whereClause}`,
      params
    );

    if (essayRows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada jawaban essay santri yang ditemukan untuk dinilai.' }, { status: 404 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    let gradedCount = 0;

    for (const item of essayRows) {
      const bobotMax = Number(item.bobot_maksimal) || 10;
      const santriAns = (item.jawaban_santri || '').trim();

      let skorAi = 0;
      let feedbackAi = '';
      let kataKunciStr = '';

      if (!santriAns) {
        skorAi = 0;
        feedbackAi = 'Santri tidak menjawab pertanyaan ini.';
      } else if (geminiApiKey) {
        // Panggil Google Gemini Flash API jika API Key tersedia
        try {
          const prompt = `Anda adalah asisten koreksi ujian madrasah/pondok pesantren yang bijaksana, teliti, dan adil.
Tugas Anda: Menilai jawaban essay santri berdasarkan pertanyaan, kunci jawaban acuan pengajar, dan rubrik kata kunci.

Informasi Soal:
- Pertanyaan: ${item.pertanyaan}
- Kunci Jawaban Acuan: ${item.kunci_ideal || 'Tidak disediakan secara spesifik, evaluasi berdasarkan kebenaran ilmu syariat/materi.'}
- Rubrik / Kata Kunci Pokok: ${item.rubrik_kata_kunci || 'Sesuai konteks pertanyaan.'}
- Bobot Skor Maksimal: ${bobotMax}

Jawaban Santri:
"""
${santriAns}
"""

Format respon WAJIB berupa JSON murni dengan struktur berikut tanpa markdown tambahan:
{
  "skor": number (antara 0 sampai ${bobotMax}),
  "kata_kunci_ditemukan": ["kata1", "kata2"],
  "alasan": "Ulasan 1-2 kalimat mengenai kesesuaian dan kelengkapan jawaban santri."
}`;

          const resAi = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.2,
                },
              }),
            }
          );

          if (resAi.ok) {
            const dataJson = await resAi.json();
            const textOut = dataJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = JSON.parse(textOut);
            skorAi = Math.min(bobotMax, Math.max(0, Number(parsed.skor) || 0));
            feedbackAi = `AI (Gemini): ${parsed.alasan || 'Jawaban dianalisis sesuai rubrik.'}`;
            kataKunciStr = Array.isArray(parsed.kata_kunci_ditemukan) ? parsed.kata_kunci_ditemukan.join(', ') : '';
          } else {
            // Fallback ke local keyword evaluator jika API gagal
            const localResult = evaluateWithKeywords(item.pertanyaan, item.kunci_ideal, item.rubrik_kata_kunci, santriAns, bobotMax);
            skorAi = localResult.skor;
            feedbackAi = localResult.feedback;
            kataKunciStr = localResult.kataKunciDitemukan.join(', ');
          }
        } catch (apiErr: any) {
          const localResult = evaluateWithKeywords(item.pertanyaan, item.kunci_ideal, item.rubrik_kata_kunci, santriAns, bobotMax);
          skorAi = localResult.skor;
          feedbackAi = localResult.feedback;
          kataKunciStr = localResult.kataKunciDitemukan.join(', ');
        }
      } else {
        // Mode Evaluasi Semantik Lokal (Kata Kunci & Panjang Kalimat)
        const localResult = evaluateWithKeywords(item.pertanyaan, item.kunci_ideal, item.rubrik_kata_kunci, santriAns, bobotMax);
        skorAi = localResult.skor;
        feedbackAi = localResult.feedback;
        kataKunciStr = localResult.kataKunciDitemukan.join(', ');
      }

      // Update skor saran AI ke database
      await pool.execute(
        `UPDATE ujian_essay_jawaban SET
           skor_ai = ?,
           feedback_ai = ?,
           kata_kunci_terdeteksi = ?,
           status_koreksi = 'dinilai_ai',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [skorAi, feedbackAi, kataKunciStr, item.id]
      );
      gradedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menganalisis ${gradedCount} butir jawaban essay santri dengan Asisten AI.`,
      graded_count: gradedCount,
    });
  } catch (error: any) {
    console.error('Error in POST /api/ujian/koreksi-ai:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
