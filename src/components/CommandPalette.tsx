'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Home, ClipboardCheck, QrCode, FileText, CalendarDays, BookOpen, FileWarning, Megaphone, Trash2, Users, UserCog, GraduationCap, BookOpen as BookOpenIcon, Calendar, ClipboardList, Home as HomeIcon, Archive, QrCode as QrCodeIcon, CreditCard, Users as UsersIcon, MessageSquare, Shield, Settings, User, Globe, Smartphone, Sparkles, Sun, Moon, MessageCircle, X, ArrowRight, Zap, Link2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────
type SearchItemType = 'page' | 'action' | 'external';

interface SearchItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  action?: string;
  type: SearchItemType;
  tags: string[];       // Kata kunci pencarian / sinonim
  roles: string[];      // Role yang bisa melihat item ini ('*' = semua)
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;        // Tailwind bg color class untuk ikon
  textColor: string;    // Tailwind text color class untuk ikon
}

// ─────────────────────────────────────────────────────────────────────────────
// Data: Semua Entri Menu + Aksi + Link Eksternal
// ─────────────────────────────────────────────────────────────────────────────
const ALL_SEARCH_ITEMS: SearchItem[] = [
  // ── Halaman & Menu ──────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Halaman utama / beranda',
    href: '/dashboard',
    type: 'page',
    tags: ['beranda', 'home', 'utama', 'dashboard', 'awal', 'depan'],
    roles: ['*'],
    icon: Home,
    color: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-400',
  },
  {
    id: 'absen',
    label: 'Input Absensi',
    description: 'Isi daftar kehadiran santri / kelas',
    href: '/dashboard/absen',
    type: 'page',
    tags: ['absen', 'hadir', 'kehadiran', 'presensi', 'daftar hadir', 'isi absen', 'absensi', 'input absen'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'],
    icon: ClipboardCheck,
    color: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-400',
  },
  {
    id: 'scan-absen',
    label: 'Scan Absensi',
    description: 'Scan QR code untuk absensi',
    href: '/dashboard/scan-absen',
    type: 'page',
    tags: ['scan', 'qr', 'kamera', 'barcode', 'scan absen', 'qr absen', 'pindai'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'],
    icon: QrCode,
    color: 'bg-emerald-100 dark:bg-emerald-900/40',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    id: 'rekapitulasi',
    label: 'Rekapitulasi Absensi',
    description: 'Laporan & rekap kehadiran',
    href: '/dashboard/rekapitulasi',
    type: 'page',
    tags: ['rekap', 'laporan', 'resume', 'rangkuman', 'rekapitulasi', 'statistik hadir', 'export absen', 'laporan absen'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'],
    icon: FileText,
    color: 'bg-purple-100 dark:bg-purple-900/40',
    textColor: 'text-purple-700 dark:text-purple-400',
  },
  {
    id: 'absen-guru',
    label: 'Absen Dewan Guru',
    description: 'Daftar hadir guru & pembina',
    href: '/dashboard/absen-guru',
    type: 'page',
    tags: ['absen guru', 'daftar hadir guru', 'presensi guru', 'kehadiran ustadz', 'absensi pengajar'],
    roles: ['admin', 'staff', 'pengurus_asrama', 'pengasuh'],
    icon: ClipboardList,
    color: 'bg-teal-100 dark:bg-teal-900/40',
    textColor: 'text-teal-700 dark:text-teal-400',
  },
  {
    id: 'tabel-jadwal',
    label: 'Tabel Jadwal',
    description: 'Lihat tabel jadwal kegiatan',
    href: '/dashboard/tabel-jadwal',
    type: 'page',
    tags: ['tabel jadwal', 'agenda', 'kalender', 'waktu', 'pelajaran', 'lihat jadwal', 'jadwal harian'],
    roles: ['*'],
    icon: CalendarDays,
    color: 'bg-teal-100 dark:bg-teal-900/40',
    textColor: 'text-teal-700 dark:text-teal-400',
  },
  {
    id: 'jadwal-alumni',
    label: 'Jadwal Alumni',
    description: 'Jadwal kegiatan alumni pesantren',
    href: '/dashboard/jadwal-alumni',
    type: 'page',
    tags: ['jadwal alumni', 'agenda lulusan', 'kegiatan alumni', 'alumni schedule'],
    roles: ['*'],
    icon: CalendarDays,
    color: 'bg-amber-100 dark:bg-amber-900/40',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  {
    id: 'jurnal',
    label: 'Jurnal Kegiatan',
    description: 'Catatan & log kegiatan harian',
    href: '/dashboard/jurnal',
    type: 'page',
    tags: ['jurnal', 'catatan', 'log', 'kegiatan', 'aktivitas', 'harian', 'diary', 'notulensi'],
    roles: ['*'],
    icon: BookOpen,
    color: 'bg-blue-100 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  {
    id: 'ketertiban',
    label: 'Ketertiban Murid',
    description: 'Catatan pelanggaran & disiplin santri',
    href: '/dashboard/ketertiban',
    type: 'page',
    tags: ['ketertiban', 'bolos', 'hukuman', 'pelanggaran', 'disiplin', 'tata tertib', 'sanksi', 'ta\'zir', 'alpa', 'izin'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh', 'wali_murid'],
    icon: FileWarning,
    color: 'bg-red-100 dark:bg-red-900/40',
    textColor: 'text-red-700 dark:text-red-400',
  },
  {
    id: 'panggilan',
    label: 'Panggilan Santri',
    description: 'Sistem panggilan santri via TOA / speaker',
    href: '/dashboard/panggilan',
    type: 'page',
    tags: ['panggilan', 'toa', 'speaker', 'umumkan', 'panggil', 'pengumuman', 'pengeras suara', 'broadcast'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh', 'wali_murid'],
    icon: Megaphone,
    color: 'bg-orange-100 dark:bg-orange-900/40',
    textColor: 'text-orange-700 dark:text-orange-400',
  },
  {
    id: 'kebersihan',
    label: 'Kebersihan & Sampah',
    description: 'Manajemen kebersihan asrama & lingkungan',
    href: '/dashboard/kebersihan',
    type: 'page',
    tags: ['kebersihan', 'sampah', 'bersih', 'piket', 'lingkungan', 'sapu', 'cuci', 'sanitasi'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh', 'petugas', 'petugas_umum', 'petugas_kebersihan', 'petugas_kebersihan_umum'],
    icon: Trash2,
    color: 'bg-emerald-100 dark:bg-emerald-900/40',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    id: 'murid',
    label: 'Data Santri',
    description: 'Daftar & profil data santri',
    href: '/dashboard/murid',
    type: 'page',
    tags: ['santri', 'murid', 'siswa', 'anak', 'peserta didik', 'data santri', 'profil santri', 'biodata'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'],
    icon: Users,
    color: 'bg-orange-100 dark:bg-orange-900/40',
    textColor: 'text-orange-700 dark:text-orange-400',
  },
  {
    id: 'guru',
    label: 'Data Guru & Pembina',
    description: 'Daftar & profil guru, ustadz, pembina',
    href: '/dashboard/guru',
    type: 'page',
    tags: ['guru', 'ustadz', 'pengajar', 'pendidik', 'tenaga pengajar', 'dewan guru', 'musyrif', 'pembina'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'],
    icon: UserCog,
    color: 'bg-indigo-100 dark:bg-indigo-900/40',
    textColor: 'text-indigo-700 dark:text-indigo-400',
  },
  {
    id: 'alumni',
    label: 'Data Alumni',
    description: 'Daftar santri yang telah lulus / alumni',
    href: '/dashboard/alumni',
    type: 'page',
    tags: ['alumni', 'lulusan', 'mantan santri', 'tamat', 'wisuda', 'tammat'],
    roles: ['admin', 'staff'],
    icon: GraduationCap,
    color: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-400',
  },
  {
    id: 'kelas',
    label: 'Manajemen Kelas',
    description: 'Kelola kelas quran & madin',
    href: '/dashboard/kelas',
    type: 'page',
    tags: ['kelas', 'kelompok belajar', 'rombel', 'kelas quran', 'kelas madin', 'halaqoh', 'fashl'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'],
    icon: BookOpenIcon,
    color: 'bg-teal-100 dark:bg-teal-900/40',
    textColor: 'text-teal-700 dark:text-teal-400',
  },
  {
    id: 'kurikulum',
    label: 'Kurikulum Madin',
    description: 'Mata pelajaran & silabus madrasah diniyah',
    href: '/dashboard/kurikulum',
    type: 'page',
    tags: ['kurikulum', 'mata pelajaran', 'mapel', 'materi', 'silabus', 'madin', 'diniyah', 'kitab'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'],
    icon: BookOpenIcon,
    color: 'bg-indigo-100 dark:bg-indigo-900/40',
    textColor: 'text-indigo-700 dark:text-indigo-400',
  },
  {
    id: 'jadwal',
    label: 'Kelola Jadwal',
    description: 'Buat & atur jadwal kegiatan / pelajaran',
    href: '/dashboard/jadwal',
    type: 'page',
    tags: ['kelola jadwal', 'buat jadwal', 'atur jadwal', 'jadwal pelajaran', 'jadwal kegiatan', 'tambah jadwal', 'edit jadwal'],
    roles: ['admin', 'staff', 'pengurus_asrama', 'pengasuh'],
    icon: Calendar,
    color: 'bg-blue-100 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  {
    id: 'jadwal-dewan-guru',
    label: 'Jadwal Dewan Guru',
    description: 'Jadwal mengajar & rotasi guru',
    href: '/dashboard/jadwal-dewan-guru',
    type: 'page',
    tags: ['jadwal guru', 'jadwal mengajar', 'rotasi guru', 'jadwal dewan guru', 'jadwal ustadz', 'mengajar'],
    roles: ['admin', 'staff', 'guru', 'pengasuh'],
    icon: CalendarDays,
    color: 'bg-teal-100 dark:bg-teal-900/40',
    textColor: 'text-teal-700 dark:text-teal-400',
  },
  {
    id: 'qr-dewan-guru',
    label: 'QR Code Dewan Guru',
    description: 'Generate & cetak QR code guru',
    href: '/dashboard/qr-dewan-guru',
    type: 'page',
    tags: ['qr guru', 'barcode guru', 'kartu absen', 'qr code guru', 'cetak qr', 'generate qr'],
    roles: ['admin', 'staff', 'guru', 'pengasuh'],
    icon: QrCodeIcon,
    color: 'bg-indigo-100 dark:bg-indigo-900/40',
    textColor: 'text-indigo-700 dark:text-indigo-400',
  },
  {
    id: 'kamar',
    label: 'Kamar Asrama',
    description: 'Manajemen kamar & penempatan santri',
    href: '/dashboard/kamar',
    type: 'page',
    tags: ['kamar', 'tidur', 'ruang', 'asrama', 'tempat tidur', 'penempatan', 'hunian', 'kamar santri'],
    roles: ['admin', 'staff', 'pengurus_asrama', 'pengasuh'],
    icon: HomeIcon,
    color: 'bg-blue-100 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  {
    id: 'inventaris',
    label: 'Inventaris Asrama',
    description: 'Daftar barang & aset asrama',
    href: '/dashboard/inventaris',
    type: 'page',
    tags: ['inventaris', 'barang', 'peralatan', 'aset', 'sarpras', 'perabot', 'fasilitas', 'sarana', 'prasarana'],
    roles: ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh', 'petugas', 'petugas_umum', 'petugas_inventaris', 'petugas_inventaris_umum', 'petugas_sarpras'],
    icon: Archive,
    color: 'bg-indigo-100 dark:bg-indigo-900/40',
    textColor: 'text-indigo-700 dark:text-indigo-400',
  },
  {
    id: 'pairing',
    label: 'Pairing & Face AI',
    description: 'Pasangkan santri & aktifkan pengenalan wajah',
    href: '/dashboard/pairing',
    type: 'page',
    tags: ['pairing', 'wajah', 'muka', 'kamera', 'ai', 'pengenalan wajah', 'biometrik', 'face recognition', 'face ai', 'face detection'],
    roles: ['admin', 'staff', 'pengurus_asrama'],
    icon: QrCodeIcon,
    color: 'bg-cyan-100 dark:bg-cyan-900/40',
    textColor: 'text-cyan-700 dark:text-cyan-400',
  },
  {
    id: 'billing',
    label: 'Info Tagihan',
    description: 'Informasi pembayaran & tunggakan SPP',
    href: '/dashboard/billing',
    type: 'page',
    tags: ['billing', 'tagihan', 'spp', 'bayar', 'keuangan', 'tunggakan', 'iuran', 'pembayaran', 'biaya', 'cicilan'],
    roles: ['admin', 'wali_murid', 'wali_alumni', 'pengasuh'],
    icon: CreditCard,
    color: 'bg-orange-100 dark:bg-orange-900/40',
    textColor: 'text-orange-700 dark:text-orange-400',
  },
  {
    id: 'users',
    label: 'Manajemen Pengguna',
    description: 'Kelola akun & hak akses pengguna',
    href: '/dashboard/users',
    type: 'page',
    tags: ['users', 'pengguna', 'akun', 'user', 'hak akses', 'password', 'login', 'manajemen akun', 'tambah user', 'edit user'],
    roles: ['admin'],
    icon: UsersIcon,
    color: 'bg-indigo-100 dark:bg-indigo-900/40',
    textColor: 'text-indigo-700 dark:text-indigo-400',
  },
  {
    id: 'notifikasi',
    label: 'Notifikasi & WhatsApp',
    description: 'Kirim pesan & pengingat via WhatsApp',
    href: '/dashboard/notifikasi',
    type: 'page',
    tags: ['notifikasi', 'whatsapp', 'wa', 'pesan', 'kirim', 'broadcast', 'pengingat', 'reminder', 'push notif'],
    roles: ['admin', 'staff'],
    icon: MessageSquare,
    color: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-400',
  },
  {
    id: 'audit',
    label: 'Audit Log',
    description: 'Riwayat & jejak aktivitas sistem',
    href: '/dashboard/audit',
    type: 'page',
    tags: ['audit', 'audit log', 'riwayat', 'jejak', 'log aktivitas', 'log sistem', 'history', 'aktivitas pengguna'],
    roles: ['admin'],
    icon: Shield,
    color: 'bg-indigo-100 dark:bg-indigo-900/40',
    textColor: 'text-indigo-700 dark:text-indigo-400',
  },
  {
    id: 'settings',
    label: 'Pengaturan Sistem',
    description: 'Konfigurasi & preferensi aplikasi',
    href: '/dashboard/settings',
    type: 'page',
    tags: ['pengaturan', 'settings', 'setting', 'konfigurasi', 'preferensi', 'sistem', 'nomor cs', 'edit pengaturan'],
    roles: ['admin'],
    icon: Settings,
    color: 'bg-gray-100 dark:bg-gray-700/50',
    textColor: 'text-gray-700 dark:text-gray-300',
  },
  {
    id: 'profil',
    label: 'Profil Saya',
    description: 'Edit profil, foto & sidik jari',
    href: '/dashboard/profil',
    type: 'page',
    tags: ['profil', 'akun saya', 'sidik jari', 'biometrik', 'foto profil', 'edit nama', 'ganti foto', 'fingerprint', 'password saya'],
    roles: ['*'],
    icon: User,
    color: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-400',
  },

  // ── Aksi Cepat ────────────────────────────────────────────────────────────
  {
    id: 'action-theme',
    label: 'Ganti Mode Tampilan',
    description: 'Toggle antara mode gelap dan terang',
    action: 'toggleTheme',
    type: 'action',
    tags: ['dark mode', 'mode malam', 'mode gelap', 'mode terang', 'light mode', 'tema', 'tampilan gelap', 'tampilan terang', 'ganti tema', 'toggle theme'],
    roles: ['*'],
    icon: Sun,
    color: 'bg-yellow-100 dark:bg-yellow-900/40',
    textColor: 'text-yellow-700 dark:text-yellow-400',
  },
  {
    id: 'action-cs',
    label: 'Layanan CS WhatsApp',
    description: 'Hubungi admin / CS via WhatsApp',
    action: 'openCS',
    type: 'action',
    tags: ['cs', 'customer service', 'bantuan', 'admin', 'kontak', 'support', 'whatsapp cs', 'hubungi', 'help'],
    roles: ['*'],
    icon: MessageCircle,
    color: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-400',
  },

  // ── Aplikasi Lainnya ──────────────────────────────────────────────────────
  {
    id: 'ext-ppma',
    label: 'PP. Matholi\'ul Anwar',
    description: 'Website resmi pesantren',
    href: 'https://ppmawar.or.id/',
    type: 'external',
    tags: ['ppma', 'pondok', 'pesantren', "matholi'ul anwar", 'web resmi', 'website pesantren', 'ppmawar'],
    roles: ['*'],
    icon: Globe,
    color: 'bg-emerald-100 dark:bg-emerald-900/40',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    id: 'ext-mafatih',
    label: 'Mafatihul Akhyar (Beta)',
    description: 'Aplikasi wirid & doa santri',
    href: 'https://play.google.com/store/apps/details?id=id.quizb.bukuwirid',
    type: 'external',
    tags: ['mafatih', 'wirid', 'doa', 'zikir', 'dzikir', 'aplikasi wirid', 'android', 'play store', 'buku wirid'],
    roles: ['*'],
    icon: Smartphone,
    color: 'bg-blue-100 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  {
    id: 'ext-rose',
    label: 'Rose App',
    description: 'Aplikasi MA Matholi\'ul Anwar',
    href: 'https://app.mamawar.sch.id/',
    type: 'external',
    tags: ['rose', 'rose app', 'ma', 'madrasah', 'sekolah', 'mamawar', 'ma mawar'],
    roles: ['*'],
    icon: Sparkles,
    color: 'bg-rose-100 dark:bg-rose-900/40',
    textColor: 'text-rose-700 dark:text-rose-400',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: filter berdasarkan role pengguna
// ─────────────────────────────────────────────────────────────────────────────
function filterByRole(items: SearchItem[], userRole: string): SearchItem[] {
  const roleLower = (userRole || '').toLowerCase();
  return items.filter(item => {
    if (item.roles.includes('*')) return true;
    return item.roles.some(r => {
      if (roleLower === r) return true;
      // Petugas match: petugas_kebersihan cocok dengan 'petugas'
      if (r === 'petugas' && roleLower.startsWith('petugas')) return true;
      return false;
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: scoring pencarian
// ─────────────────────────────────────────────────────────────────────────────
function scoreItem(item: SearchItem, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1; // Semua tampil saat kosong

  const labelLower = item.label.toLowerCase();
  const descLower = (item.description || '').toLowerCase();

  // Label exact match → skor tertinggi
  if (labelLower === q) return 100;
  // Label starts with → sangat tinggi
  if (labelLower.startsWith(q)) return 80;
  // Label contains → tinggi
  if (labelLower.includes(q)) return 60;
  // Description contains → sedang
  if (descLower.includes(q)) return 40;
  // Tags exact / starts / contains
  for (const tag of item.tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === q) return 70;
    if (tagLower.startsWith(q)) return 50;
    if (tagLower.includes(q)) return 30;
  }
  // Partial match per word di label
  const words = q.split(' ').filter(Boolean);
  if (words.length > 1) {
    const allMatch = words.every(w => labelLower.includes(w) || descLower.includes(w) || item.tags.some(t => t.toLowerCase().includes(w)));
    if (allMatch) return 25;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  userRole: string;
  isDark: boolean;
  onToggleTheme: () => void;
  nomorCs: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CommandPalette({ open, onClose, userRole, isDark, onToggleTheme, nomorCs }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter role-based items sekali saja
  const roleItems = filterByRole(ALL_SEARCH_ITEMS, userRole);

  // Filter + sort berdasarkan query
  const results = query.trim()
    ? roleItems
        .map(item => ({ item, score: scoreItem(item, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
    : roleItems; // Tampilkan semua saat query kosong

  // Kelompokkan
  const pages = results.filter(r => r.type === 'page');
  const actions = results.filter(r => r.type === 'action');
  const externals = results.filter(r => r.type === 'external');

  // Flat ordered untuk navigasi keyboard
  const flat = [...pages, ...actions, ...externals];

  // Reset state saat terbuka
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Delay sedikit agar DOM sudah render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Navigasi keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flat[activeIndex];
      if (selected) executeItem(selected);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [flat, activeIndex, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll item aktif ke tampilan
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Reset activeIndex saat hasil berubah
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeItem = useCallback((item: SearchItem) => {
    if (item.type === 'action') {
      if (item.action === 'toggleTheme') {
        onToggleTheme();
      } else if (item.action === 'openCS') {
        const msg = encodeURIComponent("Assalamu'alaikum, Admin PPMA. Saya butuh bantuan terkait sistem absensi.");
        window.open(`https://wa.me/${nomorCs.replace(/\D/g, '')}?text=${msg}`, '_blank', 'noopener,noreferrer');
      }
      onClose();
    } else if (item.type === 'external') {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      onClose();
    } else if (item.href) {
      window.location.href = item.href;
      onClose();
    }
  }, [onClose, onToggleTheme, nomorCs]);

  if (!open) return null;

  const groupLabel = (label: string) => (
    <li className="px-3 pt-3 pb-1">
      <span className="text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1.5">
        {label}
        <span className="flex-1 h-px bg-gray-100 dark:bg-gray-700/60 ml-1" />
      </span>
    </li>
  );

  const renderItem = (item: SearchItem, globalIdx: number) => {
    const Icon = item.icon;
    const isActive = activeIndex === globalIdx;
    return (
      <li key={item.id} data-index={globalIdx}>
        <button
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
            isActive
              ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-700/40'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
          }`}
          onMouseEnter={() => setActiveIndex(globalIdx)}
          onClick={() => executeItem(item)}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
            <Icon size={16} className={item.textColor} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${isActive ? 'text-green-800 dark:text-green-300' : 'text-gray-800 dark:text-gray-100'}`}>
              {item.label}
            </p>
            {item.description && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
            )}
          </div>
          <ArrowRight
            size={14}
            className={`shrink-0 transition-opacity ${isActive ? 'opacity-100 text-green-600 dark:text-green-400' : 'opacity-0'}`}
          />
        </button>
      </li>
    );
  };

  let idx = 0;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 pb-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/60 flex flex-col overflow-hidden animate-[slideDown_0.2s_ease-out]"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <Search size={18} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari halaman, fitur, atau aksi..."
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-mono text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <ul ref={listRef} className="overflow-y-auto py-2 px-2 space-y-0.5" style={{ maxHeight: 'calc(75vh - 60px)' }}>
          {flat.length === 0 ? (
            <li className="py-10 text-center">
              <Search size={32} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Tidak ada hasil untuk <span className="font-semibold">"{query}"</span></p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Coba kata kunci lain</p>
            </li>
          ) : (
            <>
              {pages.length > 0 && (
                <>
                  {groupLabel('📄 Halaman & Menu')}
                  {pages.map(item => renderItem(item, idx++))}
                </>
              )}
              {actions.length > 0 && (
                <>
                  {groupLabel('⚡ Aksi Cepat')}
                  {actions.map(item => {
                    // Override icon untuk toggle theme berdasarkan kondisi saat ini
                    const displayItem = item.id === 'action-theme'
                      ? { ...item, icon: isDark ? Sun : Moon, label: isDark ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap', description: isDark ? 'Beralih ke tampilan terang' : 'Beralih ke tampilan gelap' }
                      : item;
                    return renderItem(displayItem, idx++);
                  })}
                </>
              )}
              {externals.length > 0 && (
                <>
                  {groupLabel('🌐 Aplikasi Lainnya')}
                  {externals.map(item => renderItem(item, idx++))}
                </>
              )}
            </>
          )}
        </ul>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-600">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">↑</kbd><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">↓</kbd> Navigasi</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">Enter</kbd> Buka</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">Esc</kbd> Tutup</span>
          <span className="ml-auto flex items-center gap-1"><Zap size={10} /> {flat.length} hasil</span>
        </div>
      </div>
    </div>
  );
}
