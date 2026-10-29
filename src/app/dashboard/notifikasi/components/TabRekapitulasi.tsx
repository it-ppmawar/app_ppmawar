'use client';

import React from 'react';
import {
  FileText, Search, X, ToggleRight, ToggleLeft, RefreshCw,
  Clock, CheckCircle2, AlertCircle, Phone, MessageCircle,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

type RekapSortField = 'nama' | 'persentase' | 'hadir' | 'nama_wali';
type SortDir = 'asc' | 'desc';

function RekapSortButton({
  field, label, current, dir, onSort, color = 'purple',
}: {
  field: RekapSortField; label: string; current: RekapSortField; dir: SortDir;
  onSort: (f: RekapSortField) => void; color?: string;
}) {
  const active = current === field;
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-600 text-white border-purple-600 shadow-sm',
  };
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
        active
          ? colorMap[color] || colorMap.purple
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600'
      }`}
    >
      {active ? (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} />}
      {label}
    </button>
  );
}

export interface RekapFilterState {
  tipe: string;
  target_id: string;
  bulan: string;
  tahun: string;
  tanggal_dari: string;
  tanggal_sampai: string;
}

export interface TabRekapitulasiProps {
  availableRekapTipes?: string[];
  rekapSearchNama: string;
  setRekapSearchNama: React.Dispatch<React.SetStateAction<string>>;
  rekapFilter: RekapFilterState;
  setRekapFilter: React.Dispatch<React.SetStateAction<RekapFilterState>>;
  loadRekapOptions: (tipe: string) => Promise<void>;
  loadRekapSubFilter: (tipe: string, targetId: string) => Promise<void>;
  rekapOptions: any[];
  loadingRekapOptions: boolean;
  rekapSubFilter: string;
  setRekapSubFilter: React.Dispatch<React.SetStateAction<string>>;
  rekapSubFilterOptions: string[];
  loadingRekapSubFilter: boolean;
  rekapModeRentang: boolean;
  setRekapModeRentang: React.Dispatch<React.SetStateAction<boolean>>;
  currentRekapYear: number;
  fetchRekapData: () => Promise<void>;
  loadingRekapData: boolean;
  rekapExpiryDays: number;
  setRekapExpiryDays: React.Dispatch<React.SetStateAction<number>>;
  pesanRekapWaliTemplate: string;
  setPesanRekapWaliTemplate: React.Dispatch<React.SetStateAction<string>>;
  saveTemplate: (key: string, value: string) => Promise<void>;
  resetTemplate: (key: string, defaultValue: string, setter: (val: string) => void) => Promise<void>;
  defaultRekapWaliTemplate: string;
  saveStatus: Record<string, string>;
  rekapErrorMsg: string;
  hasFetchedRekap: boolean;
  rekapData: any[];
  sentRekapWaIds: Record<string, boolean>;
  setSentRekapWaIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  getWaWaliRekapLink: (item: any) => string;
}

export default function TabRekapitulasi({
  availableRekapTipes = ['madin', 'quran', 'kegiatan'],
  rekapSearchNama,
  setRekapSearchNama,
  rekapFilter,
  setRekapFilter,
  loadRekapOptions,
  loadRekapSubFilter,
  rekapOptions,
  loadingRekapOptions,
  rekapSubFilter,
  setRekapSubFilter,
  rekapSubFilterOptions,
  loadingRekapSubFilter,
  rekapModeRentang,
  setRekapModeRentang,
  currentRekapYear,
  fetchRekapData,
  loadingRekapData,
  rekapExpiryDays,
  setRekapExpiryDays,
  pesanRekapWaliTemplate,
  setPesanRekapWaliTemplate,
  saveTemplate,
  resetTemplate,
  defaultRekapWaliTemplate,
  saveStatus,
  rekapErrorMsg,
  hasFetchedRekap,
  rekapData,
  sentRekapWaIds,
  setSentRekapWaIds,
  getWaWaliRekapLink,
}: TabRekapitulasiProps) {
  const [waFilter, setWaFilter] = React.useState<'semua' | 'ada' | 'tidak_ada'>('semua');
  const [autoScrollRekap, setAutoScrollRekap] = React.useState<boolean>(true);
  const [rekapSortField, setRekapSortField] = React.useState<RekapSortField>('nama');
  const [rekapSortDir, setRekapSortDir] = React.useState<SortDir>('asc');

  const handleRekapSort = (field: RekapSortField) => {
    if (rekapSortField === field) setRekapSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setRekapSortField(field); setRekapSortDir('asc'); }
  };

  // Auto-scroll ke hasil setelah tombol "Tampilkan Data Rekap" diklik dan data berhasil dimuat
  React.useEffect(() => {
    if (hasFetchedRekap && !loadingRekapData) {
      setTimeout(() => {
        const el = document.getElementById('rekap-hasil-anchor');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [hasFetchedRekap, loadingRekapData]);

  const handleScrollToNextRekap = (nextIdx: number) => {
    if (!autoScrollRekap) return;
    setTimeout(() => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const targetId = isMobile ? `rekap-card-${nextIdx}` : `rekap-row-${nextIdx}`;
      let el = document.getElementById(targetId);
      if (!el || el.offsetParent === null) {
        el = document.getElementById(isMobile ? `rekap-row-${nextIdx}` : `rekap-card-${nextIdx}`);
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Kartu 6 Filter Persis Halaman Rekapitulasi */}
      <div className="bg-purple-50/40 dark:bg-purple-950/20 border border-purple-150/60 dark:border-purple-900/30 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-purple-100/70 dark:border-purple-900/40 pb-3">
          <div>
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 leading-tight">Filter Rekapitulasi Presensi</h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Pilih kriteria kelas, mapel/kegiatan, dan periode waktu yang ingin disiarkan ke wali murid</p>
          </div>
        </div>

        {/* Baris 1: Cari Nama, Pilih Tipe, Pilih Kelas/Kamar, Pilih Sub-filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* 1. Cari Nama / NIS / Alamat */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Cari Nama / NIS</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Cari santri..."
                value={rekapSearchNama}
                onChange={(e) => setRekapSearchNama(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              />
              {rekapSearchNama && (
                <button
                  onClick={() => setRekapSearchNama('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 2. Pilih Tipe */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Pilih Kategori</label>
            <select
              value={rekapFilter.tipe}
              onChange={(e) => {
                const newTipe = e.target.value;
                setRekapFilter(prev => ({ ...prev, tipe: newTipe }));
                loadRekapOptions(newTipe);
              }}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
            >
              {availableRekapTipes.includes('madin') && (
                <option value="madin">Absensi Madin</option>
              )}
              {availableRekapTipes.includes('quran') && (
                <option value="quran">Absensi Al-Qur&apos;an</option>
              )}
              {availableRekapTipes.includes('kegiatan') && (
                <option value="kegiatan">Absensi Kegiatan Asrama</option>
              )}
            </select>
          </div>

          {/* 3. Pilih Kelas / Kamar */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Pilih Kelas / Kamar</label>
            <select
              value={rekapFilter.target_id}
              onChange={(e) => {
                const newTarget = e.target.value;
                setRekapFilter(prev => ({ ...prev, target_id: newTarget }));
                loadRekapSubFilter(rekapFilter.tipe, newTarget);
              }}
              disabled={loadingRekapOptions || rekapOptions.length === 0}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer disabled:opacity-50"
            >
              {loadingRekapOptions ? (
                <option>Memuat kelas...</option>
              ) : rekapOptions.length === 0 ? (
                <option>Tidak ada data kelas</option>
              ) : (
                rekapOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.nama}</option>
                ))
              )}
            </select>
          </div>

          {/* 4. Sub-filter: Mapel / Majlis / Kegiatan */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              {rekapFilter.tipe === 'quran' ? 'Pilih Majlis' : rekapFilter.tipe === 'madin' ? 'Pilih Mapel' : 'Pilih Kegiatan'}
            </label>
            <select
              value={rekapSubFilter}
              onChange={(e) => setRekapSubFilter(e.target.value)}
              disabled={loadingRekapSubFilter}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="">
                {loadingRekapSubFilter ? 'Memuat...' : rekapFilter.tipe === 'quran' ? 'Semua Majlis' : rekapFilter.tipe === 'madin' ? 'Semua Mapel' : 'Semua Kegiatan'}
              </option>
              {rekapSubFilterOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Baris 2: Waktu & Tombol Tampilkan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-1">
          {/* 5. Toggle Mode Waktu */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Mode Waktu</label>
            <button
              type="button"
              onClick={() => setRekapModeRentang(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-purple-400 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all cursor-pointer select-none"
            >
              <span className="text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                {rekapModeRentang ? 'Mode Rentang' : 'Mode Bulanan'}
              </span>
              <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                rekapModeRentang
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {rekapModeRentang ? <ToggleRight size={14} className="text-purple-600" /> : <ToggleLeft size={14} />}
                {rekapModeRentang ? 'Rentang' : 'Bulan'}
              </span>
            </button>
          </div>

          {/* 6. Input Waktu (Bulan & Tahun ATAU Dari & Sampai) */}
          {rekapModeRentang ? (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={rekapFilter.tanggal_dari}
                  max={rekapFilter.tanggal_sampai}
                  onChange={(e) => setRekapFilter({ ...rekapFilter, tanggal_dari: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={rekapFilter.tanggal_sampai}
                  min={rekapFilter.tanggal_dari}
                  onChange={(e) => setRekapFilter({ ...rekapFilter, tanggal_sampai: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Bulan</label>
                <select
                  value={rekapFilter.bulan}
                  onChange={(e) => setRekapFilter({ ...rekapFilter, bulan: e.target.value })}
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
                  value={rekapFilter.tahun}
                  onChange={(e) => setRekapFilter({ ...rekapFilter, tahun: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                >
                  {[currentRekapYear, currentRekapYear - 1, currentRekapYear - 2].map(y => (
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
              disabled={loadingRekapData}
              className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 h-[38px]"
            >
              {loadingRekapData ? (
                <><RefreshCw size={14} className="animate-spin" /> Memuat Data...</>
              ) : (
                <><Search size={14} /> Tampilkan Data Rekap</>
              )}
            </button>
          </div>
        </div>

        {/* Baris 3: Masa Berlaku Tautan (Signed URL) & Preset Cepat */}
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
                value={rekapExpiryDays}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setRekapExpiryDays(isNaN(val) ? ('' as any) : val);
                }}
                onBlur={() => {
                  if (!rekapExpiryDays || rekapExpiryDays < 1) {
                    setRekapExpiryDays(1);
                  }
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
                onClick={() => setRekapExpiryDays(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  rekapExpiryDays === d
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

      {/* Templat Pesan WA Rekapitulasi */}
      <div className="bg-purple-50/20 dark:bg-purple-950/10 border border-purple-200/40 dark:border-purple-900/20 rounded-2xl p-4">
        <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 mb-1.5 flex flex-col gap-1">
          <span>✏️ Edit Templat Pesan Rekapitulasi untuk Wali Murid</span>
          <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 leading-relaxed">Placeholder: &#123;nama_santri&#125;, &#123;nis&#125;, &#123;tipe&#125;, &#123;kelas&#125;, &#123;sub_filter&#125;, &#123;periode&#125;, &#123;hadir&#125;, &#123;izin&#125;, &#123;sakit&#125;, &#123;alpha&#125;, &#123;persentase&#125;, &#123;link_rekap&#125;, &#123;masa_berlaku&#125;, &#123;batas_waktu&#125;</span>
        </label>
        <textarea
          value={pesanRekapWaliTemplate}
          onChange={(e) => {
            setPesanRekapWaliTemplate(e.target.value);
            localStorage.setItem('wa_template_wali_rekap', e.target.value);
          }}
          onBlur={() => saveTemplate('wa_template_wali_rekap', pesanRekapWaliTemplate)}
          rows={6}
          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
          placeholder="Tulis templat pesan rekapitulasi..."
        />
        <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
          <button
            type="button"
            onClick={() => resetTemplate('wa_template_wali_rekap', defaultRekapWaliTemplate, setPesanRekapWaliTemplate)}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            ⟳ Reset ke Templat Default
          </button>
          {saveStatus['wa_template_wali_rekap'] === 'saved' && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 size={13} /> Tersimpan di Database ✓
            </span>
          )}
          <button
            type="button"
            onClick={() => saveTemplate('wa_template_wali_rekap', pesanRekapWaliTemplate)}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px] cursor-pointer"
          >
            Simpan Templat
          </button>
        </div>
      </div>

      {/* Pesan Kesalahan jika ada */}
      {rekapErrorMsg && (
        <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold text-center">
          <AlertCircle size={15} className="inline mr-1" /> {rekapErrorMsg}
        </div>
      )}

      {/* Anchor auto-scroll ke hasil rekapitulasi */}
      <div id="rekap-hasil-anchor" className="scroll-mt-20" />

      {/* Hasil / List Santri Rekapitulasi */}
      {loadingRekapData ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-150">
          <RefreshCw className="animate-spin text-purple-600 mb-2" size={24} />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Menghitung dan memuat data rekapitulasi santri...</span>
        </div>
      ) : !hasFetchedRekap ? (
        <div className="p-10 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-500">
          <FileText size={28} className="mx-auto mb-2 text-purple-400 opacity-60" />
          <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">Data Belum Ditampilkan</p>
          <p>Pilih kelas/kamar dan periode di atas, lalu klik tombol <strong>&quot;Tampilkan Data Rekap&quot;</strong>.</p>
        </div>
      ) : (() => {
        const searchFiltered = rekapData.filter(item => {
          if (!rekapSearchNama.trim()) return true;
          const q = rekapSearchNama.toLowerCase();
          return (item.nama && item.nama.toLowerCase().includes(q)) ||
                 (item.identifier && item.identifier.toLowerCase().includes(q)) ||
                 (item.nis && item.nis.toLowerCase().includes(q)) ||
                 (item.nama_wali && item.nama_wali.toLowerCase().includes(q));
        });

        const totalCount = searchFiltered.length;
        const adaWaCount = searchFiltered.filter(item => {
          const waLink = getWaWaliRekapLink(item);
          return waLink !== '#';
        }).length;
        const tidakAdaWaCount = totalCount - adaWaCount;

        const filteredList = searchFiltered
          .filter(item => {
            if (waFilter === 'semua') return true;
            const waLink = getWaWaliRekapLink(item);
            const hasWa = waLink !== '#';
            if (waFilter === 'ada') return hasWa;
            if (waFilter === 'tidak_ada') return !hasWa;
            return true;
          })
          .sort((a, b) => {
            let cmp = 0;
            if (rekapSortField === 'nama') {
              cmp = (a.nama || '').localeCompare(b.nama || '', 'id');
            } else if (rekapSortField === 'nama_wali') {
              cmp = (a.nama_wali || '').localeCompare(b.nama_wali || '', 'id');
            } else if (rekapSortField === 'persentase') {
              const totalA = Number(a.total || ((+a.hadir||0)+(+a.izin||0)+(+a.sakit||0)+(+a.alpha||0)));
              const totalB = Number(b.total || ((+b.hadir||0)+(+b.izin||0)+(+b.sakit||0)+(+b.alpha||0)));
              const pA = totalA > 0 ? (+a.hadir || 0) / totalA : 0;
              const pB = totalB > 0 ? (+b.hadir || 0) / totalB : 0;
              cmp = pA - pB;
            } else if (rekapSortField === 'hadir') {
              cmp = (+a.hadir || 0) - (+b.hadir || 0);
            }
            return rekapSortDir === 'asc' ? cmp : -cmp;
          });

        const renderControls = () => (
          <div className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
            {/* Baris 1: Semua — melebar penuh */}
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

            {/* Baris 2: Ada No. WA & Tanpa No. WA — sama rata 50/50 */}
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

            {/* Baris 3: Auto-scroll — rata tengah */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setAutoScrollRekap(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  autoScrollRekap
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-2xs'
                    : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-400'
                }`}
                title="Otomatis bergeser ke bawah pada data berikutnya saat tombol WA Wali diklik untuk memudahkan autoklik"
              >
                <span className={`w-2 h-2 rounded-full ${autoScrollRekap ? 'bg-purple-600 animate-pulse' : 'bg-gray-400'}`} />
                <span>Auto-scroll {autoScrollRekap ? 'Aktif' : 'Mati'}</span>
              </button>
            </div>

            {/* Baris 4: Sort / Urutkan */}
            <div className="pt-1 border-t border-gray-100 dark:border-gray-700/60">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mr-0.5">Urutkan:</span>
                <RekapSortButton field="nama"       label="Nama Santri"  current={rekapSortField} dir={rekapSortDir} onSort={handleRekapSort} />
                <RekapSortButton field="nama_wali"  label="Nama Wali"    current={rekapSortField} dir={rekapSortDir} onSort={handleRekapSort} />
                <RekapSortButton field="persentase" label="% Kehadiran"  current={rekapSortField} dir={rekapSortDir} onSort={handleRekapSort} />
                <RekapSortButton field="hadir"      label="Jml Hadir"    current={rekapSortField} dir={rekapSortDir} onSort={handleRekapSort} />
              </div>
            </div>
          </div>
        );

        if (totalCount === 0) {
          return (
            <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-2xl">
              Tidak ada santri yang cocok dengan filter pencarian &quot;{rekapSearchNama}&quot;.
            </div>
          );
        }

        if (filteredList.length === 0) {
          return (
            <div className="space-y-3">
              {renderControls()}
              <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-2xl">
                Tidak ada data santri pada kategori filter {waFilter === 'ada' ? '"Ada No. WA"' : '"Tanpa No. WA"'}.
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-3">
            {renderControls()}
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>
                Menampilkan <strong className="text-gray-800 dark:text-gray-200">{filteredList.length}</strong> santri untuk disiarkan
              </span>
              <span className="text-[11px] text-purple-600 font-semibold hidden sm:inline">
                💡 Tautan WA otomatis melampirkan preview PDF resmi siap unduh
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-4 rounded-l-xl">Nama Santri</th>
                    <th className="px-5 py-4">Wali Murid</th>
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
                    const waLink = getWaWaliRekapLink(item);
                    const rawPhone = item.no_wali || item.no_hp_wali || item.no_hp || '';
                    const hasWa = waLink !== '#';
                    const isSent = !!sentRekapWaIds[item.id];
                    const previewUrl = item.preview_token
                      ? `/rekapitulasi/preview?t=${item.preview_token}`
                      : `/rekapitulasi/preview?murid_id=${item.id}&tipe=${rekapFilter.tipe}&target_id=${rekapFilter.target_id}`;

                    return (
                      <tr
                        key={item.id || idx}
                        id={`rekap-row-${idx}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors scroll-mt-24"
                      >
                        <td className="px-5 py-4 font-semibold text-gray-800 dark:text-gray-200">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{item.nama}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                            <span className="font-mono text-gray-400 text-[11px]">NIS: {item.identifier || item.nis || '-'}</span>
                            <span className="text-gray-300 dark:text-gray-700">•</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                              {persentase}% Hadir
                            </span>
                            <span className="text-[11px] text-gray-500 font-medium">
                              ({hadir}H · {izin}I · {sakit}S · {alpha}A)
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{item.nama_wali || '-'}</div>
                          <div className="text-xs font-mono mt-0.5 text-gray-500 flex items-center gap-1">
                            <Phone size={12} className="text-gray-400 shrink-0" />
                            <span>{rawPhone || '-'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                            title="Lihat Pratinjau Dokumen PDF"
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
                                setSentRekapWaIds(prev => ({ ...prev, [item.id]: true }));
                                handleScrollToNextRekap(idx + 1);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                isSent
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'
                                  : 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                              }`}
                            >
                              <MessageCircle size={14} />
                              <span>{isSent ? 'Terkirim ✓' : 'WA Wali'}</span>
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

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {filteredList.map((item, idx) => {
                const hadir = Number(item.hadir || 0);
                const izin = Number(item.izin || 0);
                const sakit = Number(item.sakit || 0);
                const alpha = Number(item.alpha || 0);
                const total = Number(item.total || (hadir + izin + sakit + alpha));
                const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
                const waLink = getWaWaliRekapLink(item);
                const rawPhone = item.no_wali || item.no_hp_wali || item.no_hp || '';
                const hasWa = waLink !== '#';
                const isSent = !!sentRekapWaIds[item.id];
                const previewUrl = item.preview_token
                  ? `/rekapitulasi/preview?t=${item.preview_token}`
                  : `/rekapitulasi/preview?murid_id=${item.id}&tipe=${rekapFilter.tipe}&target_id=${rekapFilter.target_id}`;

                return (
                  <div
                    key={item.id || idx}
                    id={`rekap-card-${idx}`}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-xs space-y-3 scroll-mt-24"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="font-bold text-sm text-gray-900 dark:text-gray-100">{item.nama}</h5>
                        <p className="text-[11px] text-gray-400 font-mono">NIS: {item.identifier || item.nis || '-'}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-purple-600">{persentase}%</span>
                        <span className="block text-[10px] text-gray-400">Kehadiran</span>
                      </div>
                    </div>

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
                      <div className="bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-100 dark:border-rose-900/30">
                        <span className="block text-[10px] text-rose-600 font-bold">Alpha</span>
                        <span className="font-bold text-rose-800 dark:text-rose-300">{alpha}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700/60 space-y-2.5">
                      {/* Baris Nama Wali Murid (Rata Kiri Utuh) dan No. HP (Sebelah Kanan) */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        {/* Nama Wali Murid Rata Kiri */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left text-xs">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium shrink-0">Wali:</span>
                          <strong className="font-bold text-gray-800 dark:text-gray-200 truncate">{item.nama_wali || '-'}</strong>
                        </div>

                        {/* No. HP Sebelah Kanan */}
                        <div className="flex items-center justify-end gap-1 font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0 text-right">
                          <Phone size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate max-w-[125px]">{rawPhone || '-'}</span>
                        </div>
                      </div>

                      {/* Baris Tombol PDF dan WA Wali - Dibawah Baris No. HP Sama Rata Secara Presisi (50% - 50%) */}
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
                              setSentRekapWaIds(prev => ({ ...prev, [item.id]: true }));
                              handleScrollToNextRekap(idx + 1);
                            }}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                              isSent
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            <MessageCircle size={14} />
                            <span>{isSent ? 'Terkirim ✓' : 'WA Wali'}</span>
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
    </div>
  );
}
