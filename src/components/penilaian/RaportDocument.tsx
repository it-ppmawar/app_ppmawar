'use client';

import { BookOpen } from 'lucide-react';
import { isEmptyScoreVal } from '@/lib/penilaian/calcNilai';
import RaportKopHeader from '@/components/penilaian/RaportKopHeader';
import RaportFooterSections, { RaportKedisiplinanRow } from '@/components/penilaian/RaportFooterSections';

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
];

function getInitials(nama: string): string {
  if (!nama) return '?';
  const parts = nama.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nama.substring(0, 2).toUpperCase();
}

function getAvatarColor(nama: string): string {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) {
    hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export interface RaportDocumentProps {
  raportData: any;
  editCatatan?: {
    catatan_wali_kelas?: string;
    akhlak?: string;
    tahfidz_hafalan?: string;
    status_kelulusan?: string;
  };
  getFotoUrl: (fotoName: string | null, nis?: string) => string;
  onZoomPhoto?: (url: string) => void;
}

/**
 * Lembar Raport Resmi A4 PP. Matholi'ul Anwar dengan tata letak konsisten di PC, HP (horizontal scroll), dan Cetak PDF.
 */
export default function RaportDocument({
  raportData,
  editCatatan,
  getFotoUrl,
  onZoomPhoto,
}: RaportDocumentProps) {
  if (!raportData) return null;

  const listNilai = Array.isArray(raportData.nilai) ? raportData.nilai : [];
  const hasLisan = listNilai.some((n: any) => !isEmptyScoreVal(n.nilai_lisan));

  const tahfidzText = editCatatan?.tahfidz_hafalan ?? raportData.catatan?.tahfidz_hafalan ?? '';
  const keputusanText = editCatatan?.status_kelulusan ?? raportData.catatan?.status_kelulusan ?? 'Lanjut ke Semester Berikutnya';
  const catatanWaliText =
    editCatatan?.catatan_wali_kelas ??
    raportData.catatan?.catatan_wali_kelas ??
    '';

  const fotoSrc = getFotoUrl(raportData.santri?.foto, raportData.santri?.nis);
  const canZoomFoto = Boolean(fotoSrc && onZoomPhoto);

  const kedisiplinanRows: RaportKedisiplinanRow[] = [
    {
      label: 'Total Poin Pelanggaran',
      value: `${raportData.rekap_kedisiplinan?.total_poin ?? 0} Poin`,
      valueClassName: 'font-bold text-gray-900',
    },
    {
      label: 'Predikat Kedisiplinan',
      value: raportData.rekap_kedisiplinan?.predikat || 'Sangat Baik',
      valueClassName: 'font-black text-emerald-800',
    },
    {
      label: 'Catatan Pelanggaran',
      value:
        !raportData.rekap_kedisiplinan?.riwayat || raportData.rekap_kedisiplinan.riwayat.length === 0
          ? 'Tidak ada catatan pelanggaran.'
          : `${raportData.rekap_kedisiplinan.riwayat[0].jenis} (${raportData.rekap_kedisiplinan.riwayat[0].deskripsi || '-'})`,
      valueClassName: 'text-gray-600 italic font-normal',
    },
    {
      label: 'Capaian Tahfidz',
      value: tahfidzText || '-',
      valueClassName: 'font-bold text-gray-800',
    },
    {
      label: 'Keputusan Akhir',
      value: keputusanText,
      valueClassName: 'font-black text-emerald-800',
      highlightRow: true,
    },
  ];

  return (
    <div className="w-full overflow-x-auto pb-4 print:overflow-visible print:pb-0">
      <div
        className="bg-white text-gray-900 rounded-3xl shadow-md border border-gray-200 p-9 print:border-none print:shadow-none print:p-0 print:m-0 w-[794px] min-h-[1123px] flex flex-col mx-auto print:w-full print:min-h-0"
        style={{ fontFamily: '"Courier New", Courier, monospace' }}
      >
        {/* KOP RESMI PESANTREN */}
        <RaportKopHeader />

        {/* IDENTITAS SANTRI DENGAN PAS FOTO RESMI */}
        <div className="flex flex-row items-start gap-4 mb-4 bg-gray-50 print:bg-transparent p-3.5 rounded-2xl border border-gray-200/60 print:border-none print:p-0">
          {/* Pas Foto Santri Resmi */}
          <div className="shrink-0">
            <div
              className={`w-[88px] h-[104px] rounded-xl overflow-hidden relative shadow-xs border-2 border-gray-300 bg-gray-100 ${
                canZoomFoto ? 'cursor-pointer hover:opacity-90' : ''
              }`}
              onClick={() => (canZoomFoto ? onZoomPhoto?.(fotoSrc) : null)}
              title={canZoomFoto ? 'Foto Santri (klik untuk memperbesar)' : undefined}
            >
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: getAvatarColor(raportData.santri?.nama || '') }}
              >
                <span className="text-white text-base font-bold leading-none">
                  {getInitials(raportData.santri?.nama || '')}
                </span>
              </div>
              {fotoSrc && (
                <img
                  src={fotoSrc}
                  alt={raportData.santri?.nama || 'Foto Santri'}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0';
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>
          </div>

          {/* Rincian Identitas Santri */}
          <div className="flex-1 min-w-0 text-xs sm:text-[13px] print:text-xs space-y-1">
            <div className="flex items-baseline">
              <span className="w-40 shrink-0 font-bold text-gray-600">Nama Santri</span>
              <span className="font-black text-gray-900 flex-1">: {raportData.santri?.nama}</span>
            </div>
            <div className="flex items-baseline">
              <span className="w-40 shrink-0 font-bold text-gray-600">Nomor Induk (NIS)</span>
              <span className="flex-1 whitespace-nowrap">: {raportData.santri?.nis || '-'}</span>
            </div>
            <div className="flex items-baseline">
              <span className="w-40 shrink-0 font-bold text-gray-600">Kelas Madin</span>
              <span className="flex-1 whitespace-nowrap">: {raportData.santri?.nama_kelas_madin || '-'}</span>
            </div>
            <div className="flex items-baseline">
              <span className="w-40 shrink-0 font-bold text-gray-600">Semester / TA</span>
              <span className="font-bold flex-1 whitespace-nowrap">
                : {raportData.semester === '1' ? '1 (Ganjil)' : '2 (Genap)'} / {raportData.tahun_ajaran}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="w-40 shrink-0 font-bold text-gray-600">Kamar / Asrama</span>
              <span className="flex-1 whitespace-nowrap">
                : {raportData.santri?.nama_kamar} ({raportData.santri?.nama_asrama})
              </span>
            </div>
          </div>
        </div>

        {/* TABEL A: HASIL BELAJAR / NILAI AKADEMIK */}
        <div className="mb-4">
          <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5">
            <BookOpen size={14} /> A. Nilai Hasil Belajar
          </h5>
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 font-bold text-gray-800">
                  <th className="py-2 px-2.5 w-9 text-center border-r border-gray-300">No</th>
                  <th className="py-2 px-2.5 border-r border-gray-300">Mata Pelajaran</th>
                  <th className="py-2 px-2.5 border-r border-gray-300">Kitab yang Dipelajari</th>
                  <th className="py-2 px-2 w-12 text-center border-r border-gray-300">KKM</th>
                  {hasLisan && (
                    <th className="py-2 px-2 w-14 text-center border-r border-gray-300">Lisan</th>
                  )}
                  <th className="py-2 px-2 w-14 text-center border-r border-gray-300">Nilai</th>
                  <th className="py-2 px-2 w-16 text-center border-r border-gray-300">Predikat</th>
                  <th className="py-2 px-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {listNilai.length === 0 ? (
                  <tr>
                    <td colSpan={hasLisan ? 8 : 7} className="py-4 text-center text-gray-500 italic">
                      Belum ada nilai yang diinput untuk santri ini pada semester ini.
                    </td>
                  </tr>
                ) : (
                  listNilai.map((n: any, idx: number) => (
                    <tr key={n.id || idx} className="hover:bg-gray-50">
                      <td className="py-1.5 px-2.5 text-center border-r border-gray-200">{idx + 1}</td>
                      <td className="py-1.5 px-2.5 font-bold border-r border-gray-200">{n.mata_pelajaran}</td>
                      <td className="py-1.5 px-2.5 italic text-gray-700 border-r border-gray-200">{n.kitab || '-'}</td>
                      <td className="py-1.5 px-2 text-center border-r border-gray-200">70</td>
                      {hasLisan && (
                        <td className="py-1.5 px-2 text-center font-semibold text-gray-800 border-r border-gray-200">
                          {!isEmptyScoreVal(n.nilai_lisan) ? n.nilai_lisan : '-'}
                        </td>
                      )}
                      <td className="py-1.5 px-2 text-center font-bold text-gray-900 border-r border-gray-200">{n.nilai_akhir}</td>
                      <td className="py-1.5 px-2 text-center font-black border-r border-gray-200">{n.predikat}</td>
                      <td className="py-1.5 px-2.5 text-gray-600">
                        {Number(n.nilai_akhir) >= 70
                          ? 'Tuntas'
                          : Number(n.nilai_akhir) > 0
                            ? 'Perlu Bimbingan'
                            : n.catatan || 'Belum Dinilai'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {listNilai.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t border-gray-300">
                    <td colSpan={hasLisan ? 5 : 4} className="py-2 px-2.5 text-right border-r border-gray-300 uppercase">
                      Nilai Rata-Rata Akhir:
                    </td>
                    <td className="py-2 px-2 text-center font-black text-emerald-800 border-r border-gray-300">
                      {Number(raportData.ringkasan_nilai?.rata_rata) > 0 ? raportData.ringkasan_nilai.rata_rata : '-'}
                    </td>
                    <td colSpan={2} className="py-2 px-2.5 text-[11px] text-gray-600">
                      {Number(raportData.ringkasan_nilai?.rata_rata) > 0
                        ? `Dari total ${raportData.ringkasan_nilai.total_mapel} mata pelajaran`
                        : 'Belum ada nilai akhir yang dihitung'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* TABEL B & C BERDAMPINGAN + CATATAN WALI KELAS + TANDA TANGAN RESMI */}
        <RaportFooterSections
          absensi={raportData.rekap_absensi || {}}
          kedisiplinanRows={kedisiplinanRows}
          catatanTitle="Catatan Wali Kelas:"
          catatanContent={
            <p className="italic leading-snug">
              &quot;{catatanWaliText || 'Tingkatkan terus prestasi belajar dan ketaatan ibadah.'}&quot;
            </p>
          }
          namaWali={raportData.santri?.nama_wali}
          kepalaMadin={raportData.kepala_madin}
        />
      </div>
    </div>
  );
}
