'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Printer, Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle, HelpCircle, FileText, ArrowLeft, RefreshCw, Sparkles, MapPin, BookOpen, ShieldCheck } from 'lucide-react';
import { exportToPDF } from '@/lib/exportUtils';

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
];

const getInitials = (nama: string): string => {
  if (!nama) return '?';
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nama.substring(0, 2).toUpperCase();
};

const getAvatarColor = (nama: string): string => {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getFotoUrl = (fotoName: string | null, nis?: string) => {
  if (!fotoName || fotoName === '-') {
    if (nis) return `https://mawar.smartpesantren.id/sekretariat/berkas/Berkas_2026_${nis}.jpg`;
    return '';
  }
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) return fotoName;
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  return `${baseUrl}${cleanFotoName}`;
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function RekapPreviewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('t') || searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [murid, setMurid] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('semua');

  useEffect(() => {
    if (!token) {
      setError('Tautan presensi tidak valid atau telah kedaluwarsa. Silakan hubungi pengurus pesantren.');
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/rekapitulasi/detail?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.data || []);
          setMurid(res.murid || null);
          setMeta(res.meta || null);
        } else {
          setError(res.error || 'Gagal memuat detail rekapitulasi.');
        }
      })
      .catch(err => {
        setError('Terjadi kendala jaringan saat memuat data: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Statistik Kehadiran
  const stats = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;

    data.forEach(item => {
      const s = (item.status || '').toLowerCase();
      if (s === 'hadir') hadir++;
      else if (s === 'izin') izin++;
      else if (s === 'sakit') sakit++;
      else if (s === 'alpha' || s === 'alpa' || s === '') alpha++;
    });

    const total = hadir + izin + sakit + alpha;
    const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

    return { hadir, izin, sakit, alpha, total, persentase };
  }, [data]);

  // Filter Baris Data
  const filteredData = useMemo(() => {
    if (statusFilter === 'semua') return data;
    return data.filter(item => (item.status || '').toLowerCase() === statusFilter.toLowerCase());
  }, [data, statusFilter]);

  // Periode Label
  const periodeLabel = useMemo(() => {
    if (!meta) return '-';
    if (meta.isRentang && meta.tanggal_dari && meta.tanggal_sampai) {
      return `${meta.tanggal_dari} s/d ${meta.tanggal_sampai}`;
    }
    if (meta.bulan && meta.tahun) {
      const bIdx = parseInt(meta.bulan) - 1;
      return `${MONTH_NAMES[bIdx] || meta.bulan} ${meta.tahun}`;
    }
    return '-';
  }, [meta]);

  // Kategori Label
  const tipeLabel = useMemo(() => {
    if (!meta) return 'Presensi';
    if (meta.tipe === 'madin') return 'Madrasah Diniyah (Madin)';
    if (meta.tipe === 'quran') return "Al-Qur'an (Tahfidz/Tartil)";
    if (meta.tipe === 'kegiatan') return 'Kegiatan Asrama / Pesantren';
    return meta.tipe;
  }, [meta]);

  // Handler Unduh PDF
  const handleDownloadPdf = () => {
    if (!murid || data.length === 0) return;

    const title = 'RINCIAN REKAPITULASI PRESENSI SANTRI';
    const subtitle = `Nama: ${murid.nama || '-'}\nNIS: ${murid.nis || '-'}\nKelas / Kamar: ${murid.kelas_madin || murid.kelas_quran || murid.nama_kamar || '-'}\nKategori: ${tipeLabel}${meta?.sub_filter ? ` (${meta.sub_filter})` : ''}`;
    const period = periodeLabel;
    const safeNama = (murid.nama || 'Santri').replace(/[^a-zA-Z0-9]/g, '_');
    const safePeriod = periodeLabel.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Rekap_Presensi_${safeNama}_${safePeriod}`;

    const columns = ['No', 'Hari, Tanggal', 'Waktu', 'Jadwal / Mapel / Kegiatan', 'Status', 'Keterangan', 'Diinput Oleh'];
    const rows = filteredData.map((r, idx) => [
      idx + 1,
      `${r.hari || ''}, ${r.tanggal || ''}`,
      r.jam_mulai ? `${r.jam_mulai}${r.jam_selesai ? ` - ${r.jam_selesai}` : ''}` : '-',
      r.mata_pelajaran || '-',
      r.status || '-',
      r.keterangan || '-',
      r.penginput || '-',
    ]);

    exportToPDF({ title, subtitle, period, columns, rows, filename, previewOnly: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center max-w-sm text-center">
          <RefreshCw size={36} className="text-purple-600 animate-spin mb-4" />
          <h3 className="text-base font-bold text-gray-800">Menyiapkan Rekapitulasi Presensi...</h3>
          <p className="text-xs text-gray-500 mt-1">Mengambil data resmi dari Sistem Presensi PPMA</p>
        </div>
      </div>
    );
  }

  if (error || !murid) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-red-100 flex flex-col items-center max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Informasi Tidak Dapat Ditampilkan</h3>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{error || 'Data santri tidak ditemukan.'}</p>
          <div className="mt-6 pt-4 border-t border-gray-100 w-full text-center">
            <p className="text-[11px] text-gray-400">Pondok Pesantren Matholi&apos;ul Anwar (PPMA)</p>
          </div>
        </div>
      </div>
    );
  }

  const avatarBg = getAvatarColor(murid.nama || '');
  const initials = getInitials(murid.nama || '');
  const fotoSrc = getFotoUrl(murid.foto, murid.nis);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased pb-16">
      {/* Top Floating App Bar (Print hidden) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-xs print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Rekapitulasi Presensi</h1>
              <p className="text-[11px] text-slate-500">Pondok Pesantren Mawar</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Cetak Dokumen"
            >
              <Printer size={15} /> Cetak
            </button>
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Download size={15} /> Unduh PDF
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Surat / Lembar Identitas Dokumen */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-7 relative overflow-hidden">
          {/* Aksen Latar Belakang */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          {/* Header Identitas Lembaga */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-6 border-b border-slate-100 text-center sm:text-left">
            <div className="w-20 h-20 rounded-2xl bg-purple-50 border-2 border-purple-100 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              {fotoSrc ? (
                <img
                  src={fotoSrc}
                  alt={murid.nama}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-xl font-bold text-purple-700">{initials}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck size={12} /> Dokumen Resmi Presensi
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {murid.nama}
              </h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                <span className="font-mono">NIS: <strong className="text-slate-800">{murid.nis || '-'}</strong></span>
                <span>•</span>
                <span>Kelas: <strong className="text-slate-800">{murid.kelas_madin || murid.kelas_quran || murid.nama_kamar || '-'}</strong></span>
                {murid.nama_wali && (
                  <>
                    <span>•</span>
                    <span>Wali: <strong className="text-slate-800">{murid.nama_wali}</strong></span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Button for Mobile */}
            <div className="sm:hidden w-full pt-3">
              <button
                onClick={handleDownloadPdf}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-2xl text-xs font-bold shadow-md shadow-purple-600/20 active:scale-[0.98] transition-all"
              >
                <Download size={16} /> Unduh Dokumen PDF
              </button>
            </div>
          </div>

          {/* Metadata Kegiatan & Periode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-5 text-xs">
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
              <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Kategori & Jadwal</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <BookOpen size={14} className="text-purple-600 shrink-0" />
                {tipeLabel} {meta?.sub_filter ? `(${meta.sub_filter})` : ''}
              </span>
            </div>
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
              <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Periode Rekapitulasi</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar size={14} className="text-purple-600 shrink-0" />
                {periodeLabel}
              </span>
            </div>
          </div>

          {/* Badge Keabsahan & Batas Waktu Token */}
          {meta?.expires_at && (
            <div className="mt-3 bg-purple-50/60 border border-purple-150/70 rounded-2xl p-2.5 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-purple-900">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck size={14} className="text-purple-600 shrink-0" />
                <span>Dokumen Resmi Terautentikasi Pesantren</span>
              </span>
              <span className="flex items-center gap-1 text-slate-500 font-medium">
                <Clock size={12} className="text-purple-500 shrink-0" />
                <span>Tautan preview ini berlaku s/d: <strong className="text-purple-700">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(meta.expires_at))}</strong></span>
              </span>
            </div>
          )}
        </div>

        {/* Ringkasan Statistik Presensi */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-xs font-bold">Hadir</span>
              <CheckCircle2 size={16} />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.hadir}</div>
            <span className="text-[10px] text-slate-400">Pertemuan</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 mb-1">
              <span className="text-xs font-bold">Izin</span>
              <FileText size={16} />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.izin}</div>
            <span className="text-[10px] text-slate-400">Pertemuan</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-xs font-bold">Sakit</span>
              <AlertCircle size={16} />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.sakit}</div>
            <span className="text-[10px] text-slate-400">Pertemuan</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-rose-600 mb-1">
              <span className="text-xs font-bold">Alpha</span>
              <XCircle size={16} />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.alpha}</div>
            <span className="text-[10px] text-slate-400">Pertemuan</span>
          </div>
        </div>

        {/* Persentase Kehadiran Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Tingkat Kehadiran:</span>
              <span className="text-base font-black text-purple-600">{stats.persentase}%</span>
              <span className="text-xs text-slate-400 font-medium">({stats.hadir} dari {stats.total} sesi)</span>
            </div>
            <div className="w-full sm:w-64 bg-slate-100 rounded-full h-2 mt-2 overflow-hidden flex">
              <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: `${stats.persentase}%` }} />
            </div>
          </div>

          {/* Filter Status Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-[11px] font-bold w-full sm:w-auto overflow-x-auto">
            {['semua', 'hadir', 'izin', 'sakit', 'alpha'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-purple-700 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Tabel Detail Riwayat Kehadiran (Foto 2) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Calendar size={16} className="text-purple-600" />
              Catatan Rincian Presensi Sesi
            </h3>
            <span className="text-xs text-slate-400 font-medium">{filteredData.length} Catatan</span>
          </div>

          {filteredData.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Tidak ada catatan presensi untuk kriteria yang dipilih.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Hari, Tanggal</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Jadwal / Mapel / Kegiatan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Diinput Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredData.map((row, idx) => {
                    const st = (row.status || '').toLowerCase();
                    const badgeClass =
                      st === 'hadir'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : st === 'izin'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : st === 'sakit'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{row.hari || '-'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{row.tanggal || '-'}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                          {row.jam_mulai ? `${row.jam_mulai}${row.jam_selesai ? ` - ${row.jam_selesai}` : ''}` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{row.mata_pelajaran || '-'}</div>
                          {row.keterangan && (
                            <div className="text-[11px] text-slate-400 italic mt-0.5">Ket: {row.keterangan}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeClass}`}>
                            {row.status || 'Alpha'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 text-[11px]">
                          {row.penginput || 'Pengajar'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Dokumen */}
          <div className="p-5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-3 text-center sm:text-left">
            <span>Dokumen ini diterbitkan sah oleh Sistem Presensi Terpadu Pondok Pesantren Mawar.</span>
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 text-purple-600 font-bold hover:underline cursor-pointer"
            >
              <Download size={13} /> Unduh PDF Lengkap
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

export default function RekapPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <RefreshCw size={32} className="text-purple-600 animate-spin" />
      </div>
    }>
      <RekapPreviewContent />
    </Suspense>
  );
}
