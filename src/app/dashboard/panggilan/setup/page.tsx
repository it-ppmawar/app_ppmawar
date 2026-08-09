'use client';

import { useState, useEffect } from 'react';
import {
  Wifi, Cable, Smartphone, Server, CheckCircle2, Circle,
  ChevronRight, ExternalLink, Copy, Check, Volume2,
  HelpCircle, Zap, AlertTriangle, MonitorSpeaker, Usb,
  Radio, PlugZap,
} from 'lucide-react';

interface Step {
  id: number;
  title: string;
  desc: string;
  icon: React.ReactNode;
  detail: React.ReactNode;
}

export default function SetupGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [asramaInput, setAsramaInput] = useState('');
  const [toaUrl, setToaUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const base = window.location.origin;
      setCurrentUrl(base);
      setToaUrl(`${base}/dashboard/panggilan/toa`);
    }
  }, []);

  useEffect(() => {
    if (asramaInput && currentUrl) {
      setToaUrl(`${currentUrl}/dashboard/panggilan/toa?asrama=${encodeURIComponent(asramaInput)}`);
    } else if (currentUrl) {
      setToaUrl(`${currentUrl}/dashboard/panggilan/toa`);
    }
  }, [asramaInput, currentUrl]);

  const copyUrl = () => {
    navigator.clipboard.writeText(toaUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const markDone = (step: number) => {
    setCompletedSteps(prev => prev.includes(step) ? prev.filter(s => s !== step) : [...prev, step]);
  };

  const steps: Step[] = [
    {
      id: 0,
      title: 'Siapkan Perangkat',
      icon: <Smartphone size={20} />,
      desc: 'HP Android atau mini PC untuk ditempatkan di ruang TOA',
      detail: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Perangkat yang direkomendasikan (pilih salah satu):</p>
          <div className="grid gap-3">
            {[
              { label: '⭐ HP Android Bekas', spec: 'Android 8.0+, RAM 2GB+, ada audio jack 3.5mm', harga: 'Rp 150rb – 400rb', recommended: true },
              { label: 'Raspberry Pi 4', spec: 'RAM 2GB, SD card 16GB, OS Raspberry Pi', harga: 'Rp 600rb – 900rb', recommended: false },
              { label: 'Laptop / Mini PC Tua', spec: 'Windows/Linux, ada audio jack', harga: 'Sudah ada', recommended: false },
            ].map(item => (
              <div key={item.label} className={`p-3 rounded-xl border ${item.recommended ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{item.label}</span>
                  {item.recommended && <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">DIREKOMENDASIKAN</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.spec}</p>
                <p className="text-xs font-bold text-green-600 dark:text-green-400 mt-1">💰 {item.harga}</p>
              </div>
            ))}
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1"><AlertTriangle size={12}/> Penting untuk HP Android:</p>
            <ul className="text-xs text-amber-600 dark:text-amber-300 space-y-0.5 list-disc list-inside">
              <li>Aktifkan "Tetap aktif saat mengisi daya" di Opsi Developer</li>
              <li>Matikan lock screen / screensaver</li>
              <li>Set brightness rendah agar hemat daya</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 1,
      title: 'Siapkan Kabel Audio',
      icon: <Cable size={20} />,
      desc: 'Kabel 3.5mm dari perangkat ke TOA LINE IN',
      detail: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Pilih kabel sesuai input TOA Anda:</p>
          <div className="grid gap-3">
            {[
              { input: '🎵 TOA punya LINE IN / AUX IN (3.5mm)', kabel: 'Kabel 3.5mm stereo to 3.5mm', harga: 'Rp 15rb', gambar: '🔌→🔌' },
              { input: '🎵 TOA punya input RCA (merah/putih)', kabel: 'Kabel 3.5mm to 2x RCA', harga: 'Rp 20rb', gambar: '🔌→🎮' },
              { input: '🎙️ TOA hanya punya MIC/XLR input', kabel: 'Kabel 3.5mm + DI Box + XLR', harga: 'Rp 100rb–300rb', gambar: '🔌→📦→🎤' },
            ].map(item => (
              <div key={item.input} className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">{item.input}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">➜ Gunakan: <strong className="text-gray-700 dark:text-gray-200">{item.kabel}</strong></p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg">{item.gambar}</span>
                  <span className="text-xs font-bold text-green-600 dark:text-green-400">💰 {item.harga}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <p className="text-xs text-blue-600 dark:text-blue-400"><strong>💡 Tips:</strong> Jika ada noise/bising saat disambungkan, gunakan <strong>USB DAC</strong> (konverter audio USB → 3.5mm, Rp 50rb) untuk kualitas lebih bersih.</p>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Cek WiFi di Ruang TOA',
      icon: <Wifi size={20} />,
      desc: 'Pastikan sinyal WiFi kuat di tempat TOA berada',
      detail: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Perangkat TOA harus bisa terhubung ke server PPMA via WiFi.</p>
          <div className="grid gap-2">
            {[
              { label: 'Kekuatan sinyal ideal', value: '-70 dBm atau lebih kuat', icon: '📶' },
              { label: 'Bandwidth yang dibutuhkan', value: '< 1 Mbps (hanya teks/data, bukan audio streaming)', icon: '📊' },
              { label: 'Latency maksimal', value: '< 500ms ke server', icon: '⏱️' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">⚠️ Jika sinyal lemah di ruang TOA:</p>
            <p className="text-xs text-amber-600 dark:text-amber-300">Pasang <strong>WiFi Extender / Repeater</strong> (Rp 150rb–300rb) di dekat ruangan TOA. Pastikan join ke jaringan WiFi yang sama dengan server PPMA.</p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl">
            <p className="text-xs text-green-700 dark:text-green-400"><strong>💡 Rekomendasi terbaik:</strong> Server PPMA berjalan di PC lokal pesantren (LAN), sehingga tidak bergantung internet. Lebih stabil dan lebih cepat.</p>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Sambungkan Kabel ke TOA',
      icon: <PlugZap size={20} />,
      desc: 'Colok kabel audio dari perangkat ke input TOA',
      detail: (
        <div className="space-y-3">
          <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400">
            <p className="text-gray-400 mb-2"># Diagram koneksi fisik:</p>
            <p>[Perangkat]</p>
            <p>  ↓ audio jack 3.5mm</p>
            <p>  ↓ kabel audio</p>
            <p>[TOA LINE IN / AUX IN]</p>
            <p>  ↓ amplifier internal TOA</p>
            <p>[Horn Speaker]</p>
            <p>  ↓</p>
            <p className="text-amber-400">📢 Suara terdengar di asrama</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Langkah-langkah:</p>
            {[
              'Colok ujung kabel 3.5mm ke audio jack HP/perangkat',
              'Colok ujung lainnya ke LINE IN / AUX IN di TOA',
              'Atur channel LINE IN di TOA mixer ke level yang sesuai',
              'Set volume HP ke 80–100%',
              'Jangan gunakan Bluetooth — pakai kabel saja untuk stabilitas',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-gray-600 dark:text-gray-300">{s}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Buka Halaman TOA di Browser',
      icon: <MonitorSpeaker size={20} />,
      desc: 'Buka URL khusus TOA di browser perangkat',
      detail: (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 block uppercase tracking-wide">Nama Asrama (opsional)</label>
            <input
              type="text"
              value={asramaInput}
              onChange={e => setAsramaInput(e.target.value)}
              placeholder="Contoh: Asrama A, Asrama Putra, dll"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Diisi sesuai nama asrama agar hanya menerima panggilan untuk asrama ini</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 block uppercase tracking-wide">URL Perangkat TOA</label>
            <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-xl">
              <code className="text-green-400 text-xs flex-1 break-all">{toaUrl}</code>
              <button onClick={copyUrl} className="shrink-0 p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-300" />}
              </button>
            </div>
          </div>
          <a
            href={toaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
          >
            <ExternalLink size={16} /> Buka Halaman TOA
          </a>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <strong>Untuk Android:</strong> Buka <strong>Chrome</strong> (bukan browser lain). Setelah halaman terbuka, tambahkan ke layar utama (Add to Home Screen) agar mudah diakses kembali.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Test & Verifikasi',
      icon: <Volume2 size={20} />,
      desc: 'Uji suara dan pastikan semua berfungsi',
      detail: (
        <div className="space-y-3">
          <div className="space-y-2">
            {[
              { test: 'Klik tombol "Tes Audio" di halaman TOA', expected: 'Terdengar suara tes dari speaker TOA' },
              { test: 'Buka halaman Panggilan Santri di HP lain', expected: 'Status perangkat TOA terlihat "Online"' },
              { test: 'Kirim panggilan test untuk santri', expected: 'Dalam ≤2 detik, panggilan dibacakan di TOA' },
              { test: 'Tutup dan buka kembali halaman TOA', expected: 'Auto-reconnect dalam beberapa detik' },
              { test: 'Matikan WiFi sebentar lalu nyalakan lagi', expected: 'Sistem reconnect otomatis tanpa bantuan manual' },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">Test {i + 1}: {item.test}</p>
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Expected: {item.expected}
                </p>
              </div>
            ))}
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl text-center">
            <p className="text-sm font-bold text-green-700 dark:text-green-300">🎉 Jika semua test berhasil, asrama ini siap digunakan!</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Ulangi langkah 1–5 untuk asrama berikutnya.</p>
          </div>
        </div>
      ),
    },
  ];

  const allDone = completedSteps.length === steps.length;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-white/15 p-2.5 rounded-xl">
            <Server size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black">Panduan Setup TOA</h1>
            <p className="text-slate-300 text-xs">Infrastruktur Panggilan Santri PPMA</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 relative z-10">
          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-300">{completedSteps.length}/{steps.length}</span>
        </div>
      </div>

      {allDone && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl text-green-700 dark:text-green-300">
          <Zap size={18} className="shrink-0 text-yellow-500" />
          <div>
            <p className="text-sm font-black">Setup selesai! 🎉</p>
            <p className="text-xs">TOA sudah terhubung dan siap menerima panggilan.</p>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => {
          const isOpen = currentStep === step.id;
          const isDone = completedSteps.includes(step.id);

          return (
            <div
              key={step.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl border transition-all overflow-hidden ${
                isOpen
                  ? 'border-orange-300 dark:border-orange-700 shadow-md shadow-orange-500/10'
                  : isDone
                  ? 'border-green-200 dark:border-green-800'
                  : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              {/* Step Header */}
              <button
                onClick={() => setCurrentStep(isOpen ? -1 : step.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  isDone ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                  : isOpen ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                }`}>
                  {isDone ? <CheckCircle2 size={18} /> : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400">Langkah {step.id + 1}</span>
                    {isDone && <span className="text-[10px] font-bold text-green-500">✓ Selesai</span>}
                  </div>
                  <p className={`text-sm font-bold truncate ${isDone ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-gray-100'}`}>
                    {step.title}
                  </p>
                  {!isOpen && <p className="text-xs text-gray-400 truncate">{step.desc}</p>}
                </div>
                <ChevronRight
                  size={16}
                  className={`text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Step Detail */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                  {step.detail}
                  <button
                    onClick={() => {
                      markDone(step.id);
                      if (step.id < steps.length - 1) setCurrentStep(step.id + 1);
                    }}
                    className={`mt-4 w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                      isDone
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-500/20'
                    }`}
                  >
                    {isDone ? '✓ Tandai Belum Selesai' : step.id === steps.length - 1 ? '✅ Selesai!' : 'Tandai Selesai & Lanjut →'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Troubleshooting */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 mb-3">
          <HelpCircle size={15} className="text-gray-400" /> Troubleshooting
        </h3>
        <div className="space-y-2">
          {[
            { masalah: 'Tidak ada suara dari TOA', solusi: 'Cek kabel audio, cek volume HP, cek level input di TOA mixer' },
            { masalah: 'Status offline padahal HP menyala', solusi: 'Refresh halaman TOA, cek koneksi WiFi, pastikan browser tidak di-minimize' },
            { masalah: 'Suara bergetar/noise', solusi: 'Coba USB DAC eksternal, hindari charger yang interferensi' },
            { masalah: 'Panggilan tidak terdengar', solusi: 'Cek apakah ada pesan error di halaman TOA, pastikan tidak dalam mode Mute' },
          ].map((item, i) => (
            <div key={i} className="text-xs">
              <p className="font-bold text-red-500">❌ {item.masalah}</p>
              <p className="text-gray-500 dark:text-gray-400 ml-3">→ {item.solusi}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-3">
        <a href="/dashboard/panggilan" className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-sm rounded-2xl border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors">
          <Radio size={15} /> Buat Panggilan
        </a>
        <a href="/dashboard/panggilan/toa" target="_blank" className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors">
          <MonitorSpeaker size={15} /> Halaman TOA
        </a>
      </div>
    </div>
  );
}
