'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Volume2, Wifi, WifiOff, CheckCircle2, Megaphone, Clock, Settings,
  VolumeX, Play, Mic2, Layers, RefreshCw, AlertCircle, Zap, Radio,
  ChevronUp, ChevronDown, X, Sparkles,
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
  status?: string;
}

// ─── Voice Engine Types ────────────────────────────────────────────────────
type VoiceEngine = 'browser' | 'google';

// ─── Audio Queue Manager ──────────────────────────────────────────────────
// FIFO queue yang aman dan tidak akan crash meski banyak panggilan serentak
class AudioQueue {
  private queue: Panggilan[] = [];
  private playing = false;
  private onStart?: (p: Panggilan) => void;
  private onEnd?: (p: Panggilan) => void;
  private onQueueChange?: (count: number) => void;

  constructor(callbacks: {
    onStart: (p: Panggilan) => void;
    onEnd: (p: Panggilan) => void;
    onQueueChange: (count: number) => void;
  }) {
    this.onStart = callbacks.onStart;
    this.onEnd = callbacks.onEnd;
    this.onQueueChange = callbacks.onQueueChange;
  }

  push(p: Panggilan) {
    this.queue.push(p);
    this.onQueueChange?.(this.queue.length);
    if (!this.playing) this.processNext();
  }

  get count() { return this.queue.length; }
  get isPlaying() { return this.playing; }

  private async processNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      return;
    }
    this.playing = true;
    const p = this.queue.shift()!;
    this.onQueueChange?.(this.queue.length);
    this.onStart?.(p);

    try {
      await this.playItem(p);
    } catch (e) {
      console.error('[AudioQueue] Play error:', e);
    }

    this.onEnd?.(p);
    // Jeda antar panggilan (1.5 detik)
    await new Promise(r => setTimeout(r, 1500));
    this.processNext();
  }

  private playItem(p: Panggilan): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return resolve();
      }

      const repeat = Math.max(1, Math.min(p.pengulangan || 2, 5));
      let count = 0;

      window.speechSynthesis.cancel();

      const sayOnce = () => {
        const utter = new SpeechSynthesisUtterance(p.teks_panggilan);
        utter.lang = 'id-ID';
        utter.rate = (window as any).__toa_rate ?? 0.88;
        utter.volume = (window as any).__toa_volume ?? 1.0;
        utter.pitch = 1.0;

        // Pilih suara jika ada
        const voiceName = (window as any).__toa_voice;
        if (voiceName) {
          const voice = window.speechSynthesis.getVoices().find(v => v.name === voiceName);
          if (voice) utter.voice = voice;
        }

        utter.onend = () => {
          count++;
          if (count < repeat) {
            setTimeout(sayOnce, 900);
          } else {
            resolve();
          }
        };
        utter.onerror = () => resolve();

        window.speechSynthesis.speak(utter);
      };

      sayOnce();
    });
  }

  clear() {
    this.queue = [];
    window.speechSynthesis?.cancel();
    this.playing = false;
    this.onQueueChange?.(0);
  }
}

