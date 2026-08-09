'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Search, RefreshCw, Calendar, User, Activity, ChevronLeft, ChevronRight, Info } from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: number;
  user_nama: string;
  user_role: string;
  aksi: string;
  tabel: string;
  record_id: number | null;
  keterangan: string;
  data_lama: any;
  data_baru: any;
  ip_address: string;
  created_at: string;
}

const AKSI_LABEL: Record<string, string> = {
  simpan_absen: 'Simpan Absen',
  ubah_status: 'Ubah Status',
  hapus_absen: 'Hapus Absen',
  login: 'Login',
  logout: 'Logout',
};

const AKSI_COLOR: Record<string, string> = {
  simpan_absen: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  ubah_status: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  hapus_absen: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  login: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  logout: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 30;

  // Filters
  const [filterAksi, setFilterAksi] = useState('');
  const [filterTabel, setFilterTabel] = useState('');
  const [filterTanggal, setFilterTanggal] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filterAksi && { aksi: filterAksi }),
        ...(filterTabel && { tabel: filterTabel }),
        ...(filterTanggal && { tanggal: filterTanggal }),
        ...(filterUserId && { user_id: filterUserId }),
      });
      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterAksi, filterTabel, filterTanggal, filterUserId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dt: string) => {
    try {
      return new Date(dt).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'Asia/Jakarta',
      });
    } catch { return dt; }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Riwayat aktivitas sistem — siapa, apa, kapan, dari mana</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Aksi</label>
            <select
              value={filterAksi}
              onChange={e => { setFilterAksi(e.target.value); setPage(1); }}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">Semua Aksi</option>
              {Object.entries(AKSI_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Tabel</label>
            <select
              value={filterTabel}
              onChange={e => { setFilterTabel(e.target.value); setPage(1); }}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">Semua Tabel</option>
              <option value="absensi">absensi (Madin)</option>
              <option value="absensi_quran">absensi_quran</option>
              <option value="absensi_kegiatan">absensi_kegiatan</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Tanggal</label>
            <input
              type="date"
              value={filterTanggal}
              onChange={e => { setFilterTanggal(e.target.value); setPage(1); }}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => { setFilterAksi(''); setFilterTabel(''); setFilterTanggal(''); setFilterUserId(''); setPage(1); }}
              className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-2 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={fetchLogs}
              className="flex items-center justify-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 transition-colors shrink-0"
              title="Refresh Data Log"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Total <span className="font-semibold text-gray-800 dark:text-gray-200">{total.toLocaleString('id-ID')}</span> entri log
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Hal {page} / {totalPages || 1}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden mb-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-indigo-500 w-8 h-8" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Shield className="mx-auto mb-3 w-12 h-12 opacity-30" />
            <p className="text-sm">Belum ada log yang ditemukan</p>
            <p className="text-xs mt-1 opacity-60">Pastikan sudah jalankan endpoint <code>/api/migrate-audit</code></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Waktu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Aksi</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Keterangan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">IP</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar size={12} />
                        {formatDate(log.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <User size={13} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200 text-xs leading-tight">{log.user_nama || '—'}</p>
                          <p className="text-gray-400 text-[10px]">{log.user_role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${AKSI_COLOR[log.aksi] || 'bg-gray-100 text-gray-600'}`}>
                        <Activity size={10} />
                        {AKSI_LABEL[log.aksi] || log.aksi}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{log.tabel}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">{log.keterangan || '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <code className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {log.ip_address || '—'}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="Lihat Detail"
                      >
                        <Info size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield size={16} className="text-indigo-500" />
                Detail Log #{selectedLog.id}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['Waktu', formatDate(selectedLog.created_at)],
                ['User', `${selectedLog.user_nama} (${selectedLog.user_role})`],
                ['Aksi', AKSI_LABEL[selectedLog.aksi] || selectedLog.aksi],
                ['Tabel', selectedLog.tabel],
                ['Record ID', selectedLog.record_id?.toString() || '—'],
                ['IP Address', selectedLog.ip_address || '—'],
                ['Keterangan', selectedLog.keterangan || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-24 shrink-0">{label}</span>
                  <span className="text-xs text-gray-800 dark:text-gray-200">{value}</span>
                </div>
              ))}
              {selectedLog.data_baru && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Data Baru</p>
                  <pre className="text-[11px] bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300">
                    {JSON.stringify(
                      typeof selectedLog.data_baru === 'string'
                        ? JSON.parse(selectedLog.data_baru)
                        : selectedLog.data_baru,
                      null, 2
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
