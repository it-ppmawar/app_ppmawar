import * as XLSX from 'xlsx';
import { isEmptyScoreVal, resolvePengaturanNilai } from '@/lib/penilaian/calcNilai';

export interface RaportExcelOverrides {
  tahfidz_hafalan?: string;
  status_kelulusan?: string;
  catatan_wali_kelas?: string;
  batas_nilai_tuntas?: string;
  keterangan_tuntas?: string;
  keterangan_bimbingan?: string;
}

/**
 * Mengekspor data raport santri ke file Excel (.xlsx) dengan format standar pesantren.
 */
export function exportRaportToExcel(raportData: any, overrides?: RaportExcelOverrides) {
  if (!raportData) return;

  const wb = XLSX.utils.book_new();
  const listNilai = Array.isArray(raportData.nilai) ? raportData.nilai : [];
  const hasLisan = listNilai.some((n: any) => !isEmptyScoreVal(n.nilai_lisan));
  const {
    batasNilaiTuntas,
    keteranganTuntas,
    keteranganBimbingan,
  } = resolvePengaturanNilai(raportData.pengaturan_nilai, overrides);

  const tahfidz = overrides?.tahfidz_hafalan ?? raportData.catatan?.tahfidz_hafalan ?? '';
  const keputusan = overrides?.status_kelulusan ?? raportData.catatan?.status_kelulusan ?? '-';
  const catatanWali =
    overrides?.catatan_wali_kelas ??
    raportData.catatan?.catatan_wali_kelas ??
    'Tingkatkan terus prestasi belajar dan ketaatan ibadah.';

  const nilaiRows = [
    ['LAPORAN HASIL BELAJAR SANTRI (RAPORT)'],
    ["Pondok Pesantren Matholi'ul Anwar — Madrasah Diniyah"],
    [],
    ['Nama Santri', raportData.santri?.nama || '-'],
    ['NIS', raportData.santri?.nis || '-'],
    ['Kelas Madin', raportData.santri?.nama_kelas_madin || '-'],
    [
      'Semester / Tahun Ajaran',
      `${raportData.semester === '1' ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)'} / ${raportData.tahun_ajaran || '-'}`,
    ],
    ['Kamar / Asrama', `${raportData.santri?.nama_kamar || '-'} (${raportData.santri?.nama_asrama || '-'})`],
    ['Nama Wali Santri', raportData.santri?.nama_wali || '-'],
    [],
    ['A. NILAI HASIL BELAJAR'],
    hasLisan
      ? ['No', 'Mata Pelajaran', 'Kitab yang Dipelajari', 'KKM', 'Ujian Lisan', 'Nilai Akhir', 'Predikat', 'Keterangan']
      : ['No', 'Mata Pelajaran', 'Kitab yang Dipelajari', 'KKM', 'Nilai Akhir', 'Predikat', 'Keterangan'],
    ...listNilai.map((n: any, i: number) => {
      const hasFinal = !isEmptyScoreVal(n.nilai_akhir) && String(n.nilai_akhir).trim() !== '-';
      const finalNumber = hasFinal ? Number(n.nilai_akhir) : NaN;
      const rowKeterangan =
        n.catatan ||
        (Number.isFinite(finalNumber)
          ? finalNumber >= batasNilaiTuntas
            ? keteranganTuntas
            : keteranganBimbingan
          : 'Belum Dinilai');
      return hasLisan
        ? [
            i + 1,
            n.mata_pelajaran,
            n.kitab || '-',
            batasNilaiTuntas,
            !isEmptyScoreVal(n.nilai_lisan) ? n.nilai_lisan : '-',
            n.nilai_akhir,
            n.predikat,
            rowKeterangan,
          ]
        : [
            i + 1,
            n.mata_pelajaran,
            n.kitab || '-',
            batasNilaiTuntas,
            n.nilai_akhir,
            n.predikat,
            rowKeterangan,
          ];
    }),
    [],
    hasLisan
      ? ['', '', '', '', 'Nilai Rata-Rata Akhir:', raportData.ringkasan_nilai?.rata_rata, '', `Dari ${raportData.ringkasan_nilai?.total_mapel} mata pelajaran`]
      : ['', '', '', 'Nilai Rata-Rata Akhir:', raportData.ringkasan_nilai?.rata_rata, '', `Dari ${raportData.ringkasan_nilai?.total_mapel} mata pelajaran`],
    [],
    ['B. REKAPITULASI PRESENSI'],
    ['Hadir', (raportData.rekap_absensi?.hadir ?? 0) + ' kali'],
    ['Izin', (raportData.rekap_absensi?.izin ?? 0) + ' kali'],
    ['Sakit', (raportData.rekap_absensi?.sakit ?? 0) + ' kali'],
    ['Alpha / Tanpa Keterangan', (raportData.rekap_absensi?.alpha ?? 0) + ' kali'],
    ['Persentase Kehadiran', (raportData.rekap_absensi?.persentase ?? 100) + '%'],
    [],
    ['C. KEDISIPLINAN & KETERTIBAN'],
    ['Total Poin Pelanggaran', (raportData.rekap_kedisiplinan?.total_poin ?? 0) + ' Poin'],
    ['Predikat Kedisiplinan', raportData.rekap_kedisiplinan?.predikat || '-'],
    ['Capaian Tahfidz', tahfidz || '-'],
    ['Keputusan Akhir', keputusan],
    [],
    ['D. CATATAN WALI KELAS'],
    [catatanWali],
  ];

  const ws = XLSX.utils.aoa_to_sheet(nilaiRows);
  ws['!cols'] = hasLisan
    ? [{ wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }]
    : [{ wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Raport Santri');

  const namaSantri = (raportData.santri?.nama || 'Santri')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const smstr = raportData.semester === '1' ? 'Ganjil' : 'Genap';
  XLSX.writeFile(wb, `Raport_${namaSantri}_Sem${smstr}_${String(raportData.tahun_ajaran || '').replace('/', '-')}.xlsx`);
}
