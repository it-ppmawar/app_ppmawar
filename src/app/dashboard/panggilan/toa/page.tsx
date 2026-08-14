'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Volume2, Wifi, WifiOff, CheckCircle2, Megaphone, Settings,
  VolumeX, Play, Mic2, Layers, RefreshCw, AlertCircle, Radio,
  ChevronUp, ChevronDown, X, Sparkles, ArrowLeft, Zap, Home,
} from 'lucide-react';

interface Panggilan {
  id: number;
  santri_nama: string;
  santri_nama_panggilan?: string;
  nama_kamar?: string;
  nama_asrama?: string;
  teks_panggilan: string;
  tujuan?: string;
  pengulangan?: number;
  bahasa?: string;          // 'id' | 'ar' | 'jv' | 'en'
  jenis_suara?: string;     // 'pria' | 'wanita' | 'auto'
  volume?: number;
  rate?: number;
  status?: string;
}

const LS_VOICE_KEY = 'toa_voice_preset';

// ─── AudioContext Singleton ──────────────────────────────────────────────────
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!(window as any).__toa_audio_ctx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      (window as any).__toa_audio_ctx = new AudioCtx();
    }
  }
  const ctx: AudioContext = (window as any).__toa_audio_ctx;
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx || null;
}

// ─── Universal Male Voice TTS Player ──────────────────────────────────────────
async function playTTS(
  text: string,
  lang: string = 'id',
  jenisSuara: string = 'pria', // Default: Suara Pria Murni
  volume: number = 1.0,
  rate: number = 0.88
): Promise<void> {
  const isArabic = /[\u0600-\u06FF]/.test(text);
  const targetLang = isArabic ? 'ar' : (lang === 'ar' || lang === 'en' || lang === 'jv') ? lang : 'id';

  // 1. Primary Engine: Server-side TTS Proxy via Web Audio API
  try {
    const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(targetLang)}`;
    const response = await fetch(ttsUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    const ctx = getAudioContext();
    if (!ctx) throw new Error('AudioContext null');

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = Math.max(0.5, Math.min(rate, 1.5));

    // Tuning Pria Murni (-180 cents = natural masculine tone tanpa distorsi)
    source.detune.value = (jenisSuara === 'wanita') ? +200 : -180;

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start(0);
    });
  } catch (err) {
    console.warn('[playTTS] Proxy failed, falling back to WebSpeech:', err);

    // 2. Fallback Engine: Web Speech API (Pilih Voice Pack Pria Murni)
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = targetLang === 'ar' ? 'ar-SA' : targetLang === 'en' ? 'en-US' : targetLang === 'jv' ? 'jv-ID' : 'id-ID';
      utter.rate = rate;
      utter.volume = volume;
      utter.pitch = (jenisSuara === 'wanita') ? 1.15 : 0.85;

      const voices = window.speechSynthesis.getVoices();
      const maleKw = ['andika', 'male', 'man', 'laki', 'idm', 'wavenet-b', 'wavenet-d', 'standard-b', 'standard-d'];
      const femaleKw = ['female', 'woman', 'perempuan', 'wanita', 'wavenet-a', 'wavenet-c', 'wavenet-e', 'wavenet-f', 'standard-a', 'standard-c', 'standard-e', 'standard-f', 'zira', 'yuna', 'kyoko'];
      const candidates = voices.filter(v => v.lang.toLowerCase().startsWith(targetLang));
      if (candidates.length > 0) {
        if (jenisSuara === 'wanita') {
          const femaleVoice = candidates.find(v => femaleKw.some(kw => v.name.toLowerCase().includes(kw)));
          if (femaleVoice) utter.voice = femaleVoice;
        } else {
          const maleVoice = candidates.find(v => maleKw.some(kw => v.name.toLowerCase().includes(kw)));
          if (maleVoice) utter.voice = maleVoice;
        }
      }

      let finished = false;
      const done = () => { if (!finished) { finished = true; resolve(); } };
      utter.onend = done;
      utter.onerror = done;
      window.speechSynthesis.speak(utter);
      setTimeout(done, 20000);
    });
  }
}

// ─── Audio Queue Manager dengan Deduplikasi Presisi ───────────────────────────
class AudioQueue {
  private queue: Panggilan[] = [];
  private processedIds = new Set<number>();
  private playing = false;
  private onStart?: (p: Panggilan) => void;
  private onEnd?: (p: Panggilan) => void;
  private onQueueChange?: (count: number) => void;

  constructor(cbs: { onStart: (p: Panggilan) => void; onEnd: (p: Panggilan) => void; onQueueChange: (count: number) => void }) {
    this.onStart = cbs.onStart; this.onEnd = cbs.onEnd; this.onQueueChange = cbs.onQueueChange;
  }

  push(p: Panggilan) {
    // Cegah duplikasi panggilan yang sama diputar berulang kali
    if (p.id !== -1 && this.processedIds.has(p.id)) {
      console.log(`[AudioQueue] Ignored duplicate call id=${p.id}`);
      return;
    }

    if (p.id !== -1) {
      this.processedIds.add(p.id);
      // Bersihkan cache lama jika sudah terlalu banyak (> 100 items)
      if (this.processedIds.size > 100) {
        const oldestId = Array.from(this.processedIds)[0];
        this.processedIds.delete(oldestId);
      }
    }

    this.queue.push(p);
    this.onQueueChange?.(this.queue.length);
    if (!this.playing) this.processNext();
  }

  get count() { return this.queue.length; }
  get isPlaying() { return this.playing; }

  private async processNext() {
    if (this.queue.length === 0) { this.playing = false; return; }
    this.playing = true;
    const p = this.queue.shift()!;
    this.onQueueChange?.(this.queue.length);
    this.onStart?.(p);
    try { await this.playItem(p); } catch (e) { console.warn('[AudioQueue]', e); }
    this.onEnd?.(p);
    await new Promise(r => setTimeout(r, 1200));
    this.processNext();
  }

  private async playItem(p: Panggilan): Promise<void> {
    const repeat = Math.max(1, Math.min(p.pengulangan ?? 1, 5));
    const reqBahasa = p.bahasa || 'id';
    const reqJenis  = p.jenis_suara || 'pria'; // Selalu sinkron dari sender (Pria Murni)

    const vol  = p.volume ?? ((window as any).__toa_volume ?? 1.0);
    const rate = p.rate   ?? ((window as any).__toa_rate   ?? 0.88);

    for (let i = 0; i < repeat; i++) {
      await playTTS(p.teks_panggilan, reqBahasa, reqJenis, vol, rate);
      if (i < repeat - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }

  clear() {
    this.queue = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.playing = false;
    this.onQueueChange?.(0);
  }
}

// ─── Main TOA Component ───────────────────────────────────────────────────────
function TOAContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const asramaParam  = searchParams.get('asrama') || '';

  const [asrama, setAsrama] = useState(asramaParam);

  // ── Auth & Role Check ─────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole]       = useState('');
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success) { router.replace('/dashboard'); return; }
      const role: string = d.user?.role || '';
      const asrm: string = d.user?.asrama || '';
      const allowed = ['admin', 'staff', 'petugas_panggilan'].some(r => role.includes(r));
      if (!allowed) { router.replace('/dashboard'); return; }
      if (asrm && !asramaParam) setAsrama(asrm);
      setUserRole(role);
      setAuthChecked(true);
    }).catch(() => router.replace('/dashboard'));
  }, [router, asramaParam]);

  const isPetugasOnly = userRole.includes('petugas_panggilan') && !['admin', 'staff'].some(r => userRole.includes(r));

  // ── GATING ────────────────────────────────────────────────────────────────
  const [sessionStarted, setSessionStarted] = useState(false);
  const pendingQueueRef = useRef<Panggilan[]>([]);

  const [connected,        setConnected]        = useState(false);
  const [reconnecting,     setReconnecting]     = useState(false);
  const [currentPanggilan, setCurrentPanggilan] = useState<Panggilan | null>(null);
  const [queueCount,       setQueueCount]       = useState(0);
  const [history,          setHistory]          = useState<Array<{ id: number; nama: string; waktu: string; asrama?: string }>>([]);
  const [muted,            setMuted]            = useState(false);
  const [showSettings,     setShowSettings]     = useState(false);
  const [showHistory,      setShowHistory]      = useState(false);
  const [connectionError,  setConnectionError]  = useState('');
  const [totalToday,       setTotalToday]       = useState(0);
  const [pendingCount,     setPendingCount]     = useState(0);

  // Format list untuk Tes Audio Sistem bergilir
  const [formatList, setFormatList] = useState<Array<{ nama: string; bahasa: string; jenis_suara: string; template: string }>>([]);
  const testIndexRef = useRef(0);

  // Daftar asrama dari petugas panggilan (untuk dropdown)
  const [asramaList, setAsramaList] = useState<string[]>([]);

  // Audio Settings
  const [volume, setVolume] = useState(1.0);
  const [rate,   setRate]   = useState(0.88);
  const [selectedVoice, setSelectedVoice] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(LS_VOICE_KEY) || '' : ''
  );

  const audioQueueRef       = useRef<AudioQueue | null>(null);
  const sseRef              = useRef<EventSource | null>(null);
  const reconnectTimerRef   = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef       = useRef(0);
  const deviceIdRef         = useRef(`toa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const heartbeatRef        = useRef<NodeJS.Timeout | null>(null);
  const mutedRef            = useRef(false);
  const sessionStartedRef   = useRef(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { sessionStartedRef.current = sessionStarted; }, [sessionStarted]);

  useEffect(() => {
    (window as any).__toa_volume = muted ? 0 : volume;
    (window as any).__toa_rate   = rate;
    (window as any).__toa_voice  = selectedVoice;
    localStorage.setItem(LS_VOICE_KEY, selectedVoice);
  }, [volume, rate, selectedVoice, muted]);

  // Fetch format list untuk tes audio bergilir
  useEffect(() => {
    fetch('/api/panggilan/format').then(r => r.json()).then(d => {
      if (d.success && d.data.length > 0) setFormatList(d.data);
    }).catch(() => {});
  }, []);

  // Fetch daftar asrama dari akun petugas_panggilan
  useEffect(() => {
    fetch('/api/users?role=petugas_panggilan').then(r => r.json()).then(d => {
      if (d.success && d.data) {
        const asramas: string[] = [];
        d.data.forEach((u: any) => {
          const a = u.asrama || u.nama_asrama || '';
          if (a && !asramas.includes(a)) asramas.push(a);
        });
        setAsramaList(asramas.sort());
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    audioQueueRef.current = new AudioQueue({
      onStart: (p) => setCurrentPanggilan(p),
      onEnd:   (p) => {
        setCurrentPanggilan(null);
        setTotalToday(prev => prev + 1);
        setHistory(prev => [
          { id: p.id, nama: p.santri_nama, waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), asrama: p.nama_asrama },
          ...prev.slice(0, 29),
        ]);
        if (p.id !== -1) {
          fetch(`/api/panggilan/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'selesai' }),
          }).catch(() => {});
        }
      },
      onQueueChange: (count) => setQueueCount(count),
    });

    const sendHeartbeat = () => {
      fetch('/api/panggilan/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceIdRef.current, nama_asrama: asramaParam || null }),
      }).catch(() => {});
    };
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, []);

  const connectSSE = useCallback(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setReconnecting(retryCountRef.current > 0);
    setConnectionError('');

    const url = `/api/panggilan/stream?device_id=${deviceIdRef.current}${asrama ? `&asrama=${encodeURIComponent(asrama)}` : ''}`;
    const es  = new EventSource(url);
    sseRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true); setReconnecting(false); setConnectionError(''); retryCountRef.current = 0;
    });

    es.addEventListener('panggilan', (e) => {
      try {
        const p: Panggilan = JSON.parse((e as MessageEvent).data);
        if (!sessionStartedRef.current) {
          pendingQueueRef.current.push(p);
          setPendingCount(prev => prev + 1);
          return;
        }
        if (mutedRef.current) {
          setHistory(prev => [
            { id: p.id, nama: p.santri_nama, waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
            ...prev.slice(0, 29),
          ]);
          if (p.id !== -1) {
            fetch(`/api/panggilan/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'selesai' }) }).catch(() => {});
          }
          return;
        }
        audioQueueRef.current?.push(p);
      } catch (_) {}
    });

    es.onerror = () => {
      setConnected(false); es.close(); sseRef.current = null;
      retryCountRef.current++;
      const delay = Math.min(2000 * Math.pow(1.5, retryCountRef.current - 1), 30000);
      setConnectionError(`Koneksi terputus. Reconnect dalam ${Math.round(delay / 1000)}s...`);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(connectSSE, delay);
    };
  }, [asrama]);

  useEffect(() => {
    if (!sessionStarted || !authChecked) return;
    connectSSE();
    return () => {
      sseRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [sessionStarted, authChecked, asrama]);

  const handleStartSession = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx) {
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
      const warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0.001;
      window.speechSynthesis.speak(warm);
    }

    setSessionStarted(true);
    sessionStartedRef.current = true;

    setTimeout(() => {
      const pending = [...pendingQueueRef.current];
      pendingQueueRef.current = [];
      setPendingCount(0);
      pending.forEach(p => audioQueueRef.current?.push(p));
    }, 400);
  }, []);

  const handleTest = () => {
    getAudioContext();
    if (formatList.length > 0) {
      // Bergilir urut sesuai format list, loop balik ke awal jika sudah habis
      const idx = testIndexRef.current % formatList.length;
      const fmt = formatList[idx];
      testIndexRef.current = idx + 1;
      const preview = (fmt.template || 'Sistem panggilan santri siap digunakan.')
        .replace(/{nama}/g, 'Ahmad Fauzi')
        .replace(/{kamar}/g, 'Kamar Al-Ikhlas')
        .replace(/{asrama}/g, 'Asrama A')
        .replace(/{tujuan}/g, 'kantor pengurus')
        .replace(/{teks}/g, 'Harap segera hadir.');
      audioQueueRef.current?.push({
        id: -1, santri_nama: `Tes — ${fmt.nama}`,
        teks_panggilan: preview,
        pengulangan: 1,
        bahasa: fmt.bahasa || 'id',
        jenis_suara: fmt.jenis_suara || 'pria',
      });
    } else {
      // Fallback jika format belum dimuat
      audioQueueRef.current?.push({
        id: -1, santri_nama: 'Tes Sistem',
        teks_panggilan: 'Assalamualaikum warahmatullahi wabarakatuh. Sistem panggilan santri siap digunakan.',
        pengulangan: 1, bahasa: 'id', jenis_suara: 'pria',
      });
    }
  };

  const handleClearQueue = () => { audioQueueRef.current?.clear(); setCurrentPanggilan(null); };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── GATE SCREEN ────────────────────────────────────────────────────────────
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col select-none">
        <div className="px-5 pt-4 pb-3 border-b border-white/10 bg-white/5 text-center">
          <h1 className="font-black text-base">Sistem TOA — PPMA</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{asrama ? `Asrama: ${asrama}` : 'Semua Asrama'}</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="relative w-28 h-28 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Megaphone size={44} className="text-orange-400" />
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <h2 className="text-2xl font-black">Siap Memulai Sesi TOA</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Ketuk tombol di bawah untuk mengaktifkan speaker dan mulai menerima panggilan. Ini diperlukan agar suara dapat berbunyi di perangkat Anda.
            </p>
            {pendingCount > 0 && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-amber-400 text-xs font-bold animate-pulse">
                <Layers size={13} />
                {pendingCount} panggilan menunggu untuk diputar
              </div>
            )}
          </div>

          <button
            onClick={handleStartSession}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-lg rounded-2xl shadow-2xl shadow-orange-500/30 active:scale-95 transition-all"
          >
            <Zap size={22} />
            Mulai Sesi TOA
          </button>

          {/* Sembunyikan tombol Kembali jika akun petugas_panggilan */}
          {!isPetugasOnly && (
            <Link href="/dashboard/panggilan"
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs transition-colors">
              <ArrowLeft size={13} /> Kembali ke Panggilan Santri
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN TOA UI ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col select-none overflow-hidden">

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="px-5 pt-3.5 pb-1 text-center">
          <h1 className="font-black text-base leading-tight">Sistem TOA — PPMA</h1>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">
            {asrama ? `Asrama: ${asrama}` : 'Semua Asrama'} &nbsp;·&nbsp; {totalToday} panggilan hari ini
          </div>
        </div>

        <div className="px-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Hanya tampilkan tombol Kembali untuk admin/staff */}
            {!isPetugasOnly ? (
              <Link href="/dashboard/panggilan"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 border border-white/10 flex items-center gap-1 text-xs font-bold transition-colors">
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Kembali</span>
              </Link>
            ) : (
              <Link href="/dashboard"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 border border-white/10 flex items-center gap-1 text-xs font-bold transition-colors">
                <Home size={14} />
              </Link>
            )}

            <div className={`p-2 rounded-xl ${connected ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <Radio size={14} className={connected ? 'text-emerald-400' : 'text-red-400'} />
            </div>
            <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
              connected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
              : reconnecting ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20 animate-pulse'
              : 'bg-red-500/20 text-red-400 border border-red-500/20'
            }`}>
              {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
              {connected ? 'Online' : reconnecting ? 'Reconnecting...' : 'Offline'}
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            {queueCount > 0 ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/20 animate-pulse">
                <Layers size={11} /> {queueCount} antrian
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] text-gray-600 border border-white/5">
                {connected ? '✓ Siap' : '—'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setMuted(!muted)} title={muted ? 'Aktifkan audio' : 'Matikan audio'}
              className={`p-2 rounded-xl transition-colors ${muted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}>
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}>
              <Settings size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Action Bar: Tes Audio & Reconnect (Presisi Ukuran Sama & Rata Tengah) ─── */}
      <div className="px-5 py-2.5 bg-white/5 border-b border-white/10 grid grid-cols-2 gap-2.5 max-w-sm mx-auto w-full">
        <button
          onClick={handleTest}
          className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-orange-500/20 active:scale-95 transition-all text-center"
        >
          <Play size={14} /> Tes Audio Sistem
        </button>
        <button
          onClick={connectSSE}
          className="flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/20 text-gray-300 font-bold rounded-xl text-xs border border-white/10 active:scale-95 transition-all text-center"
        >
          <RefreshCw size={14} /> Reconnect
        </button>
      </div>

      {connectionError && (
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-amber-400 text-xs">
          <AlertCircle size={13} className="shrink-0" />
          <span>{connectionError}</span>
          <button onClick={connectSSE} className="ml-auto flex items-center gap-1 font-bold hover:text-amber-300">
            <RefreshCw size={11} /> Reconnect
          </button>
        </div>
      )}

      {/* ─── Settings Panel (Tombol Bersihkan Antrian Rata Tengah) ─── */}
      {showSettings && (
        <div className="bg-gray-900/90 border-b border-white/10 px-5 py-4 space-y-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Sparkles size={14} className="text-orange-400"/> Pengaturan Audio</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-300"><X size={16}/></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block font-bold uppercase tracking-wide">Filter Asrama</label>
              <select
                value={asrama}
                onChange={e => setAsrama(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none"
              >
                <option value="">Semua Asrama</option>
                {asramaList.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="px-3.5 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs flex items-center gap-2">
                <Sparkles size={15} className="shrink-0 text-orange-400" />
                <span>
                  <strong>Sinkron Otomatis:</strong> Volume, kecepatan, dan cengkok pengisi suara (Indonesia, Arab Fasih, Jawa, Inggris) 100% diatur dan disesuaikan dari perangkat pengirim panggilan.
                </span>
              </div>
            </div>
          </div>

          {/* Tombol Bersihkan Antrian: RATA TENGAH (Foto 2) */}
          {(queueCount > 0 || currentPanggilan) && (
            <div className="flex justify-center pt-2">
              <button onClick={handleClearQueue}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-bold border border-red-500/30 active:scale-95 transition-all shadow-sm">
                <X size={14} /> Bersihkan Antrian
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
        {currentPanggilan ? (
          <div className="w-full max-w-lg space-y-6 animate-[fadeIn_0.3s_ease]">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-widest animate-pulse">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" /> Dibacakan
            </div>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 border border-orange-500/20 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-1 mb-4">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <span key={i} className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">{currentPanggilan.santri_nama}</h2>
                {currentPanggilan.nama_kamar && (
                  <p className="text-sm text-orange-400 font-semibold mb-4">
                    {currentPanggilan.nama_kamar} {currentPanggilan.nama_asrama ? `· ${currentPanggilan.nama_asrama}` : ''}
                  </p>
                )}
                <p className="text-sm text-gray-300 italic font-mono bg-black/30 p-4 rounded-xl border border-white/5 leading-relaxed" dir={currentPanggilan.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                  "{currentPanggilan.teks_panggilan}"
                </p>
              </div>
            </div>
            {queueCount > 0 && (
              <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
                <Layers size={13} className="text-orange-400" />
                <span className="text-orange-400 font-bold">{queueCount}</span> panggilan berikutnya
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-md space-y-5">
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full ${connected ? 'bg-emerald-500/10 animate-ping' : 'bg-red-500/10'}`} style={{ animationDuration: '3s' }} />
              <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                <Megaphone size={36} />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-200">{connected ? 'Siap Menerima Panggilan' : 'Terputus dari Server'}</h2>
              <p className="text-gray-500 text-sm max-w-xs mx-auto mt-1">
                {connected ? `Sistem aktif${asrama ? ` untuk ${asrama}` : ''}. Menunggu panggilan.` : 'Periksa koneksi internet.'}
              </p>
            </div>
            {connected && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-400">{totalToday}</div>
                  <div className="text-xs text-gray-500">Panggilan hari ini</div>
                </div>
                <div className="w-px h-8 bg-gray-700" />
                <div className="text-center">
                  <div className="text-2xl font-black text-orange-400">{queueCount}</div>
                  <div className="text-xs text-gray-500">Dalam antrian</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── History Panel ────────────────────────────────────────────── */}
      <div className="border-t border-white/10 bg-black/30 backdrop-blur-sm">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors">
          <span className="flex items-center gap-2 font-bold"><Mic2 size={12} className="text-orange-400" /> Riwayat Panggilan ({history.length})</span>
          {showHistory ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {showHistory && history.length > 0 && (
          <div className="px-5 pb-4 space-y-2 max-h-48 overflow-y-auto">
            {history.map((h, idx) => (
              <div key={`${h.id}-${idx}`} className="flex items-center justify-between bg-gray-900/80 border border-white/10 px-4 py-2.5 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-gray-200 truncate">{h.nama}</span>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0 ml-2">{h.waktu}{h.asrama ? ` · ${h.asrama}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

export default function TOAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
      </div>
    }>
      <TOAContent />
    </Suspense>
  );
}