// ─── Main Component ────────────────────────────────────────────────────────
function TOAContent() {
  const searchParams = useSearchParams();
  const asramaParam = searchParams.get('asrama') || '';

  const [asrama, setAsrama] = useState(asramaParam);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [currentPanggilan, setCurrentPanggilan] = useState<Panggilan | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [history, setHistory] = useState<Array<{ id: number; nama: string; waktu: string; asrama?: string }>>([]);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [totalToday, setTotalToday] = useState(0);

  // Audio Settings
  const [volume, setVolume] = useState(1.0);
  const [rate, setRate] = useState(0.88);
  const [voiceList, setVoiceList] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voiceEngine] = useState<VoiceEngine>('browser');

  const audioQueueRef = useRef<AudioQueue | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const deviceIdRef = useRef(`toa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Sync audio settings ke global vars (diakses oleh AudioQueue)
  useEffect(() => {
    (window as any).__toa_volume = muted ? 0 : volume;
    (window as any).__toa_rate = rate;
    (window as any).__toa_voice = selectedVoice;
  }, [volume, rate, selectedVoice, muted]);

  // Init AudioQueue
  useEffect(() => {
    audioQueueRef.current = new AudioQueue({
      onStart: (p) => setCurrentPanggilan(p),
      onEnd: (p) => {
        setCurrentPanggilan(null);
        setTotalToday(prev => prev + 1);
        setHistory(prev => [
          { id: p.id, nama: p.santri_nama, waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), asrama: p.nama_asrama },
          ...prev.slice(0, 29),
        ]);
        // Update status ke 'selesai' di server
        fetch(`/api/panggilan/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'selesai' }),
        }).catch(() => {});
      },
      onQueueChange: (count) => setQueueCount(count),
    });

    // ─── Heartbeat: kirim ke server setiap 30 detik ─────────────────────
    const sendHeartbeat = () => {
      fetch('/api/panggilan/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceIdRef.current,
          nama_asrama: asramaParam || null,
        }),
      }).catch(() => {}); // non-fatal
    };
    sendHeartbeat(); // kirim langsung saat pertama buka
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoiceList(voices);
      const idVoice = voices.find(v => v.lang.startsWith('id') && !v.name.includes('Google')) ||
                      voices.find(v => v.lang.startsWith('id'));
      if (idVoice && !selectedVoice) setSelectedVoice(idVoice.name);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  // SSE Connection dengan auto-reconnect exponential backoff
  const connectSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    setReconnecting(retryCountRef.current > 0);
    setConnectionError('');

    const deviceId = `toa_${asrama || 'all'}_${Date.now()}`;
    const url = `/api/panggilan/stream?device_id=${deviceId}${asrama ? `&asrama=${encodeURIComponent(asrama)}` : ''}`;

    const es = new EventSource(url);
    sseRef.current = es;

    es.addEventListener('connected', (e) => {
      setConnected(true);
      setReconnecting(false);
      setConnectionError('');
      retryCountRef.current = 0;
    });

    es.addEventListener('panggilan', (e) => {
      try {
        const p: Panggilan = JSON.parse((e as MessageEvent).data);
        if (!muted) {
          audioQueueRef.current?.push(p);
        } else {
          // Meskipun muted, tetap update history tapi tandai sebagai selesai
          setHistory(prev => [
            { id: p.id, nama: p.santri_nama, waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
            ...prev.slice(0, 29),
          ]);
          fetch(`/api/panggilan/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'selesai' }),
          }).catch(() => {});
        }
      } catch (_) {}
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      sseRef.current = null;

      // Exponential backoff: 2s, 4s, 8s, max 30s
      retryCountRef.current++;
      const delay = Math.min(2000 * Math.pow(1.5, retryCountRef.current - 1), 30000);
      setConnectionError(`Koneksi terputus. Mencoba ulang dalam ${Math.round(delay / 1000)}s...`);

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(connectSSE, delay);
    };
  }, [asrama, muted]);

  // Connect saat mount dan saat asrama berubah
  useEffect(() => {
    connectSSE();
    return () => {
      sseRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [asrama]);

  const handleTest = () => {
    const testPanggilan: Panggilan = {
      id: -1,
      santri_nama: 'Tes Sistem',
      teks_panggilan: 'Tes sistem panggilan. Assalamualaikum warahmatullahi wabarakatuh. Sistem panggilan santri siap digunakan.',
      pengulangan: 1,
    };
    audioQueueRef.current?.push(testPanggilan);
  };

  const handleClearQueue = () => {
    audioQueueRef.current?.clear();
    setCurrentPanggilan(null);
  };

  // Animasi wave bars saat speaking
  const waveCount = 12;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col select-none overflow-hidden">
      
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors ${connected ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
            <Radio size={18} className={connected ? 'text-emerald-400' : 'text-red-400'} />
          </div>
          <div>
            <h1 className="font-black text-base leading-tight">Sistem TOA — PPMA</h1>
            <p className="text-[11px] text-gray-400">
              {asrama ? `Asrama: ${asrama}` : 'Semua Asrama'} · {totalToday} panggilan hari ini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Status Koneksi */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all ${
            connected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
            : reconnecting ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20 animate-pulse'
            : 'bg-red-500/20 text-red-400 border border-red-500/20'
          }`}>
            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {connected ? 'Online' : reconnecting ? 'Reconnecting...' : 'Offline'}
          </div>

          {/* Antrian */}
          {queueCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/20">
              <Layers size={11} />
              {queueCount} antrian
            </div>
          )}

          <button onClick={() => setMuted(!muted)} title={muted ? 'Aktifkan audio' : 'Matikan audio'}
            className={`p-2 rounded-xl transition-colors ${muted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* ─── Error Banner ─────────────────────────────────────────────── */}
      {connectionError && (
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-amber-400 text-xs">
          <AlertCircle size={13} className="shrink-0" />
          <span>{connectionError}</span>
          <button onClick={connectSSE} className="ml-auto flex items-center gap-1 font-bold hover:text-amber-300">
            <RefreshCw size={11} /> Reconnect
          </button>
        </div>
      )}

      {/* ─── Settings Panel ───────────────────────────────────────────── */}
      {showSettings && (
        <div className="bg-gray-900/90 border-b border-white/10 px-5 py-4 space-y-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Sparkles size={14} className="text-orange-400"/> Pengaturan Audio</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-300"><X size={16}/></button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Filter Asrama */}
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block font-bold uppercase tracking-wide">Filter Asrama</label>
              <input type="text" value={asrama} onChange={e => setAsrama(e.target.value)}
                placeholder="Kosongkan = semua asrama"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Voice Selection */}
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block font-bold uppercase tracking-wide">Suara (Voice AI)</label>
              <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none">
                <option value="">— Default Browser —</option>
                {voiceList.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang}){v.localService ? ' 📶' : ' ☁️'}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-0.5">📶 = offline · ☁️ = cloud AI</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Volume */}
            <div>
              <label className="text-[11px] text-gray-400 mb-2 block font-bold uppercase tracking-wide">
                Volume: <span className="text-orange-400">{Math.round(volume * 100)}%</span>
              </label>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-full accent-orange-500" />
            </div>

            {/* Kecepatan */}
            <div>
              <label className="text-[11px] text-gray-400 mb-2 block font-bold uppercase tracking-wide">
                Kecepatan: <span className="text-orange-400">{rate}×</span>
              </label>
              <input type="range" min={0.6} max={1.3} step={0.05} value={rate}
                onChange={e => setRate(parseFloat(e.target.value))}
                className="w-full accent-orange-500" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleTest}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-xs font-bold transition-colors border border-orange-500/20">
              <Play size={13} /> Tes Audio
            </button>
            <button onClick={connectSSE}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-bold transition-colors border border-blue-500/20">
              <RefreshCw size={13} /> Reconnect
            </button>
            {(queueCount > 0 || currentPanggilan) && (
              <button onClick={handleClearQueue}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-bold transition-colors border border-red-500/20 ml-auto">
                <X size={13} /> Bersihkan Antrian
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Main Display ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        
        {/* Background pulse effect saat speaking */}
        {currentPanggilan && (
          <div className="absolute inset-0 bg-orange-500/5 animate-pulse pointer-events-none rounded-full blur-3xl" />
        )}

        {currentPanggilan ? (
          /* ── SPEAKING STATE ─────────────────────────────────────────── */
          <div className="text-center max-w-2xl w-full animate-[fadeIn_0.3s_ease]">
            
            {/* Wave visualizer */}
            <div className="flex items-end justify-center gap-[3px] mb-8 h-14">
              {Array.from({ length: waveCount }).map((_, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-t from-orange-600 to-amber-400 rounded-full w-1.5"
                  style={{
                    height: `${20 + Math.abs(Math.sin(i * 0.7)) * 36}px`,
                    animation: `bounce ${0.5 + i * 0.04}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.06}s`,
                  }}
                />
              ))}
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 border border-orange-500/20 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
              {/* Glow effect */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                  <span className="text-orange-400 text-xs font-black uppercase tracking-widest">Dibacakan</span>
                </div>

                <h2 className="text-4xl font-black text-white mb-2 leading-tight">{currentPanggilan.santri_nama}</h2>
                
                {currentPanggilan.nama_kamar && (
                  <p className="text-gray-400 text-sm mb-5 flex items-center justify-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs">{currentPanggilan.nama_kamar}</span>
                    {currentPanggilan.nama_asrama && (
                      <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs">{currentPanggilan.nama_asrama}</span>
                    )}
                  </p>
                )}

                <p className="text-lg text-gray-100 leading-relaxed font-medium italic">
                  "{currentPanggilan.teks_panggilan}"
                </p>

                {currentPanggilan.tujuan && (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 rounded-full text-orange-300 text-sm font-bold border border-orange-500/20">
                    <Zap size={13} /> Tujuan: {currentPanggilan.tujuan}
                  </div>
                )}
              </div>
            </div>

            {/* Queue badge */}
            {queueCount > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
                <Layers size={14} className="text-orange-400" />
                <span><strong className="text-orange-400">{queueCount}</strong> panggilan berikutnya dalam antrian</span>
              </div>
            )}
          </div>

        ) : (
          /* ── IDLE STATE ─────────────────────────────────────────────── */
          <div className="text-center">
            <div className={`relative w-36 h-36 mx-auto mb-6`}>
              {/* Outer glow ring */}
              {connected && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full border border-emerald-500/10 animate-pulse" />
                </>
              )}
              <div className={`w-full h-full rounded-full flex items-center justify-center ${
                connected ? 'bg-emerald-500/10 border-2 border-emerald-500/20' : 'bg-gray-800 border-2 border-gray-700'
              }`}>
                <Megaphone size={52} className={connected ? 'text-emerald-400' : 'text-gray-600'} />
              </div>
            </div>

            <h2 className="text-3xl font-black mb-2 text-gray-200">
              {reconnecting ? 'Menghubungkan...' : connected ? 'Siap Menerima' : 'Koneksi Terputus'}
            </h2>
            <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
              {connected
                ? `Sistem aktif${asrama ? ` untuk ${asrama}` : ''}. Menunggu panggilan dari pengasuh atau wali santri.`
                : 'Periksa koneksi internet dan server.'}
            </p>

            {connected && (
              <div className="mt-6 flex items-center justify-center gap-4">
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

            {/* Quick test button */}
            {connected && (
              <button onClick={handleTest}
                className="mt-6 flex items-center gap-2 mx-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 font-medium transition-colors">
                <Play size={14} className="text-orange-400" /> Tes Suara
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── History Panel ────────────────────────────────────────────── */}
      <div className="border-t border-white/10 bg-black/30 backdrop-blur-sm">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Mic2 size={12} className="text-gray-500" />
            Riwayat Panggilan ({history.length})
          </span>
          {showHistory ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {showHistory && history.length > 0 && (
          <div className="px-5 pb-4 flex gap-2 overflow-x-auto">
            {history.map((h, idx) => (
              <div key={`${h.id}-${idx}`} className="flex-shrink-0 flex items-center gap-2 bg-gray-900/80 border border-white/10 px-3 py-2 rounded-xl">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-200 whitespace-nowrap">{h.nama}</p>
                  <p className="text-[10px] text-gray-500">{h.waktu}{h.asrama ? ` · ${h.asrama}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function TOAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Memuat sistem TOA...</p>
        </div>
      </div>
    }>
      <TOAContent />
    </Suspense>
  );
}
