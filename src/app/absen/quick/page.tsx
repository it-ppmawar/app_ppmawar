'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Send, Sparkles, QrCode, Brain, X, User, MapPin } from 'lucide-react';
import Link from 'next/link';

// Avatar & Photo helper
const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#ea580c',
  '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#059669',
];
const getInitials = (nama: string): string => {
  if (!nama) return '?';
  const words = nama.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nama.substring(0, 2).toUpperCase();
};
const getAvatarColor = (nama: string): string => {
  if (!nama) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) {
    hash = nama.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const getFotoUrl = (fotoName: string | null) => {
  if (!fotoName || fotoName === '-') return '';
  if (fotoName.startsWith('http://') || fotoName.startsWith('https://')) return fotoName;
  if (fotoName.startsWith('foto_') || fotoName.startsWith('upload_') || fotoName.startsWith('profil_')) {
    return `/uploads/${fotoName}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_MITRA_FOTO_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/';
  const cleanFotoName = fotoName.startsWith('/') ? fotoName.substring(1) : fotoName;
  if (cleanFotoName.includes('sekretariat/berkas')) return `https://mawar.smartpesantren.id/${cleanFotoName}`;
  return `${baseUrl}${cleanFotoName}`;
};

function QuickAbsenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [kehadiran, setKehadiran] = useState<{ [muridId: number]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

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
          const initialMap: { [id: number]: string } = {};
          const existing = res.data.existingAbsensi || {};
          (res.data.murid || []).forEach((m: any) => {
            initialMap[m.murid_id] = existing[m.murid_id] || 'hadir';
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

    const listAbsensi = (murid || []).map((m: any) => ({
      murid_id: m.murid_id,
      status: kehadiran[m.murid_id] || 'hadir',
      nama_panggilan: m.nama_panggilan || ''
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
        setShowSuccessModal(true);
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
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
        <p className="text-emerald-200 font-medium">Memverifikasi Token Quick Absen...</p>
        <p className="text-slate-400 text-xs mt-1">PP. Miftahul Anwar (PPMA)</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-xl">
          <AlertCircle className="w-14 h-14 text-rose-400 mx-auto mb-3 animate-bounce" />
          <h1 className="text-xl font-bold text-rose-300 mb-2">Tautan Tidak Valid / Expired</h1>
          <p className="text-slate-300 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard/absen')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Masuk ke Dashboard Absensi
          </button>
        </div>
      </div>
    );
  }

  const { guru_nama, tipe, date, jadwal, murid } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Header */}
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

        {/* Tombol Pintasan Absen (Scan QR & Scan Wajah AI) */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/scan-absen?mode=qr"
            className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-sm text-xs font-bold transition active:scale-95"
          >
            <QrCode size={16} /> Scan QR Kartu
          </Link>
          <Link
            href="/dashboard/scan-absen?mode=face"
            className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-sm text-xs font-bold transition active:scale-95"
          >
            <Brain size={16} /> Scan Wajah AI
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 p-3 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Quick Batch Select (Set Massal Sesuai Desain HP) */}
        <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              ⚡ Set Massal ({murid?.length || 0} Santri)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 w-full">
            <button
              onClick={() => setAllStatus('hadir')}
              className="py-2 text-xs rounded-xl bg-emerald-900/70 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60 font-bold transition text-center active:scale-95"
            >
              Hadir All
            </button>
            <button
              onClick={() => setAllStatus('izin')}
              className="py-2 text-xs rounded-xl bg-amber-900/70 hover:bg-amber-800 text-amber-300 border border-amber-700/60 font-bold transition text-center active:scale-95"
            >
              Izin All
            </button>
            <button
              onClick={() => setAllStatus('sakit')}
              className="py-2 text-xs rounded-xl bg-blue-900/70 hover:bg-blue-800 text-blue-300 border border-blue-700/60 font-bold transition text-center active:scale-95"
            >
              Sakit All
            </button>
            <button
              onClick={() => setAllStatus('alpha')}
              className="py-2 text-xs rounded-xl bg-rose-900/70 hover:bg-rose-800 text-rose-300 border border-rose-700/60 font-bold transition text-center active:scale-95"
            >
              Alpha All
            </button>
          </div>
        </div>

        {/* Student List */}
        <div className="space-y-3">
          {murid?.map((m: any, idx: number) => {
            const st = kehadiran[m.murid_id] || 'hadir';
            const fotoUrl = getFotoUrl(m.foto);

            return (
              <div key={m.murid_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm hover:border-slate-700 transition">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700 mt-1">
                    {idx + 1}
                  </span>

                  {/* Avatar / Foto Santri (Klik untuk Zoom) */}
                  <div
                    onClick={() => fotoUrl && setZoomPhoto(fotoUrl)}
                    className={`w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-slate-700 flex items-center justify-center relative ${fotoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : ''}`}
                    style={{ backgroundColor: getAvatarColor(m.nama) }}
                    title={fotoUrl ? 'Klik untuk memperbesar foto' : ''}
                  >
                    {fotoUrl ? (
                      <img
                        src={fotoUrl}
                        alt={m.nama}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-white font-bold text-xs">{getInitials(m.nama)}</span>
                    )}
                  </div>

                  {/* Informasi Santri: Nama, Panggilan (Input Instan), NIS, Wali, Alamat */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="font-bold text-sm text-slate-100 truncate">{m.nama}</h3>
                    
                    {/* Input Nama Panggilan Instan */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium">Panggilan:</span>
                      <input
                        type="text"
                        placeholder="Isi panggilan..."
                        value={m.nama_panggilan || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setData((prev: any) => ({
                            ...prev,
                            murid: (prev.murid || []).map((item: any) =>
                              item.murid_id === m.murid_id ? { ...item, nama_panggilan: val } : item
                            )
                          }));
                        }}
                        className="w-full max-w-[170px] px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-300 placeholder:text-slate-500 transition"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono">NIS: {m.nis || '-'}</p>
                    
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1 text-slate-400">
                        <User size={11} className="shrink-0 text-emerald-400" />
                        <span className="truncate">Wali: <strong className="text-slate-200">{m.nama_wali || '-'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin size={11} className="shrink-0 text-teal-400" />
                        <span className="truncate" title={m.alamat}>Alamat: <span className="text-slate-300">{m.alamat || '-'}</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Options Buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80">
                  {[
                    { id: 'hadir', label: 'Hadir', bgActive: 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' },
                    { id: 'izin', label: 'Izin', bgActive: 'bg-amber-600 text-white font-bold shadow-md shadow-amber-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' },
                    { id: 'sakit', label: 'Sakit', bgActive: 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' },
                    { id: 'alpha', label: 'Alpha', bgActive: 'bg-rose-600 text-white font-bold shadow-md shadow-rose-900/50', bgInactive: 'bg-slate-800/80 text-slate-400 hover:text-slate-200' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setKehadiran(prev => ({ ...prev, [m.murid_id]: opt.id }))}
                      className={`py-2 text-xs rounded-xl transition text-center font-medium ${st === opt.id ? opt.bgActive : opt.bgInactive}`}
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
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base active:scale-[0.99]"
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

      {/* Modal Zoom Foto Santri */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out" onClick={() => setZoomPhoto(null)}>
          <div className="relative max-w-2xl max-h-[90vh] flex items-center justify-center animate-in zoom-in duration-200">
            <img src={zoomPhoto} alt="Zoomed Santri" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-700" />
            <button className="absolute -top-3 -right-3 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-110 transition-transform">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Pemberitahuan Sukses & Opsi Edit */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">MasyaAllah! Absensi Berhasil Disimpan</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Data presensi kelas <strong>{jadwal.nama_kelas}</strong> telah tersimpan di sistem.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition flex items-center justify-center gap-2"
              >
                ✏️ Edit / Ubah Absensi Ini
              </button>
              <button
                onClick={() => router.push('/dashboard/absen')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
              >
                📊 Ke Halaman Absensi Utama
              </button>
            </div>
          </div>
        </div>
      )}
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
