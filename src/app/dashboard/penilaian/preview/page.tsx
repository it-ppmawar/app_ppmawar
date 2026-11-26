'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, BookOpen, RefreshCw } from 'lucide-react';

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
];

const getInitials = (nama: string): string => {
  if (!nama) return '?';
  const parts = nama.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nama.substring(0, 2).toUpperCase();
};

const getAvatarColor = (nama: string): string => {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getFotoUrl = (fotoName: string | null) => {
  if (!fotoName || fotoName === '-') return '';
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) return fotoName;
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) return `/uploads/${fotoName}`;
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  return `${baseUrl}${cleanFotoName}`;
};

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
      <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between gap-2 px-4 py-2.5 z-50">
        <div className="flex items-center gap-2 text-amber-700 font-bold text-xs sm:text-sm min-w-0">
          <BookOpen size={18} className="shrink-0" />
          <span className="truncate">Preview Raport — {d.santri?.nama || '-'}</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shrink-0"
        >
          <Printer size={15} />
          <span>Cetak / Simpan PDF</span>
        </button>
      </div>

      {/* Konten Raport (A4 Print — Konsisten di PC & HP) */}
      <div className="print:pt-0 pt-14 bg-gray-100 print:bg-white min-h-screen w-full overflow-x-auto print:overflow-visible">
        <div className="bg-white text-gray-900 w-[840px] max-w-4xl lg:w-full mx-auto p-10 print:p-8 print:w-auto print:max-w-none shadow-md print:shadow-none" style={{ fontFamily: '"Courier New", Courier, monospace' }}>

          {/* KOP RESMI PESANTREN */}
          <div className="border-b-4 border-double border-gray-900 pb-4 mb-6 text-center">
            <h3 className="text-2xl font-black tracking-wider uppercase font-serif">
              PONDOK PESANTREN MATHOLI&apos;UL ANWAR
            </h3>
            <h4 className="text-lg font-bold uppercase text-emerald-800 font-serif">
              MADRASAH DINIYAH &amp; MADRASATUL QUR&apos;AN
            </h4>
            <p className="text-xs text-gray-600 mt-1 font-sans">
              Simo - Lamongan - Jawa Timur | Website: ppmawar.or.id
            </p>
            <div className="mt-3 inline-block bg-gray-900 text-white font-bold text-sm px-6 py-1 rounded-full uppercase tracking-widest">
              LAPORAN HASIL BELAJAR SANTRI (RAPORT)
            </div>
          </div>

          {/* IDENTITAS SANTRI DENGAN PAS FOTO */}
          <div className="flex flex-row items-start gap-5 mb-6 bg-gray-50 print:bg-transparent p-4 rounded-2xl border border-gray-200/60 print:border-none print:p-0">
            {/* Pas Foto Santri */}
            <div className="shrink-0">
              <div className="w-24 h-28 rounded-xl overflow-hidden relative shadow-xs border-2 border-gray-300 bg-gray-100">
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: getAvatarColor(d.santri?.nama || '') }}
                >
                  <span className="text-white text-base font-bold leading-none">{getInitials(d.santri?.nama || '')}</span>
                </div>
                {d.santri?.foto && d.santri.foto !== '-' && (
                  <img
                    src={getFotoUrl(d.santri.foto)}
                    alt={d.santri?.nama}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0';
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 text-sm space-y-1.5">
              <div className="flex items-baseline">
                <span className="w-44 shrink-0 font-bold text-gray-600">Nama Santri</span>
                <span className="font-black text-gray-900 flex-1">: {d.santri?.nama}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-44 shrink-0 font-bold text-gray-600">Nomor Induk (NIS)</span>
                <span className="flex-1 whitespace-nowrap">: {d.santri?.nis || '-'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-44 shrink-0 font-bold text-gray-600">Kelas Madin</span>
                <span className="flex-1 whitespace-nowrap">: {d.santri?.nama_kelas_madin || '-'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-44 shrink-0 font-bold text-gray-600">Semester / TA</span>
                <span className="font-bold flex-1 whitespace-nowrap">: {semLabel} / {d.tahun_ajaran}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-44 shrink-0 font-bold text-gray-600">Kamar / Asrama</span>
                <span className="flex-1 whitespace-nowrap">: {d.santri?.nama_kamar} ({d.santri?.nama_asrama})</span>
              </div>
            </div>
          </div>

          {/* TABEL NILAI AKADEMIK */}
          {(() => {
            const nilaiList = Array.isArray(d.nilai) ? d.nilai : [];
            const hasLisan = nilaiList.some(
              (n: any) => n.nilai_lisan !== null && n.nilai_lisan !== undefined && String(n.nilai_lisan).trim() !== ''
            );
            const abs = d.rekap_absensi || d.absensi;

            return (
              <>
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
                          {hasLisan && (
                            <th className="py-2.5 px-2 w-14 text-center border-r border-gray-300">Lisan</th>
                          )}
                          <th className="py-2.5 px-2 w-14 text-center border-r border-gray-300">Nilai</th>
                          <th className="py-2.5 px-2 w-16 text-center border-r border-gray-300">Predikat</th>
                          <th className="py-2.5 px-3">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {nilaiList.length === 0 ? (
                          <tr>
                            <td colSpan={hasLisan ? 8 : 7} className="py-4 text-center text-gray-500 italic">
                              Belum ada nilai yang diinput untuk santri ini pada semester ini.
                            </td>
                          </tr>
                        ) : (
                          nilaiList.map((n: any, idx: number) => (
                            <tr key={n.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 text-center border-r border-gray-200">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold border-r border-gray-200">{n.mata_pelajaran}</td>
                              <td className="py-2 px-3 italic text-gray-700 border-r border-gray-200">{n.kitab || '-'}</td>
                              <td className="py-2 px-2 text-center border-r border-gray-200">70</td>
                              {hasLisan && (
                                <td className="py-2 px-2 text-center font-semibold text-gray-800 border-r border-gray-200">
                                  {n.nilai_lisan !== null && n.nilai_lisan !== undefined && String(n.nilai_lisan).trim() !== ''
                                    ? n.nilai_lisan
                                    : '-'}
                                </td>
                              )}
                              <td className="py-2 px-2 text-center font-bold text-gray-900 border-r border-gray-200">{n.nilai_akhir ?? '-'}</td>
                              <td className="py-2 px-2 text-center font-black border-r border-gray-200">{n.predikat ?? '-'}</td>
                              <td className="py-2 px-3 text-gray-600">{Number(n.nilai_akhir) >= 70 ? 'Tuntas' : Number(n.nilai_akhir) > 0 ? 'Perlu Bimbingan' : (n.catatan || 'Belum Dinilai')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {nilaiList.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-100 font-bold border-t border-gray-300">
                            <td colSpan={hasLisan ? 5 : 4} className="py-2.5 px-3 text-right border-r border-gray-300 uppercase">
                              Nilai Rata-Rata Akhir:
                            </td>
                            <td className="py-2.5 px-2 text-center font-black text-emerald-800 border-r border-gray-300">
                              {d.ringkasan_nilai?.rata_rata ?? '0.00'}
                            </td>
                            <td colSpan={2} className="py-2.5 px-3 text-xs text-gray-600">
                              Dari total {d.ringkasan_nilai?.total_mapel ?? nilaiList.length} mata pelajaran
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* REKAP ABSENSI & KEDISIPLINAN (BERTUMPUK FULL-WIDTH) */}
                <div className="space-y-6 mb-6">
                  {abs && (
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2">B. Rekapitulasi Presensi</h5>
                      <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-200">
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Hadir</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{abs.hadir ?? 0} kali</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Izin</td>
                              <td className="py-2 px-3 font-bold text-amber-700">{abs.izin ?? 0} kali</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Sakit</td>
                              <td className="py-2 px-3 font-bold text-blue-700">{abs.sakit ?? 0} kali</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Alpha / Tanpa Keterangan</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{abs.alpha ?? abs.alpa ?? 0} kali</td>
                            </tr>
                            <tr className="bg-gray-100 font-bold">
                              <td className="py-2 px-3 w-64 border-r border-gray-200">Persentase Kehadiran</td>
                              <td className="py-2 px-3 font-black text-gray-900">{abs.persentase ?? 100}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {d.rekap_kedisiplinan && (
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2">C. Kedisiplinan &amp; Ketertiban</h5>
                      <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-200">
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Predikat Kedisiplinan</td>
                              <td className="py-2 px-3 font-black text-emerald-800">{d.rekap_kedisiplinan.predikat}</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Catatan Pelanggaran</td>
                              <td className="py-2 px-3 text-gray-600 italic">
                                {!d.rekap_kedisiplinan.riwayat || d.rekap_kedisiplinan.riwayat.length === 0
                                  ? 'Tidak ada catatan pelanggaran (Disiplin baik).'
                                  : `${d.rekap_kedisiplinan.riwayat[0].jenis} (${d.rekap_kedisiplinan.riwayat[0].deskripsi || '-'})`}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Predikat Akhlak</td>
                              <td className="py-2 px-3 font-bold text-gray-800">{d.catatan?.akhlak || 'Baik'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 w-64 font-semibold bg-gray-50 border-r border-gray-200">Capaian Tahfidz</td>
                              <td className="py-2 px-3 font-bold text-gray-800">{d.catatan?.tahfidz_hafalan || '-'}</td>
                            </tr>
                            <tr className="bg-gray-100 font-bold">
                              <td className="py-2 px-3 w-64 border-r border-gray-200">Keputusan Akhir</td>
                              <td className="py-2 px-3 font-black text-emerald-800">{d.catatan?.status_kelulusan || '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* CATATAN WALI KELAS */}
          <div className="mb-6 border border-gray-200 rounded-xl p-4">
            <h5 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2">D. Catatan Wali Kelas</h5>
            <p className="text-xs text-gray-700 min-h-[48px] whitespace-pre-wrap">{d.catatan?.catatan_wali_kelas || '-'}</p>
          </div>

          {/* TANDA TANGAN */}
          <div className="text-xs mt-8">
            <p className="text-right text-gray-500">
              Lamongan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-center text-gray-500 mt-1 mb-1">Mengetahui,</p>
            <div className="grid grid-cols-2 gap-6 text-center">
              <div className="flex flex-col justify-between">
                <p className="font-bold text-gray-700">Orang Tua / Wali Santri</p>
                <div className="mt-16">
                  <p className="font-bold border-t border-gray-400 mx-8 pt-1 whitespace-nowrap">
                    {d.santri?.nama_wali && String(d.santri.nama_wali).trim() && d.santri.nama_wali !== '-'
                      ? d.santri.nama_wali
                      : '( ......................... )'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-between">
                <p className="font-bold text-gray-700 whitespace-nowrap">Kepala Madrasah Diniyah PP. Matholi&apos;ul Anwar</p>
                <div className="mt-16">
                  <p className="font-bold border-t border-gray-400 mx-8 pt-1 whitespace-nowrap">
                    {(d as any).kepala_madin || 'Agus Naqoub Ashrofun Nasr'}
                  </p>
                </div>
              </div>
            </div>
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
