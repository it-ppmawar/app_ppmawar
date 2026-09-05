'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  QrCode, Download, Send, Search, Building2, RefreshCw, FileText,
  Archive, CheckCircle2, Phone, X, ExternalLink, Sparkles, AlertCircle, Eye
} from 'lucide-react';
import Link from 'next/link';

const HOMEBASES = [
  'SEMUA',
  'TKM NU MAWAR',
  'MI BANIN',
  'MI BANAT',
  'SMP NU',
  'MTS PUTRA-PUTRI',
  'MA MAWAR',
  'SMK NU',
  'MADIN',
  'MQ',
  'KOPMA',
  'KLINIK',
  'KBIHU MAWAR'
];

export default function QrDewanGuruPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [isPengasuh, setIsPengasuh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedHomebase, setSelectedHomebase] = useState('SEMUA');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Preview Modal
  const [previewGuru, setPreviewGuru] = useState<any>(null);

  // Send WhatsApp Modal
  const [waModalGuru, setWaModalGuru] = useState<any>(null);
  const [waCustomPhone, setWaCustomPhone] = useState('');
  const [copied, setCopied] = useState(false);

  // Check auth
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const d = await res.json();
        if (!d.success) {
          router.replace('/dashboard');
          return;
        }
        const user = d.user;
        const pengasuhFlag = user.role === 'pengasuh' || user.is_pengasuh || user.isPengasuh;
        if (user.role !== 'admin' && user.role !== 'staff' && !pengasuhFlag) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        setIsPengasuh(!!pengasuhFlag);
      } catch {
        router.replace('/dashboard');
      }
    })();
  }, [router]);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/dewan-guru?all=true';
      if (selectedHomebase !== 'SEMUA') url += `&homebase=${encodeURIComponent(selectedHomebase)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setTeachers(json.data || []);
        setStats(json.stats || []);
      }
    } catch (e) {
      console.error('Failed to load dewan guru', e);
    } finally {
      setLoading(false);
    }
  }, [selectedHomebase]);

  useEffect(() => {
    if (role || isPengasuh) fetchTeachers();
  }, [role, isPengasuh, fetchTeachers]);

  const handleSync = async (mode: 'online' | 'offline') => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch(`/api/dewan-guru/sync?mode=${mode}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Gagal sinkronisasi');
      } else {
        setSyncMsg(json.message);
        await fetchTeachers();
      }
    } catch (e: any) {
      alert('Koneksi gagal: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const filteredTeachers = useMemo(() => {
    let list = teachers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        t =>
          (t.nama || '').toLowerCase().includes(q) ||
          (t.homebase || '').toLowerCase().includes(q) ||
          (t.no_hp || '').includes(q) ||
          (t.nip || '').includes(q)
      );
    }
    return list;
  }, [teachers, search]);

  const openWaDialog = (guru: any) => {
    setWaModalGuru(guru);
    setWaCustomPhone(guru.no_hp || '');
    setCopied(false);
  };

  const getWaMessage = (guru: any) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.ppmawar.or.id';
    const link = `${origin}/absen/guru?token=${guru.qr_token}`;
    return `Assalamu'alaikum Wr. Wb.

Yth. *${guru.nama}*
(${guru.homebase})

Berikut kami sampaikan tautan Kartu Presensi Digital Kehadiran Dewan Guru PP. Matholi'ul Anwar:

🔗 *Link Presensi:*
${link}

Bapak/Ibu Ustadz dapat membuka tautan di atas atau menyimpan gambar QR Code untuk melakukan absensi kehadiran.

Terima kasih.
_Pondok Pesantren Matholi'ul Anwar Simo Sungelebak_`;
  };

  const handleSendWa = () => {
    if (!waModalGuru) return;
    let phone = waCustomPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    if (!phone) {
      alert('Mohon masukkan nomor WhatsApp yang valid.');
      return;
    }
    const msg = encodeURIComponent(getWaMessage(waModalGuru));
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleCopyText = () => {
    if (!waModalGuru) return;
    navigator.clipboard.writeText(getWaMessage(waModalGuru));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {/* Top Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <QrCode size={22} />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                <span>QR Code Presensi Dewan Guru</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Total {teachers.length} Dewan Guru & Karyawan YPMA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Download Bulk ZIP */}
            <a
              href={`/api/dewan-guru/qr/bulk?type=zip&homebase=${encodeURIComponent(selectedHomebase)}`}
              download
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Download File ZIP Semua Gambar QR"
            >
              <Archive size={14} />
              <span className="hidden sm:inline">Unduh ZIP</span>
            </a>

            {/* Download Bulk PDF */}
            <a
              href={`/api/dewan-guru/qr/bulk?type=pdf&homebase=${encodeURIComponent(selectedHomebase)}`}
              target="_blank"
              rel="noreferrer"
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Cetak Dokumen Katalog Kartu A4"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">Cetak PDF (A4)</span>
            </a>

            {/* Tombol Sinkronisasi */}
            <div className="relative inline-block">
              <button
                onClick={() => handleSync('online')}
                disabled={syncing}
                className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Tarik data terbaru dari Google Sheets"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Sinkronisasi...' : 'Tarik Online'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-3">
        {/* Sync Success Notification */}
        {syncMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{syncMsg}</span>
            </div>
            <button onClick={() => setSyncMsg('')} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Homebase Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama guru, NIP, no. HP, atau homebase..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Homebase Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {HOMEBASES.map(hb => {
              const count = hb === 'SEMUA'
                ? teachers.length
                : (stats.find(s => s.homebase === hb)?.count || 0);

              return (
                <button
                  key={hb}
                  onClick={() => setSelectedHomebase(hb)}
                  className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${
                    selectedHomebase === hb
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{hb === 'SEMUA' ? '🌐 Semua' : hb}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      selectedHomebase === hb ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid Cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-3 animate-pulse space-y-2">
                <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-full w-3/4 mx-auto" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2 mx-auto" />
              </div>
            ))}
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
            <QrCode size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="font-extrabold text-slate-700 dark:text-slate-200 text-sm">Tidak Ada Guru Ditemukan</h3>
            <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau filter unit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredTeachers.map((guru, idx) => (
              <div
                key={guru.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg transition-all p-3 flex flex-col justify-between group"
              >
                <div>
                  {/* Homebase Badge */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 truncate max-w-[85%]">
                      {guru.homebase}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* QR Image Box */}
                  <div
                    onClick={() => setPreviewGuru(guru)}
                    className="w-full aspect-square bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2 border border-slate-100 dark:border-slate-800 flex items-center justify-center cursor-pointer hover:border-teal-400 transition-colors relative"
                  >
                    <img
                      src={`/api/dewan-guru/qr?token=${encodeURIComponent(guru.qr_token)}`}
                      alt={`QR ${guru.nama}`}
                      className="w-full h-full object-contain rounded-xl"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-teal-900/0 hover:bg-teal-900/30 rounded-2xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                      <span className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 p-1.5 rounded-xl shadow-md">
                        <Eye size={16} />
                      </span>
                    </div>
                  </div>

                  {/* Teacher Info */}
                  <div className="mt-2 text-center">
                    <h3
                      className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight"
                      title={guru.nama}
                    >
                      {guru.nama}
                    </h3>
                    {guru.no_hp && (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate flex items-center justify-center gap-1">
                        <Phone size={9} /> {guru.no_hp}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <a
                    href={`/api/dewan-guru/qr?token=${encodeURIComponent(guru.qr_token)}&download=true`}
                    download
                    className="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    title="Unduh Gambar QR"
                  >
                    <Download size={13} />
                    <span>Unduh</span>
                  </a>

                  <button
                    onClick={() => openWaDialog(guru)}
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Kirim via WhatsApp"
                  >
                    <Send size={13} />
                    <span>Kirim</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewGuru && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewGuru(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                {previewGuru.homebase}
              </span>
              <button
                onClick={() => setPreviewGuru(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-56 h-56 mx-auto bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <img
                src={`/api/dewan-guru/qr?token=${encodeURIComponent(previewGuru.qr_token)}`}
                alt={`QR ${previewGuru.nama}`}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">{previewGuru.nama}</h3>
              {previewGuru.nip && <p className="text-xs text-slate-400 mt-0.5">NIP: {previewGuru.nip}</p>}
              {previewGuru.no_hp && <p className="text-xs text-slate-400 mt-0.5">WhatsApp: {previewGuru.no_hp}</p>}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={`/api/dewan-guru/qr?token=${encodeURIComponent(previewGuru.qr_token)}&download=true`}
                download
                className="flex-1 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Download size={15} /> Unduh PNG
              </a>
              <button
                onClick={() => {
                  const g = previewGuru;
                  setPreviewGuru(null);
                  openWaDialog(g);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Send size={15} /> Kirim Pesan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Send Dialog Modal */}
      {waModalGuru && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setWaModalGuru(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Send size={16} className="text-emerald-600" />
                <span>Kirim Kartu QR ke Guru</span>
              </h3>
              <button onClick={() => setWaModalGuru(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Penerima:</label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-800 dark:text-slate-200">
                  {waModalGuru.nama} ({waModalGuru.homebase})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nomor WhatsApp Guru:</label>
                <input
                  type="text"
                  placeholder="Contoh: 08123456789 atau +628123456789"
                  value={waCustomPhone}
                  onChange={e => setWaCustomPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Teks Format Pesan:</label>
                <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-sans text-[11px] leading-relaxed max-h-40 overflow-y-auto">
                  {getWaMessage(waModalGuru)}
                </pre>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopyText}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <span>{copied ? 'Tersalin! ✅' : 'Salin Teks'}</span>
              </button>
              <button
                type="button"
                onClick={handleSendWa}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={15} />
                <span>Buka WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
