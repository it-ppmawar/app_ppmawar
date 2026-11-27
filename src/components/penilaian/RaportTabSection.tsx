'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Search, X, ChevronDown, CheckCircle, FileText, Printer, Download,
  RefreshCw, AlertCircle, Sparkles, Save
} from 'lucide-react';
import RaportDocument from '@/components/penilaian/RaportDocument';
import { exportRaportToExcel } from '@/lib/penilaian/exportRaportExcel';
import { getTahunAjaranOptions } from '@/lib/penilaian/semesterPeriode';

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
];

function getInitials(nama: string): string {
  if (!nama) return '?';
  const parts = nama.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
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

export interface RaportCatatanForm {
  catatan_wali_kelas: string;
  akhlak: string;
  kerajinan: string;
  kebersihan: string;
  tahfidz_hafalan: string;
  status_kelulusan: string;
  batas_nilai_tuntas: string;
  keterangan_tuntas: string;
  keterangan_bimbingan: string;
}

export interface RaportTabSectionProps {
  kelasList: any[];
  selectedKelas: string;
  onChangeKelas: (val: string) => void;
  semester: string;
  onChangeSemester: (val: string) => void;
  tahunAjaran?: string;
  onChangeTahunAjaran?: (val: string) => void;
  muridList: any[];
  loadingMurid: boolean;
  selectedMuridId: string;
  onSelectMuridId: (id: string) => void;
  raportData: any;
  loadingRaport: boolean;
  raportError: string | null;
  onRefreshRaport: (muridId: string) => void;
  onPrint: () => void;
  getPreviewUrl: (muridId: string) => string;
  getFotoUrl: (fotoName: string | null, nis?: string) => string;
  onZoomPhoto?: (url: string) => void;
  canEditCatatan: boolean;
  isWaliOrSantri?: boolean;
  editCatatan: RaportCatatanForm;
  onChangeEditCatatan: (next: RaportCatatanForm) => void;
  onSaveCatatan: () => void;
  savingCatatan: boolean;
  variant?: 'dashboard' | 'shortcut';
}

/**
 * Konten tab Raport Santri lengkap: filter santri/kelas/semester, tombol ekspor & cetak,
 * pratinjau lembar raport A4 resmi, serta form Pengaturan Catatan & Kepribadian Raport.
 */
export default function RaportTabSection({
  kelasList,
  selectedKelas,
  onChangeKelas,
  semester,
  onChangeSemester,
  tahunAjaran,
  onChangeTahunAjaran,
  muridList,
  loadingMurid,
  selectedMuridId,
  onSelectMuridId,
  raportData,
  loadingRaport,
  raportError,
  onRefreshRaport,
  onPrint,
  getPreviewUrl,
  getFotoUrl,
  onZoomPhoto,
  canEditCatatan,
  isWaliOrSantri = false,
  editCatatan,
  onChangeEditCatatan,
  onSaveCatatan,
  savingCatatan,
  variant = 'dashboard',
}: RaportTabSectionProps) {
  const [muridSearch, setMuridSearch] = useState('');
  const [showMuridDropdown, setShowMuridDropdown] = useState(false);
  const muridComboRef = useRef<HTMLDivElement>(null);
  const muridInputRef = useRef<HTMLInputElement>(null);

  const filteredMuridOptions = useMemo(() => {
    if (!muridSearch.trim()) return muridList;
    const q = muridSearch.toLowerCase().trim();
    return muridList.filter(m =>
      (m.nama || '').toLowerCase().includes(q) ||
      (m.nis || '').toLowerCase().includes(q) ||
      (m.nama_kelas || '').toLowerCase().includes(q)
    );
  }, [muridList, muridSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (muridComboRef.current && !muridComboRef.current.contains(e.target as Node)) {
        setShowMuridDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isShortcut = variant === 'shortcut';
  const cardCls = isShortcut
    ? 'bg-white dark:bg-[#0b1429] rounded-3xl p-4 sm:p-5 shadow-xs dark:shadow-lg border border-slate-200/80 dark:border-gray-800 transition-colors'
    : 'bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700';
  const inputBgCls = isShortcut
    ? 'bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100'
    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100';

  const selectedMurid = muridList.find(m => String(m.murid_id) === selectedMuridId);

  return (
    <div className="space-y-6 print:space-y-0 animate-[fadeIn_0.2s_ease-out]">
      {/* Header Kontrol Raport */}
      <div className={`print:hidden ${cardCls} space-y-4`}>
        <div className="flex flex-col gap-3 w-full">
          {/* Baris 1: Filter Pilih Santri — Searchable Combobox */}
          <div className="w-full" ref={muridComboRef}>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Pilih Santri
            </label>
            <div className="relative">
              <div
                className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${
                  showMuridDropdown
                    ? 'border-amber-500 ring-2 ring-amber-500/30'
                    : isShortcut
                      ? 'border-slate-200 dark:border-gray-700'
                      : 'border-gray-200 dark:border-gray-600'
                } ${
                  isShortcut ? 'bg-slate-50 dark:bg-gray-900 text-slate-900 dark:text-gray-100' : 'bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                } text-xs sm:text-sm font-bold shadow-xs cursor-text transition-all`}
                onClick={() => {
                  setShowMuridDropdown(true);
                  setTimeout(() => muridInputRef.current?.focus(), 0);
                }}
              >
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  ref={muridInputRef}
                  type="text"
                  value={showMuridDropdown ? muridSearch : (selectedMurid?.nama || '')}
                  onChange={e => {
                    setMuridSearch(e.target.value);
                    setShowMuridDropdown(true);
                  }}
                  onFocus={() => {
                    setMuridSearch('');
                    setShowMuridDropdown(true);
                  }}
                  placeholder={
                    loadingMurid
                      ? 'Memuat daftar santri...'
                      : muridList.length === 0
                        ? '(Belum ada data santri)'
                        : 'Pilih atau ketik nama / NIS santri...'
                  }
                  className="flex-1 bg-transparent outline-none font-bold placeholder:font-normal placeholder:text-gray-400 min-w-0"
                />
                {selectedMuridId && !showMuridDropdown && (
                  <>
                    <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                      {selectedMurid?.nis || ''}
                    </span>
                    {!isWaliOrSantri && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onSelectMuridId('');
                          setMuridSearch('');
                        }}
                        title="Kosongkan pilihan santri"
                        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors shrink-0 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </>
                )}
                <ChevronDown
                  size={14}
                  className={`text-gray-400 shrink-0 transition-transform duration-200 ${showMuridDropdown ? 'rotate-180 text-amber-500' : ''}`}
                />
              </div>

              {showMuridDropdown && (
                <div
                  className={`absolute z-50 top-full left-0 right-0 mt-1.5 border rounded-2xl shadow-xl overflow-hidden max-h-64 flex flex-col ${
                    isShortcut
                      ? 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {filteredMuridOptions.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center">
                      {muridSearch ? `Tidak ditemukan: "${muridSearch}"` : 'Belum ada data santri'}
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-[10px] text-gray-400">
                        {filteredMuridOptions.length} santri {muridSearch ? `cocok dengan "${muridSearch}"` : 'tersedia'}
                      </div>
                      <ul className="overflow-y-auto flex-1">
                        {filteredMuridOptions.map(m => {
                          const isSelected = String(m.murid_id) === selectedMuridId;
                          const q = muridSearch.trim().toLowerCase();
                          const name = m.nama || '';
                          const nis = m.nis || '';
                          const fotoSrc = getFotoUrl(m.foto, m.nis);

                          const highlightText = (text: string) => {
                            if (!q) return <span>{text}</span>;
                            const idx = text.toLowerCase().indexOf(q);
                            if (idx === -1) return <span>{text}</span>;
                            return (
                              <span>
                                {text.slice(0, idx)}
                                <mark className="bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded px-0.5">
                                  {text.slice(idx, idx + q.length)}
                                </mark>
                                {text.slice(idx + q.length)}
                              </span>
                            );
                          };

                          return (
                            <li key={m.murid_id}>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextId = String(m.murid_id);
                                  setMuridSearch('');
                                  setShowMuridDropdown(false);
                                  onSelectMuridId(nextId);
                                  onRefreshRaport(nextId);
                                }}
                                className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-50 dark:bg-amber-900/30'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 relative border border-gray-200 dark:border-gray-700 shadow-2xs">
                                  <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{ backgroundColor: getAvatarColor(name) }}
                                  >
                                    <span className="text-white text-[10px] font-bold leading-none">
                                      {getInitials(name)}
                                    </span>
                                  </div>
                                  {fotoSrc && (
                                    <img
                                      src={fotoSrc}
                                      alt={name}
                                      className="absolute inset-0 w-full h-full object-cover"
                                      onError={e => {
                                        e.currentTarget.style.opacity = '0';
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div
                                    className={`text-xs font-bold truncate ${
                                      isSelected ? 'text-amber-700 dark:text-amber-300' : 'text-gray-800 dark:text-gray-100'
                                    }`}
                                  >
                                    {highlightText(name)}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {nis && <span className="text-[10px] text-gray-400 font-mono">{highlightText(nis)}</span>}
                                    {m.nama_kelas && (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                        {m.nama_kelas}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && <CheckCircle size={14} className="text-amber-500 shrink-0" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Baris 2: Filter Pilih Kelas, Pilih Semester, (dan Tahun Ajaran opsional) */}
          <div className={`grid grid-cols-2 ${onChangeTahunAjaran ? 'sm:grid-cols-3' : ''} gap-3 w-full`}>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Pilih Kelas
              </label>
              <select
                value={selectedKelas}
                onChange={e => onChangeKelas(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs ${inputBgCls}`}
              >
                {kelasList.map(k => (
                  <option key={k.kelas_id} value={String(k.kelas_id)}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Pilih Semester
              </label>
              <select
                value={semester}
                onChange={e => onChangeSemester(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs ${inputBgCls}`}
              >
                <option value="1">Semester 1 (Ganjil)</option>
                <option value="2">Semester 2 (Genap)</option>
              </select>
            </div>

            {onChangeTahunAjaran && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Tahun Ajaran
                </label>
                <select
                  value={tahunAjaran || '2025/2026'}
                  onChange={e => onChangeTahunAjaran(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs ${inputBgCls}`}
                >
                  {getTahunAjaranOptions(tahunAjaran).map(thn => (
                    <option key={thn} value={thn}>{thn}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tombol Aksi PDF + Excel */}
        <div className="grid grid-cols-3 sm:flex sm:justify-center gap-2 w-full pt-1">
          <button
            type="button"
            onClick={() => {
              if (!selectedMuridId) return;
              window.open(getPreviewUrl(selectedMuridId), '_blank', 'noopener');
            }}
            disabled={!raportData}
            className="px-2 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
            title="Preview Lembar Raport PDF"
          >
            <FileText size={15} />
            <span>
              Preview<span className="hidden sm:inline"> PDF</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onPrint}
            disabled={!raportData}
            className="px-2 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
            title="Cetak atau Download Raport PDF"
          >
            <Printer size={15} />
            <span className="sm:hidden">PDF</span>
            <span className="hidden sm:inline">Cetak / Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => exportRaportToExcel(raportData, editCatatan)}
            disabled={!raportData}
            className="px-2 sm:px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
            title="Unduh Raport Format Excel (.xlsx)"
          >
            <Download size={15} />
            <span className="sm:hidden">Excel</span>
            <span className="hidden sm:inline">Unduh Excel</span>
          </button>
        </div>
      </div>

      {/* Konten Raport */}
      {loadingRaport ? (
        <div className={`p-16 text-center text-gray-500 dark:text-gray-400 ${cardCls}`}>
          <RefreshCw size={32} className="animate-spin mx-auto text-amber-600 mb-3" />
          <p className="font-bold">Menyiapkan Lembar Raport Santri...</p>
          <p className="text-xs text-gray-400 mt-1">Menyinkronkan nilai, rekap absensi, dan poin kedisiplinan</p>
        </div>
      ) : raportError ? (
        <div className={`p-12 sm:p-16 text-center text-rose-600 dark:text-rose-400 ${cardCls} border-rose-200 dark:border-rose-800 space-y-3`}>
          <AlertCircle size={32} className="mx-auto" />
          <p className="font-bold text-sm sm:text-base">{raportError}</p>
          {selectedMuridId && (
            <button
              type="button"
              onClick={() => onRefreshRaport(selectedMuridId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Muat Ulang Raport</span>
            </button>
          )}
        </div>
      ) : !raportData ? (
        <div className={`p-16 text-center text-gray-500 dark:text-gray-400 ${cardCls} space-y-4`}>
          <AlertCircle size={32} className="mx-auto text-gray-400 mb-3" />
          {selectedMuridId ? (
            <>
              <p className="font-bold text-amber-700 dark:text-amber-400">Data raport belum dimuat.</p>
              <p className="text-xs text-gray-400 mt-1">Klik tombol di bawah untuk memuat raport santri ini.</p>
              <button
                type="button"
                onClick={() => onRefreshRaport(selectedMuridId)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Muat Raport Santri</span>
              </button>
            </>
          ) : (
            <p className="font-bold">Silakan pilih santri untuk melihat raport.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6 print:space-y-0 w-full">
          {/* LEMBAR RAPORT RESMI */}
          <RaportDocument
            raportData={raportData}
            editCatatan={editCatatan}
            getFotoUrl={getFotoUrl}
            onZoomPhoto={onZoomPhoto}
          />

          {/* FORM PENGISIAN CATATAN WALI KELAS & KEPRIBADIAN */}
          {canEditCatatan && (
            <div className={`print:hidden ${cardCls} space-y-4`}>
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                <h4 className="font-extrabold text-sm sm:text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" /> Pengaturan Catatan &amp; Kepribadian Raport
                </h4>
                <button
                  type="button"
                  onClick={onSaveCatatan}
                  disabled={savingCatatan}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingCatatan ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{savingCatatan ? 'Menyimpan...' : 'Simpan Catatan & Pengaturan'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Capaian Tahfidz / Hafalan
                  </label>
                  <input
                    type="text"
                    value={editCatatan.tahfidz_hafalan}
                    onChange={e => onChangeEditCatatan({ ...editCatatan, tahfidz_hafalan: e.target.value })}
                    placeholder="Contoh: Juz 30 (Al-A'la - An-Nas)"
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${inputBgCls}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Keputusan Kenaikan / Kelulusan
                  </label>
                  <select
                    value={editCatatan.status_kelulusan}
                    onChange={e => onChangeEditCatatan({ ...editCatatan, status_kelulusan: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${inputBgCls}`}
                  >
                    <option value="Naik Kelas">Naik Kelas</option>
                    <option value="Tinggal di Kelas">Tinggal di Kelas</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Lanjut ke Semester Berikutnya">Lanjut ke Semester Berikutnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Predikat Akhlak Santri
                  </label>
                  <select
                    value={editCatatan.akhlak}
                    onChange={e => onChangeEditCatatan({ ...editCatatan, akhlak: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${inputBgCls}`}
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Baik">Baik</option>
                    <option value="Cukup">Cukup</option>
                    <option value="Perlu Pembinaan">Perlu Pembinaan</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h5 className="text-xs font-extrabold text-gray-800 dark:text-gray-100 mb-1">Pengaturan Keterangan Nilai</h5>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">
                  Berlaku untuk seluruh raport kelas {raportData?.santri?.nama_kelas_madin || selectedKelas || '-'} pada semester {semester}, tahun ajaran {tahunAjaran || '-'}.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Batas nilai tuntas (KKM)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={editCatatan.batas_nilai_tuntas}
                      onChange={e => onChangeEditCatatan({ ...editCatatan, batas_nilai_tuntas: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${inputBgCls}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Keterangan jika tuntas
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={editCatatan.keterangan_tuntas}
                      onChange={e => onChangeEditCatatan({ ...editCatatan, keterangan_tuntas: e.target.value })}
                      placeholder="Tuntas"
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${inputBgCls}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Keterangan jika belum tuntas
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={editCatatan.keterangan_bimbingan}
                      onChange={e => onChangeEditCatatan({ ...editCatatan, keterangan_bimbingan: e.target.value })}
                      placeholder="Perlu Bimbingan"
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${inputBgCls}`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Catatan Wali Kelas untuk Santri &amp; Orang Tua
                </label>
                <textarea
                  rows={2}
                  value={editCatatan.catatan_wali_kelas}
                  onChange={e => onChangeEditCatatan({ ...editCatatan, catatan_wali_kelas: e.target.value })}
                  placeholder="Tuliskan motivasi, saran, dan evaluasi untuk santri..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputBgCls}`}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
