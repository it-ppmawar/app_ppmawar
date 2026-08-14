'use client';

import React from 'react';

interface SantriIconProps {
  size?: number;
  className?: string;
}

/**
 * Ikon Santri Putra: Siluet Santri berpeci / bersongkok / bersorban
 */
export function SantriPutraIcon({ size = 18, className = '' }: SantriIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block flex-shrink-0 ${className}`}
      aria-label="Santri Putra"
    >
      {/* Peci / Songkok / Kopyah Santri */}
      <path
        d="M6 9.5C6 7 8 5.5 12 5.5C16 5.5 18 7 18 9.5V10.5H6V9.5Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Garis batas peci */}
      <path
        d="M5.5 10H18.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Wajah Santri */}
      <path
        d="M8 10.5C8 12.8 9.8 14.5 12 14.5C14.2 14.5 16 12.8 16 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Telinga */}
      <path
        d="M7 11.5C6.5 11.5 6.5 12.5 7 13M17 11.5C17.5 11.5 17.5 12.5 17 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Bahu & Baju Koko Santri */}
      <path
        d="M5 20.5C5 17.5 8 16.5 12 16.5C16 16.5 19 17.5 19 20.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Kerah Baju Koko */}
      <path
        d="M10 16.8L12 19L14 16.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Ikon Santri Putri: Siluet Santriwati berkerudung / berhijab / bercadar
 */
export function SantriPutriIcon({ size = 18, className = '' }: SantriIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block flex-shrink-0 ${className}`}
      aria-label="Santri Putri"
    >
      {/* Kerudung / Hijab Luar (Kubah atas kepala sampai bahu) */}
      <path
        d="M6 13C6 8 8.5 5 12 5C15.5 5 18 8 18 13C18 16.5 19.5 19 20 20.5C18.5 21 14 21 12 21C10 21 5.5 21 4 20.5C4.5 19 6 16.5 6 13Z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M6 13C6 8 8.5 5 12 5C15.5 5 18 8 18 13C18 16.5 19.5 19 20 20.5C18.5 21 14 21 12 21C10 21 5.5 21 4 20.5C4.5 19 6 16.5 6 13Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bukaan Wajah Kerudung (Oval bukaan hijab santriwati) */}
      <path
        d="M9 10C9 8.5 10.3 7.5 12 7.5C13.7 7.5 15 8.5 15 10C15 12.2 13.7 13.8 12 13.8C10.3 13.8 9 12.2 9 10Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Lipatan bawah dagu kerudung */}
      <path
        d="M12 13.8V17"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Komponen Helper Gender Santri: Menampilkan ikon putra atau putri sesuai nilai gender
 */
export function GenderIcon({
  gender,
  size = 16,
  className = '',
}: {
  gender?: string | null;
  size?: number;
  className?: string;
}) {
  const isPutri =
    gender === 'Perempuan' ||
    gender === 'P' ||
    gender === 'putri' ||
    gender === 'Putri';

  if (isPutri) {
    return <SantriPutriIcon size={size} className={className} />;
  }
  return <SantriPutraIcon size={size} className={className} />;
}

/**
 * Badge Gender Santri Berikon
 */
export function GenderBadge({
  gender,
  className = '',
  size = 'sm',
}: {
  gender?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  const isPutri =
    gender === 'Perempuan' ||
    gender === 'P' ||
    gender === 'putri' ||
    gender === 'Putri';

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 16,
  }[size];

  if (isPutri) {
    return (
      <span
        className={`inline-flex items-center font-bold rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 ${sizeClasses} ${className}`}
      >
        <SantriPutriIcon size={iconSizes} className="text-rose-500" />
        <span>Putri</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 ${sizeClasses} ${className}`}
    >
      <SantriPutraIcon size={iconSizes} className="text-teal-600 dark:text-teal-400" />
      <span>Putra</span>
    </span>
  );
}
