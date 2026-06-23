'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, CalendarDays, Clock, Fingerprint } from 'lucide-react';
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
            <span className="font-cairo text-xl md:text-2xl mt-1 tracking-wide font-bold" dir="rtl">{getHijriDate(currentTime)}</span>
          </div>
          <div className="flex justify-center items-center gap-2 text-green-100 text-xs md:text-sm mt-1">
            <span>{getMasehiDate(currentTime)}</span>
            <span className="text-white/50">|</span>
            <span className="font-mono">{getTime(currentTime)}</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 animate-[fadeIn_0.6s_ease-out]">
        <div className="text-center mb-8">
          <div className="bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl h-32 w-32 md:h-40 md:w-40 p-4 md:p-5 animate-[slideDown_0.8s_ease-out]">
            <img src="/logo.png" alt="Logo PPMA" className="h-[85%] w-[85%] object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide animate-[fadeIn_1s_ease-out]">Sistem Absensi</h1>
          <p className="text-green-100 text-sm mt-1 animate-[fadeIn_1.2s_ease-out]">Pondok Pesantren Matholi'ul Anwar</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-white px-4 py-3 rounded-lg mb-6 text-sm backdrop-blur-sm animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-green-50 ml-1">Username / NIP</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-green-200" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-green-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                placeholder="Masukkan username Anda"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-green-50 ml-1">Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-green-200" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-green-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                  placeholder="Masukkan password Anda"
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
            className="w-full py-3.5 bg-white text-green-800 font-bold rounded-xl hover:bg-green-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-green-800 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-green-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Masuk'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-green-200">
            &copy; {new Date().getFullYear()} PP. Matholi'ul Anwar
          </p>
        </div>
      </div>
    </div>
  );
}
