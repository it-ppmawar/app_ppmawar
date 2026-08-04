'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Send, Sparkles } from 'lucide-react';

function QuickAbsenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [kehadiran, setKehadiran] = useState<{ [muridId: number]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token absensi tidak ditemukan. Silakan klik link dari pesan WhatsApp kembali.');
      setLoading(false);
      return;
    }

    fetch('/api/absen/quick-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then(res => res.json())
      .then(res => {
        if (!res.success) {
          setError(res.error || 'Token tidak valid atau sudah kadaluarsa.');
        } else {
          setData(res.data);
          // Default semua santri 'hadir'
          const initialMap: { [id: number]: string } = {};
          (res.data.murid || []).forEach((m: any) => {
            initialMap[m.murid_id] = 'hadir';
          });
          setKehadiran(initialMap);
        }
      })
      .catch(err => {
        setError('Gagal menghubungkan ke server: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const setAllStatus = (status: string) => {
    if (!data?.murid) return;
    const newMap = { ...kehadiran };
    data.murid.forEach((m: any) => {
      newMap[m.murid_id] = status;
    });
    setKehadiran(newMap);
  };

  const handleSubmit = async () => {
    if (!data || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const listAbsensi = Object.entries(kehadiran).map(([murid_id, status]) => ({
      murid_id: Number(murid_id),
      status
    }));

    const payload = {
      jadwal_id: data.jadwal.jadwal_id,
      tipe: data.tipe,
      tanggal: data.date,
      absensi: listAbsensi
    };

    try {
      const res = await fetch('/api/absen/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success || res.ok) {
        setSuccessMsg('MasyaAllah! Absensi kelas berhasil disimpan.');
        setTimeout(() => {
          router.push('/dashboard/absen');
        }, 2000);
      } else {
        setError(result.error || 'Gagal menyimpan absensi.');
      }
    } catch (e: any) {
      setError('Terjadi kesalahan: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
        <p className="text-emerald-200 font-medium">Memverifikasi Token Quick Absen...</p>
        <p className="text-slate-400 text-xs mt-1">PP. Miftahul Anwar (PPMA)</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-xl">
          <AlertCircle className="w-14 h-14 text-rose-400 mx-auto mb-3 animate-bounce" />
          <h1 className="text-xl font-bold text-rose-300 mb-2">Tautan Tidak Valid / Expired</h1>
          <p className="text-slate-300 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard/absen')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Masuk ke Dashboard Absensi
          </button>
        </div>
      </div>
    );
  }

  const { guru_nama, tipe, date, jadwal, murid } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Quick Absen PPMA</h1>
              <p className="text-[11px] text-slate-400">{guru_nama}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-full uppercase">
            {tipe}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Info Card */}
        <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-700/50 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-emerald-300">{jadwal.nama_kelas}</h2>
          <p className="text-sm text-slate-300 font-medium">{jadwal.mata_pelajaran || 'Pengajaran Madin/Al-Qur\'an'}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-emerald-800/40">
            <span>🕒 {jadwal.jam_mulai} - {jadwal.jam_selesai} WIB</span>
            <span>📅 {date}</span>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">{successMsg}</p>
              <p className="text-xs text-emerald-400">Mengalihkan ke dashboard...</p>
            </div>
          </div>
        )}

        {/* Quick Batch Select */}
        <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">Set Massal ({murid?.length || 0} Santri):</span>
          <div className="flex items-center gap-1.5 text-xs">
            <button onClick={() => setAllStatus('hadir')} className="px-2.5 py-1 rounded-lg bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-800">Hadir All</button>
            <button onClick={() => setAllStatus('izin')} className="px-2.5 py-1 rounded-lg bg-amber-900/60 text-amber-300 border border-amber-700/50 hover:bg-amber-800">Izin All</button>
            <button onClick={() => setAllStatus('sakit')} className="px-2.5 py-1 rounded-lg bg-blue-900/60 text-blue-300 border border-blue-700/50 hover:bg-blue-800">Sakit All</button>
            <button onClick={() => setAllStatus('alpha')} className="px-2.5 py-1 rounded-lg bg-rose-900/60 text-rose-300 border border-rose-700/50 hover:bg-rose-800">Alpha All</button>
          </div>
        </div>

        {/* Student List */}
        <div className="space-y-2.5">
          {murid?.map((m: any, idx: number) => {
            const st = kehadiran[m.murid_id] || 'hadir';
            return (
              <div key={m.murid_id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100">{m.nama}</h3>
                    <p className="text-[11px] text-slate-400">NIS: {m.nis || '-'}</p>
                  </div>
                </div>

                {/* Status Options */}
                <div className="grid grid-cols-4 gap-1 sm:w-auto">
                  {[
                    { id: 'hadir', label: 'Hadir', bgActive: 'bg-emerald-600 text-white font-bold', bgInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' },
                    { id: 'izin', label: 'Izin', bgActive: 'bg-amber-600 text-white font-bold', bgInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' },
                    { id: 'sakit', label: 'Sakit', bgActive: 'bg-blue-600 text-white font-bold', bgInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' },
                    { id: 'alpha', label: 'Alpha', bgActive: 'bg-rose-600 text-white font-bold', bgInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setKehadiran(prev => ({ ...prev, [m.murid_id]: opt.id }))}
                      className={`px-3 py-1.5 text-xs rounded-lg transition text-center ${st === opt.id ? opt.bgActive : opt.bgInactive}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-30">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Menyimpan Absensi...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" /> Simpan Absensi Kelas
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function QuickAbsenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <QuickAbsenContent />
    </Suspense>
  );
}
