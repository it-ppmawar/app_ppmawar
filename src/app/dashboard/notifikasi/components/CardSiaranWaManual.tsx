'use client';

import React, { useState } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import TabRekapitulasi, { RekapFilterState } from './TabRekapitulasi';
import TabHarian from './TabHarian';

export interface CardSiaranWaManualProps {
  role: string;
  manualMode: 'absensi' | 'rekapitulasi' | 'info_akun' | 'pembayaran';
  setManualMode: React.Dispatch<React.SetStateAction<'absensi' | 'rekapitulasi' | 'info_akun' | 'pembayaran'>>;
  userScheduleTypes: Set<string>;
  availableRekapTipes?: string[];

  // Tab Rekapitulasi props
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
  defaultRekapWaliTemplate: string;
  rekapErrorMsg: string;
  hasFetchedRekap: boolean;
  rekapData: any[];
  sentRekapWaIds: Record<string, boolean>;
  setSentRekapWaIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  getWaWaliRekapLink: (item: any) => string;

  // Tab Harian (Pembayaran) props
  pesanBillingTemplate: string;
  setPesanBillingTemplate: React.Dispatch<React.SetStateAction<string>>;
  defaultBillingTemplate: string;
  billingSearch: string;
  setBillingSearch: React.Dispatch<React.SetStateAction<string>>;
  loadingBilling: boolean;
  setLoadingBilling: React.Dispatch<React.SetStateAction<boolean>>;
  billingList: any[];
  setBillingList: React.Dispatch<React.SetStateAction<any[]>>;
  sentBillingIds: Record<string, boolean>;
  setSentBillingIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Tab Harian (Absensi & Info Akun) props
  tipePesan: 'madin' | 'quran' | 'kamar' | 'semua';
  setTipePesan: React.Dispatch<React.SetStateAction<'madin' | 'quran' | 'kamar' | 'semua'>>;
  selectedKategoriId: string;
  handleKategoriChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  loadingKategori: boolean;
  listKategori: any[];
  statusAbsen: string;
  setStatusAbsen: React.Dispatch<React.SetStateAction<string>>;

  pesanWaliInfoTemplate: string;
  setPesanWaliInfoTemplate: React.Dispatch<React.SetStateAction<string>>;
  defaultWaliInfoTemplate: string;

  pesanWaliTemplate: string;
  setPesanWaliTemplate: React.Dispatch<React.SetStateAction<string>>;
  defaultWaliTemplate: string;

  simpanTemplatRef: React.RefObject<any>;
  saveTemplate: (key: string, value: string) => Promise<void>;
  resetTemplate: (key: string, defaultValue: string, setter: (val: string) => void) => Promise<void>;
  saveStatus: Record<string, string>;

  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  hasSearch: boolean | string;
  setShowAllWaliData: React.Dispatch<React.SetStateAction<boolean>>;
  filteredMurid: any[];
  sentWaIds: Record<number, boolean>;
  getWaLink: (murid: any) => string;
  markAsSent: (muridId: number) => void;
}

