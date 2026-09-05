'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Clock, Building2, UserCheck, QrCode, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

function AbsenGuruContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [guru, setGuru] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [status, setStatus] = useState<'Hadir' | 'Izin' | 'Sakit'>('Hadir');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('Token absensi QR tidak ditemukan.');
      setLoading(false);
      return;
    }

    const fetchGuru = async () => {
      try {
        const res = await fetch(`/api/dewan-guru/qr?token=${encodeURIComponent(token)}&format=json`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Data dewan guru tidak valid.');
        } else {
          setGuru(json.guru);
        }
      } catch (err: any) {
        setError('Gagal terhubung ke server.');
      } finally {
        setLoading(false);
      }
    };

    fetchGuru();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guru || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/dewan-guru/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: token,
          status,
          keterangan: keterangan || (status === 'Hadir' ? 'Presensi Mandiri via Scan QR' : `${status}: ${keterangan}`)
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Gagal menyimpan absensi');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-xl border border-slate-100 dark:border-slate-800 space-y-4">
          <Loader2 className="w-12 h-12 text-teal-600 animate-spin mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Memverifikasi Kartu QR...</h3>
          <p className="text-xs text-slate-400">Mohon tunggu sebentar, sistem sedang membaca data presensi Anda.</p>
        </div>
      </div>
    );
  }

  if (error || !guru) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-xl border border-rose-100 dark:border-rose-950/50 space-y-4">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">QR Code Tidak Valid</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
          >
            <ArrowLeft size={16} /> Kembali ke Halaman Utama
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 dark:from-teal-950/20 dark:to-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border border-teal-100 dark:border-teal-900/40 space-y-5 animate-[scaleUp_0.3s_ease-out]">
          <div className="w-20 h-20 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-teal-50/50 dark:ring-teal-950/20">
            <CheckCircle2 size={44} />
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300">
              <Sparkles size={12} /> Presensi Berhasil Dicatat
            </span>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 pt-1">
              Alhamdulillah, {guru.nama}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Kehadiran Anda di <span className="font-bold text-teal-700 dark:text-teal-400">{guru.homebase}</span> telah tercatat resmi di database YPMA.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">Status</span>
              <span className="font-bold text-teal-600 dark:text-teal-400 uppercase">{status}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">Waktu Presensi</span>
              <span className="font-mono font-bold">{currentTime} WIB</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">Tanggal</span>
              <span className="font-medium">{currentDate}</span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="block w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-md shadow-teal-600/20"
          >
            Selesai / Buka Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-md w-full overflow-hidden">
        {/* Header Pesantren */}
        <div className="bg-gradient-to-br from-teal-700 to-emerald-800 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <h1 className="text-sm font-bold tracking-wider uppercase text-teal-200">Presensi Kehadiran Dewan Guru</h1>
          <h2 className="text-lg font-extrabold mt-0.5">PP. Matholi'ul Anwar</h2>
          <p className="text-[11px] text-teal-100/80 mt-1">{currentDate}</p>
          <div className="mt-2 font-mono font-black text-2xl tracking-widest text-teal-100">{currentTime}</div>
        </div>

        {/* Profil Guru */}
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3.5 bg-teal-50/60 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-100 dark:border-teal-900/40">
            <div className="w-12 h-12 bg-teal-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-md shadow-teal-600/20">
              {guru.nama ? guru.nama[0] : 'G'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate leading-tight">
                {guru.nama}
              </h3>
              <p className="text-xs text-teal-700 dark:text-teal-400 font-bold mt-0.5 flex items-center gap-1">
                <Building2 size={12} /> {guru.homebase}
              </p>
              {guru.nip && <p className="text-[11px] text-slate-400">NIP: {guru.nip}</p>}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Pilih Status Kehadiran:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Hadir', 'Izin', 'Sakit'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all ${
                      status === s
                        ? s === 'Hadir'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                          : s === 'Izin'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                          : 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {status !== 'Hadir' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Keterangan {status}:
                </label>
                <textarea
                  value={keterangan}
                  onChange={e => setKeterangan(e.target.value)}
                  placeholder={`Tuliskan alasan ${status.toLowerCase()}...`}
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-black tracking-wide uppercase transition-all shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <UserCheck size={18} /> Konfirmasi {status}
                </>
              )}
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-400">
            Sistem Presensi Digital YPMA • Matholi'ul Anwar Simo Sungelebak
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AbsenGuruPublicPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
        </div>
      }
    >
      <AbsenGuruContent />
    </Suspense>
  );
}
