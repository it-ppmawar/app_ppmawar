'use client';
import React, { useState, useEffect } from 'react';
import { User, Camera, Save, Fingerprint } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ newUsername: '', currentPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
          setFormData(prev => ({ ...prev, newUsername: data.user.username }));
        }
      })
      .catch(console.error);
      
    const savedAvatar = localStorage.getItem('user_avatar');
    if (savedAvatar) setAvatar(savedAvatar);
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAvatar(base64);
        localStorage.setItem('user_avatar', base64);
        alert('Foto profil berhasil diperbarui secara lokal!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Apakah Anda yakin ingin membersihkan cache dan memuat ulang aplikasi? Ini akan memastikan Anda mendapatkan versi terbaru.')) return;
    
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      alert('Cache berhasil dibersihkan! Aplikasi akan dimuat ulang.');
      window.location.reload();
    } catch (e) {
      alert('Terjadi kesalahan saat membersihkan cache.');
    }
  };

  const handleRegisterFingerprint = async () => {
    try {
      const resp = await fetch('/api/auth/webauthn/register/generate');
      const options = await resp.json();
      if (!resp.ok) throw new Error(options.error || 'Gagal menyiapkan data pendaftaran biometrik');

      let regResp;
      try {
        regResp = await startRegistration(options);
      } catch (err: any) {
        throw new Error('Pendaftaran biometrik dibatalkan atau tidak didukung pada perangkat ini.');
      }

      const verifyResp = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regResp),
      });

      const verification = await verifyResp.json();
      if (verifyResp.ok && verification.verified) {
        alert('Perangkat berhasil didaftarkan! Sekarang Anda dapat login menggunakan sidik jari/passkey.');
        // Trigger event for sidebar to remove notification
        window.dispatchEvent(new Event('fingerprint-registered'));
      } else {
        throw new Error(verification.error || 'Verifikasi pendaftaran gagal.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.currentPassword) return alert('Silakan masukkan password saat ini untuk menyimpan perubahan.');
    
    setLoading(true);
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Profil berhasil diperbarui!');
        setIsEditing(false);
        setUser({ ...user, username: formData.newUsername || user.username });
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
      } else {
        alert(data.error || 'Gagal memperbarui profil');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto animate-[fadeIn_0.5s_ease-out]">
      <div className="bg-gradient-to-r from-green-800 to-green-900 rounded-t-3xl p-8 text-white shadow-lg text-center relative">
        <div className="relative inline-block mt-4">
          <div className="w-28 h-28 bg-white rounded-full mx-auto flex items-center justify-center border-4 border-white/20 shadow-xl overflow-hidden relative group">
            {avatar ? (
              <img src={avatar} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-gray-300" />
            )}
            <label className="absolute inset-0 bg-black/50 hidden group-hover:flex flex-col items-center justify-center cursor-pointer transition-all">
              <Camera size={24} className="text-white mb-1" />
              <span className="text-[10px] font-bold">Ubah Foto</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          {/* Tombol Kamera Ekstra untuk HP */}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg cursor-pointer z-10 sm:hidden">
            <Camera size={14} className="text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>
        <h2 className="text-2xl font-bold mt-4 capitalize drop-shadow-sm">{user?.real_name || user?.username || 'Memuat...'}</h2>
        <p className="text-green-200 text-xs font-medium uppercase tracking-wider mt-1">{user?.role || ''}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-b-3xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
        {!isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Username</label>
              <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-700 dark:text-gray-200 font-medium flex justify-between items-center">
                {user?.username || '-'}
                {(user?.role === 'admin' || user?.role === 'staff') && (
                  <button onClick={() => setIsEditing(true)} className="text-green-600 dark:text-green-400 text-xs font-bold hover:underline">
                    UBAH
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Role / Peran</label>
              <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-700 dark:text-gray-200 font-medium capitalize">
                {user?.role || '-'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Keamanan</label>
              <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-medium tracking-[0.2em]">••••••••</span>
                {user?.role !== 'tamu' && (
                  <button onClick={() => setIsEditing(true)} className="text-green-600 dark:text-green-400 text-xs font-bold hover:underline">
                    UBAH PASSWORD
                  </button>
                )}
              </div>
            </div>
            
            {/* Keamanan Tambahan: WebAuthn */}
            {(user?.role === 'guru' || user?.role === 'wali_murid') && (
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Biometrik (Sidik Jari / Passkey)</label>
                <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 font-medium text-sm flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" /> Login Cepat & Aman
                  </span>
                  <button onClick={handleRegisterFingerprint} className="text-green-700 dark:text-green-400 text-xs font-bold hover:underline bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 transition-colors">
                    DAFTARKAN
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleUpdateProfile} className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            {(user?.role === 'admin' || user?.role === 'staff') ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Username Baru</label>
                <input 
                  type="text" 
                  value={formData.newUsername}
                  onChange={e => setFormData({...formData, newUsername: e.target.value})}
                  className="w-full bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 focus:ring-2 focus:ring-green-500 rounded-xl p-3 text-gray-800 dark:text-gray-200 outline-none transition"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">Username</label>
                <input 
                  type="text" 
                  disabled
                  value={user?.username}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-gray-400 outline-none cursor-not-allowed"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Password Baru <span className="text-gray-400 font-normal">(Kosongkan jika tidak ingin mengubah)</span></label>
              <input 
                type="password" 
                placeholder="Minimal 6 karakter"
                value={formData.newPassword}
                onChange={e => setFormData({...formData, newPassword: e.target.value})}
                className="w-full bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 focus:ring-2 focus:ring-green-500 rounded-xl p-3 text-gray-800 dark:text-gray-200 outline-none transition"
              />
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50">
              <label className="block text-xs font-bold text-orange-800 dark:text-orange-400 mb-1">Password Saat Ini (Wajib)</label>
              <input 
                type="password" 
                required
                placeholder="Masukkan password lama untuk konfirmasi"
                value={formData.currentPassword}
                onChange={e => setFormData({...formData, currentPassword: e.target.value})}
                className="w-full bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 focus:ring-2 focus:ring-orange-500 rounded-xl p-3 text-gray-800 dark:text-gray-200 outline-none transition"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2"
              >
                {loading ? 'Menyimpan...' : <><Save size={18}/> Simpan Perubahan</>}
              </button>
              <button 
                type="button" 
                onClick={() => { setIsEditing(false); setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' })); }}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition"
              >
                Batal
              </button>
            </div>
          </form>
        )}
        <div className="mt-8 text-center space-y-4">
          <button 
            onClick={handleClearCache}
            className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-2 rounded-full transition-colors"
          >
            Bersihkan Cache & Perbarui Aplikasi
          </button>
          <div className="text-xs text-gray-400">
            Versi Aplikasi: 1.0.1 (PWA)
          </div>
        </div>
      </div>
    </div>
  );
}