export default function CardSiaranWaManual({
  role,
  manualMode,
  setManualMode,
  userScheduleTypes,
  availableRekapTipes = ['madin', 'quran', 'kegiatan'],

  // Rekapitulasi
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
  defaultRekapWaliTemplate,
  rekapErrorMsg,
  hasFetchedRekap,
  rekapData,
  sentRekapWaIds,
  setSentRekapWaIds,
  getWaWaliRekapLink,

  // Pembayaran
  pesanBillingTemplate,
  setPesanBillingTemplate,
  defaultBillingTemplate,
  billingSearch,
  setBillingSearch,
  loadingBilling,
  setLoadingBilling,
  billingList,
  setBillingList,
  sentBillingIds,
  setSentBillingIds,

  // Absensi & Info Akun
  tipePesan,
  setTipePesan,
  selectedKategoriId,
  handleKategoriChange,
  loadingKategori,
  listKategori,
  statusAbsen,
  setStatusAbsen,

  pesanWaliInfoTemplate,
  setPesanWaliInfoTemplate,
  defaultWaliInfoTemplate,

  pesanWaliTemplate,
  setPesanWaliTemplate,
  defaultWaliTemplate,

  simpanTemplatRef,
  saveTemplate,
  resetTemplate,
  saveStatus,

  search,
  setSearch,
  loading,
  hasSearch,
  setShowAllWaliData,
  filteredMurid,
  sentWaIds,
  getWaLink,
  markAsSent,
}: CardSiaranWaManualProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div id="siaran-wa-manual" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300">
      {/* Header Kartu — Dapat dibuka dan ditutup (default ditutup) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-4 sm:p-6 flex items-center justify-between gap-4 hover:bg-green-50/30 dark:hover:bg-gray-700/40 transition-colors cursor-pointer group"
        aria-label="Buka / Tutup Siaran WhatsApp (Manual)"
      >
        <div className="flex-1 min-w-0">
          <div className="sm:flex sm:items-center sm:gap-2.5 mb-1">
            <h3 className="font-bold text-base sm:text-xl text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <MessageCircle className="text-green-500 shrink-0" size={20} /> Siaran WhatsApp (Manual)
            </h3>
            {/* Baris Badge & Ikon Mobile: sebaris dan ringkas */}
            <div className="flex items-center justify-between sm:justify-start gap-2 mt-1 sm:mt-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider transition-colors ${
                isOpen 
                  ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
              }`}>
                {isOpen ? 'Terbuka' : 'Tertutup'}
              </span>
              {/* Ikon Buka Kartu Mobile: Lebih kecil & sebaris dengan badge Tertutup */}
              <div className={`sm:hidden p-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 group-hover:bg-green-100 dark:group-hover:bg-green-900/40 group-hover:text-green-600 dark:group-hover:text-green-400 transition-all duration-200 ${isOpen ? 'rotate-180 bg-green-50 dark:bg-green-900/30 text-green-600' : ''}`}>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
          <p className={`text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1 sm:mt-0 ${isOpen ? '' : 'line-clamp-1 sm:line-clamp-none'}`}>
            Kirim pesan siaran langsung ke aplikasi WhatsApp asli Anda (anti-blokir). Pesan otomatis diisi, Anda hanya perlu klik tombol kirim di aplikasi WA.
          </p>
        </div>
        {/* Ikon Buka Kartu Desktop */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className={`p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 group-hover:bg-green-100 dark:group-hover:bg-green-900/40 group-hover:text-green-600 dark:group-hover:text-green-400 transition-all duration-200 ${isOpen ? 'rotate-180 bg-green-50 dark:bg-green-900/30 text-green-600' : ''}`}>
            <ChevronDown size={18} />
          </div>
        </div>
      </button>

      {/* Konten Kartu — Muncul jika dibuka */}
      {isOpen && (
        <div className="p-5 sm:p-6 pt-0 border-t border-gray-100 dark:border-gray-700/60 animate-[fadeIn_0.2s_ease-out]">
          <div className="pt-5">
            {/* Mode Selector for Siaran WA Manual */}
      {(role === 'admin' || role === 'staff' || role === 'guru') && (
        <div className="flex flex-wrap bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-150/50 dark:border-gray-700/50 mb-6 gap-1">
          <button
            onClick={() => setManualMode('absensi')}
            className={`flex-1 basis-[calc(50%-2px)] sm:basis-0 py-2.5 text-xs font-bold rounded-lg transition-all ${
              manualMode === 'absensi'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/30'
            }`}
          >
            Laporan Absensi (Harian)
          </button>
          <button
            onClick={() => {
              setManualMode('rekapitulasi');
              if (rekapOptions.length === 0) {
                loadRekapOptions(rekapFilter.tipe);
              }
            }}
            className={`flex-1 basis-[calc(50%-2px)] sm:basis-0 py-2.5 text-xs font-bold rounded-lg transition-all ${
              manualMode === 'rekapitulasi'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/30'
            }`}
          >
            📊 Rekap Absensi
          </button>
          {(role === 'admin' || role === 'staff') && (
            <button
              onClick={() => setManualMode('info_akun')}
              className={`flex-1 basis-[calc(50%-2px)] sm:basis-0 py-2.5 text-xs font-bold rounded-lg transition-all ${
                manualMode === 'info_akun'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/30'
              }`}
            >
              Info Akun Wali Murid
            </button>
          )}
          {role === 'admin' && (
            <button
              onClick={() => {
                setManualMode('pembayaran');
                if (billingList.length === 0) {
                  setLoadingBilling(true);
                  fetch('/api/billing')
                    .then(r => r.json())
                    .then(d => {
                      if (d.success) setBillingList(d.data.filter((b: any) => b.status === 'Belum'));
                    })
                    .catch(console.error)
                    .finally(() => setLoadingBilling(false));
                }
              }}
              className={`flex-1 basis-[calc(50%-2px)] sm:basis-0 py-2.5 text-xs font-bold rounded-lg transition-all ${
                manualMode === 'pembayaran'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/30'
              }`}
            >
              💳 Tagihan
            </button>
          )}
        </div>
      )}

      {manualMode === 'rekapitulasi' ? (
        <TabRekapitulasi
          availableRekapTipes={availableRekapTipes}
          rekapSearchNama={rekapSearchNama}
          setRekapSearchNama={setRekapSearchNama}
          rekapFilter={rekapFilter}
          setRekapFilter={setRekapFilter}
          loadRekapOptions={loadRekapOptions}
          loadRekapSubFilter={loadRekapSubFilter}
          rekapOptions={rekapOptions}
          loadingRekapOptions={loadingRekapOptions}
          rekapSubFilter={rekapSubFilter}
          setRekapSubFilter={setRekapSubFilter}
          rekapSubFilterOptions={rekapSubFilterOptions}
          loadingRekapSubFilter={loadingRekapSubFilter}
          rekapModeRentang={rekapModeRentang}
          setRekapModeRentang={setRekapModeRentang}
          currentRekapYear={currentRekapYear}
          fetchRekapData={fetchRekapData}
          loadingRekapData={loadingRekapData}
          rekapExpiryDays={rekapExpiryDays}
          setRekapExpiryDays={setRekapExpiryDays}
          pesanRekapWaliTemplate={pesanRekapWaliTemplate}
          setPesanRekapWaliTemplate={setPesanRekapWaliTemplate}
          saveTemplate={saveTemplate}
          resetTemplate={resetTemplate}
          defaultRekapWaliTemplate={defaultRekapWaliTemplate}
          saveStatus={saveStatus}
          rekapErrorMsg={rekapErrorMsg}
          hasFetchedRekap={hasFetchedRekap}
          rekapData={rekapData}
          sentRekapWaIds={sentRekapWaIds}
          setSentRekapWaIds={setSentRekapWaIds}
          getWaWaliRekapLink={getWaWaliRekapLink}
        />
      ) : (
        <TabHarian
          manualMode={manualMode}
          role={role}
          userScheduleTypes={userScheduleTypes}
          pesanBillingTemplate={pesanBillingTemplate}
          setPesanBillingTemplate={setPesanBillingTemplate}
          defaultBillingTemplate={defaultBillingTemplate}
          billingSearch={billingSearch}
          setBillingSearch={setBillingSearch}
          loadingBilling={loadingBilling}
          setLoadingBilling={setLoadingBilling}
          billingList={billingList}
          setBillingList={setBillingList}
          sentBillingIds={sentBillingIds}
          setSentBillingIds={setSentBillingIds}
          tipePesan={tipePesan}
          setTipePesan={setTipePesan}
          selectedKategoriId={selectedKategoriId}
          handleKategoriChange={handleKategoriChange}
          loadingKategori={loadingKategori}
          listKategori={listKategori}
          statusAbsen={statusAbsen}
          setStatusAbsen={setStatusAbsen}
          pesanWaliInfoTemplate={pesanWaliInfoTemplate}
          setPesanWaliInfoTemplate={setPesanWaliInfoTemplate}
          defaultWaliInfoTemplate={defaultWaliInfoTemplate}
          pesanWaliTemplate={pesanWaliTemplate}
          setPesanWaliTemplate={setPesanWaliTemplate}
          defaultWaliTemplate={defaultWaliTemplate}
          simpanTemplatRef={simpanTemplatRef}
          saveTemplate={saveTemplate}
          resetTemplate={resetTemplate}
          saveStatus={saveStatus}
          search={search}
          setSearch={setSearch}
          loading={loading}
          hasSearch={hasSearch}
          setShowAllWaliData={setShowAllWaliData}
          filteredMurid={filteredMurid}
          sentWaIds={sentWaIds}
          getWaLink={getWaLink}
          markAsSent={markAsSent}
        />
      )}
          </div>
        </div>
      )}
    </div>
  );
}
