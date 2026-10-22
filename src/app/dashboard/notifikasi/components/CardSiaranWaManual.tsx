'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import TabRekapitulasi, { RekapFilterState } from './TabRekapitulasi';
import TabHarian from './TabHarian';

export interface CardSiaranWaManualProps {
  role: string;
  manualMode: 'absensi' | 'rekapitulasi' | 'info_akun' | 'pembayaran';
  setManualMode: React.Dispatch<React.SetStateAction<'absensi' | 'rekapitulasi' | 'info_akun' | 'pembayaran'>>;
  userScheduleTypes: Set<string>;

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
  tipePesan: 'madin' | 'quran' | 'kamar';
  setTipePesan: React.Dispatch<React.SetStateAction<'madin' | 'quran' | 'kamar'>>;
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
  return (
    <div id="siaran-wa-manual" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 overflow-hidden">
      <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
        <MessageCircle className="text-green-500" /> Siaran WhatsApp (Manual)
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Kirim pesan siaran langsung ke aplikasi WhatsApp asli Anda (anti-blokir). Pesan otomatis diisi, Anda hanya perlu klik tombol kirim di aplikasi WA.
      </p>

      {/* Mode Selector for Siaran WA Manual */}
      {(role === 'admin' || role === 'staff' || role === 'guru') && (
        <div className="flex bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-150/50 dark:border-gray-700/50 mb-6 gap-1">
          <button
            onClick={() => setManualMode('absensi')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
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
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
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
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
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
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
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
  );
}
