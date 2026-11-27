'use client';

import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

interface KelasCollapseToggleButtonProps {
  sectionKeys: string[];
  collapsedMap: Record<string, boolean>;
  onChangeMap: (next: Record<string, boolean>) => void;
}

/**
 * Tombol Buka Semua / Tutup Semua untuk mengontrol semua kelompok kelas sekaligus pada mode Semua Kelas.
 */
export function KelasCollapseToggleButton({
  sectionKeys,
  collapsedMap,
  onChangeMap,
}: KelasCollapseToggleButtonProps) {
  if (sectionKeys.length === 0) return null;

  const hasAnyCollapsed = sectionKeys.some((k) => Boolean(collapsedMap[k]));

  const handleToggleAll = () => {
    const nextCollapsed = !hasAnyCollapsed;
    const next: Record<string, boolean> = {};
    sectionKeys.forEach((k) => {
      next[k] = nextCollapsed;
    });
    onChangeMap(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggleAll}
      className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-lg transition-colors border border-amber-200 dark:border-amber-800/60 cursor-pointer shrink-0 whitespace-nowrap"
      title="Buka atau tutup semua kelompok kelas sekaligus"
    >
      {hasAnyCollapsed ? 'Buka Semua' : 'Tutup Semua'}
    </button>
  );
}

interface KelasGroupHeaderContentProps {
  namaKelas: string;
  count: number;
  isCollapsed: boolean;
  subtitleBadge?: string;
}

/**
 * Isi bar header per kelas (ikon panah buka/tutup, nama kelas, jumlah santri, dan petunjuk Klik Buka/Tutup)
 * yang digunakan konsisten pada tabel desktop maupun kartu mobile.
 */
export function KelasGroupHeaderContent({
  namaKelas,
  count,
  isCollapsed,
  subtitleBadge,
}: KelasGroupHeaderContentProps) {
  const upperKelas = namaKelas.trim().toUpperCase();
  const kelasHeading = upperKelas.startsWith('KELAS ') ? upperKelas : `KELAS ${upperKelas}`;

  return (
    <div className="flex flex-col items-start gap-1 w-full">
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 shrink-0">
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </div>
          <BookOpen size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-extrabold text-slate-900 dark:text-slate-100 text-[11px] sm:text-xs uppercase tracking-wider text-left break-words">
            --- {kelasHeading} ({count} Santri) ---
          </span>
        </div>
        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 opacity-80 shrink-0 whitespace-nowrap">
          {isCollapsed ? 'Klik Buka ▾' : 'Klik Tutup ▴'}
        </span>
      </div>

      {subtitleBadge && (
        <div className="pl-7">
          <span className="inline-block text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-white/90 dark:bg-amber-900/70 px-2.5 py-0.5 rounded-full border border-amber-300/80 dark:border-amber-700/80 shadow-2xs">
            {subtitleBadge}
          </span>
        </div>
      )}
    </div>
  );
}
