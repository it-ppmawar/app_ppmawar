import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

const SESSIONS_DATA = [
  { "tingkat": "Ula", "kelas": "1A ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "Y", "guru_nama": "FanI nur afifah" },
  { "tingkat": "Ula", "kelas": "1B ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AI", "guru_nama": "Bunga Melati" },
  { "tingkat": "Ula", "kelas": "1C ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "AL", "guru_nama": "hikmatul ibrizah" },
  { "tingkat": "Ula", "kelas": "2A ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "U", "guru_nama": "Laelatul Isroiyah" },
  { "tingkat": "Ula", "kelas": "2B ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AA", "guru_nama": "Khimayatul A." },
  { "tingkat": "Ula", "kelas": "2C ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "Z", "guru_nama": "Siti Uswatun Hasanah" },
  { "tingkat": "Ula", "kelas": "3A ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "AE", "guru_nama": "Dewi Badriyah A.Z." },
  { "tingkat": "Ula", "kelas": "3B ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AH", "guru_nama": "Henis Insyirotul A." },
  { "tingkat": "Ula", "kelas": "3C ULA PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "I", "guru_nama": "Hj. Nurul Khoiriyah" },
  { "tingkat": "Ula", "kelas": "1A ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "U", "guru_nama": "Laelatul Isroiyah" },
  { "tingkat": "Ula", "kelas": "1B ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "M", "guru_nama": "Nurotu Mustaqimah" },
  { "tingkat": "Ula", "kelas": "1C ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "W", "guru_nama": "Ibriza Majidah" },
  { "tingkat": "Ula", "kelas": "2A ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "C", "guru_nama": "Hj. Jamilah" },
  { "tingkat": "Ula", "kelas": "2B ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "S", "guru_nama": "Irdhina Zahidah" },
  { "tingkat": "Ula", "kelas": "2C ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "X", "guru_nama": "Lailyatul Maftuhah" },
  { "tingkat": "Ula", "kelas": "3A ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AI", "guru_nama": "Bunga Melati" },
  { "tingkat": "Ula", "kelas": "3B ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "AM", "guru_nama": "Putri ayu" },
  { "tingkat": "Ula", "kelas": "3C ULA PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AH", "guru_nama": "Henis Insyirotul A." },
  { "tingkat": "Ula", "kelas": "1A ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "T", "guru_nama": "Fera Rahmah" },
  { "tingkat": "Ula", "kelas": "1B ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "S", "guru_nama": "Irdhina Zahidah" },
  { "tingkat": "Ula", "kelas": "1C ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "N", "guru_nama": "Dewi retno sari" },
  { "tingkat": "Ula", "kelas": "2A ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "D", "guru_nama": "Hj. Siti Aisyah" },
  { "tingkat": "Ula", "kelas": "2B ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "AL", "guru_nama": "hikmatul ibrizah" },
  { "tingkat": "Ula", "kelas": "2C ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AH", "guru_nama": "Henis Insyirotul A." },
  { "tingkat": "Ula", "kelas": "3A ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "I", "guru_nama": "Hj. Nurul Khoiriyah" },
  { "tingkat": "Ula", "kelas": "3B ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AJ", "guru_nama": "Ulin Nihayatul Q." },
  { "tingkat": "Ula", "kelas": "3C ULA PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "AM", "guru_nama": "Putri ayu" },
  { "tingkat": "Ula", "kelas": "1A ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "M", "guru_nama": "Nurotu Mustaqimah" },
  { "tingkat": "Ula", "kelas": "1B ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "N", "guru_nama": "Dewi retno sari" },
  { "tingkat": "Ula", "kelas": "1C ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "AE", "guru_nama": "Dewi Badriyah A.Z." },
  { "tingkat": "Ula", "kelas": "2A ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AA", "guru_nama": "Khimayatul A." },
  { "tingkat": "Ula", "kelas": "2B ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "Z", "guru_nama": "Siti Uswatun Hasanah" },
  { "tingkat": "Ula", "kelas": "2C ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "G", "guru_nama": "Ziyanatuddiyanah IR" },
  { "tingkat": "Ula", "kelas": "3A ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AJ", "guru_nama": "Ulin Nihayatul Q." },
  { "tingkat": "Ula", "kelas": "3B ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "X", "guru_nama": "Lailyatul Maftuhah" },
  { "tingkat": "Ula", "kelas": "3C ULA PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AF", "guru_nama": "Nadhifatul M." },
  { "tingkat": "Ula", "kelas": "1A ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "X", "guru_nama": "Lailyatul Maftuhah" },
  { "tingkat": "Ula", "kelas": "1B ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "AD", "guru_nama": "Nikla Shofiyatul F." },
  { "tingkat": "Ula", "kelas": "1C ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "M", "guru_nama": "Nurotu Mustaqimah" },
  { "tingkat": "Ula", "kelas": "2A ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "S", "guru_nama": "Irdhina Zahidah" },
  { "tingkat": "Ula", "kelas": "2B ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AJ", "guru_nama": "Ulin Nihayatul Q." },
  { "tingkat": "Ula", "kelas": "2C ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AA", "guru_nama": "Khimayatul A." },
  { "tingkat": "Ula", "kelas": "3A ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "D", "guru_nama": "Hj. Siti Aisyah" },
  { "tingkat": "Ula", "kelas": "3B ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "I", "guru_nama": "Hj. Nurul Khoiriyah" },
  { "tingkat": "Ula", "kelas": "3C ULA PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "C", "guru_nama": "Hj. Jamilah" },
  { "tingkat": "Wustho", "kelas": "1A WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "Q", "guru_nama": "Hj. Ainul Masruroh" },
  { "tingkat": "Wustho", "kelas": "1B WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "J", "guru_nama": "Zainina Z, Zaretta" },
  { "tingkat": "Wustho", "kelas": "1C WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "O", "guru_nama": "Annisa'atus Salamiyah" },
  { "tingkat": "Wustho", "kelas": "2A WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "G", "guru_nama": "Ziyanatuddiyanah IR" },
  { "tingkat": "Wustho", "kelas": "2B WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "E", "guru_nama": "Hj. Khotimah Suryani" },
  { "tingkat": "Wustho", "kelas": "2C WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "AG", "guru_nama": "gus Ibad" },
  { "tingkat": "Wustho", "kelas": "3A WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "M", "guru_nama": "Nurotu Mustaqimah" },
  { "tingkat": "Wustho", "kelas": "3B WUSTHO PUTRI", "hari": "Jumat", "malam_ket": "Malam Sabtu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "B", "guru_nama": "Hj. Zainab" },
  { "tingkat": "Wustho", "kelas": "1A WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "P", "guru_nama": "Uswatun Hasanah" },
  { "tingkat": "Wustho", "kelas": "1B WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AF", "guru_nama": "Nadhifatul M." },
  { "tingkat": "Wustho", "kelas": "1C WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "K", "guru_nama": "Minnatur Rohmaniyah" },
  { "tingkat": "Wustho", "kelas": "2A WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AJ", "guru_nama": "Ulin Nihayatul Q." },
  { "tingkat": "Wustho", "kelas": "2B WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "O", "guru_nama": "Annisa'atus Salamiyah" },
  { "tingkat": "Wustho", "kelas": "2C WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "B", "guru_nama": "Hj. Zainab" },
  { "tingkat": "Wustho", "kelas": "3A WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "AB", "guru_nama": "Alfiyah" },
  { "tingkat": "Wustho", "kelas": "3B WUSTHO PUTRI", "hari": "Sabtu", "malam_ket": "Malam Ahad", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "F", "guru_nama": "Hj. Siti Lathifatus Sun'iyah" },
  { "tingkat": "Wustho", "kelas": "1A WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "AI", "guru_nama": "Bunga Melati" },
  { "tingkat": "Wustho", "kelas": "1B WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "H", "guru_nama": "Hj. Mufidatul Munawaroh" },
  { "tingkat": "Wustho", "kelas": "1C WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "C", "guru_nama": "Hj. Jamilah" },
  { "tingkat": "Wustho", "kelas": "2A WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "P", "guru_nama": "Uswatun Hasanah" },
  { "tingkat": "Wustho", "kelas": "2B WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "M", "guru_nama": "Nurotu Mustaqimah" },
  { "tingkat": "Wustho", "kelas": "2C WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "J", "guru_nama": "Zainina Z, Zaretta" },
  { "tingkat": "Wustho", "kelas": "3A WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "B", "guru_nama": "Hj. Zainab" },
  { "tingkat": "Wustho", "kelas": "3B WUSTHO PUTRI", "hari": "Ahad", "malam_ket": "Malam Senin", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "G", "guru_nama": "Ziyanatuddiyanah IR" },
  { "tingkat": "Wustho", "kelas": "1A WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "F", "guru_nama": "Hj. Siti Lathifatus Sun'iyah" },
  { "tingkat": "Wustho", "kelas": "1B WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "B", "guru_nama": "Hj. Zainab" },
  { "tingkat": "Wustho", "kelas": "1C WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "P", "guru_nama": "Uswatun Hasanah" },
  { "tingkat": "Wustho", "kelas": "2A WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "AB", "guru_nama": "Alfiyah" },
  { "tingkat": "Wustho", "kelas": "2B WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "D", "guru_nama": "Hj. Siti Aisyah" },
  { "tingkat": "Wustho", "kelas": "2C WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "L", "guru_nama": "Siti Mas'ulah" },
  { "tingkat": "Wustho", "kelas": "3A WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "R", "guru_nama": "Elifatin Maghfiroh" },
  { "tingkat": "Wustho", "kelas": "3B WUSTHO PUTRI", "hari": "Selasa", "malam_ket": "Malam Rabu", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AH", "guru_nama": "Henis Insyirotul A." },
  { "tingkat": "Wustho", "kelas": "1A WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "AF", "guru_nama": "Nadhifatul M." },
  { "tingkat": "Wustho", "kelas": "1B WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "R", "guru_nama": "Elifatin Maghfiroh" },
  { "tingkat": "Wustho", "kelas": "1C WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Akhlaq", "guru_code": "F", "guru_nama": "Hj. Siti Lathifatus Sun'iyah" },
  { "tingkat": "Wustho", "kelas": "2A WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Aqidah", "guru_code": "B", "guru_nama": "Hj. Zainab" },
  { "tingkat": "Wustho", "kelas": "2B WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "G", "guru_nama": "Ziyanatuddiyanah IR" },
  { "tingkat": "Wustho", "kelas": "2C WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Bahasa Arab", "guru_code": "AH", "guru_nama": "Henis Insyirotul A." },
  { "tingkat": "Wustho", "kelas": "3A WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Fiqih", "guru_code": "AC", "guru_nama": "Gus Aan" },
  { "tingkat": "Wustho", "kelas": "3B WUSTHO PUTRI", "hari": "Rabu", "malam_ket": "Malam Kamis", "jam_mulai": "20:00:00", "jam_selesai": "21:00:00", "mata_pelajaran": "Nahwu", "guru_code": "L", "guru_nama": "Siti Mas'ulah" }
];

export async function GET() {
  try {
    const [kelasRows] = await pool.execute<RowDataPacket[]>('SELECT kelas_id, nama_kelas FROM kelas_madin');
    const [guruRows] = await pool.execute<RowDataPacket[]>('SELECT guru_id, nama FROM guru');

    const kelasMap = new Map<string, number>();
    kelasRows.forEach(k => {
      kelasMap.set(k.nama_kelas.trim().toLowerCase(), k.kelas_id);
    });

    const guruMap = new Map<string, number>();
    guruRows.forEach(g => {
      guruMap.set(g.nama.trim().toLowerCase(), g.guru_id);
    });

    const findGuruId = (searchName: string): number | null => {
      if (!searchName) return null;
      const clean = searchName.trim().toLowerCase();
      if (guruMap.has(clean)) return guruMap.get(clean)!;
      for (const [name, id] of guruMap.entries()) {
        if (name.includes(clean) || clean.includes(name)) return id;
      }
      return null;
    };

    const findKelasId = (className: string): number | null => {
      if (!className) return null;
      const clean = className.trim().toLowerCase();
      if (kelasMap.has(clean)) return kelasMap.get(clean)!;

      const match = className.match(/(\d+)\s*([a-cA-C])?\s+(ula|wustho|ulya|ma)\s*(putri|putra)?/i);
      if (match) {
        const num = match[1];
        const letter = match[2] || '';
        const tingkat = match[3].toLowerCase();

        for (const [kName, kId] of kelasMap.entries()) {
          const kLower = kName.toLowerCase();
          if (kLower.includes(num) && kLower.includes(tingkat) && kLower.includes('putri')) {
            if (letter) {
              if (kLower.includes(`(${letter.toLowerCase()})`) || kLower.includes(` ${letter.toLowerCase()}`) || kLower.includes(`${num}${letter.toLowerCase()}`)) {
                return kId;
              }
            } else {
              return kId;
            }
          }
        }
      }

      for (const [kName, kId] of kelasMap.entries()) {
        if (kName.includes(className) || className.includes(kName)) return kId;
      }

      return null;
    };

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of SESSIONS_DATA) {
      const kelas_id = findKelasId(item.kelas);
      const guru_id = findGuruId(item.guru_nama);

      if (!kelas_id) {
        errors.push(`Kelas tidak ditemukan di DB: "${item.kelas}"`);
        skipped++;
        continue;
      }

      const [existing] = await pool.execute<RowDataPacket[]>(
        `SELECT jadwal_id FROM jadwal_madin WHERE kelas_madin_id = ? AND hari = ? AND jam_mulai = ? LIMIT 1`,
        [kelas_id, item.hari, item.jam_mulai]
      );

      if (existing.length > 0) {
        await pool.execute(
          `UPDATE jadwal_madin SET mata_pelajaran = ?, guru_id = ?, jam_selesai = ? WHERE jadwal_id = ?`,
          [item.mata_pelajaran, guru_id, item.jam_selesai, existing[0].jadwal_id]
        );
        updated++;
      } else {
        await pool.execute(
          `INSERT INTO jadwal_madin (hari, jam_mulai, jam_selesai, mata_pelajaran, kelas_madin_id, guru_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [item.hari, item.jam_mulai, item.jam_selesai, item.mata_pelajaran, kelas_id, guru_id]
        );
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_schedules: SESSIONS_DATA.length,
        inserted,
        updated,
        skipped,
        unmatched_kelas_errors: errors
      },
      message: `✅ Sync Jadwal Madin Putri 2026 FIKS berhasil (Malam -> Hari DB)! ${inserted} ditambahkan, ${updated} diperbarui.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
