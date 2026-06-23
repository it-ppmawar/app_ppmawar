# Panduan Penggunaan Sistem Absensi Online PPMA

Selamat datang di Sistem Absensi Online Madrasah Diniyah & Pondok Pesantren Matholi'ul Anwar (PPMA). Aplikasi ini dirancang untuk memudahkan pencatatan kehadiran santri menggunakan pemindaian kartu secara real-time.

---

## 👥 Peran Pengguna (User Roles) & Batasan Akses

Sistem ini membagi akses menjadi 4 peran utama untuk menjaga keamanan dan ketertiban data:

### 1. 👑 Admin / Staff
* **Hak Akses:** Penuh (Full Access)
* **Fungsi Utama:**
  * Mengelola data master: Murid, Guru, Kelas Madin, dan Kamar Asrama.
  * Mengatur dan mengedit Jadwal Pelajaran Madin & Kegiatan Asrama secara interaktif melalui halaman Jadwal.
  * Menghubungkan dan menyinkronkan data santri secara otomatis dari **Google Sheets**.
  * Mendaftarkan fitur biometrik (Passkey/WebAuthn) untuk login cepat & aman.
  * Melihat dan mengekspor rekapitulasi absensi seluruh santri.

### 2. 👨‍🏫 Guru (Asatidz / Asatidzah)
* **Hak Akses:** Terbatas pada kelas Diniyah yang diampu.
* **Fungsi Utama:**
  * Melakukan absensi masuk kelas Madin sesuai jadwal yang sedang aktif saat itu.
  * Memindai kartu santri menggunakan kamera HP / laptop atau alat scanner barcode/RFID.
  * Melihat kode pengajar dan jadwal pribadi.

### 3. 🏡 Pengurus Asrama
* **Hak Akses:** Terbatas pada kegiatan kamar/asrama yang dikelola.
* **Fungsi Utama:**
  * Melakukan absensi kegiatan kamar (seperti jama'ah, muwajahah, kebersihan, dll).
  * Memindai kartu santri yang berada di bawah wewenang asrama/kamarnya.

### 4. 🧕 Wali Murid
* **Hak Akses:** Hanya Lihat (Read-Only)
* **Fungsi Utama:**
  * Memantau kehadiran anak-anak mereka secara real-time dari rumah.
  * Tidak memiliki tombol absensi maupun menu pengelolaan data.

---

## 📅 Panduan Pengelolaan Jadwal Madin

* **Format Penamaan Hari & Malam:**
  Untuk menyelaraskan antara kalender masehi dan malam hari belajar pesantren, hari disimpan sesuai hari kalender fisiknya namun dilabeli dengan malam yang dimaksud:
  * **Jum'at** = Jum'at (Malam Sabtu)
  * **Sabtu** = Sabtu (Malam Ahad)
  * **Ahad** = Ahad (Malam Senin)
  * **Senin** = Senin (Malam Selasa) *(Khusus hari ini diisi penuh oleh Ngaji Umum)*
  * **Selasa** = Selasa (Malam Rabu)
  * **Rabu** = Rabu (Malam Kamis)
* **Pengeditan:** Admin/Staff cukup mengetuk sel pada tabel jadwal untuk menambah, mengubah kitab/guru, atau menghapus jadwal kelas tertentu.

---

## 📷 Cara Melakukan Absensi (Pemindaian Kartu)

1. Pastikan Anda masuk (**Login**) menggunakan akun **Guru** atau **Pengurus Asrama**.
2. Masuk ke menu **Absen** atau **Scan Absen**.
3. Sistem akan mendeteksi jadwal yang sedang aktif (dimulai dari 30 menit sebelum jadwal mulai hingga 3 jam setelah jadwal berakhir).
4. Klik tombol **Mulai Scan** dan izinkan akses kamera jika menggunakan HP.
5. Arahkan barcode/QR Code kartu santri ke depan kamera. Setelah berbunyi atau muncul notifikasi berhasil, data kehadiran santri langsung tercatat di server cPanel secara real-time.
