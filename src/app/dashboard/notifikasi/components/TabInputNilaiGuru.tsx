'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Award, Search, RefreshCw, Clock, CheckCircle2, AlertCircle,
  Phone, MessageCircle, Sparkles, User, BookOpen, ArrowUpDown,
  ArrowUp, ArrowDown, ExternalLink, Copy, Check, X
} from 'lucide-react';

export const DEFAULT_INPUT_NILAI_GURU_TEMPLATE = `Assalamu'alaikum Warohmatullah Wabarokatuh,

Yth. Ustadz/Ustadzah *{nama_guru}*
Pondok Pesantren Matholi'ul Anwar

Berikut kami sampaikan tautan pintasan resmi untuk Penginputan Nilai Santri & Leger Nilai Semester {semester} Tahun Ajaran {tahun_ajaran}:

📚 *Daftar Kelas & Mata Pelajaran yang Diampu:*
{daftar_mapel_kelas}

📊 *Status Penginputan Nilai Saat Ini:*
• Terisi: {total_dinilai} dari {total_santri} santri ({persentase}%)

📝 *Tautan Pintasan Pengisian Nilai (Langsung Buka):*
{link_input_nilai}

⚠️ _Catatan: Tautan pintasan ini bersifat resmi, aman, dan berlaku selama {masa_berlaku} (sampai {batas_waktu}). Ustadz/Ustadzah dapat langsung memasukkan nilai Harian, UTS, UAS, dan catatan santri melalui tautan di atas._

Demikian informasi ini kami sampaikan. Atas keikhlasan, dedikasi, dan bimbingan Ustadz/Ustadzah dalam mendidik para santri, kami haturkan jazakumullah khairan katsiran.

Wassalamu'alaikum Warohmatullah Wabarokatuh,
_Pengurus Pondok Pesantren Matholi'ul Anwar_`;

type InputNilaiSortField = 'nama' | 'persentase' | 'total_santri' | 'total_mapel' | 'nip';
type SortDir = 'asc' | 'desc';

