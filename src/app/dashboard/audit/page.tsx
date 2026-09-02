'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Shield, Search, RefreshCw, Calendar, User, Activity, ChevronLeft, ChevronRight, Info, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: number;
  user_nama: string;
  nama_lengkap?: string;
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

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  guru: 'Guru',
  staff: 'Staff',
  pengurus_asrama: 'Pengurus',
  pengasuh: 'Pengasuh',
  murid: 'Santri',
  tamu: 'Tamu',
};

/**
 * Ekstrak info kelas/kamar dari data_baru atau data_lama log
 * Mengembalikan string ringkas seperti "Kelas: 1 MAK PUTRA | Kamar: Asrama A"
 */
function getDetailKelasKamar(log: AuditLog): string | null {
  const data = log.data_baru || log.data_lama;
  if (!data) return null;

  let obj: any = null;
  try {
    obj = typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return null;
  }

  if (!obj || typeof obj !== 'object') return null;

  const parts: string[] = [];

  // Kelas Madin
  if (obj.kelas_madin || obj.nama_kelas) {
    parts.push(`Kelas: ${obj.kelas_madin || obj.nama_kelas}`);
  }
  // Kelas Quran
  if (obj.kelas_quran) {
    parts.push(`Qur'an: ${obj.kelas_quran}`);
  }
  // Kamar / Asrama
  if (obj.nama_kamar || obj.kamar) {
    parts.push(`Kamar: ${obj.nama_kamar || obj.kamar}`);
  }
  // Mapel / Kegiatan
  if (obj.mata_pelajaran) {
    parts.push(`Mapel: ${obj.mata_pelajaran}`);
  } else if (obj.nama_kegiatan) {
    parts.push(`Kegiatan: ${obj.nama_kegiatan}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}


export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState('');
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

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) setMyRole(data.user.role);
      })
      .catch(() => {});
  }, []);

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
        weekday: 'long',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'Asia/Jakarta',
      });
    } catch { return dt; }
  };
  const [sortField, setSortField] = useState<'created_at' | 'user' | 'aksi' | 'keterangan' | 'ip_address'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'created_at' | 'user' | 'aksi' | 'keterangan' | 'ip_address') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const sortedLogs = [...logs].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortField === 'created_at') {
      valA = a.created_at || '';
      valB = b.created_at || '';
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (sortField === 'user') {
      valA = (a.nama_lengkap || a.user_nama || '').toLowerCase();
      valB = (b.nama_lengkap || b.user_nama || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (sortField === 'aksi') {
      valA = (AKSI_LABEL[a.aksi] || a.aksi || '').toLowerCase();
      valB = (AKSI_LABEL[b.aksi] || b.aksi || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (sortField === 'keterangan') {
      valA = (a.keterangan || '').toLowerCase();
      valB = (b.keterangan || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (sortField === 'ip_address') {
      valA = (a.ip_address || '').toLowerCase();
      valB = (b.ip_address || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  if (myRole && myRole !== 'admin') {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 mt-12">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Akses Dibatasi</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Halaman Audit Log hanya dapat diakses oleh Administrator Utama.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Shield className="text-indigo-600 dark:text-indigo-400 w-7 h-7" />
            Audit Log
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Riwayat aktivitas sistem — siapa, apa, kapan, dan dari mana
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter Aksi */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Aksi</label>
            <select
              value={filterAksi}
              onChange={e => { setFilterAksi(e.target.value); setPage(1); }}
              className="w-full text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Aksi</option>
              <option value="simpan_absen">Simpan Absen</option>
              <option value="ubah_status">Ubah Status</option>
              <option value="hapus_absen">Hapus Absen</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>
          </div>

          {/* Filter Tabel */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Tabel</label>
            <select
              value={filterTabel}
              onChange={e => { setFilterTabel(e.target.value); setPage(1); }}
              className="w-full text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Tabel</option>
              <option value="absensi">absensi (Madin)</option>
              <option value="absensi_quran">absensi_quran (MQ)</option>
              <option value="absensi_kegiatan">absensi_kegiatan (Asrama)</option>
              <option value="users">users</option>
            </select>
          </div>

          {/* Filter Tanggal */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Tanggal</label>
            <input
              type="date"
              value={filterTanggal}
              onChange={e => { setFilterTanggal(e.target.value); setPage(1); }}
              className="w-full text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setFilterAksi('');
                setFilterTabel('');
                setFilterTanggal('');
                setFilterUserId('');
                setPage(1);
              }}
              className="flex-1 text-xs py-2 px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => fetchLogs()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
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
        ) : sortedLogs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Shield className="mx-auto mb-3 w-12 h-12 opacity-30" />
            <p className="text-sm">Belum ada log yang ditemukan</p>
            <p className="text-xs mt-1 opacity-60">Pastikan sudah jalankan endpoint <code>/api/migrate-audit</code></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                  <th 
                    onClick={() => handleSort('created_at')}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group whitespace-nowrap"
                    title="Klik untuk mengurutkan berdasarkan waktu"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Waktu</span>
                      {sortField === 'created_at' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('user')}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group whitespace-nowrap"
                    title="Klik untuk mengurutkan berdasarkan user/nama"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>User</span>
                      {sortField === 'user' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('aksi')}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group whitespace-nowrap"
                    title="Klik untuk mengurutkan berdasarkan aksi"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Aksi</span>
                      {sortField === 'aksi' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('keterangan')}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group whitespace-nowrap"
                    title="Klik untuk mengurutkan berdasarkan keterangan"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Keterangan</span>
                      {sortField === 'keterangan' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('ip_address')}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none group whitespace-nowrap"
                    title="Klik untuk mengurutkan berdasarkan IP Address"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>IP</span>
                      {sortField === 'ip_address' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar size={12} className="shrink-0" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <User size={13} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs leading-tight whitespace-nowrap">
                            {log.nama_lengkap && log.nama_lengkap !== log.user_nama ? log.nama_lengkap : log.user_nama || '—'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {log.nama_lengkap && log.nama_lengkap !== log.user_nama && (
                              <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                {log.user_nama}
                              </span>
                            )}
                            <span className="text-gray-400 text-[10px]">{ROLE_LABEL[log.user_role] || log.user_role}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${AKSI_COLOR[log.aksi] || 'bg-gray-100 text-gray-600'}`}>
                        <Activity size={10} />
                        {AKSI_LABEL[log.aksi] || log.aksi}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{log.tabel}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">{log.keterangan || '—'}</p>
                      {(() => {
                        const detail = getDetailKelasKamar(log);
                        return detail ? (
                          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-0.5 max-w-xs truncate" title={detail}>
                            📋 {detail}
                          </p>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {log.ip_address || '—'}
                      </code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
                [
                  'User',
                  selectedLog.nama_lengkap && selectedLog.nama_lengkap !== selectedLog.user_nama
                    ? `${selectedLog.nama_lengkap} (${selectedLog.user_nama} • ${ROLE_LABEL[selectedLog.user_role] || selectedLog.user_role})`
                    : `${selectedLog.user_nama} (${ROLE_LABEL[selectedLog.user_role] || selectedLog.user_role})`
                ],
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

              {/* Info Kelas / Kamar (jika ada di data) */}
              {(() => {
                const detail = getDetailKelasKamar(selectedLog);
                return detail ? (
                  <div className="flex gap-3">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-24 shrink-0">Kelas/Kamar</span>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{detail}</span>
                  </div>
                ) : null;
              })()}

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
