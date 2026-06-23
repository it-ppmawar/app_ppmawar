'use client';

import { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft, Save } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Suspense } from 'react';

function InputAbsenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tipe = searchParams.get('tipe');
  const kelas_id = searchParams.get('kelas_id');
  const jadwal_id = searchParams.get('jadwal_id');

  const [murid, setMurid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (!tipe || !kelas_id || !jadwal_id) {
      setErrorMsg('Parameter tidak lengkap');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/absen/input?tipe=${tipe}&kelas_id=${kelas_id}&jadwal_id=${jadwal_id}`);
        const json = await res.json();
        if (json.success) {
          setMurid(json.data);
        } else {
          setErrorMsg(json.error || 'Gagal memuat data santri');
        }
      } catch (err) {
        setErrorMsg('Terjadi kesalahan jaringan');
      } finally {
        setLoading(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          fetchData();
        },
        (err) => {
          console.error(err);
          setLocationError('Akses lokasi ditolak atau tidak tersedia. Anda wajib mengaktifkan GPS/Lokasi untuk melakukan absensi.');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError('Browser Anda tidak mendukung deteksi lokasi.');
      setLoading(false);
    }
  }, [tipe, kelas_id, jadwal_id]);

  const handleStatusChange = (murid_id: number, status: string) => {
    setMurid(prev => prev.map(m => m.murid_id === murid_id ? { ...m, status } : m));
  };

  const handleKeteranganChange = (murid_id: number, keterangan: string) => {
    setMurid(prev => prev.map(m => m.murid_id === murid_id ? { ...m, keterangan } : m));
  };

  const handleNamaPanggilanChange = (murid_id: number, nama_panggilan: string) => {
    setMurid(prev => prev.map(m => m.murid_id === murid_id ? { ...m, nama_panggilan } : m));
  };

  const setAllStatus = (status: string) => {
    if (confirm(`Tandai semua santri sebagai ${status}?`)) {
      setMurid(prev => prev.map(m => ({ ...m, status })));
    }
  };

  const handleSave = async () => {
    if (!confirm('Simpan data absensi sekarang?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/absen/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe,
          jadwal_id,
          absensi: murid.map(m => ({
            murid_id: m.murid_id,
            status: m.status,
            keterangan: m.keterangan,
            nama_panggilan: m.nama_panggilan
          })),
          lokasi_lat: location?.lat,
          lokasi_lng: location?.lng
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
      } else {
        alert('Gagal: ' + data.error);
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-bold animate-pulse">Memuat data santri...</div>;

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white dark:bg-gray-800 rounded-3xl mt-10 shadow-lg border border-gray-100 dark:border-gray-700 animate-[slideDown_0.3s_ease-out]">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-800 dark:text-gray-200 mb-2">Absensi Berhasil Disimpan!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Data kehadiran santri telah berhasil masuk ke sistem.</p>
        
        <div className="space-y-3">
          <Link href={`/dashboard/notifikasi?kegiatan=${tipe}&kelas=${kelas_id}`} className="block w-full bg-[#25D366] hover:bg-[#1DA851] text-white px-6 py-4 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-center gap-2">
            Lanjut Kirim Pesan WA Wali Murid
          </Link>
          <Link href="/dashboard/absen" className="block w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-xl font-bold transition-colors">
            Kembali ke Jadwal
          </Link>
        </div>
      </div>
    );
  }

  if (errorMsg || locationError) return (
    <div className="max-w-3xl mx-auto p-6 text-center bg-red-50 dark:bg-red-900/20 rounded-3xl mt-10">
      <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
      <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Akses Ditolak</h2>
      <p className="text-red-600 dark:text-red-300 mb-6">{errorMsg || locationError}</p>
      {locationError && (
        <p className="text-sm text-red-500 mb-6 font-bold">
          Deteksi lokasi diwajibkan untuk menjaga ketertiban absensi. Pastikan fitur Lokasi / GPS di HP Anda menyala dan Anda mengizinkan browser mengakses lokasi.
        </p>
      )}
      <Link href="/dashboard/absen" className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold">Kembali</Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 rounded-3xl p-6 shadow-sm border border-indigo-200 dark:border-indigo-800/50 relative overflow-hidden transition-colors">
        <Link href="/dashboard/absen" className="absolute top-4 left-4 p-2 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 rounded-full transition-colors z-20">
          <ArrowLeft size={20} className="text-indigo-800 dark:text-indigo-200" />
        </Link>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-200/50 dark:text-indigo-800/30">
          <Users size={120} />
        </div>
        <div className="relative z-10 mt-8">
          <h1 className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400 drop-shadow-sm flex items-center gap-2">
            Input Absensi Kelas
          </h1>
          <p className="text-indigo-600 dark:text-indigo-300 text-sm mt-1 font-medium max-w-md">
            Silakan centang kehadiran santri di bawah ini.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <button onClick={() => setAllStatus('Hadir')} className="text-xs bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-bold py-2 px-4 rounded-xl transition-colors">Semua Hadir</button>
        <button onClick={() => setAllStatus('Alpha')} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold py-2 px-4 rounded-xl transition-colors">Semua Alpha</button>
      </div>

      {/* Tampilan Desktop (Tabel) */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-4 py-4 w-10 text-center">NO</th>
                <th className="px-4 py-4">NAMA SANTRI</th>
                <th className="px-4 py-4">NAMA PANGGILAN</th>
                <th className="px-4 py-4 text-center">KEHADIRAN</th>
                <th className="px-4 py-4">KETERANGAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {murid.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Tidak ada data santri di kelas ini.</td></tr>
              ) : (
                murid.map((item, index) => (
                  <tr key={item.murid_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-400 font-medium">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900 dark:text-white">{item.nama}</div>
                      <div className="text-xs text-gray-400 font-mono">{item.nis || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Panggilan..."
                        value={item.nama_panggilan || ''}
                        onChange={(e) => handleNamaPanggilanChange(item.murid_id, e.target.value)}
                        className="w-full max-w-[120px] px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1 gap-1">
                        {['Hadir', 'Izin', 'Sakit', 'Alpha'].map(status => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleStatusChange(item.murid_id, status)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                              item.status === status 
                                ? status === 'Hadir' ? 'bg-green-500 text-white shadow-sm'
                                : status === 'Izin' ? 'bg-blue-500 text-white shadow-sm'
                                : status === 'Sakit' ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-red-500 text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Catatan..."
                        value={item.keterangan || ''}
                        onChange={(e) => handleKeteranganChange(item.murid_id, e.target.value)}
                        className="w-full min-w-[150px] px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                        disabled={item.status === 'Hadir'}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tampilan Mobile (Kartu Bertumpuk) */}
      <div className="block md:hidden space-y-4">
        {murid.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center text-gray-500 border border-gray-100 dark:border-gray-700">Tidak ada data santri di kelas ini.</div>
        ) : (
          murid.map((item, index) => (
            <div key={item.murid_id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className="text-gray-400 text-xs font-semibold">{index + 1}.</span>
                    {item.nama}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5 ml-3.5">NIS: {item.nis || '-'}</div>
                </div>
              </div>

              {/* Input Nama Panggilan Mobile */}
              <div className="ml-3.5 flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 font-medium">Nama Panggilan:</span>
                <input
                  type="text"
                  placeholder="Panggilan..."
                  value={item.nama_panggilan || ''}
                  onChange={(e) => handleNamaPanggilanChange(item.murid_id, e.target.value)}
                  className="w-full max-w-[180px] px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300"
                />
              </div>

              {/* Grid Status Kehadiran Mobile */}
              <div className="grid grid-cols-4 gap-1.5 bg-gray-100 dark:bg-gray-900 rounded-xl p-1">
                {['Hadir', 'Izin', 'Sakit', 'Alpha'].map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(item.murid_id, status)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all text-center ${
                      item.status === status 
                        ? status === 'Hadir' ? 'bg-green-500 text-white shadow-sm'
                        : status === 'Izin' ? 'bg-blue-500 text-white shadow-sm'
                        : status === 'Sakit' ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-red-500 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Catatan (hanya jika bukan Hadir) */}
              {item.status !== 'Hadir' && (
                <div className="ml-0.5">
                  <input
                    type="text"
                    placeholder="Masukkan catatan (alasan izin/sakit/keterangan)..."
                    value={item.keterangan || ''}
                    onChange={(e) => handleKeteranganChange(item.murid_id, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-16 sm:bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
            Total Hadir: <span className="text-green-600 dark:text-green-400">{murid.filter(m => m.status === 'Hadir').length}</span> / {murid.length}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || murid.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {saving ? <Clock className="animate-spin" size={20} /> : <Save size={20} />}
            {saving ? 'Menyimpan...' : 'Simpan Absensi'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InputAbsenDetailPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500 font-bold animate-pulse">Memuat halaman...</div>}>
      <InputAbsenContent />
    </Suspense>
  );
}