function InputNilaiSortButton({
  field, label, current, dir, onSort,
}: {
  field: InputNilaiSortField; label: string; current: InputNilaiSortField; dir: SortDir;
  onSort: (f: InputNilaiSortField) => void;
}) {
  const active = current === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
        active
          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600'
      }`}
    >
      {active ? (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} />}
      {label}
    </button>
  );
}

export interface TabInputNilaiGuruProps {
  guruList: any[];
  pesanInputNilaiTemplate: string;
  setPesanInputNilaiTemplate: React.Dispatch<React.SetStateAction<string>>;
  saveTemplate: (key: string, value: string) => Promise<void>;
  resetTemplate: (key: string, defaultValue: string, setter: (val: string) => void) => Promise<void>;
  saveStatus: Record<string, string>;
}

export default function TabInputNilaiGuru({
  guruList,
  pesanInputNilaiTemplate,
  setPesanInputNilaiTemplate,
  saveTemplate,
  resetTemplate,
  saveStatus,
}: TabInputNilaiGuruProps) {
  // Filter States (fokus Madrasah Diniyah sesuai modul Penilaian)
  const [kategori, setKategori] = useState<'all' | 'putra' | 'putri'>('all');
  const [kelasFilterId, setKelasFilterId] = useState<string>('all');
  const [kelasOptions, setKelasOptions] = useState<Array<{ kelas_id: number; nama_kelas: string }>>([]);
  const [targetGuruId, setTargetGuruId] = useState<string>('all');
  const [semester, setSemester] = useState<string>('1');
  const [tahunAjaran, setTahunAjaran] = useState<string>('2025/2026');
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [searchNama, setSearchNama] = useState<string>('');

  // Data State
  const [teacherData, setTeacherData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [waFilter, setWaFilter] = useState<'semua' | 'ada' | 'tidak_ada' | 'belum_lengkap' | 'lengkap'>('semua');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [sentWaIds, setSentWaIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<InputNilaiSortField>('nama');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: InputNilaiSortField) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  // Options guru urut abjad
  const optionsGuru = useMemo(() => {
    return [...(guruList || [])].sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
  }, [guruList]);

  // Fetch Data Guru & Nilai
  const fetchTeacherScores = async () => {
    setLoadingData(true);
    setErrorMsg('');
    try {
      const expiryParam = expiryDays && expiryDays >= 1 ? expiryDays : 7;
      const params = new URLSearchParams({
        kategori,
        kelas_id: kelasFilterId || 'all',
        target_id: targetGuruId || 'all',
        semester,
        tahun_ajaran: tahunAjaran,
        expiry: String(expiryParam),
      });

      const res = await fetch(`/api/penilaian/shortcut-guru?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTeacherData(json.data || []);
        if (Array.isArray(json.kelas_options)) {
          setKelasOptions(json.kelas_options);
        }
        setHasFetched(true);
      } else {
        setErrorMsg(json.error || 'Gagal memuat data penginputan nilai guru.');
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
        const el = document.getElementById('input-nilai-guru-hasil-anchor');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [hasFetched, loadingData]);

  // Format Nomor WhatsApp
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    return p;
  };

  // Generate WA Message & URL
  const generateWaContent = (item: any) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.ppmawar.or.id';
    const previewUrl = item.preview_token
      ? `${origin}/penilaian/input?t=${item.preview_token}`
      : `${origin}/dashboard/penilaian`;

    const masaBerlaku = item.token_duration_label || `${expiryDays} Hari`;
    const batasWaktu = item.token_exp_date || '-';
    const semLabel = semester === '1' ? '1 (Ganjil)' : '2 (Genap)';

    const msg = (pesanInputNilaiTemplate || DEFAULT_INPUT_NILAI_GURU_TEMPLATE)
      .replace(/{nama_guru}/g, item.nama || item.guru_nama || 'Ustadz/Ustadzah')
      .replace(/{semester}/g, semLabel)
      .replace(/{tahun_ajaran}/g, tahunAjaran)
      .replace(/{daftar_mapel_kelas}/g, item.daftar_mapel_text || item.daftar_mapel_ringkas || '-')
      .replace(/{total_santri}/g, String(item.total_santri_target || 0))
      .replace(/{total_dinilai}/g, String(item.total_santri_dinilai || 0))
      .replace(/{persentase}/g, String(item.persentase_selesai || 0))
      .replace(/{link_input_nilai}/g, previewUrl)
      .replace(/{masa_berlaku}/g, masaBerlaku)
      .replace(/{batas_waktu}/g, batasWaktu);

    const phone = formatPhoneNumber(item.no_hp || '');
    const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : '#';

    return { msg, previewUrl, phone, waUrl };
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // ignore clipboard errors in restricted contexts
    }
  };

  const handleWaClick = (itemId: string, idx: number, isMobile: boolean) => {
    setSentWaIds(prev => ({ ...prev, [itemId]: true }));
    if (autoScroll) {
      setTimeout(() => {
        const nextIdx = idx + 1;
        const targetId = isMobile ? `guru-input-card-${nextIdx}` : `guru-input-row-${nextIdx}`;
        let nextEl = document.getElementById(targetId);
        if (!nextEl || nextEl.offsetParent === null) {
          nextEl = document.getElementById(isMobile ? `guru-input-row-${nextIdx}` : `guru-input-card-${nextIdx}`);
        }
        if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
    }
  };

  // Search-filtered items
  const searchFiltered = useMemo(() => {
    if (!searchNama.trim()) return teacherData;
    const q = searchNama.toLowerCase().trim();
    return teacherData.filter(g =>
      (g.nama || '').toLowerCase().includes(q) ||
      (g.nip || '').toLowerCase().includes(q) ||
      (g.no_hp || '').includes(q) ||
      (g.daftar_mapel_ringkas || '').toLowerCase().includes(q)
    );
  }, [teacherData, searchNama]);

  // Statistik Filter
  const filterCounts = useMemo(() => {
    let adaWa = 0;
    let tanpaWa = 0;
    let lengkap = 0;
    let belumLengkap = 0;
    searchFiltered.forEach(g => {
      if (formatPhoneNumber(g.no_hp).length >= 10) adaWa++;
      else tanpaWa++;
      if (g.status_kelengkapan === 'lengkap') lengkap++;
      else belumLengkap++;
    });
    return { total: searchFiltered.length, adaWa, tanpaWa, lengkap, belumLengkap };
  }, [searchFiltered]);

  // Filtered & Sorted Guru List
  const filteredGuruList = useMemo(() => {
    let result = [...searchFiltered];

    if (waFilter === 'ada') {
      result = result.filter(g => formatPhoneNumber(g.no_hp).length >= 10);
    } else if (waFilter === 'tidak_ada') {
      result = result.filter(g => formatPhoneNumber(g.no_hp).length < 10);
    } else if (waFilter === 'belum_lengkap') {
      result = result.filter(g => g.status_kelengkapan !== 'lengkap');
    } else if (waFilter === 'lengkap') {
      result = result.filter(g => g.status_kelengkapan === 'lengkap');
    }

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'persentase') {
        valA = a.persentase_selesai || 0;
        valB = b.persentase_selesai || 0;
      } else if (sortField === 'total_santri') {
        valA = a.total_santri_target || 0;
        valB = b.total_santri_target || 0;
      } else if (sortField === 'total_mapel') {
        valA = a.total_mapel || 0;
        valB = b.total_mapel || 0;
      }

      if (typeof valA === 'string') {
        const cmp = (valA || '').localeCompare(String(valB || ''), 'id');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [searchFiltered, waFilter, sortField, sortDir]);

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
      {/* 1. Filter Section (Persis Foto 2, Tema Amber sesuai Foto 1) */}
      <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-amber-200/50 dark:border-amber-800/30 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-4 bg-amber-500 rounded-full"></span>
            <h3 className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Filter Pintasan Input &amp; Leger Nilai Guru
            </h3>
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold hidden sm:inline">
            Kirim tautan pengisian nilai langsung ke WhatsApp pengajar
          </span>
        </div>

        {/* Input & Dropdown Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Cari Guru / Mapel */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Cari Mapel / Guru
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchNama}
                onChange={e => setSearchNama(e.target.value)}
                placeholder="Cari mapel, kelas, atau nama guru..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
              />
              {searchNama && (
                <button
                  type="button"
                  onClick={() => setSearchNama('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  aria-label="Hapus pencarian"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Pilih Unit / Bagian Madin */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Pilih Unit Madin
            </label>
            <select
              value={kategori}
              onChange={e => {
                setKategori(e.target.value as any);
                setKelasFilterId('all');
              }}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            >
              <option value="all">📚 Semua Madrasah Diniyah (Madin)</option>
              <option value="putra">🕌 Madin Putra</option>
              <option value="putri">🌸 Madin Putri</option>
            </select>
          </div>

          {/* Pilih Guru / Pengajar */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Pilih Guru / Pengajar
            </label>
            <select
              value={targetGuruId}
              onChange={e => setTargetGuruId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            >
              <option value="all">Semua Guru / Pengajar</option>
              {optionsGuru.map((g: any) => (
                <option key={g.guru_id} value={String(g.guru_id)}>
                  {g.nama} {g.nip ? `(NIP: ${g.nip})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={e => setSemester(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            >
              <option value="1">Semester 1 (Ganjil)</option>
              <option value="2">Semester 2 (Genap)</option>
            </select>
          </div>

          {/* Tahun Ajaran */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Tahun Ajaran
            </label>
            <select
              value={tahunAjaran}
              onChange={e => setTahunAjaran(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            >
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>

          {/* Filter Kelas Spesifik (jika sudah dimuat) + Tombol Tampilkan */}
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            {kelasOptions.length > 0 && (
              <div className="w-full sm:w-1/2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Kelas Madin
                </label>
                <select
                  value={kelasFilterId}
                  onChange={e => setKelasFilterId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                >
                  <option value="all">Semua Kelas</option>
                  {kelasOptions.map(k => (
                    <option key={k.kelas_id} value={String(k.kelas_id)}>
                      {k.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={fetchTeacherScores}
              disabled={loadingData}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loadingData ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Memuat...</span>
                </>
              ) : (
                <>
                  <Award size={14} />
                  <span>Tampilkan Data Input Nilai</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Masa Berlaku Tautan */}
        <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-amber-200/50 dark:border-amber-800/30 text-xs">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-amber-600 dark:text-amber-400" />
            <span className="font-bold text-gray-700 dark:text-gray-300">Masa Berlaku Tautan:</span>
            <input
              type="number"
              min={1}
              max={90}
              value={expiryDays}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setExpiryDays(isNaN(val) ? ('' as any) : val);
              }}
              onBlur={() => {
                if (!expiryDays || expiryDays < 1) setExpiryDays(1);
                else if (expiryDays > 90) setExpiryDays(90);
              }}
              className="w-14 px-2 py-0.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-bold text-xs"
            />
            <span className="text-gray-500">Hari (Min. 1 Hari)</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500">Pilihan Cepat:</span>
            {[1, 3, 7, 14, 30].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setExpiryDays(d)}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  expiryDays === d
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-amber-400'
                }`}
              >
                {d} Hari {d === 7 ? '(Standar)' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Edit Templat Pesan WA Penginputan Nilai (Persis Foto 2 & 3) */}
      <div className="bg-amber-50/30 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-800/40 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-600" />
            <span>✏️ Edit Templat Pesan WhatsApp Pintasan Input Nilai Guru</span>
          </label>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
            Placeholder: &#123;nama_guru&#125;, &#123;semester&#125;, &#123;tahun_ajaran&#125;, &#123;daftar_mapel_kelas&#125;, &#123;total_dinilai&#125;, &#123;total_santri&#125;, &#123;persentase&#125;, &#123;link_input_nilai&#125;, &#123;masa_berlaku&#125;, &#123;batas_waktu&#125;
          </span>
        </div>

        <textarea
          rows={6}
          value={pesanInputNilaiTemplate}
          onChange={e => {
            setPesanInputNilaiTemplate(e.target.value);
            if (typeof window !== 'undefined') {
              localStorage.setItem('wa_template_input_nilai_guru', e.target.value);
            }
          }}
          onBlur={() => saveTemplate('wa_template_input_nilai_guru', pesanInputNilaiTemplate)}
          className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none font-mono text-gray-800 dark:text-gray-200 leading-relaxed shadow-inner"
          placeholder="Tulis draf templat pesan pengingat input nilai..."
        />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-amber-200/40 dark:border-amber-800/30">
          <button
            type="button"
            onClick={() => resetTemplate('wa_template_input_nilai_guru', DEFAULT_INPUT_NILAI_GURU_TEMPLATE, setPesanInputNilaiTemplate)}
            className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            ⟳ Reset ke Templat Default
          </button>
          {saveStatus['wa_template_input_nilai_guru'] === 'saved' && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 size={13} /> Tersimpan di Database ✓
            </span>
          )}
          <button
            type="button"
            onClick={() => saveTemplate('wa_template_input_nilai_guru', pesanInputNilaiTemplate)}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px] cursor-pointer"
          >
            {saveStatus['wa_template_input_nilai_guru'] === 'saving' ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan Templat</span>
            )}
          </button>
        </div>
      </div>

      {/* Anchor scroll */}
      <div id="input-nilai-guru-hasil-anchor" className="scroll-mt-20" />

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Hasil / List Guru (Persis Foto 3 & TabRekapGuru) */}
      {loadingData ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-200/60 dark:border-gray-800">
          <RefreshCw className="animate-spin text-amber-600 mb-2" size={24} />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
            Menghitung progres penginputan nilai dan membuat tautan pintasan guru...
          </span>
        </div>
      ) : !hasFetched ? (
        <div className="p-10 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-500">
          <Award size={28} className="mx-auto mb-2 text-amber-500 opacity-60" />
          <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">Data Belum Ditampilkan</p>
          <p>Pilih semester, tahun ajaran, dan unit di atas, lalu klik tombol <strong>&quot;Tampilkan Data Input Nilai&quot;</strong>.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Panel */}
          <div className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
            {/* Baris 1: Semua */}
            <button
              type="button"
              onClick={() => setWaFilter('semua')}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                waFilter === 'semua'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>Semua</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                waFilter === 'semua' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}>
                {filterCounts.total}
              </span>
            </button>

            {/* Baris 2: Filter WA & Kelengkapan */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  {filterCounts.adaWa}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWaFilter('tidak_ada')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  waFilter === 'tidak_ada'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>Tanpa No. WA</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  waFilter === 'tidak_ada' ? 'bg-white/20 text-white' : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                }`}>
                  {filterCounts.tanpaWa}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWaFilter('belum_lengkap')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  waFilter === 'belum_lengkap'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>Belum Lengkap</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  waFilter === 'belum_lengkap' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                }`}>
                  {filterCounts.belumLengkap}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWaFilter('lengkap')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  waFilter === 'lengkap'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>Lengkap</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  waFilter === 'lengkap' ? 'bg-white/20 text-white' : 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300'
                }`}>
                  {filterCounts.lengkap}
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
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                    : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-amber-600 animate-pulse' : 'bg-gray-400'}`} />
                <span>Auto-scroll {autoScroll ? 'Aktif' : 'Mati'}</span>
              </button>
            </div>

            {/* Baris 4: Sort / Urutkan */}
            <div className="pt-1 border-t border-gray-100 dark:border-gray-700/60">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mr-0.5">Urutkan:</span>
                <InputNilaiSortButton field="nama" label="Nama Guru" current={sortField} dir={sortDir} onSort={handleSort} />
                <InputNilaiSortButton field="persentase" label="% Selesai" current={sortField} dir={sortDir} onSort={handleSort} />
                <InputNilaiSortButton field="total_santri" label="Jml Santri" current={sortField} dir={sortDir} onSort={handleSort} />
                <InputNilaiSortButton field="total_mapel" label="Jml Kelas/Mapel" current={sortField} dir={sortDir} onSort={handleSort} />
                <InputNilaiSortButton field="nip" label="NIP" current={sortField} dir={sortDir} onSort={handleSort} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span>
              Menampilkan <strong className="text-gray-800 dark:text-gray-200">{filteredGuruList.length}</strong> guru / pengajar untuk disiarkan
            </span>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold hidden sm:inline">
              💡 Tautan WA otomatis menyertakan pintasan input nilai siap pakai tanpa perlu login
            </span>
          </div>

          {filteredGuruList.length === 0 ? (
            <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900">
              <User size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-xs font-bold">Tidak ada data guru yang cocok dengan filter</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View (Persis Pola TabRekapGuru) */}
              <div className="hidden md:block overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="px-5 py-4 rounded-l-xl">Guru Pengajar &amp; Progres Input Nilai</th>
                      <th className="px-5 py-4 text-right rounded-r-xl">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {filteredGuruList.map((item, idx) => {
                      const { msg, previewUrl, phone, waUrl } = generateWaContent(item);
                      const isSent = !!sentWaIds[item.id];
                      const hasPhone = phone.length >= 10;

                      return (
                        <tr
                          key={item.id}
                          id={`guru-input-row-${idx}`}
                          className={`transition-colors scroll-mt-24 ${
                            isSent
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-sm shrink-0 border border-amber-200/60 dark:border-amber-800/40 mt-0.5">
                                {(item.nama || 'G')[0]}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                    {item.nama || item.guru_nama}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40">
                                    {item.total_mapel} Mapel / Kelas
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    item.status_kelengkapan === 'lengkap'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                      : item.status_kelengkapan === 'sebagian'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {item.status_kelengkapan === 'lengkap'
                                      ? '✓ Nilai Lengkap'
                                      : item.status_kelengkapan === 'sebagian'
                                        ? '⚠️ Sebagian Terisi'
                                        : 'Belum Diisi'}
                                  </span>
                                  {isSent && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 inline-flex items-center gap-1">
                                      <Check size={10} /> Terkirim
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                  <span className="font-mono">NIP: {item.nip || '-'}</span>
                                  <span>•</span>
                                  <span>{hasPhone ? `WA: ${item.no_hp}` : '⚠️ Tanpa Nomor WA'}</span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  {item.mapel_list.map((m: any, mIdx: number) => (
                                    <span
                                      key={mIdx}
                                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 inline-flex items-center gap-1"
                                    >
                                      <BookOpen size={10} className="text-amber-500" />
                                      <span>{m.nama_kelas} ({m.mata_pelajaran})</span>
                                      <span className="text-gray-400 font-normal">[{m.total_dinilai}/{m.total_santri}]</span>
                                    </span>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2.5 pt-0.5">
                                  <div className="w-40 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                                      style={{ width: `${item.persentase_selesai || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                                    {item.total_santri_dinilai}/{item.total_santri_target} Santri ({item.persentase_selesai}%)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right whitespace-nowrap align-middle">
                            <div className="inline-flex items-center justify-end gap-2">
                              {hasPhone ? (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => handleWaClick(item.id, idx, false)}
                                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 ${
                                    isSent
                                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  <MessageCircle size={14} />
                                  <span>{isSent ? 'Terkirim ✓' : 'Kirim WA'}</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                                >
                                  <Phone size={13} />
                                  <span>No. WA Kosong</span>
                                </button>
                              )}

                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all active:scale-95"
                                title="Buka pintasan input nilai untuk guru ini"
                              >
                                <Award size={14} />
                                <span>Input Nilai</span>
                                <ExternalLink size={12} className="opacity-75" />
                              </a>

                              <button
                                type="button"
                                onClick={() => handleCopyText(`msg_${item.id}`, msg)}
                                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 transition-all active:scale-95 cursor-pointer"
                                title="Salin isi pesan WhatsApp"
                              >
                                {copiedId === `msg_${item.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredGuruList.map((item, idx) => {
                  const { msg, previewUrl, phone, waUrl } = generateWaContent(item);
                  const isSent = !!sentWaIds[item.id];
                  const hasPhone = phone.length >= 10;

                  return (
                    <div
                      key={item.id}
                      id={`guru-input-card-${idx}`}
                      className={`p-4 rounded-2xl border transition-all space-y-3 scroll-mt-24 ${
                        isSent
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : 'bg-white dark:bg-gray-800/90 border-gray-200 dark:border-gray-700/80 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm shrink-0">
                          {(item.nama || 'G')[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                              {item.nama || item.guru_nama}
                            </h4>
                            {isSent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                ✓ Terkirim
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            NIP: {item.nip || '-'} • {hasPhone ? item.no_hp : 'Tanpa WA'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {item.mapel_list.map((m: any, mIdx: number) => (
                          <span
                            key={mIdx}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                          >
                            {m.nama_kelas} ({m.mata_pelajaran}) [{m.total_dinilai}/{m.total_santri}]
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                            style={{ width: `${item.persentase_selesai || 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                          {item.total_santri_dinilai}/{item.total_santri_target} ({item.persentase_selesai}%)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                        {hasPhone ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleWaClick(item.id, idx, true)}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold shadow-sm active:scale-95 ${
                              isSent
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <MessageCircle size={14} />
                            <span>{isSent ? 'Terkirim ✓' : 'Kirim WA'}</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                          >
                            <Phone size={13} />
                            <span>Tanpa WA</span>
                          </button>
                        )}

                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95"
                        >
                          <Award size={14} />
                          <span>Input Nilai</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleCopyText(`msg_${item.id}`, msg)}
                          className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 active:scale-95"
                          title="Salin Pesan"
                        >
                          {copiedId === `msg_${item.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
