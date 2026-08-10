'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Megaphone, Search, Send, Clock, CheckCircle2, Mic2, X, ChevronDown, RefreshCw, ExternalLink, BookOpen, User, Home, AlertCircle, Loader2, History, Trash2, Volume2, Filter, Wifi, Radio, Server, Wrench } from 'lucide-react';

interface Santri {
  murid_id: number;
  nama: string;
  nama_panggilan?: string;
  nama_kamar?: string;
  nama_asrama?: string;
  kelas_madin?: string;
  kelas_quran?: string;
}

interface Format {
  id: number;
  nama: string;
  bahasa: string;
  jenis_suara: 'pria' | 'wanita' | 'auto';
  template: string;
}

interface Panggilan {
  id: number;
  santri_nama: string;
  santri_nama_panggilan: string;
  nama_kamar: string;
  nama_asrama: string;
  teks_panggilan: string;
  tujuan: string;
  status: 'pending' | 'dibacakan' | 'selesai';
  jam_panggilan: string;
  nama_pemanggil: string;
  peran_pemanggil: string;
}

interface Device {
  device_id: string;
  nama_asrama: string | null;
  status: 'online' | 'idle' | 'offline';
  last_seen: string;
}

export default function PanggilanSantriPage() {
  const [user, setUser] = useState<any>(null);

  // Data
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [formatList, setFormatList] = useState<Format[]>([]);
  const [history, setHistory] = useState<Panggilan[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  // Form State
  const [searchQ, setSearchQ] = useState('');
  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<Format | null>(null);
  const [tujuan, setTujuan] = useState('');
  const [teksPanggilan, setTeksPanggilan] = useState('');
  const [pengulangan, setPengulangan] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);

  // UI State
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch devices status
  const fetchDevices = useCallback(async () => {
    try {
      const r = await fetch('/api/panggilan/devices');
      const d = await r.json();
      if (d.success) setDevices(d.data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchDevices();
    const t = setInterval(fetchDevices, 15000);
    return () => clearInterval(t);
  }, [fetchDevices]);

  // Fetch user
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.success) setUser(d.user);
    });
  }, []);

  // Fetch format panggilan
  useEffect(() => {
    fetch('/api/panggilan/format').then(r => r.json()).then(d => {
      if (d.success) {
        setFormatList(d.data);
        if (d.data.length > 0) setSelectedFormat(d.data[0]);
      }
    }).catch(() => {});
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/panggilan');
      const d = await r.json();
      if (d.success) setHistory(d.data);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Auto-refresh history
  useEffect(() => {
    const t = setInterval(fetchHistory, 15000);
    return () => clearInterval(t);
  }, [fetchHistory]);

  // Search santri
  useEffect(() => {
    if (searchQ.length < 2) {
      setSantriList([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/murid?q=${encodeURIComponent(searchQ)}&limit=20`);
        const d = await r.json();
        if (d.success) setSantriList(d.data);
      } catch (_) {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // Generate teks panggilan dari template
  useEffect(() => {
    if (!selectedSantri || !selectedFormat) return;
    const namaPanggilan = selectedSantri.nama_panggilan || selectedSantri.nama;
    const teksGenerated = selectedFormat.template
      .replace(/{nama}/g, namaPanggilan)
      .replace(/{kamar}/g, selectedSantri.nama_kamar || 'kamar Anda')
      .replace(/{asrama}/g, selectedSantri.nama_asrama || 'asrama')
      .replace(/{tujuan}/g, tujuan || 'kantor pengurus')
      .replace(/{teks}/g, '');
    setTeksPanggilan(teksGenerated);
  }, [selectedSantri, selectedFormat, tujuan]);

  const handleSelectSantri = (s: Santri) => {
    setSelectedSantri(s);
    setSearchQ(s.nama);
    setSantriList([]);
    setShowDropdown(false);
  };

  const handleSend = async () => {
    if (!selectedSantri) { setErrorMsg('Pilih santri terlebih dahulu'); return; }
    if (!teksPanggilan.trim()) { setErrorMsg('Teks panggilan tidak boleh kosong'); return; }

    setSending(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const r = await fetch('/api/panggilan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          santri_id: selectedSantri.murid_id,
          format_id: selectedFormat?.id || null,
          tujuan,
          teks_panggilan: teksPanggilan,
          pengulangan,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(d.message || 'Panggilan berhasil dikirim!');
        // Reset form
        setSelectedSantri(null);
        setSearchQ('');
        setTujuan('');
        setTeksPanggilan('');
        fetchHistory();
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setErrorMsg(d.error || 'Gagal mengirim panggilan');
      }
    } catch (e) {
      setErrorMsg('Koneksi bermasalah, coba lagi');
    }
    setSending(false);
  };

  const handlePreviewTTS = () => {
    if (!teksPanggilan || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(teksPanggilan);
    utter.lang = selectedFormat?.bahasa === 'ar' ? 'ar-SA' : 'id-ID';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  };

  const statusBadge = (status: string) => {
    if (status === 'dibacakan') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"><Volume2 size={10}/> Dibacakan</span>;
    if (status === 'selesai') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"><CheckCircle2 size={10}/> Selesai</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse"><Clock size={10}/> Menunggu</span>;
  };

  const filteredHistory = history.filter(h =>
    !historyFilter || h.santri_nama?.toLowerCase().includes(historyFilter.toLowerCase()) ||
    h.nama_asrama?.toLowerCase().includes(historyFilter.toLowerCase())
  );

  const isPengasuhOrAdmin = user && (
    ['admin', 'staff', 'pengasuh', 'pengurus_asrama'].includes(user.role) ||
    user.is_pengasuh || user.isPengasuh || user.is_pengurus_asrama
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-br from-red-600 via-orange-600 to-amber-500 rounded-2xl p-5 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute -bottom-8 -left-4 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Megaphone size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Panggilan Santri</h1>
              <p className="text-orange-100 text-xs">Pengumuman via TOA / Mixer Asrama</p>
            </div>
          </div>
          {/* Dua tombol berdampingan — penuh kiri & kanan, presisi sama */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href="/dashboard/panggilan/toa"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-bold px-2 py-3 rounded-xl transition-colors text-center"
            >
              <ExternalLink size={18} />
              <span className="text-[11px] leading-tight">Buka Halaman TOA</span>
            </a>
            <a
              href="/dashboard/panggilan/setup"
              className="flex flex-col items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold px-2 py-3 rounded-xl transition-colors border border-white/25 text-center"
            >
              <Wrench size={18} />
              <span className="text-[11px] leading-tight">Panduan Setup Hardware</span>
            </a>
          </div>
        </div>
      </div>

      {/* TOA Device Monitoring Status Bar — deduplicated per asrama */}
      {(() => {
        // Kelompokkan per asrama: ambil status terbaik per asrama
        const asramaMap = new Map<string, Device>();
        devices.forEach(dev => {
          const key = dev.nama_asrama || '__umum__';
          const existing = asramaMap.get(key);
          // Priority: online > idle > offline
          const priority = (s: string) => s === 'online' ? 3 : s === 'idle' ? 2 : 1;
          if (!existing || priority(dev.status) > priority(existing.status)) {
            asramaMap.set(key, dev);
          }
        });
        const uniqueDevices = Array.from(asramaMap.values())
          .sort((a, b) => {
            const p = (s: string) => s === 'online' ? 3 : s === 'idle' ? 2 : 1;
            return p(b.status) - p(a.status);
          });
        if (uniqueDevices.length === 0) return null;
        const onlineCount = uniqueDevices.filter(d => d.status === 'online').length;
        return (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Radio size={13} className="text-orange-500" />
                Perangkat TOA Asrama
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${onlineCount > 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {onlineCount} Online
                </span>
              </h3>
              <button onClick={fetchDevices} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {uniqueDevices.map((dev) => (
                <div
                  key={dev.device_id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border ${
                    dev.status === 'online'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                      : dev.status === 'idle'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      dev.status === 'online'
                        ? 'bg-emerald-500 animate-pulse'
                        : dev.status === 'idle'
                        ? 'bg-amber-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate leading-tight">{dev.nama_asrama || 'Semua Asrama'}</span>
                    <span className="text-[10px] opacity-60 leading-tight">({dev.status})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Success/Error */}
      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl text-green-700 dark:text-green-300 animate-[slideDown_0.3s_ease]">
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-300">
          <AlertCircle size={18} className="shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto"><X size={16}/></button>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Mic2 size={18} className="text-orange-500" />
            Buat Panggilan Baru
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {/* Cari Santri */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Pilih Santri <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setShowDropdown(true); setSelectedSantri(null); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Ketik nama santri..."
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                />
                {loading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 animate-spin" />}
                {selectedSantri && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
              </div>

              {/* Dropdown */}
              {showDropdown && santriList.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                  {santriList.map(s => (
                    <button
                      key={s.murid_id}
                      onClick={() => handleSelectSantri(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-left transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{s.nama}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Home size={10} /> {s.nama_kamar || 'Belum ada kamar'} 
                          {s.nama_asrama ? ` · ${s.nama_asrama}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info santri terpilih */}
            {selectedSantri && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <User size={14} className="text-orange-500 shrink-0" />
                <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                  {selectedSantri.nama}
                  {selectedSantri.nama_kamar ? ` · ${selectedSantri.nama_kamar}` : ''}
                  {selectedSantri.nama_asrama ? ` · ${selectedSantri.nama_asrama}` : ''}
                </span>
                <button onClick={() => { setSelectedSantri(null); setSearchQ(''); setTeksPanggilan(''); }} className="ml-auto">
                  <X size={14} className="text-orange-400 hover:text-orange-600" />
                </button>
              </div>
            )}
          </div>

          {/* Pilih Format */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Format Panggilan
            </label>
            <div className="relative">
              <button
                onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-800 dark:text-gray-200 hover:border-orange-400 transition-all"
              >
                <span className="flex items-center gap-2">
                  <BookOpen size={14} className="text-gray-400" />
                  {selectedFormat?.nama || 'Pilih format...'}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showFormatDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showFormatDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                  {formatList.map(f => {
                    const bahasaFlag: Record<string, string> = { id: '🇮🇩', ar: '🇸🇦', jv: '☕', en: '🇬🇧' };
                    const suaraIcon: Record<string, string> = { pria: '👨', wanita: '👩', auto: '🔊' };
                    return (
                      <button
                        key={f.id}
                        onClick={() => { setSelectedFormat(f); setShowFormatDropdown(false); }}
                        className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-left transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 ${selectedFormat?.id === f.id ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
                      >
                        <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                          <span className="text-base">{bahasaFlag[f.bahasa] || '🌐'}</span>
                          <span className="text-[10px]">{suaraIcon[f.jenis_suara] || '🔊'}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 block">{f.nama}</span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{f.template.substring(0, 65)}...</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tujuan */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Tujuan Panggilan
            </label>
            <input
              type="text"
              value={tujuan}
              onChange={e => setTujuan(e.target.value)}
              placeholder="Contoh: kantor pengurus, ruang piket, gerbang..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Teks Panggilan */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Teks Panggilan <span className="text-red-500">*</span>
              </label>
              {teksPanggilan && (
                <button
                  onClick={handlePreviewTTS}
                  className="flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 transition-colors"
                >
                  <Volume2 size={12} /> Preview Suara
                </button>
              )}
            </div>
            <textarea
              value={teksPanggilan}
              onChange={e => setTeksPanggilan(e.target.value)}
              rows={4}
              placeholder="Teks akan otomatis diisi berdasarkan format yang dipilih..."
              dir={selectedFormat?.bahasa === 'ar' ? 'rtl' : 'ltr'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all resize-none leading-relaxed"
            />
            <p className="text-[10px] text-gray-400 mt-1">Anda dapat mengedit teks secara langsung sebelum mengirim.</p>
          </div>

          {/* Pengulangan */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Diulang Berapa Kali
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setPengulangan(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${pengulangan === n ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>

          {/* Tombol Kirim */}
          <button
            onClick={handleSend}
            disabled={sending || !selectedSantri || !teksPanggilan.trim()}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 hover:from-red-600 hover:via-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-orange-500/30 disabled:shadow-none active:scale-95"
          >
            {sending ? (
              <><Loader2 size={18} className="animate-spin" /> Mengirim...</>
            ) : (
              <><Send size={18} /> Kirim Panggilan ke TOA</>
            )}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <History size={17} className="text-gray-400" />
            Riwayat Panggilan Hari Ini
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchHistory} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <RefreshCw size={14} className="text-gray-400" />
            </button>
            <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{history.length}</span>
          </div>
        </div>

        {history.length > 5 && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                placeholder="Filter nama / asrama..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {filteredHistory.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Megaphone size={32} className="mx-auto text-gray-200 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Belum ada panggilan hari ini</p>
            </div>
          ) : (
            filteredHistory.map(p => (
              <div key={p.id} className="px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{p.santri_nama}</span>
                      {statusBadge(p.status)}
                    </div>
                    {p.nama_kamar && (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                        <Home size={10} /> {p.nama_kamar}{p.nama_asrama ? ` · ${p.nama_asrama}` : ''}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 italic">"{p.teks_panggilan}"</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={10}/>{p.jam_panggilan}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{p.nama_pemanggil}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Link ke halaman format (admin/staff only) */}
      {user && ['admin', 'staff'].includes(user.role) && (
        <a
          href="/dashboard/panggilan/format"
          className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl hover:border-orange-300 dark:hover:border-orange-700 transition-all"
        >
          <BookOpen size={16} />
          Kelola Format Panggilan
        </a>
      )}
    </div>
  );
}
