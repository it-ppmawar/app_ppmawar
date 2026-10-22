'use client';

import React from 'react';
import {
  Search, RefreshCw, CheckCircle2, MessageCircle, Users, Check
} from 'lucide-react';

export interface TabHarianProps {
  manualMode: 'absensi' | 'rekapitulasi' | 'info_akun' | 'pembayaran';
  role: string;
  userScheduleTypes: Set<string>;

  // Pembayaran
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

  // Absensi & Info Akun
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

export default function TabHarian({
  manualMode,
  role,
  userScheduleTypes,

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
}: TabHarianProps) {
  return (
    <>
      {/* ===== TAB TAGIHAN & PEMBAYARAN ===== */}
      {manualMode === 'pembayaran' && (
        <div className="space-y-4">
          {/* Templat Pesan Pengingat Tagihan */}
          <div className="bg-orange-50/30 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/30 rounded-2xl p-4">
            <label className="block text-xs font-bold text-orange-800 dark:text-orange-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>✏️ Edit Templat Pesan Pengingat Tagihan</span>
              <span className="text-[10px] font-normal text-gray-400">Placeholder: &#123;nama_santri&#125;, &#123;nama_tagihan&#125;, &#123;periode&#125;, &#123;nominal&#125;</span>
            </label>
            <textarea
              value={pesanBillingTemplate}
              onChange={(e) => {
                setPesanBillingTemplate(e.target.value);
                localStorage.setItem('wa_template_billing', e.target.value);
              }}
              onBlur={() => saveTemplate('wa_template_billing', pesanBillingTemplate)}
              rows={6}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-orange-400 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
            />
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => resetTemplate('wa_template_billing', defaultBillingTemplate, setPesanBillingTemplate)}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
              >⟳ Reset ke Templat Default</button>
              {saveStatus['wa_template_billing'] === 'saved' && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> Tersimpan di Database ✓
                </span>
              )}
              <button
                type="button"
                onClick={() => saveTemplate('wa_template_billing', pesanBillingTemplate)}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
              >
                Simpan Templat
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari nama santri, NIS, atau nama wali..."
              value={billingSearch}
              onChange={(e) => setBillingSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none text-sm"
            />
          </div>

          {/* Info count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loadingBilling ? 'Memuat...' : `${billingList.filter(b => {
                if (!billingSearch.trim()) return true;
                const q = billingSearch.toLowerCase();
                return (b.nama_santri || '').toLowerCase().includes(q) ||
                       (b.nis || '').toLowerCase().includes(q) ||
                       (b.nama_wali || '').toLowerCase().includes(q);
              }).length} santri memiliki tunggakan`}
            </p>
            <button
              onClick={() => {
                setLoadingBilling(true);
                fetch('/api/billing')
                  .then(r => r.json())
                  .then(d => { if (d.success) setBillingList(d.data.filter((b: any) => b.status === 'Belum')); })
                  .catch(console.error)
                  .finally(() => setLoadingBilling(false));
              }}
              className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 font-bold"
            >
              <RefreshCw size={13} className={loadingBilling ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {/* List Tagihan Belum Lunas */}
          {loadingBilling ? (
            <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-orange-500" /></div>
          ) : (() => {
            const filteredBilling = billingList.filter(b => {
              if (!billingSearch.trim()) return true;
              const q = billingSearch.toLowerCase();
              return (b.nama_santri || '').toLowerCase().includes(q) ||
                     (b.nis || '').toLowerCase().includes(q) ||
                     (b.nama_wali || '').toLowerCase().includes(q);
            });

            if (filteredBilling.length === 0) {
              return (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">✅ Tidak ada tagihan yang belum lunas{billingSearch ? ` untuk "${billingSearch}"` : ''}.</p>
                </div>
              );
            }

            const formatRupiahLocal = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

            const getBillingWaLink = (b: any) => {
              let phone = (b.no_wali || '').replace(/[^0-9]/g, '');
              if (!phone) return '#';
              if (phone.startsWith('0')) phone = '62' + phone.slice(1);
              const msg = pesanBillingTemplate
                .replace(/{nama_santri}/g, b.nama_santri)
                .replace(/{nama_tagihan}/g, b.nama_tagihan)
                .replace(/{periode}/g, b.periode)
                .replace(/{nominal}/g, formatRupiahLocal(b.nominal));
              return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
            };

            return (
              <div className="space-y-3">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-orange-50 dark:bg-orange-950/30 text-xs uppercase font-bold text-orange-700 dark:text-orange-400 border-b border-orange-200 dark:border-orange-900/50">
                      <tr>
                        <th className="px-4 py-3">Santri & Wali</th>
                        <th className="px-4 py-3">Tagihan</th>
                        <th className="px-4 py-3">Nominal</th>
                        <th className="px-4 py-3 text-right">Kirim WA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredBilling.map((b, idx) => (
                        <tr key={`${b.id}-${idx}`} className="hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-800 dark:text-gray-100">{b.nama_santri}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">NIS: {b.nis}</div>
                            {b.nama_wali && <div className="text-xs text-emerald-600 dark:text-emerald-400">Wali: {b.nama_wali}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-700 dark:text-gray-200">{b.nama_tagihan}</div>
                            <div className="text-xs text-gray-400">{b.periode}</div>
                          </td>
                          <td className="px-4 py-3 font-extrabold text-red-600 dark:text-red-400">{formatRupiahLocal(b.nominal)}</td>
                          <td className="px-4 py-3 text-right">
                            {b.no_wali ? (
                              <a
                                href={getBillingWaLink(b)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setSentBillingIds(prev => ({ ...prev, [`${b.id}`]: true }))}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                  sentBillingIds[`${b.id}`]
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800'
                                    : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                                }`}
                              >
                                <MessageCircle size={14} />
                                {sentBillingIds[`${b.id}`] ? 'Terkirim ✓' : 'WA Wali'}
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No WA kosong</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="block md:hidden space-y-3">
                  {filteredBilling.map((b, idx) => (
                    <div key={`${b.id}-m-${idx}`} className={`rounded-2xl p-4 border transition-colors ${
                      sentBillingIds[`${b.id}`]
                        ? 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-extrabold text-gray-900 dark:text-white">{b.nama_santri}</div>
                          <div className="text-xs text-gray-400 font-mono">NIS: {b.nis}</div>
                        </div>
                        <span className="text-xs bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2.5 py-1.5 rounded-full font-bold border border-red-200 dark:border-red-800 whitespace-nowrap text-center leading-tight shrink-0">
                          Belum Lunas
                        </span>
                      </div>
                      <div className="bg-orange-50/50 dark:bg-orange-950/20 p-3 rounded-xl text-xs space-y-1.5 border border-orange-100 dark:border-orange-900/30 mb-3">
                        <div className="flex justify-between"><span className="text-gray-500">Tagihan:</span><span className="font-bold text-gray-800 dark:text-gray-100">{b.nama_tagihan}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Periode:</span><span className="font-semibold text-gray-700 dark:text-gray-300">{b.periode}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Nominal:</span><span className="font-extrabold text-red-600 dark:text-red-400">{formatRupiahLocal(b.nominal)}</span></div>
                        {b.nama_wali && <div className="flex justify-between"><span className="text-gray-500">Wali:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{b.nama_wali}</span></div>}
                      </div>
                      {b.no_wali ? (
                        <a
                          href={getBillingWaLink(b)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSentBillingIds(prev => ({ ...prev, [`${b.id}`]: true }))}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                            sentBillingIds[`${b.id}`]
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800'
                              : 'bg-[#25D366] hover:bg-[#1DA851] text-white shadow-md'
                          }`}
                        >
                          <MessageCircle size={16} />
                          {sentBillingIds[`${b.id}`] ? '✓ Pesan Terkirim' : 'Kirim WA Pengingat Tagihan'}
                        </a>
                      ) : (
                        <div className="text-center text-xs text-gray-400 italic py-2">Nomor WA wali tidak tersedia</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Dropdown default pesan WA — hanya tampil untuk mode absensi & info_akun */}
      <div className={`${manualMode === 'pembayaran' || manualMode === 'rekapitulasi' ? 'hidden' : ''} grid grid-cols-1 ${manualMode === 'info_akun' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-6 bg-green-50/50 dark:bg-green-950/20 p-4 rounded-2xl border border-green-100 dark:border-green-900/30`}>
        <div>
          <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5">Kategori Kegiatan</label>
          <select
            value={tipePesan}
            onChange={(e) => setTipePesan(e.target.value as any)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
          >
            {(role === 'admin' || role === 'staff' || userScheduleTypes.has('quran')) && (
              <option value="quran">Kelas Qur'an (Majlis)</option>
            )}
            {(role === 'admin' || role === 'staff' || userScheduleTypes.has('madin')) && (
              <option value="madin">Kelas Madin</option>
            )}
            {(role === 'admin' || role === 'staff' || userScheduleTypes.has('kamar')) && (
              <option value="kamar">Asrama (Kamar)</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5">Pilihan Kelas / Kamar</label>
          <select
            value={selectedKategoriId}
            onChange={handleKategoriChange}
            disabled={loadingKategori || listKategori.length === 0}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60"
          >
            {loadingKategori ? (
              <option>Memuat...</option>
            ) : listKategori.length === 0 ? (
              <option>Tidak ada data</option>
            ) : (
              <>
                <option value="all">Semua {tipePesan === 'kamar' ? 'Kamar' : 'Kelas'}</option>
                {listKategori.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </>
            )}
          </select>
        </div>
        {manualMode !== 'info_akun' && (
          <div>
            <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5">Status Absensi</label>
            <select
              value={statusAbsen}
              onChange={(e) => setStatusAbsen(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="Hadir">Hadir</option>
              <option value="Sakit">Sakit</option>
              <option value="Izin">Izin</option>
              <option value="Absen (Alpha)">Absen (Alpha)</option>
            </select>
          </div>
        )}
      </div>

      {/* Kolom Edit Templat Pesan Wali */}
      {manualMode !== 'rekapitulasi' && (manualMode === 'info_akun' ? (
        <div className="mb-6 bg-green-50/20 dark:bg-green-950/10 border border-green-200/40 dark:border-green-900/20 rounded-2xl p-4">
          <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>Edit Templat Pesan Info Akun Wali Murid</span>
            <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_santri&#125;, &#123;username&#125;, &#123;password&#125;</span>
          </label>
          <textarea
            value={pesanWaliInfoTemplate}
            onChange={(e) => {
              setPesanWaliInfoTemplate(e.target.value);
              localStorage.setItem('wa_template_wali_info', e.target.value);
            }}
            onBlur={() => saveTemplate('wa_template_wali_info', pesanWaliInfoTemplate)}
            rows={4}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-green-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
            placeholder="Tulis templat pesan info login..."
          />
          <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => resetTemplate('wa_template_wali_info', defaultWaliInfoTemplate, setPesanWaliInfoTemplate)}
              className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
            >⟳ Reset ke Templat Default</button>
            {saveStatus['wa_template_wali_info'] === 'saved' && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> Tersimpan di Database ✓
              </span>
            )}
            <button
              type="button"
              onClick={() => saveTemplate('wa_template_wali_info', pesanWaliInfoTemplate)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
            >
              Simpan Templat
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-green-50/20 dark:bg-green-950/10 border border-green-200/40 dark:border-green-900/20 rounded-2xl p-4">
          <label className="block text-xs font-bold text-green-800 dark:text-green-400 mb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>Edit Templat Pesan Wali Murid</span>
            <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">Placeholder: &#123;nama_santri&#125;, &#123;kegiatan&#125;, &#123;kelas&#125;, &#123;status&#125;, &#123;link_laporan&#125;</span>
          </label>
          <textarea
            value={pesanWaliTemplate}
            onChange={(e) => {
              setPesanWaliTemplate(e.target.value);
              localStorage.setItem('wa_template_wali', e.target.value);
            }}
            onBlur={() => saveTemplate('wa_template_wali', pesanWaliTemplate)}
            rows={4}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-green-500 outline-none resize-none font-mono text-gray-750 dark:text-gray-300 leading-relaxed"
            placeholder="Tulis templat pesan..."
          />
          <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2.5 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => resetTemplate('wa_template_wali', defaultWaliTemplate, setPesanWaliTemplate)}
              className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
            >⟳ Reset ke Templat Default</button>
            {saveStatus['wa_template_wali'] === 'saved' && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> Tersimpan di Database ✓
              </span>
            )}
            <button
              ref={simpanTemplatRef}
              type="button"
              onClick={() => saveTemplate('wa_template_wali', pesanWaliTemplate)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 min-w-[140px]"
            >
              Simpan Templat
            </button>
          </div>
        </div>
      ))}

      {/* Search bar — hanya tampil untuk mode absensi & info_akun */}
      {manualMode !== 'pembayaran' && manualMode !== 'rekapitulasi' && (
        <div id="search-wali-container" className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Ketik nama santri atau nama wali untuk mencari..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm transition-all"
          />
        </div>
      )}

      {/* Hasil / List Murid — hanya tampil untuk mode absensi & info_akun */}
      {manualMode !== 'pembayaran' && manualMode !== 'rekapitulasi' && loading ? (
        <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-green-500" /></div>
      ) : (manualMode !== 'pembayaran' && manualMode !== 'rekapitulasi') && (
        <>
          {/* Tampilan Desktop (Tabel) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-4 rounded-l-xl">Nama Santri</th>
                  <th className="px-5 py-4">Wali Murid</th>
                  <th className="px-5 py-4 text-right rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {!hasSearch ? (
                  <tr>
                    <td colSpan={3} className="text-center py-12">
                      <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium">
                        Gunakan fitur pencarian di atas untuk menemukan data santri,<br/>atau klik tombol di bawah ini untuk melihat seluruh data santri.
                      </p>
                      <button
                        onClick={() => setShowAllWaliData(true)}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <Users size={16} /> Tampilkan Semua Data
                      </button>
                    </td>
                  </tr>
                ) : filteredMurid.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-500">
                      Santri &quot;{search}&quot; tidak ditemukan
                    </td>
                  </tr>
                ) : (
                  filteredMurid.map(m => (
                    <tr key={m.murid_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-gray-800 dark:text-gray-200">
                        {m.nama}
                        {manualMode === 'info_akun' && (
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-1 font-normal">
                            User: {m.nis || `2026${m.murid_id}`} | Pass: {m.nis || `2026${m.murid_id}`}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                        {m.nama_wali || '-'} <br/>
                        <span className="text-xs">{m.no_wali || 'Nomor HP tidak ada'}</span>
                      </td>
                      <td className="px-5 py-4 text-right space-x-2">
                        {manualMode === 'info_akun' && (
                          <button
                            type="button"
                            onClick={() => {
                              const username = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                              const password = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                              const text = pesanWaliInfoTemplate
                                .replace(/{nama_santri}/g, m.nama)
                                .replace(/{username}/g, username)
                                .replace(/{password}/g, password);
                              navigator.clipboard.writeText(text);
                              alert('Info login disalin ke clipboard!');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                          >
                            Salin Info
                          </button>
                        )}
                        {m.no_wali ? (
                          <a 
                            href={getWaLink(m)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markAsSent(m.murid_id)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform hover:scale-105 active:scale-95 ${
                              sentWaIds[m.murid_id] 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800'
                                  : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                            }`}
                          >
                            {sentWaIds[m.murid_id] ? <Check size={16} /> : <MessageCircle size={16} />}
                            {sentWaIds[m.murid_id] ? 'Terkirim' : (manualMode === 'info_akun' ? 'Kirim Info' : 'WA Wali')}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No WA Kosong</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Tampilan Mobile (Kartu Bertumpuk) */}
          <div className="block md:hidden space-y-4">
            {!hasSearch ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium">
                  Gunakan fitur pencarian di atas untuk menemukan data santri,<br/>atau klik tombol di bawah ini untuk melihat seluruh data santri.
                </p>
                <button
                  onClick={() => setShowAllWaliData(true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <Users size={16} /> Tampilkan Semua Data
                </button>
              </div>
            ) : filteredMurid.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Santri &quot;{search}&quot; tidak ditemukan
              </div>
            ) : (
              filteredMurid.map(m => (
                <div key={m.murid_id} className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border transition-colors ${
                  sentWaIds[m.murid_id] ? 'border-green-200 dark:border-green-800 bg-green-50/10 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-700'
                } space-y-3`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-gray-900 dark:text-white text-base leading-tight">{m.nama}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">NIS: {m.nis || '-'}</div>
                    </div>
                  </div>

                  {manualMode === 'info_akun' ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-xs space-y-1.5 border border-blue-100 dark:border-blue-900/30">
                      <div className="flex justify-between">
                        <span className="text-blue-800 dark:text-blue-300 font-medium">Username:</span>
                        <span className="font-bold text-blue-900 dark:text-blue-200 font-mono">{m.nis || `2026${m.murid_id}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-800 dark:text-blue-300 font-medium">Password Default:</span>
                        <span className="font-bold text-blue-900 dark:text-blue-200 font-mono">{m.nis || `2026${m.murid_id}`}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-medium">Wali Murid:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{m.nama_wali || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-medium">No. Wali:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{m.no_wali || 'Nomor HP tidak ada'}</span>
                      </div>
                    </div>
                  )}

                  {/* Tombol WA Wali & Salin bertumpuk */}
                  <div className="grid grid-cols-1 gap-2">
                    {manualMode === 'info_akun' && (
                      <button
                        type="button"
                        onClick={() => {
                          const username = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                          const password = (m.nis && m.nis.trim() !== '') ? m.nis.trim() : `2026${m.murid_id}`;
                          const text = pesanWaliInfoTemplate
                            .replace(/{nama_santri}/g, m.nama)
                            .replace(/{username}/g, username)
                            .replace(/{password}/g, password);
                          navigator.clipboard.writeText(text);
                          alert('Info login disalin ke clipboard!');
                        }}
                        className="w-full flex items-center justify-center py-2.5 bg-gray-150 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs transition-colors"
                      >
                        Salin Info Login
                      </button>
                    )}
                    {m.no_wali ? (
                      <a 
                        href={getWaLink(m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markAsSent(m.murid_id)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95 ${
                          sentWaIds[m.murid_id] 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800'
                              : 'bg-[#25D366] hover:bg-[#1DA851] text-white'
                        }`}
                      >
                        {sentWaIds[m.murid_id] ? <Check size={16} /> : <MessageCircle size={16} />}
                        {sentWaIds[m.murid_id] ? 'Info Terkirim' : (manualMode === 'info_akun' ? 'Kirim Info Akun' : 'Kirim WA Wali')}
                      </a>
                    ) : (
                      <div className="w-full bg-gray-50 dark:bg-gray-900 text-center py-2.5 rounded-xl text-xs text-gray-400 italic">
                        Nomor WhatsApp Wali Kosong
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
