'use client';

import { useEffect, useState } from 'react';
import { Bell, Download } from 'lucide-react';

export default function PwaProvider({ children }: { children: React.ReactNode }) {
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('Service Worker registration successful with scope: ', registration.scope);
        },
        (err) => {
          console.log('Service Worker registration failed: ', err);
        }
      );
    }

    // Check if we need to ask for push notification permissions
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay prompt slightly so it's not too aggressive
      setTimeout(() => setShowNotificationPrompt(true), 3000);
    }

    // PWA Install Prompt Logic
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowNotificationPrompt(false);
        // We can subscribe to push manager here
        // For demonstration, trigger a test notification
        new Notification('Notifikasi Aktif', {
          body: 'Anda akan menerima pengingat jadwal mengajar.',
          icon: '/logo.png',
          vibrate: [200, 100, 200]
        } as any);
      } else {
        setShowNotificationPrompt(false);
      }
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      {children}
      {showNotificationPrompt && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 z-[100] animate-[slideUp_0.3s_ease-out]">
          <div className="flex gap-3 items-start">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full shrink-0 text-blue-600 dark:text-blue-400">
              <Bell size={24} className="animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Nyalakan Notifikasi</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                Dapatkan pengingat (alarm/getaran) otomatis saat jadwal mengajar Anda dimulai.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={requestNotificationPermission}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition-colors flex-1"
                >
                  Nyalakan
                </button>
                <button 
                  onClick={() => setShowNotificationPrompt(false)}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold py-2 px-4 rounded-xl transition-colors"
                >
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Button (Draggable & Minimizable) */}
      {isInstallable && (
        <DraggableInstallButton onInstall={handleInstallClick} />
      )}
    </>
  );
}

// Komponen Pembantu untuk Tombol Install yang bisa didrag
function DraggableInstallButton({ onInstall }: { onInstall: () => void }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: window.innerWidth - 150, y: window.innerHeight - 80 });
    setIsMounted(true);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    
    // Batasi agar tidak keluar layar
    newX = Math.max(10, Math.min(newX, window.innerWidth - 60));
    newY = Math.max(10, Math.min(newY, window.innerHeight - 60));
    
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.releasePointerCapture) {
      target.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  if (!isMounted) return null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ 
        position: 'fixed', 
        left: position.x, 
        top: position.y, 
        touchAction: 'none',
        zIndex: 9999 
      }}
      className="cursor-move animate-[slideUp_0.5s_ease-out]"
    >
      <div className="flex flex-col items-end gap-1">
        {/* Tombol Minimize/Maximize (Kecil) */}
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
          className="bg-gray-800/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border border-white/20 hover:bg-gray-700 pointer-events-auto"
        >
          {isMinimized ? '+' : '-'}
        </button>
        
        {/* Tombol Install Utama */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!isDragging) onInstall(); }}
          className={`flex items-center gap-2 bg-gradient-to-r from-green-700 to-green-900 text-white rounded-full shadow-2xl transition-all border border-white/20 font-medium group pointer-events-auto
            ${isMinimized ? 'p-3' : 'px-5 py-3'}
            ${isDragging ? 'scale-110 shadow-green-900/50' : 'hover:-translate-y-1 hover:shadow-green-900/50'}
          `}
        >
          <Download size={20} className={!isMinimized ? "group-hover:animate-bounce" : ""} />
          {!isMinimized && <span className="whitespace-nowrap select-none">Install App</span>}
        </button>
      </div>
    </div>
  );
}
