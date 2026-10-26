'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, X, ToggleRight, ToggleLeft, RefreshCw,
  Clock, CheckCircle2, AlertCircle, AlertTriangle, Phone, MessageCircle,
  Calendar, Award, Send, ChevronDown, ChevronUp, Loader2, Sparkles, User, BookOpen
} from 'lucide-react';

export const DEFAULT_KEPALA_MADIN_TEMPLATE = 
`Assalamu'alaikum Warohmatullah,

Yth. *Kepala Madrasah Diniyah (Madin)*
Pondok Pesantren Matholi'ul Anwar

Berikut kami sampaikan Laporan Rekapitulasi Kehadiran Dewan Guru Madin untuk periode {bulan_tahun}:

📊 *Ringkasan Presensi Dewan Guru Madin:*
• Total Dewan Guru: {total_guru} Guru
• Rata-rata Kehadiran: {avg_kehadiran}%
{ringkasan_kehadiran}

🔗 *Link Preview Detail Evaluasi Dewan Guru:*
{link_laporan}

Tautan di atas berisi daftar lengkap kehadiran masing-masing guru, rincian jadwal kelas yang diampu, serta fitur ekspor/cetak laporan resmi untuk evaluasi madrasah.

Wassalamu'alaikum Warohmatullah,
_Pengurus PP. Matholi'ul Anwar_`;

export const DEFAULT_REKAP_GURU_TEMPLATE = `Assalamu'alaikum Warohmatullah Wabarokatuh,

Yth. Ustadz/Ustadzah *{nama_guru}*
Pondok Pesantren Matholi'ul Anwar

Berikut kami sampaikan pemberitahuan rekapitulasi catatan presensi santri untuk mata pelajaran yang Ustadz/Ustadzah ampu pada periode *{periode}*:

📚 *Rincian Mata Pelajaran & Kelas:*
• Mata Pelajaran: *{nama_mapel}*
• Kelas / Ruang: {kelas}
• Kategori: {kategori}

📊 *Ringkasan Presensi Santri:*
• Hadir: {hadir} presensi
• Izin: {izin} presensi
• Sakit: {sakit} presensi
• Tanpa Keterangan: {alpha} presensi
• Persentase Kehadiran: *{persentase}%*

🔗 *Tautan Rekapitulasi Lengkap:*
{link_rekap}

Tautan resmi di atas berlaku selama {masa_berlaku} (sampai {batas_waktu}).

Demikian pemberitahuan ini kami sampaikan. Atas keikhlasan, dedikasi, dan bimbingan Ustadz/Ustadzah dalam mengajar para santri, kami haturkan jazakumullah khairan katsiran.

Wassalamu'alaikum Warohmatullah Wabarokatuh,
_Pengurus Pondok Pesantren Matholi'ul Anwar_`;

const HOMEBASES = [
  { id: 'SEMUA', nama: 'SEMUA UNIT / HOMEBASE' },
  { id: 'TKM NU MAWAR', nama: 'TKM NU MAWAR' },
  { id: 'MI BANIN', nama: 'MI BANIN' },
  { id: 'MI BANAT', nama: 'MI BANAT' },
  { id: 'SMP NU', nama: 'SMP NU' },
  { id: 'MTS PUTRA-PUTRI', nama: 'MTS PUTRA-PUTRI' },
  { id: 'MA MAWAR', nama: 'MA MAWAR' },
  { id: 'SMK NU', nama: 'SMK NU' },
  { id: 'MADIN', nama: 'MADIN' },
  { id: 'MQ', nama: 'MQ' },
  { id: 'KOPMA', nama: 'KOPMA' },
  { id: 'KLINIK', nama: 'KLINIK' },
  { id: 'KBIHU MAWAR', nama: 'KBIHU MAWAR' },
];

export interface TabRekapGuruProps {
  guruList: any[];
  pesanRekapGuruTemplate: string;
  setPesanRekapGuruTemplate: React.Dispatch<React.SetStateAction<string>>;
  saveTemplate: (key: string, value: string) => Promise<void>;
  resetTemplate: (key: string, defaultValue: string, setter: (val: string) => void) => Promise<void>;
  saveStatus: Record<string, string>;

  // Looping & Kepala Madin (fitur massal)
  rekapBulan: number;
  setRekapBulan: React.Dispatch<React.SetStateAction<number>>;
  rekapTahun: number;
  setRekapTahun: React.Dispatch<React.SetStateAction<number>>;
  rekapCategories: string[];
  toggleRekapCategory: (key: string) => void;
  isRekapSending: boolean;
  isRekapScheduling: boolean;
  rekapStatusMsg: { type: 'success' | 'error' | 'info'; text: string; details?: any[] } | null;
  handleSendRekapWA: (mode: 'send_now' | 'schedule_monthly') => Promise<void>;

  rekapModeRentang: boolean;
  setRekapModeRentang: React.Dispatch<React.SetStateAction<boolean>>;
  rekapTanggalDari: string;
  setRekapTanggalDari: React.Dispatch<React.SetStateAction<string>>;
  rekapTanggalSampai: string;
  setRekapTanggalSampai: React.Dispatch<React.SetStateAction<string>>;

  kepalaMadinTarget: 'putra' | 'putri' | 'all';
  handleTargetKepalaMadinChange: (target: 'putra' | 'putri' | 'all') => void;
  selectedKepalaMadinId: string;
  handleSelectKepalaMadin: (gid: string) => void;
  kepalaMadinPhone: string;
  setKepalaMadinPhone: React.Dispatch<React.SetStateAction<string>>;
  pesanKepalaMadinTemplate: string;
  setPesanKepalaMadinTemplate: React.Dispatch<React.SetStateAction<string>>;
  isKepalaMadinSending: boolean;
  isKepalaMadinScheduling: boolean;
  kepalaMadinStatusMsg: { type: 'success' | 'error' | 'info'; text: string } | null;
  handleSendKepalaMadinWA: (mode: 'send_now' | 'schedule_monthly') => Promise<void>;
}

