self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  const data = event.data?.json() ?? {};
  const title = data.title || 'Pemberitahuan PPMA';

  // Mendukung data sebagai object (baru) atau string URL (lama)
  const notifData = typeof data.data === 'object' && data.data !== null
    ? data.data
    : { url: data.url || data.data || '/dashboard', type: 'general' };

  const actions = data.actions || [];

  const options = {
    body: data.body || 'Ada pembaruan absensi.',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: data.vibrate || [200, 100, 200, 100, 200, 100, 200],
    data: notifData,
    requireInteraction: data.requireInteraction !== false,
    tag: data.tag || notifData.type || 'general',
    renotify: data.renotify || false,
    actions: actions,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  // Untuk aksi input absen: JANGAN tutup notifikasi dulu.
  // Notifikasi akan ditutup secara manual oleh halaman setelah absen berhasil disubmit,
  // atau secara otomatis saat jadwal sudah lewat / tidak aktif.
  if (event.action !== 'open_absen') {
    event.notification.close();
  }

  const notifData = event.notification.data || {};
  const action = event.action;

  // Tentukan URL tujuan berdasarkan action yang diklik
  let targetUrl = '/dashboard';

  if (typeof notifData === 'string') {
    // Backward compat: data lama berupa string URL
    targetUrl = notifData;
  } else {
    // Data baru berupa object
    if (action === 'open_absen' && notifData.quickUrl) {
      targetUrl = notifData.quickUrl;
    } else if (action === 'open_rekap' && notifData.rekapUrl) {
      targetUrl = notifData.rekapUrl;
    } else if (action === 'open_nilai' && notifData.nilaiUrl) {
      targetUrl = notifData.nilaiUrl;
    } else if (action === 'open_tagihan' && notifData.tagihanUrl) {
      targetUrl = notifData.tagihanUrl;
    } else if (notifData.url) {
      targetUrl = notifData.url;
    }
  }

  // Pastikan URL absolut (mulai dengan http atau /)
  if (!targetUrl.startsWith('http') && !targetUrl.startsWith('/')) {
    targetUrl = '/' + targetUrl;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Coba fokus window yang sudah ada dan navigasi ke URL tujuan
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        const targetPath = targetUrl.startsWith('http')
          ? new URL(targetUrl).pathname
          : targetUrl.split('?')[0];

        if (clientUrl.pathname.startsWith('/dashboard') || clientUrl.pathname.startsWith('/absen') || clientUrl.pathname.startsWith('/rekap') || clientUrl.pathname.startsWith('/rekapitulasi')) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(c => c && c.focus());
          }
          return client.focus().then(() => {
            // Kirim pesan ke client untuk navigasi jika navigate tidak tersedia
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          });
        }
      }
      // Tidak ada window yang cocok, buka window baru
      return clients.openWindow(targetUrl);
    })
  );
});

// Handle pesan dari client (misalnya untuk dismiss notifikasi)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'DISMISS_NOTIFICATION') {
    const tag = event.data.tag;
    if (tag) {
      self.registration.getNotifications({ tag }).then(notifications => {
        notifications.forEach(n => n.close());
      });
    }
  }
});
