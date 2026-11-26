'use client';

import { BookOpen, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { isEmptyScoreVal } from '@/lib/penilaian/calcNilai';

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

  return (
    <div className="w-full overflow-x-auto pb-4 print:overflow-visible print:pb-0">
      <div
        className="bg-white text-gray-900 rounded-3xl shadow-md border border-gray-200 p-10 print:border-none print:shadow-none print:p-0 print:m-0 w-[840px] max-w-4xl lg:w-full mx-auto print:w-auto print:max-w-none"
        style={{ fontFamily: '"Courier New", Courier, monospace' }}
      >
        {/* KOP RESMI PESANTREN */}
        <div className="border-b-4 border-double border-gray-900 pb-4 mb-6 text-center">
          <h3 className="text-2xl font-black tracking-wider uppercase">
            PONDOK PESANTREN MATHOLI&apos;UL ANWAR
          </h3>
          <h4 className="text-lg font-bold uppercase text-emerald-800">
            MADRASAH DINIYAH &amp; MADRASATUL QUR&apos;AN
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            Simo - Lamongan - Jawa Timur | Website: ppmawar.or.id
          </p>
          <div className="mt-3 inline-block bg-gray-900 text-white font-bold text-sm px-6 py-1 rounded-full uppercase tracking-widest">
            LAPORAN HASIL BELAJAR SANTRI (RAPORT)
          </div>
        </div>

        {/* IDENTITAS SANTRI DENGAN PAS FOTO RESMI */}
        <div className="flex flex-row items-start gap-5 mb-6 bg-gray-50 print:bg-transparent p-4 rounded-2xl border border-gray-200/60 print:border-none print:p-0">
          {/* Pas Foto Santri Resmi */}
          <div className="shrink-0">
            <div
              className={`w-24 h-28 rounded-xl overflow-hidden relative shadow-xs border-2 border-gray-300 bg-gray-100 ${
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

          {/* Rincian Identitas Santri (masing-masing 1 baris tanpa terpotong/bertumpuk, tanpa Wali Kelas) */}
          <div className="flex-1 min-w-0 text-sm space-y-1.5">
            <div className="flex items-baseline">
              <span className="w-44 shrink-0 font-bold text-gray-600">Nama Santri</span>
              <span className="font-black text-gray-900 flex-1">: {raportData.santri?.nama}</span>
            </div>
            <div className="flex items-baseline">
              <span className="w-44 shrink-0 font-bold text-gray-600">Nomor Induk (NIS)</span>
              <span className="flex-1 whitespace-nowrap">: {raportData.santri?.nis || '-'}</span>
            </div>
            <div className="flex items-baseline">
              <span className="w-44 shrink-0 font-bold text-gray-600">Kelas Madin</span>
              <span className="flex-1 whitespace-nowrap">: {raportData.santri?.nama_kelas_madin || '-'}</span>
            </div>
            <div className="flex items-baseline">
              <span className="w-44 shrink-0 font-bold text-gray-600">Semester / TA</span>
              <span className="font-bold flex-1 whitespace-nowrap">
                : {raportData.semester === '1' ? '1 (Ganjil)' : '2 (Genap)'} / {raportData.tahun_ajaran}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="w-44 shrink-0 font-bold text-gray-600">Kamar / Asrama</span>
              <span className="flex-1 whitespace-nowrap">
                : {raportData.santri?.nama_kamar} ({raportData.santri?.nama_asrama})
              </span>
            </div>
          </div>
        </div>

        {/* TABEL A: HASIL BELAJAR / NILAI AKADEMIK */}
        <div className="mb-6">
          <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
            <BookOpen size={14} /> A. Nilai Hasil Belajar (Madrasah Diniyah)
          </h5>
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 font-bold text-gray-800">
                  <th className="py-2.5 px-3 w-10 text-center border-r border-gray-300">No</th>
                  <th className="py-2.5 px-3 border-r border-gray-300">Mata Pelajaran</th>
                  <th className="py-2.5 px-3 border-r border-gray-300">Kitab yang Dipelajari</th>
                  <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">KKM</th>
                  {hasLisan && (
                    <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Lisan</th>
                  )}
                  <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Nilai</th>
                  <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Predikat</th>
                  <th className="py-2.5 px-3">Keterangan</th>
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
                      <td className="py-2 px-3 text-center border-r border-gray-200">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold border-r border-gray-200">{n.mata_pelajaran}</td>
                      <td className="py-2 px-3 italic text-gray-700 border-r border-gray-200">{n.kitab || '-'}</td>
                      <td className="py-2 px-2 text-center border-r border-gray-200">70</td>
                      {hasLisan && (
                        <td className="py-2 px-2 text-center font-semibold text-gray-800 border-r border-gray-200">
                          {!isEmptyScoreVal(n.nilai_lisan) ? n.nilai_lisan : '-'}
                        </td>
                      )}
                      <td className="py-2 px-2 text-center font-bold text-gray-900 border-r border-gray-200">{n.nilai_akhir}</td>
                      <td className="py-2 px-2 text-center font-black border-r border-gray-200">{n.predikat}</td>
                      <td className="py-2 px-3 text-gray-600">
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
                    <td colSpan={hasLisan ? 5 : 4} className="py-2.5 px-3 text-right border-r border-gray-300 uppercase">
                      Nilai Rata-Rata Akhir:
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-emerald-800 border-r border-gray-300">
                      {Number(raportData.ringkasan_nilai?.rata_rata) > 0 ? raportData.ringkasan_nilai.rata_rata : '-'}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-xs text-gray-600">
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

        {/* SINKRONISASI 1: TABEL B & C (BERTUMPUK FULL-WIDTH) */}
        <div className="space-y-6 mb-6">
          {/* TABEL B: REKAPITULASI PRESENSI */}
          <div>
            <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
              <ClipboardCheck size={14} className="text-blue-600" /> B. Rekapitulasi Presensi
            </h5>
            <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
              <table className="w-full">
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Hadir</td>
                    <td className="py-2 px-3 font-bold text-emerald-700">{raportData.rekap_absensi?.hadir ?? 0} kali</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Izin</td>
                    <td className="py-2 px-3 font-bold text-amber-700">{raportData.rekap_absensi?.izin ?? 0} kali</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Sakit</td>
                    <td className="py-2 px-3 font-bold text-blue-700">{raportData.rekap_absensi?.sakit ?? 0} kali</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Alpha / Tanpa Keterangan</td>
                    <td className="py-2 px-3 font-bold text-rose-700">{raportData.rekap_absensi?.alpha ?? 0} kali</td>
                  </tr>
                  <tr className="bg-gray-100 font-bold">
                    <td className="py-2 px-3 w-64 border-r border-gray-200">Persentase Kehadiran</td>
                    <td className="py-2 px-3 font-black text-gray-900">{raportData.rekap_absensi?.persentase ?? 100} persen</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABEL C: CATATAN KEDISIPLINAN */}
          <div>
            <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" /> C. Kedisiplinan &amp; Ketertiban
            </h5>
            <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
              <table className="w-full">
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Total Poin Pelanggaran</td>
                    <td className="py-2 px-3 font-bold text-gray-900">{raportData.rekap_kedisiplinan?.total_poin ?? 0} Poin</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Predikat Kedisiplinan</td>
                    <td className="py-2 px-3 font-black text-emerald-800">{raportData.rekap_kedisiplinan?.predikat || 'Sangat Baik'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Catatan Pelanggaran</td>
                    <td className="py-2 px-3 text-gray-600 italic">
                      {!raportData.rekap_kedisiplinan?.riwayat || raportData.rekap_kedisiplinan.riwayat.length === 0
                        ? 'Tidak ada catatan pelanggaran (Disiplin baik).'
                        : `${raportData.rekap_kedisiplinan.riwayat[0].jenis} (${raportData.rekap_kedisiplinan.riwayat[0].deskripsi || '-'})`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Capaian Tahfidz</td>
                    <td className="py-2 px-3 font-bold text-gray-800">{tahfidzText || '-'}</td>
                  </tr>
                  <tr className="bg-gray-100 font-bold">
                    <td className="py-2 px-3 w-64 border-r border-gray-200">Keputusan Akhir</td>
                    <td className="py-2 px-3 font-black text-emerald-800">{keputusanText}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CATATAN WALI KELAS */}
        <div className="border border-gray-300 rounded-xl p-4 mb-8 bg-gray-50 print:bg-transparent">
          <h6 className="font-bold text-xs uppercase text-gray-700 mb-1">Catatan Wali Kelas:</h6>
          <p className="text-xs text-gray-800 italic leading-relaxed">
            &quot;{catatanWaliText || 'Tingkatkan terus prestasi belajar dan ketaatan ibadah.'}&quot;
          </p>
        </div>

        {/* KOLOM TANDA TANGAN RESMI */}
        <div className="text-xs mt-10 pt-4">
          <p className="text-right text-gray-500">
            Lamongan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-center text-gray-500 mt-1 mb-1">Mengetahui,</p>
          <div className="grid grid-cols-2 gap-6 text-center">
            <div className="flex flex-col justify-between">
              <p className="font-bold text-gray-700">Orang Tua / Wali Santri</p>
              <div className="mt-16">
                <p className="font-bold border-t border-gray-400 mx-8 pt-1 whitespace-nowrap">
                  {raportData.santri?.nama_wali &&
                  String(raportData.santri.nama_wali).trim() &&
                  raportData.santri.nama_wali !== '-'
                    ? raportData.santri.nama_wali
                    : '( ......................... )'}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <p className="font-bold text-gray-700 whitespace-nowrap">
                Kepala Madrasah Diniyah PP. Matholi&apos;ul Anwar
              </p>
              <div className="mt-16">
                <p className="font-bold border-t border-gray-400 mx-8 pt-1 whitespace-nowrap">
                  {raportData.kepala_madin || 'Agus Naqoub Ashrofun Nasr'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