export default function TabRekapGuru({
  guruList,
  pesanRekapGuruTemplate,
  setPesanRekapGuruTemplate,
  saveTemplate,
  resetTemplate,
  saveStatus,

  rekapBulan,
  setRekapBulan,
  rekapTahun,
  setRekapTahun,
  rekapCategories,
  toggleRekapCategory,
  isRekapSending,
  isRekapScheduling,
  rekapStatusMsg,
  handleSendRekapWA,

  rekapModeRentang,
  setRekapModeRentang,
  rekapTanggalDari,
  setRekapTanggalDari,
  rekapTanggalSampai,
  setRekapTanggalSampai,

  kepalaMadinTarget,
  handleTargetKepalaMadinChange,
  selectedKepalaMadinId,
  handleSelectKepalaMadin,
  kepalaMadinPhone,
  setKepalaMadinPhone,
  pesanKepalaMadinTemplate,
  setPesanKepalaMadinTemplate,
  isKepalaMadinSending,
  isKepalaMadinScheduling,
  kepalaMadinStatusMsg,
  handleSendKepalaMadinWA,
}: TabRekapGuruProps) {
  // State Filter Presensi Guru
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const firstDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  const [kategoriMapel, setKategoriMapel] = useState<'all' | 'madin' | 'quran' | 'kegiatan'>('all');
  const [targetGuruId, setTargetGuruId] = useState<string>('all');
  const [bulan, setBulan] = useState<string>(String(currentMonth));
  const [tahun, setTahun] = useState<string>(String(currentYear));
  const [tanggalDari, setTanggalDari] = useState<string>(firstDayStr);
  const [tanggalSampai, setTanggalSampai] = useState<string>(todayStr);
  const [modeRentang, setModeRentang] = useState<boolean>(false);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [searchNama, setSearchNama] = useState<string>('');

  // State Data Rekapitulasi
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [waFilter, setWaFilter] = useState<'semua' | 'ada' | 'tidak_ada'>('semua');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [sentWaIds, setSentWaIds] = useState<Record<string, boolean>>({});

  // Accordion Fitur Tambahan (Looping Bulanan & Kepala Madin)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // State Pengiriman Manual WhatsApp Kepala Madin
  const [kepalaMadinData, setKepalaMadinData] = useState<{
    reportUrl: string;
    msg: string;
    phone: string;
    totalGuru: number;
    avgPct: number;
    totalSesi: number;
    totalHadir: number;
    totalIzin: number;
    totalSakit: number;
    totalAlpha: number;
    waLink: string;
  } | null>(null);
  const [loadingKepalaMadinData, setLoadingKepalaMadinData] = useState<boolean>(false);
  const [sentKepalaMadinWa, setSentKepalaMadinWa] = useState<boolean>(false);

  // Ambil link preview dan stats khusus Kepala Madin
  const fetchKepalaMadinLink = useCallback(async () => {
    setLoadingKepalaMadinData(true);
    try {
      const selectedGuru = guruList.find(g => String(g.guru_id) === String(selectedKepalaMadinId));
      const targetLabel = kepalaMadinTarget === 'putri' 
        ? 'Kepala Madin Putri' 
        : kepalaMadinTarget === 'putra' 
          ? 'Kepala Madin Putra' 
          : 'Kepala Madrasah Diniyah';
      const kepalaNama = selectedGuru?.nama || targetLabel;

      const res = await fetch('/api/wa-scheduler/rekap-kepala-madin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'get_link',
          ...(rekapModeRentang
            ? { tanggal_dari: rekapTanggalDari, tanggal_sampai: rekapTanggalSampai }
            : { bulan: rekapBulan, tahun: rekapTahun }),
          target_wilayah: kepalaMadinTarget,
          kepala_nama: kepalaNama,
          phone_number: kepalaMadinPhone,
          template: pesanKepalaMadinTemplate || DEFAULT_KEPALA_MADIN_TEMPLATE,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setKepalaMadinData(data);
      }
    } catch (err) {
      console.error('Error fetching kepala madin preview link:', err);
    } finally {
      setLoadingKepalaMadinData(false);
    }
  }, [guruList, selectedKepalaMadinId, kepalaMadinTarget, rekapBulan, rekapTahun, kepalaMadinPhone, pesanKepalaMadinTemplate, rekapModeRentang, rekapTanggalDari, rekapTanggalSampai]);

  useEffect(() => {
    if (showAdvancedOptions) {
      const timer = setTimeout(() => {
        fetchKepalaMadinLink();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showAdvancedOptions, fetchKepalaMadinLink]);

  // Ambil daftar guru options dari guruList atau API kelas
  const [optionsGuru, setOptionsGuru] = useState<any[]>([]);

  useEffect(() => {
    if (guruList && guruList.length > 0) {
      const sorted = [...guruList].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
      setOptionsGuru(sorted);
    } else {
      fetch('/api/kelas?type=guru&aggregate=true')
        .then(res => res.json())
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            setOptionsGuru(res.data);
          }
        })
        .catch(() => {});
    }
  }, [guruList]);

  // Fetch data rekap presensi per mata pelajaran guru
  const fetchRekapData = async () => {
    setLoadingData(true);
    setErrorMsg('');
    try {
      const expiryParam = expiryDays && expiryDays >= 1 ? expiryDays : 7;
      const params = new URLSearchParams({
        tipe: 'guru_mapel',
        kategori: kategoriMapel,
        target_id: targetGuruId || 'all',
        expiry: String(expiryParam),
        ...(modeRentang ? {
          tanggal_dari: tanggalDari,
          tanggal_sampai: tanggalSampai,
        } : {
          bulan,
          tahun,
        }),
      });

      const res = await fetch(`/api/rekapitulasi?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRekapData(json.data || []);
        setHasFetched(true);
      } else {
        setErrorMsg(json.error || 'Gagal memuat data rekapitulasi guru.');
      }
    } catch (err: any) {
      setErrorMsg('Kendala jaringan: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Auto-scroll ke hasil saat data selesai dimuat
  useEffect(() => {
    if (hasFetched && !loadingData) {
      setTimeout(() => {
        const el = document.getElementById('rekap-guru-hasil-anchor');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [hasFetched, loadingData]);

  // Format nomor WA
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    return p;
  };

  // Generate WA Link untuk Guru
  const getWaGuruLink = (item: any) => {
    const rawPhone = item.no_hp || item.nama_wali || '';
    const phone = formatPhoneNumber(rawPhone);
    if (!phone) return '#';

    const hadir = Number(item.hadir || 0);
    const izin = Number(item.izin || 0);
    const sakit = Number(item.sakit || 0);
    const alpha = Number(item.alpha || 0);
    const total = Number(item.total || (hadir + izin + sakit + alpha));
    const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

    let periodeLabel = '';
    if (modeRentang) {
      periodeLabel = `${tanggalDari} s/d ${tanggalSampai}`;
    } else {
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      periodeLabel = `${months[parseInt(bulan) - 1]} ${tahun}`;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.ppmawar.or.id';
    const previewUrl = item.preview_token
      ? `${origin}/rekapitulasi/preview?t=${item.preview_token}`
      : `${origin}/rekapitulasi/preview?tipe=guru_mapel&guru_id=${item.guru_id || ''}&kategori=${kategoriMapel || 'all'}`;

    const masaBerlaku = item.token_duration_label || `${expiryDays} Hari`;
    const batasWaktu = item.token_exp_date || '-';

    const templateToUse = pesanRekapGuruTemplate || DEFAULT_REKAP_GURU_TEMPLATE;
    const text = templateToUse
      .replace(/{nama_guru}/g, item.guru_nama || item.nama || '-')
      .replace(/{nama_mapel}/g, item.nama || '-')
      .replace(/{mapel}/g, item.nama || '-')
      .replace(/{kelas}/g, item.kelas_nama || '-')
      .replace(/{kategori}/g, item.kategori_label || item.kategori || '-')
      .replace(/{tipe}/g, item.kategori_label || item.kategori || '-')
      .replace(/{target_label}/g, item.kelas_nama || '-')
      .replace(/{nip}/g, item.identifier || item.guru_nip || '-')
      .replace(/{periode}/g, periodeLabel)
      .replace(/{bulan_tahun}/g, periodeLabel)
      .replace(/{hadir}/g, String(hadir))
      .replace(/{izin}/g, String(izin))
      .replace(/{sakit}/g, String(sakit))
      .replace(/{alpha}/g, String(alpha))
      .replace(/{total}/g, String(total))
      .replace(/{persentase}/g, String(persentase))
      .replace(/{link_rekap}/g, previewUrl)
      .replace(/{masa_berlaku}/g, masaBerlaku)
      .replace(/{batas_waktu}/g, batasWaktu);

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const handleScrollToNextGuru = (nextIdx: number) => {
    if (!autoScroll) return;
    setTimeout(() => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const targetDomId = isMobile ? `guru-rekap-card-${nextIdx}` : `guru-rekap-row-${nextIdx}`;
      let el = document.getElementById(targetDomId);
      if (!el || el.offsetParent === null) {
        el = document.getElementById(isMobile ? `guru-rekap-row-${nextIdx}` : `guru-rekap-card-${nextIdx}`);
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* 1. KARTU FILTER PERSIS HALAMAN REKAPITULASI (KHUSUS GURU) */}
      <div className="bg-purple-50/40 dark:bg-purple-950/20 border border-purple-150/60 dark:border-purple-900/30 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-purple-100/70 dark:border-purple-900/40 pb-3">
          <div>
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 leading-tight">
              Filter Rekapitulasi Presensi Guru & Staff
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Pilih kategori presensi guru, target guru/unit, dan periode waktu yang ingin disiarkan ke WhatsApp guru
            </p>
          </div>
        </div>

        {/* Baris 1: Cari Nama/NIP, Pilih Kategori, Pilih Guru/Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          {/* Kolom 1: Cari Nama / Mapel / Pengajar */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Cari Mapel / Guru
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Cari mapel, kelas, atau nama guru..."
                value={searchNama}
                onChange={(e) => setSearchNama(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              />
              {searchNama && (
                <button
                  onClick={() => setSearchNama('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Kolom 2: Pilih Kategori Mapel */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Pilih Kategori
            </label>
            <select
              value={kategoriMapel}
              onChange={(e) => setKategoriMapel(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
            >
              <option value="all">Semua Kategori (Madin, Qur&apos;an, Asrama)</option>
              <option value="madin">📚 Madrasah Diniyah (Madin)</option>
              <option value="quran">🕌 Majlis Al-Qur&apos;an</option>
              <option value="kegiatan">🏠 Kegiatan Asrama</option>
            </select>
          </div>

          {/* Kolom 3: Target Guru / Pengajar */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Pilih Guru / Pengajar
            </label>
            <select
              value={targetGuruId}
              onChange={(e) => setTargetGuruId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
            >
              <option value="all">Semua Guru / Pengajar</option>
              {optionsGuru.map((g) => (
                <option key={g.id || g.guru_id} value={g.id || g.guru_id}>
                  {g.nama} {g.nip ? `(${g.nip})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Baris 2: Mode Waktu, Bulan & Tahun / Rentang, dan Tombol Tampilkan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-1">
          {/* Toggle Mode Waktu */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Mode Waktu</label>
            <button
              type="button"
              onClick={() => setModeRentang(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-purple-400 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all cursor-pointer select-none"
            >
              <span className="text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                {modeRentang ? 'Mode Rentang' : 'Mode Bulanan'}
              </span>
              <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                modeRentang
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {modeRentang ? <ToggleRight size={14} className="text-purple-600" /> : <ToggleLeft size={14} />}
                {modeRentang ? 'Rentang' : 'Bulan'}
              </span>
            </button>
          </div>

          {/* Input Waktu */}
          {modeRentang ? (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={tanggalDari}
                  max={tanggalSampai}
                  onChange={(e) => setTanggalDari(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={tanggalSampai}
                  min={tanggalDari}
                  onChange={(e) => setTanggalSampai(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Bulan</label>
                <select
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                >
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Tahun</label>
                <select
                  value={tahun}
                  onChange={(e) => setTahun(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Tombol Tampilkan */}
          <div>
            <button
              type="button"
              onClick={fetchRekapData}
              disabled={loadingData}
              className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 h-[38px]"
            >
              {loadingData ? (
                <><RefreshCw size={14} className="animate-spin" /> Memuat Data...</>
              ) : (
                <><Search size={14} /> Tampilkan Data Rekap</>
              )}
            </button>
          </div>
        </div>

        {/* Baris 3: Masa Berlaku Tautan & Pilihan Cepat */}
        <div className="pt-3 border-t border-purple-100/70 dark:border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-bold text-gray-750 dark:text-gray-200">
              <Clock size={14} className="text-purple-600 shrink-0" />
              <span>Masa Berlaku Tautan:</span>
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-purple-500">
              <input
                type="number"
                min={1}
                max={365}
                value={expiryDays}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setExpiryDays(isNaN(val) ? ('' as any) : val);
                }}
                onBlur={() => {
                  if (!expiryDays || expiryDays < 1) setExpiryDays(1);
                }}
                className="w-12 bg-transparent text-center font-bold text-gray-800 dark:text-gray-100 outline-none text-xs"
              />
              <span className="font-semibold text-gray-500 text-xs">Hari</span>
            </div>
            <span className="text-[11px] text-gray-400 italic">(Minimal 1 hari)</span>
          </div>

          {/* Preset Cepat */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <span className="text-[11px] text-gray-400 mr-1 hidden lg:inline">Pilihan Cepat:</span>
            {[1, 3, 7, 14, 30].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setExpiryDays(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  expiryDays === d
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-400'
                }`}
              >
                {d} Hari{d === 7 ? ' (Standar)' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. TEMPLAT PESAN WA REKAPITULASI DENGAN BAHASA SANTUN & BIJAK */}
      <div className="bg-purple-50/20 dark:bg-purple-950/10 border border-purple-200/40 dark:border-purple-900/20 rounded-2xl p-4">
        <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 mb-1.5 flex flex-col gap-1">
          <span>✏️ Edit Templat Pesan Rekapitulasi untuk Guru & Staff</span>
          <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 leading-relaxed">
            Placeholder: &#123;nama_guru&#125;, &#123;nama_mapel&#125;, &#123;kelas&#125;, &#123;kategori&#125;, &#123;nip&#125;, &#123;periode&#125;, &#123;hadir&#125;, &#123;izin&#125;, &#123;sakit&#125;, &#123;alpha&#125;, &#123;total&#125;, &#123;persentase&#125;, &#123;link_rekap&#125;, &#123;masa_berlaku&#125;, &#123;batas_waktu&#125;
          </span>
        </label>
        <textarea
          value={pesanRekapGuruTemplate}
          onChange={(e) => {
            setPesanRekapGuruTemplate(e.target.value);
            if (typeof window !== 'undefined') {
              localStorage.setItem('wa_template_guru_rekap', e.target.value);
            }
          }}
          onBlur={() => saveTemplate('wa_template_guru_rekap', pesanRekapGuruTemplate)}
          rows={7}
          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
          placeholder="Tulis templat pesan rekapitulasi guru..."
        />
        <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
          <button
            type="button"
            onClick={() => resetTemplate('wa_template_guru_rekap', DEFAULT_REKAP_GURU_TEMPLATE, setPesanRekapGuruTemplate)}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            ⟳ Reset ke Templat Default
          </button>
          {saveStatus['wa_template_guru_rekap'] === 'saved' && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 size={13} /> Tersimpan di Database ✓
            </span>
          )}
          <button
            type="button"
            onClick={() => saveTemplate('wa_template_guru_rekap', pesanRekapGuruTemplate)}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px] cursor-pointer"
          >
            Simpan Templat
          </button>
        </div>
      </div>

      {/* Pesan Kesalahan jika ada */}
      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold text-center">
          <AlertCircle size={15} className="inline mr-1" /> {errorMsg}
        </div>
      )}

      {/* Anchor auto-scroll */}
      <div id="rekap-guru-hasil-anchor" className="scroll-mt-20" />

      {/* 3. HASIL / LIST DATA REKAPITULASI GURU */}
      {loadingData ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-150">
          <RefreshCw className="animate-spin text-purple-600 mb-2" size={24} />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
            Menghitung dan memuat data rekapitulasi presensi guru...
          </span>
        </div>
      ) : !hasFetched ? (
        <div className="p-10 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-500">
          <FileText size={28} className="mx-auto mb-2 text-purple-400 opacity-60" />
          <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">Data Belum Ditampilkan</p>
          <p>Pilih kategori presensi guru dan periode di atas, lalu klik tombol <strong>&quot;Tampilkan Data Rekap&quot;</strong>.</p>
        </div>
      ) : (() => {
        const searchFiltered = rekapData.filter(item => {
          if (!searchNama.trim()) return true;
          const q = searchNama.toLowerCase();
          return (item.nama && item.nama.toLowerCase().includes(q)) ||
                 (item.identifier && item.identifier.toLowerCase().includes(q)) ||
                 (item.alamat && item.alamat.toLowerCase().includes(q)) ||
                 (item.homebase && item.homebase.toLowerCase().includes(q)) ||
                 (item.no_hp && item.no_hp.includes(q));
        });

        const totalCount = searchFiltered.length;
        const adaWaCount = searchFiltered.filter(item => {
          const rawPhone = item.no_hp || item.nama_wali || '';
          return Boolean(formatPhoneNumber(rawPhone));
        }).length;
        const tidakAdaWaCount = totalCount - adaWaCount;

        const filteredList = searchFiltered.filter(item => {
          if (waFilter === 'semua') return true;
          const rawPhone = item.no_hp || item.nama_wali || '';
          const hasWa = Boolean(formatPhoneNumber(rawPhone));
          if (waFilter === 'ada') return hasWa;
          if (waFilter === 'tidak_ada') return !hasWa;
          return true;
        });

        const renderControls = () => (
          <div className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
            {/* Baris 1: Semua */}
            <button
              type="button"
              onClick={() => setWaFilter('semua')}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                waFilter === 'semua'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>Semua</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                waFilter === 'semua' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}>
                {totalCount}
              </span>
            </button>

            {/* Baris 2: Ada No. WA & Tanpa No. WA (50% - 50%) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWaFilter('ada')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  waFilter === 'ada'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Phone size={12} className={waFilter === 'ada' ? 'text-white' : 'text-emerald-500'} />
                <span>Ada No. WA</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  waFilter === 'ada' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {adaWaCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWaFilter('tidak_ada')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  waFilter === 'tidak_ada'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>Tanpa No. WA</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  waFilter === 'tidak_ada' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                }`}>
                  {tidakAdaWaCount}
                </span>
              </button>
            </div>

            {/* Baris 3: Auto-scroll */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setAutoScroll(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  autoScroll
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-2xs'
                    : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-400'
                }`}
                title="Otomatis bergeser ke bawah pada data berikutnya saat tombol WA Guru diklik"
              >
                <span className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-purple-600 animate-pulse' : 'bg-gray-400'}`} />
                <span>Auto-scroll {autoScroll ? 'Aktif' : 'Mati'}</span>
              </button>
            </div>
          </div>
        );

        if (totalCount === 0) {
          return (
            <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-2xl">
              Tidak ada guru/staff yang cocok dengan filter pencarian &quot;{searchNama}&quot;.
            </div>
          );
        }

        if (filteredList.length === 0) {
          return (
            <div className="space-y-3">
              {renderControls()}
              <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-2xl">
                Tidak ada data guru pada kategori filter {waFilter === 'ada' ? '"Ada No. WA"' : '"Tanpa No. WA"'}.
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-3">
            {renderControls()}
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>
                Menampilkan <strong className="text-gray-800 dark:text-gray-200">{filteredList.length}</strong> guru / pengajar untuk disiarkan
              </span>
              <span className="text-[11px] text-purple-600 font-semibold hidden sm:inline">
                💡 Tautan WA otomatis melampirkan preview dokumen PDF resmi siap unduh
              </span>
            </div>

            {/* Desktop Table View (2 Kolom: Guru Pengajar & Aksi) */}
            <div className="hidden md:block overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-4 rounded-l-xl">Guru Pengajar</th>
                    <th className="px-5 py-4 text-right rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                  {filteredList.map((item, idx) => {
                    const hadir = Number(item.hadir || 0);
                    const izin = Number(item.izin || 0);
                    const sakit = Number(item.sakit || 0);
                    const alpha = Number(item.alpha || 0);
                    const total = Number(item.total || (hadir + izin + sakit + alpha));
                    const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
                    const waLink = getWaGuruLink(item);
                    const rawPhone = item.no_hp || item.nama_wali || '';
                    const hasWa = Boolean(formatPhoneNumber(rawPhone));
                    const isSent = !!sentWaIds[item.id];
                    const previewUrl = item.preview_token
                      ? `/rekapitulasi/preview?t=${item.preview_token}`
                      : `/rekapitulasi/preview?tipe=guru_mapel&guru_id=${item.guru_id || ''}&kategori=${kategoriMapel || 'all'}`;

                    return (
                      <tr
                        key={item.id || idx}
                        id={`guru-rekap-row-${idx}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors scroll-mt-24"
                      >
                        <td className="px-5 py-4 font-semibold text-gray-800 dark:text-gray-200">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-black text-sm shrink-0 border border-purple-200/50 dark:border-purple-800/40 mt-0.5">
                              <User size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                  {item.guru_nama || item.nama || 'Guru Pengajar'}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                                  {item.total_mapel ? `${item.total_mapel} Mapel / Kelas` : 'Guru Mapel'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                                  NIP: <strong className="text-gray-700 dark:text-gray-300">{item.identifier || item.guru_nip || '-'}</strong>
                                </span>
                                <span className="text-gray-300 dark:text-gray-700">•</span>
                                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                  <Phone size={11} className="shrink-0" />
                                  <span>{rawPhone || '-'}</span>
                                </span>
                                <span className="text-gray-300 dark:text-gray-700">•</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                  {persentase}% Hadir
                                </span>
                                <span className="text-[11px] text-gray-500 font-medium">
                                  ({hadir}H · {izin}I · {sakit}S · {alpha}A)
                                </span>
                              </div>

                              {item.daftar_mapel && (
                                <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 truncate max-w-2xl font-normal">
                                  <span className="font-semibold text-gray-600 dark:text-gray-300">Mapel: </span>
                                  {item.daftar_mapel}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                            title="Lihat Pratinjau Dokumen PDF Resmi"
                          >
                            <FileText size={13} className="text-purple-600 shrink-0" />
                            <span>Lihat PDF</span>
                          </a>

                          {hasWa ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                setSentWaIds(prev => ({ ...prev, [item.id]: true }));
                                handleScrollToNextGuru(idx + 1);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                isSent
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'
                                  : 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                              }`}
                            >
                              <MessageCircle size={14} />
                              <span>{isSent ? 'Terkirim ✓' : 'WA Guru'}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No WA Kosong</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (1 Kartu per Guru) */}
            <div className="md:hidden space-y-3">
              {filteredList.map((item, idx) => {
                const hadir = Number(item.hadir || 0);
                const izin = Number(item.izin || 0);
                const sakit = Number(item.sakit || 0);
                const alpha = Number(item.alpha || 0);
                const total = Number(item.total || (hadir + izin + sakit + alpha));
                const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
                const waLink = getWaGuruLink(item);
                const rawPhone = item.no_hp || item.nama_wali || '';
                const hasWa = Boolean(formatPhoneNumber(rawPhone));
                const isSent = !!sentWaIds[item.id];
                const previewUrl = item.preview_token
                  ? `/rekapitulasi/preview?t=${item.preview_token}`
                  : `/rekapitulasi/preview?tipe=guru_mapel&guru_id=${item.guru_id || ''}&kategori=${kategoriMapel || 'all'}`;

                return (
                  <div
                    key={item.id || idx}
                    id={`guru-rekap-card-${idx}`}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-xs space-y-3 scroll-mt-24"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-bold mb-0.5">
                          <User size={13} className="shrink-0" />
                          <span>{item.total_mapel ? `${item.total_mapel} Mapel / Kelas Diampu` : 'Guru Pengajar'}</span>
                        </div>
                        <h5 className="font-extrabold text-sm text-gray-900 dark:text-gray-100 truncate">
                          {item.guru_nama || item.nama || 'Guru Pengajar'}
                        </h5>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                          NIP: <strong className="text-gray-800 dark:text-gray-200">{item.identifier || item.guru_nip || '-'}</strong>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-purple-600">{persentase}%</span>
                        <span className="block text-[10px] text-gray-400">Kehadiran</span>
                      </div>
                    </div>

                    {item.daftar_mapel && (
                      <div className="text-[11px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800/80 leading-relaxed">
                        <span className="font-bold text-gray-700 dark:text-gray-200">Mapel: </span>
                        <span>{item.daftar_mapel}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                        <span className="block text-[10px] text-emerald-600 font-bold">Hadir</span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">{hadir}</span>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                        <span className="block text-[10px] text-blue-600 font-bold">Izin</span>
                        <span className="font-bold text-blue-800 dark:text-blue-300">{izin}</span>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                        <span className="block text-[10px] text-amber-600 font-bold">Sakit</span>
                        <span className="font-bold text-amber-800 dark:text-amber-300">{sakit}</span>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-100 dark:border-rose-900/30" title="Alpha / Tanpa Keterangan">
                        <span className="block text-[10px] text-rose-600 font-bold truncate">Alpha</span>
                        <span className="font-bold text-rose-800 dark:text-rose-300">{alpha}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700/60 space-y-2.5">
                      {/* Baris WhatsApp */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">WhatsApp Pengajar:</span>
                        <div className="flex items-center gap-1 font-mono text-xs text-gray-700 dark:text-gray-300 font-bold">
                          <Phone size={12} className="text-emerald-500 shrink-0" />
                          <span>{rawPhone || '-'}</span>
                        </div>
                      </div>

                      {/* Baris Tombol PDF dan WA Guru (50% - 50%) */}
                      <div className="grid grid-cols-2 gap-2 w-full pt-0.5">
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200/80 dark:border-slate-600 shadow-2xs"
                          title="Lihat PDF"
                        >
                          <FileText size={14} className="text-purple-600 dark:text-purple-400" />
                          <span>Lihat PDF</span>
                        </a>

                        {hasWa ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              setSentWaIds(prev => ({ ...prev, [item.id]: true }));
                              handleScrollToNextGuru(idx + 1);
                            }}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                              isSent
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                : 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                            }`}
                          >
                            <MessageCircle size={14} />
                            <span>{isSent ? 'Terkirim ✓' : 'WA Guru'}</span>
                          </a>
                        ) : (
                          <div className="w-full py-2 rounded-xl text-xs font-bold text-gray-400 bg-gray-100/70 dark:bg-gray-800/60 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1 italic">
                            <span>No WA Kosong</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 4. EXPANDABLE SECTION: FITUR TAMBAHAN (LOOPING MASSAL & LAPORAN KEPALA MADIN) */}
      <div className="mt-8 border border-purple-200 dark:border-purple-700/80 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvancedOptions(prev => !prev)}
          className="w-full p-4.5 flex items-center justify-between bg-purple-50/80 dark:bg-gray-800/90 hover:bg-purple-100/80 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
              <Calendar size={18} />
            </div>
            <div>
              <h5 className="font-extrabold text-sm text-purple-950 dark:text-purple-100 leading-tight">
                ⚙️ Opsi Pengiriman Massal Otomatis & Laporan Khusus Kepala Madin
              </h5>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                Buka penjadwalan looping bulanan otomatis (tiap tgl 1) serta siaran evaluasi ke Kepala Madin (Manual WA & Bot)
              </p>
            </div>
          </div>
          <div className="text-purple-600 dark:text-purple-400 shrink-0">
            {showAdvancedOptions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </button>

        {showAdvancedOptions && (
          <div className="p-5 md:p-6 space-y-6 border-t border-purple-200/80 dark:border-gray-700/80 animate-[fadeIn_0.3s_ease-out] bg-white dark:bg-gray-900">
            {/* Form Konfigurasi Periode & Kategori untuk Looping Massal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Pilih Periode */}
              <div className="p-4.5 bg-gray-50/90 dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-3">
                <label className="block text-xs font-extrabold text-gray-800 dark:text-gray-100 uppercase tracking-wider">
                  1. Periode Rekapitulasi Massal
                </label>

                {/* Mode Waktu Toggle */}
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-300 mb-1 font-semibold">Mode Waktu</label>
                  <button
                    type="button"
                    onClick={() => setRekapModeRentang(v => !v)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      rekapModeRentang
                        ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-600 text-purple-800 dark:text-purple-200'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span className="whitespace-nowrap">{rekapModeRentang ? '📅 Mode Rentang' : '🗓️ Mode Bulanan'}</span>
                    <span className={`flex items-center gap-1 text-[11px] font-semibold ${rekapModeRentang ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {rekapModeRentang ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </span>
                  </button>
                </div>

                {/* Conditional Inputs */}
                {rekapModeRentang ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-gray-300 mb-1 font-semibold">Dari Tanggal</label>
                      <input
                        type="date"
                        value={rekapTanggalDari}
                        onChange={(e) => setRekapTanggalDari(e.target.value)}
                        max={rekapTanggalSampai}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-gray-300 mb-1 font-semibold">Sampai Tanggal</label>
                      <input
                        type="date"
                        value={rekapTanggalSampai}
                        onChange={(e) => setRekapTanggalSampai(e.target.value)}
                        min={rekapTanggalDari}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-gray-300 mb-1 font-semibold">Bulan</label>
                      <select
                        value={rekapBulan}
                        onChange={(e) => setRekapBulan(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        {[
                          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                        ].map((m, idx) => (
                          <option key={idx + 1} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-gray-300 mb-1 font-semibold">Tahun</label>
                      <select
                        value={rekapTahun}
                        onChange={(e) => setRekapTahun(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        {[2025, 2026, 2027, 2028].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {rekapModeRentang
                    ? 'Rekapitulasi akan menghitung kehadiran guru pada rentang tanggal yang dipilih.'
                    : 'Rekapitulasi akan menghitung kehadiran guru & santri pada bulan terpilih.'}
                </p>
              </div>

              {/* 2. Pilih Kategori Jadwal (Checkbox) */}
              <div className="p-4.5 bg-gray-50/90 dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-3">
                <label className="block text-xs font-extrabold text-gray-800 dark:text-gray-100 uppercase tracking-wider">
                  2. Kategori Jadwal Mengajar
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'madin', label: '📚 Madrasah Diniyah', desc: 'Jadwal & pelajaran diniyah (Aktif)' },
                    { key: 'quran', label: "🕌 Kelas Qur'an", desc: 'Majlis Al-Qur\'an & Tahfidz' },
                    { key: 'kamar', label: '🏠 Asrama / Kamar', desc: 'Kegiatan & piket asrama' },
                  ].map(({ key, label, desc }) => {
                    const checked = rekapCategories.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                          checked
                            ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-600 text-purple-950 dark:text-purple-100 font-bold'
                            : 'bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-700/80 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRekapCategory(key)}
                          className="mt-0.5 accent-purple-600 w-3.5 h-3.5 shrink-0"
                        />
                        <div>
                          <span className="block text-xs font-bold">{label}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">{desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Status Alert Rekapitulasi Massal */}
            {rekapStatusMsg && (
              <div className={`p-4 rounded-2xl border ${
                rekapStatusMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}>
                <div className="flex items-center gap-2 font-bold mb-1 text-xs">
                  {rekapStatusMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-red-600" />}
                  <span>{rekapStatusMsg.text}</span>
                </div>
                {rekapStatusMsg.details && Array.isArray(rekapStatusMsg.details) && (
                  <div className="mt-2.5 max-h-36 overflow-y-auto space-y-1 text-[11px] pr-1">
                    {rekapStatusMsg.details.map((det: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-black/5 dark:border-white/5">
                        <span className="font-medium">{det.guru_nama} ({det.phone})</span>
                        <span className={det.success ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                          {det.success ? '✓ Terjadwal' : `✗ ${det.error || 'Gagal'}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tombol Aksi Kirim / Jadwalkan Rekap Massal */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isRekapScheduling || isRekapSending || rekapModeRentang}
                onClick={() => handleSendRekapWA('schedule_monthly')}
                className="w-full sm:w-auto px-5 py-3 text-xs font-bold text-purple-700 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-700 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                title={rekapModeRentang ? 'Penjadwalan otomatis hanya tersedia di Mode Bulanan' : 'Jadwalkan pengiriman otomatis setiap tanggal 1 jam 08:00 WIB'}
              >
                {isRekapScheduling ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
                <span>{isRekapScheduling ? 'Menjadwalkan...' : 'Jadwalkan Tiap Tgl 1 (Looping Bulanan)'}</span>
              </button>
              <button
                type="button"
                disabled={isRekapSending || isRekapScheduling}
                onClick={() => handleSendRekapWA('send_now')}
                className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {isRekapSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                <span>{isRekapSending ? 'Sedang Mengirim...' : 'Kirim Rekap Massal Sekarang'}</span>
              </button>
            </div>

            {/* Bagian Khusus: Laporan ke Kepala Madin */}
            <div className="mt-8 pt-6 border-t-2 border-dashed border-purple-200 dark:border-gray-700 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                    <Award size={18} />
                  </div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-gray-100 leading-tight">
                    Laporan Evaluasi Khusus Kepala Madrasah Diniyah (Madin)
                  </h4>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Kirim rekapitulasi kehadiran dewan guru Madin bulan terpilih secara manual per individu maupun otomatis terjadwal ke WhatsApp Kepala Madin.
                </p>
              </div>

              {/* Sasaran Kepala Madin: Putra vs Putri vs Semua */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Sasaran Kepala Madin
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                  {[
                    { key: 'putra', label: 'Madin Putra' },
                    { key: 'putri', label: 'Madin Putri' },
                    { key: 'all', label: 'Semua Madin' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTargetKepalaMadinChange(tab.key as any)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1 ${
                        kepalaMadinTarget === tab.key
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/60 dark:bg-gray-800/80 p-4.5 rounded-2xl border border-purple-200/80 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                    Pilih Akun Guru ({kepalaMadinTarget === 'putra' ? 'Kepala Madin Putra' : kepalaMadinTarget === 'putri' ? 'Kepala Madin Putri' : 'Kepala Madin'})
                  </label>
                  <select
                    value={selectedKepalaMadinId}
                    onChange={(e) => handleSelectKepalaMadin(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="">-- Pilih dari Daftar Dewan Guru / Pengurus --</option>
                    {guruList.map(g => (
                      <option key={g.guru_id} value={g.guru_id}>
                        {g.nama} {g.jabatan ? `(${g.jabatan})` : ''} - {g.whatsapp || 'No WA (-) '}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                    Nomor WhatsApp Tujuan ({kepalaMadinTarget === 'putra' ? 'Madin Putra' : kepalaMadinTarget === 'putri' ? 'Madin Putri' : 'Kepala Madin'})
                  </label>
                  <input
                    type="text"
                    value={kepalaMadinPhone}
                    onChange={(e) => {
                      setKepalaMadinPhone(e.target.value);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(`kepala_madin_${kepalaMadinTarget}_phone`, e.target.value);
                      }
                    }}
                    onBlur={() => {
                      if (kepalaMadinPhone) {
                        saveTemplate(`kepala_madin_${kepalaMadinTarget}_phone`, kepalaMadinPhone);
                      }
                    }}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  {saveStatus[`kepala_madin_${kepalaMadinTarget}_phone`] === 'saved' && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
                      <CheckCircle2 size={12} /> Nomor WA tersimpan di Database ✓
                    </span>
                  )}
                </div>
              </div>

              {/* Templat Pesan Kepala Madin */}
              <div className="bg-amber-50/50 dark:bg-gray-800/80 p-4.5 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>Edit Templat Pesan untuk Kepala Madin</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                    Placeholder: &#123;total_guru&#125;, &#123;avg_kehadiran&#125;, &#123;ringkasan_kehadiran&#125;, &#123;link_laporan&#125;
                  </span>
                </label>
                <textarea
                  value={pesanKepalaMadinTemplate}
                  onChange={(e) => {
                    setPesanKepalaMadinTemplate(e.target.value);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('wa_template_kepala_madin', e.target.value);
                    }
                  }}
                  onBlur={() => saveTemplate('wa_template_kepala_madin', pesanKepalaMadinTemplate)}
                  rows={4}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
                <div className="mt-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-amber-200/50 dark:border-gray-700/60">
                  <button
                    type="button"
                    onClick={() => resetTemplate('wa_template_kepala_madin', DEFAULT_KEPALA_MADIN_TEMPLATE, setPesanKepalaMadinTemplate)}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center justify-center gap-1 cursor-pointer text-center w-full sm:w-auto"
                  >
                    ⟳ Reset ke Templat Default
                  </button>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 w-full sm:w-auto">
                    {saveStatus['wa_template_kepala_madin'] === 'saved' && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 size={13} /> Tersimpan di Database ✓
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => saveTemplate('wa_template_kepala_madin', pesanKepalaMadinTemplate)}
                      className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Simpan Templat
                    </button>
                  </div>
                </div>
              </div>

              {/* TABEL & KARTU SIARAN WHATSAPP MANUAL KEPALA MADIN */}
              <div className="space-y-3 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">
                      Pengiriman Manual WhatsApp (Individu)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                      1 Sasaran Kepala Madin
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchKepalaMadinLink}
                    disabled={loadingKepalaMadinData}
                    className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw size={12} className={loadingKepalaMadinData ? 'animate-spin' : ''} />
                    <span>Perbarui Link & Data</span>
                  </button>
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700 text-xs">
                      <tr>
                        <th className="px-5 py-3.5 rounded-l-xl">Sasaran Kepala Madin</th>
                        <th className="px-5 py-3.5">Akun & Kontak WhatsApp</th>
                        <th className="px-5 py-3.5 text-right rounded-r-xl">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium text-xs">
                      <tr className="hover:bg-gray-50/80 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-5 py-4 font-semibold text-gray-800 dark:text-gray-200">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                            <Award size={15} className="text-amber-500 shrink-0" />
                            <span>
                              {kepalaMadinTarget === 'putra'
                                ? 'Kepala Madin Putra'
                                : kepalaMadinTarget === 'putri'
                                  ? 'Kepala Madin Putri'
                                  : 'Kepala Madrasah Diniyah (Semua)'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {kepalaMadinData?.avgPct ?? 0}% Rata-rata Hadir
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                              {kepalaMadinData?.totalGuru ?? 0} Guru Terdata ({kepalaMadinData?.totalHadir ?? 0}H · {(kepalaMadinData?.totalIzin ?? 0) + (kepalaMadinData?.totalSakit ?? 0)}I/S · {kepalaMadinData?.totalAlpha ?? 0}A)
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                          {(() => {
                            const selectedGuru = guruList.find(g => String(g.guru_id) === String(selectedKepalaMadinId));
                            return (
                              <>
                                <div className="font-bold text-gray-800 dark:text-gray-200">
                                  {selectedGuru?.nama || 'Akun Belum Ditautkan'}
                                </div>
                                <div className="text-xs font-mono mt-0.5 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <Phone size={12} className="text-gray-400 shrink-0" />
                                  <span>{kepalaMadinPhone || '-'}</span>
                                </div>
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                          {/* Tombol Lihat Laporan */}
                          {kepalaMadinData?.reportUrl ? (
                            <a
                              href={kepalaMadinData.reportUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                              title="Lihat Pratinjau Dokumen & Evaluasi Kepala Madin"
                            >
                              <FileText size={13} className="text-amber-500 shrink-0" />
                              <span>Lihat Laporan</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-60"
                            >
                              <FileText size={13} />
                              <span>Memuat...</span>
                            </button>
                          )}

                          {/* Tombol Kirim WA Manual */}
                          {kepalaMadinPhone && kepalaMadinData?.waLink && kepalaMadinData.waLink !== '#' ? (
                            <a
                              href={kepalaMadinData.waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setSentKepalaMadinWa(true)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                                sentKepalaMadinWa
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  : 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                              }`}
                            >
                              <MessageCircle size={14} />
                              <span>{sentKepalaMadinWa ? 'Terkirim ✓' : 'WA Kepala Madin'}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">
                              No WA Kosong
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card */}
                <div className="block md:hidden">
                  <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1.5">
                          <Award size={15} className="text-amber-500 shrink-0" />
                          <span>
                            {kepalaMadinTarget === 'putra'
                              ? 'Kepala Madin Putra'
                              : kepalaMadinTarget === 'putri'
                                ? 'Kepala Madin Putri'
                                : 'Kepala Madin (Semua)'}
                          </span>
                        </div>
                        {(() => {
                          const selectedGuru = guruList.find(g => String(g.guru_id) === String(selectedKepalaMadinId));
                          return (
                            <div className="text-xs text-gray-600 dark:text-gray-300 font-medium mt-0.5">
                              {selectedGuru?.nama || 'Akun Belum Ditautkan'}
                            </div>
                          );
                        })()}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                        {kepalaMadinData?.avgPct ?? 0}% Hadir
                      </span>
                    </div>

                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl space-y-1 text-xs border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 text-[11px]">
                        <span>Nomor WhatsApp:</span>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{kepalaMadinPhone || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 text-[11px]">
                        <span>Total Presensi Guru:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{kepalaMadinData?.totalGuru ?? 0} Guru ({kepalaMadinData?.totalSesi ?? 0} Sesi)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {kepalaMadinData?.reportUrl ? (
                        <a
                          href={kepalaMadinData.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <FileText size={13} className="text-amber-500" />
                          <span>Lihat Laporan</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center gap-1 opacity-60"
                        >
                          <FileText size={13} />
                          <span>Memuat...</span>
                        </button>
                      )}

                      {kepalaMadinPhone && kepalaMadinData?.waLink && kepalaMadinData.waLink !== '#' ? (
                        <a
                          href={kepalaMadinData.waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSentKepalaMadinWa(true)}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                            sentKepalaMadinWa
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <MessageCircle size={14} />
                          <span>{sentKepalaMadinWa ? 'Terkirim ✓' : 'WA Kepala'}</span>
                        </a>
                      ) : (
                        <div className="w-full py-2 rounded-xl text-xs font-bold text-gray-400 bg-gray-100/70 dark:bg-gray-800/60 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center italic">
                          <span>No WA Kosong</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {kepalaMadinStatusMsg && (
                <div className={`p-4 rounded-2xl border text-xs font-bold ${
                  kepalaMadinStatusMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-900 dark:text-red-200'
                }`}>
                  {kepalaMadinStatusMsg.text}
                </div>
              )}

              {/* Opsi Pengiriman Massal & Penjadwalan Bot Otomatis */}
              <div className="pt-3 border-t border-purple-150/70 dark:border-gray-700/60 space-y-2.5">
                <span className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">
                  Opsi Otomatis / Penjadwalan Bot Bulanan:
                </span>
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isKepalaMadinScheduling || isKepalaMadinSending || rekapModeRentang}
                    onClick={() => handleSendKepalaMadinWA('schedule_monthly')}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    title={rekapModeRentang ? 'Penjadwalan otomatis hanya tersedia di Mode Bulanan' : 'Jadwalkan laporan ke Kepala Madin tiap tanggal 1'}
                  >
                    {isKepalaMadinScheduling ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                    <span>{isKepalaMadinScheduling ? 'Menjadwalkan...' : 'Jadwalkan Laporan Kepala Madin Tiap Tgl 1'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isKepalaMadinSending || isKepalaMadinScheduling}
                    onClick={() => handleSendKepalaMadinWA('send_now')}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                  >
                    {isKepalaMadinSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>{isKepalaMadinSending ? 'Mengirim...' : 'Kirim via Bot Otomatis'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
