import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const wb = xlsx.utils.book_new();

    // 1. DATA SHEET TEMPLATE SOAL
    const headers = [
      'No',
      'Tipe Soal (PILIHAN GANDA / ESSAY)',
      'Pertanyaan',
      'Opsi A',
      'Opsi B',
      'Opsi C',
      'Opsi D',
      'Opsi E',
      'Kunci Jawaban (A/B/C/D/E untuk PG | Jawaban Acuan untuk Essay)',
      'Kata Kunci AI (Khusus Essay, pisahkan koma)',
      'Bobot Nilai',
      'Pembahasan / Keterangan',
    ];

    const sampleRows = [
      [
        1,
        'PILIHAN GANDA',
        'Berapakah jumlah rukun Islam menurut hadits Arbain An-Nawawi?',
        '3 Rukun',
        '4 Rukun',
        '5 Rukun',
        '6 Rukun',
        '7 Rukun',
        'C',
        '',
        10,
        'Hadits kedua Arbain: Islam dibangun atas 5 perkara.',
      ],
      [
        2,
        'PILIHAN GANDA',
        'Berikut ini yang termasuk air mutlak (suci dan mensucikan) adalah...',
        'Air kopi manis',
        'Air sumur murni',
        'Air kelapa muda',
        'Air musta’mal',
        'Air mutanajjis',
        'B',
        '',
        10,
        'Air sumur adalah air asli yang turun dari langit atau keluar dari bumi tanpa perubahan sifat.',
      ],
      [
        3,
        'ESSAY',
        'Jelaskan takrif (definisi) Thaharah menurut istilah syariat Islam beserta tujuannya!',
        '',
        '',
        '',
        '',
        '',
        'Thaharah menurut syara adalah mengangkat atau membersihkan hadats dan najis dari tubuh, pakaian, atau tempat agar sah untuk mendirikan shalat atau ibadah lainnya.',
        'thaharah, membersihkan, bersuci, hadats, najis, sah shalat, ibadah',
        20,
        'Pastikan santri menyebutkan poin hadats, najis, dan keabsahan ibadah.',
      ],
      [
        4,
        'ESSAY',
        'Sebutkan 3 macam pembagian najis (Mukhaffafah, Mutawassithah, Mughalladhah) dan berikan masing-masing 1 contoh!',
        '',
        '',
        '',
        '',
        '',
        '1. Najis Mukhaffafah (ringan): air kencing bayi laki-laki yang belum makan selain ASI. 2. Najis Mutawassithah (sedang): darah, nanah, kotoran. 3. Najis Mughalladhah (berat): air liur atau jilatan anjing dan babi.',
        'mukhaffafah, mutawassithah, mughalladhah, kencing bayi laki-laki, darah, anjing, babi',
        20,
        'Ketiga macam najis harus disebutkan lengkap beserta contohnya.',
      ],
    ];

    const wsData = [headers, ...sampleRows];
    const wsTemplate = xlsx.utils.aoa_to_sheet(wsData);

    // Styling lebar kolom
    wsTemplate['!cols'] = [
      { wch: 6 },  // No
      { wch: 22 }, // Tipe
      { wch: 45 }, // Pertanyaan
      { wch: 20 }, // A
      { wch: 20 }, // B
      { wch: 20 }, // C
      { wch: 20 }, // D
      { wch: 20 }, // E
      { wch: 35 }, // Kunci
      { wch: 35 }, // Kata Kunci AI
      { wch: 12 }, // Bobot
      { wch: 35 }, // Pembahasan
    ];

    xlsx.utils.book_append_sheet(wb, wsTemplate, 'Template Soal');

    // 2. DATA SHEET PETUNJUK
    const petunjukData = [
      ['PANDUAN & PETUNJUK INPUT SOAL UJIAN SANTRI DIGITAL PPMAWAR'],
      [''],
      ['1. TIPE SOAL:'],
      ['   - PILIHAN GANDA : Wajib mengisi Pertanyaan, Opsi A, Opsi B. Opsi C, D, E bersifat opsional.'],
      ['   - ESSAY         : Wajib mengisi Pertanyaan, Kunci Jawaban Acuan, dan Kata Kunci AI. Kolom Opsi A-E dikosongkan.'],
      [''],
      ['2. KUNCI JAWABAN:'],
      ['   - Untuk Pilihan Ganda : Cukup isi 1 huruf kapital (A, B, C, D, atau E).'],
      ['   - Untuk Essay         : Tuliskan jawaban acuan / jawaban ideal yang diharapkan dari santri.'],
      [''],
      ['3. KATA KUNCI AI (KHUSUS ESSAY):'],
      ['   - Tuliskan kata-kata kunci pokok yang wajib ada pada jawaban santri, pisahkan dengan tanda koma (,).'],
      ['   - Contoh: thaharah, bersuci, hadats, najis, air mutlak'],
      ['   - Kata kunci ini akan digunakan oleh asisten AI untuk menganalisis dan memberi rekomendasi nilai secara akurat.'],
      [''],
      ['4. BOBOT NILAI:'],
      ['   - Isi dengan angka bobot poin per soal (contoh: 10, 15, atau 20).'],
      ['   - Total nilai seluruh soal akan otomatis dikalkulasikan ke skala 0 - 100 saat santri menyelesaikan ujian.'],
      [''],
      ['5. MENDUKUNG TEKS ARAB & HARAKAT:'],
      ['   - Anda dapat menyalin bait nadhom atau teks Arab langsung ke dalam kolom Pertanyaan atau Kunci Jawaban.'],
    ];
    const wsPetunjuk = xlsx.utils.aoa_to_sheet(petunjukData);
    wsPetunjuk['!cols'] = [{ wch: 100 }];
    xlsx.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk Pengisian');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template_soal_ujian_ppmawar.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Error generating template soal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
