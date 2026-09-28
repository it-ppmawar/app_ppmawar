'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, BookOpen, RefreshCw } from 'lucide-react';

function PreviewContent() {
  const params = useSearchParams();
  const murid_id = params.get('murid_id') || '';
  const semester = params.get('semester') || '1';
  const tahun_ajaran = params.get('tahun_ajaran') || '2025/2026';

  const [raportData, setRaportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!murid_id) { setError('Parameter tidak lengkap.'); setLoading(false); return; }
    const q = new URLSearchParams({ murid_id, semester, tahun_ajaran });
    fetch(`/api/penilaian/raport?${q.toString()}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setRaportData(json.data);
        } else {
          setError(json.error || 'Data raport tidak ditemukan.');
        }
      })
      .catch(() => setError('Gagal memuat data raport.'))
      .finally(() => setLoading(false));
  }, [murid_id, semester, tahun_ajaran]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <RefreshCw size={32} className="animate-spin text-amber-600" />
      <p className="font-bold text-gray-600">Memuat Raport Santri...</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-red-600 font-bold p-8 text-center">{error}</div>
  );
  if (!raportData) return null;

  const d = raportData;
  const semLabel = d.semester === '1' ? '1 (Ganjil)' : '2 (Genap)';

  return (
    <>
      {/* Tombol Print — hanya tampil di layar, tidak ikut print */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 py-2.5 z-50">
        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
          <BookOpen size={18} />
          <span>Preview Raport — {d.santri?.nama || '-'}</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95"
        >
          <Printer size={15} />
          <span>Cetak / Simpan PDF</span>
        </button>
      </div>

      {/* Konten Raport (A4 Print) */}
      <div className="print:pt-0 pt-14 bg-gray-100 print:bg-white min-h-screen">
        <div className="bg-white text-gray-900 max-w-4xl mx-auto p-8 sm:p-12 print:p-8 print:max-w-none shadow-md print:shadow-none">

          {/* KOP RESMI PESANTREN */}
          <div className="border-b-4 border-double border-gray-900 pb-4 mb-6 text-center">
            <h3 className="text-xl sm:text-2xl font-black tracking-wider uppercase font-serif">
              PONDOK PESANTREN MATHOLI&apos;UL ANWAR
            </h3>
            <h4 className="text-base sm:text-lg font-bold uppercase text-emerald-800 font-serif">
              MADRASAH DINIYAH &amp; LEMBAGA TAHFIDZ AL-QUR&apos;AN
            </h4>
            <p className="text-xs text-gray-600 mt-1 font-sans">
              Sugio - Lamongan - Jawa Timur | Website: ppmawar.or.id
            </p>
            <div className="mt-3 inline-block bg-gray-900 text-white font-bold text-xs sm:text-sm px-6 py-1 rounded-full uppercase tracking-widest">
              LAPORAN HASIL BELAJAR SANTRI (RAPORT)
            </div>
          </div>

          {/* IDENTITAS SANTRI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs sm:text-sm mb-6 bg-gray-50 print:bg-transparent p-4 rounded-2xl border border-gray-200/60 print:border-none print:p-0">
            <div className="space-y-1.5">
              <div className="flex"><span className="w-36 font-bold text-gray-600">Nama Santri</span><span className="font-black text-gray-900">: {d.santri?.nama}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600">Nomor Induk (NIS)</span><span>: {d.santri?.nis || '-'}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600">Kelas Madin</span><span>: {d.santri?.nama_kelas_madin}</span></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex"><span className="w-36 font-bold text-gray-600">Semester / TA</span><span className="font-bold">: {semLabel} / {d.tahun_ajaran}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600">Kamar / Asrama</span><span>: {d.santri?.nama_kamar} ({d.santri?.nama_asrama})</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600">Wali Kelas</span><span>: {d.santri?.wali_kelas || '-'}</span></div>
            </div>
          </div>

          {/* TABEL NILAI AKADEMIK */}
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
                    <th className="py-2.5 px-3 border-r border-gray-300">Kitab</th>
                    <th className="py-2.5 px-2 w-14 text-center border-r border-gray-300">KKM</th>
                    <th className="py-2.5 px-2 w-14 text-center border-r border-gray-300">Nilai</th>
                    <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Predikat</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {d.nilai?.length === 0 ? (
                    <tr><td colSpan={7} className="py-4 text-center text-gray-500 italic">Belum ada nilai yang diinput.</td></tr>
                  ) : (
                    d.nilai?.map((n: any, idx: number) => (
                      <tr key={n.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-center border-r border-gray-200">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold border-r border-gray-200">{n.mata_pelajaran}</td>
                        <td className="py-2 px-3 italic text-gray-700 border-r border-gray-200">{n.kitab || '-'}</td>
                        <td className="py-2 px-2 text-center border-r border-gray-200">70</td>
                        <td className="py-2 px-2 text-center font-bold text-gray-900 border-r border-gray-200">{n.nilai_akhir ?? '-'}</td>
                        <td className="py-2 px-2 text-center font-black border-r border-gray-200">{n.predikat ?? '-'}</td>
                        <td className="py-2 px-3 text-gray-600">{Number(n.nilai_akhir) >= 70 ? 'Tuntas' : 'Perlu Bimbingan'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* REKAP ABSENSI */}
          {d.absensi && (
            <div className="mb-6">
              <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2">B. Rekap Kehadiran</h5>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                {[
                  { label: 'Total Pertemuan', val: d.absensi.total ?? 0 },
                  { label: 'Hadir', val: d.absensi.hadir ?? 0 },
                  { label: 'Izin', val: d.absensi.izin ?? 0 },
                  { label: 'Sakit', val: d.absensi.sakit ?? 0 },
                  { label: 'Alpa', val: d.absensi.alpa ?? 0 },
                ].map(item => (
                  <div key={item.label} className="border border-gray-200 rounded-xl p-2">
                    <p className="font-black text-base text-gray-900">{item.val}</p>
                    <p className="text-gray-500 text-[10px]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CATATAN WALI KELAS */}
          <div className="mb-6 border border-gray-200 rounded-xl p-4">
            <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2">C. Catatan Wali Kelas</h5>
            <p className="text-xs text-gray-700 min-h-[48px] whitespace-pre-wrap">{d.catatan?.catatan_wali_kelas || '-'}</p>
          </div>

          {/* TANDA TANGAN */}
          <div className="grid grid-cols-3 gap-6 text-xs text-center mt-8">
            {[
              { label: 'Orang Tua / Wali', nama: '_________________' },
              { label: 'Wali Kelas', nama: d.santri?.wali_kelas || '_________________' },
              { label: 'Kepala Madrasah', nama: '_________________' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-gray-600">{item.label}</p>
                <div className="mt-12 border-t border-gray-400 pt-1">
                  <p className="font-bold text-gray-900">{item.nama}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}

export default function RaportPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw size={32} className="animate-spin text-amber-600" />
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}
