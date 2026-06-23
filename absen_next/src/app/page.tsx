'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, CalendarDays, Clock, Fingerprint, Eye } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    // Check if WebAuthn is supported
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setWebAuthnSupported(true);
    }
    return () => clearInterval(timer);
  }, []);

  const getHijriDate = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {day: 'numeric', month: 'long', year: 'numeric'}).format(date).replace(/هـ/g, 'هـ');
    } catch (e) {
      return '';
    }
  };

  const getMasehiDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(date) + ' M';
  };

  const getTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(date).replace(/\./g, ':');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat login');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal masuk sebagai tamu');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 1. Dapatkan authentication options dari server
      const query = username ? `?username=${encodeURIComponent(username)}` : '';
      const resp = await fetch(`/api/auth/webauthn/login/generate${query}`);
      const options = await resp.json();
      
      if (!resp.ok) throw new Error(options.error || 'Gagal memulai autentikasi biometrik');

      // 2. Tampilkan prompt WebAuthn ke user
      let authResp;
      try {
        authResp = await startAuthentication(options);
      } catch (err: any) {
        throw new Error('Autentikasi biometrik dibatalkan atau gagal.');
      }

      // 3. Verifikasi response ke server
      const verifyResp = await fetch('/api/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp)
      });
      
      const verification = await verifyResp.json();
      
      if (!verifyResp.ok) throw new Error(verification.error || 'Verifikasi biometrik gagal');
      
      // Sukses!
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex flex-col items-center justify-center p-4">
      {mounted && (
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 shadow-xl border border-white/20 text-center animate-[slideDown_0.5s_ease-out]">
          <div className="flex justify-center items-center gap-2 text-white font-medium text-sm md:text-base">
            <CalendarDays className="h-5 w-5" />
            <span className="font-theme-arabic text-xl md:text-2xl mt-1 tracking-wide font-bold" dir="rtl">{getHijriDate(currentTime)}</span>
          </div>
          <div className="flex justify-center items-center gap-2 text-green-100 text-xs md:text-sm mt-1">
            <span>{getMasehiDate(currentTime)}</span>
            <span className="text-white/50">|</span>
            <span className="font-theme-content">{getTime(currentTime)}</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 animate-[fadeIn_0.6s_ease-out]">
        <div className="text-center mb-8">
          <div className="bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl h-32 w-32 md:h-40 md:w-40 p-4 md:p-5 animate-[slideDown_0.8s_ease-out]">
            <img src="/logo.png" alt="Logo PPMA" className="h-[85%] w-[85%] object-contain drop-shadow-md" />
          </div>
          {/* Salam Mawar — baris terpendek */}
          <h1
            className="font-theme-hero font-bold text-white animate-[fadeIn_1s_ease-out] mb-2"
            style={{ fontSize: 'clamp(1.4rem, 4vw, 1.7rem)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
          >
            Salam Mawar
          </h1>
          {/* Sistem Aplikasi Layanan Akademik — medium */}
          <h2
            className="font-theme-content text-white font-bold animate-[fadeIn_1.2s_ease-out] mb-1.5"
            style={{ fontSize: 'clamp(0.7rem, 2.5vw, 0.85rem)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
          >
            Sistem Aplikasi Layanan Akademik
          </h2>
          {/* Pondok Pesantren Matholi'ul Anwar — terpanjang */}
          <p
            className="font-theme-content text-white font-bold animate-[fadeIn_1.4s_ease-out]"
            style={{ fontSize: 'clamp(0.7rem, 2.5vw, 0.85rem)', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}
          >
            Pondok Pesantren Matholi&apos;ul Anwar
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-white px-4 py-3 rounded-lg mb-6 text-sm backdrop-blur-sm animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[15px] font-extrabold text-green-50 ml-1 font-theme-content" style={{ letterSpacing: '0.05em' }}>Nama Pengguna</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-green-200" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs placeholder-green-200/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all font-theme-content placeholder:font-theme-content"
                placeholder="Masukkan Nama Pengguna Anda"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[15px] font-extrabold text-green-50 ml-1 font-theme-content" style={{ letterSpacing: '0.05em' }}>Kata Sandi</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-green-200" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs placeholder-green-200/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all font-theme-content placeholder:font-theme-content"
                  placeholder="Masukkan Kata Sandi Anda"
                  required
                />
              </div>
              {webAuthnSupported && (
                <button
                  type="button"
                  onClick={handleWebAuthnLogin}
                  disabled={loading}
                  className="flex-shrink-0 w-[52px] flex flex-col items-center justify-center bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent group"
                  title="Login dengan Sidik Jari / Biometrik"
                >
                  <Fingerprint className="h-6 w-6 text-white group-hover:text-green-200 transition-colors" />
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-white text-green-800 font-bold rounded-xl hover:bg-green-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-green-800 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center font-theme-content"
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-green-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 text-center font-theme-content">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/50 text-xs select-none bg-green-800/80 px-2 rounded font-theme-content">atau</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-3 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/15 border border-white/20 text-white/80 hover:text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50 font-theme-content"
          >
            <User className="h-4 w-4" />
            Masuk sebagai Tamu
          </button>
          <p className="text-[10px] text-green-200/60 mt-2 font-theme-content">Tamu hanya dapat melihat struktur menu tanpa akses data</p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-green-200 font-theme-content">
            &copy; {new Date().getFullYear()} PP. Matholi'ul Anwar
          </p>
        </div>
      </div>
    </div>
  );
}
