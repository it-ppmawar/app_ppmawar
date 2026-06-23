/**
 * googleSheets.ts
 * Helper library untuk koneksi dan operasi ke Google Sheets
 * menggunakan Service Account dari Google Cloud.
 */

import { google } from 'googleapis';

// Ambil kredensial dari environment variables
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
// Ganti literal \n (dari .env) menjadi newline sesungguhnya
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

/**
 * Membuat instance Google Sheets API yang terautentikasi
 */
function getAuthClient() {
  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Memastikan sheet tab dengan nama tertentu ada di Spreadsheet.
 * Jika belum ada, akan dibuat secara otomatis.
 */
async function ensureSheetExists(sheetsApi: any, sheetName: string): Promise<void> {
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = meta.data.sheets?.map((s: any) => s.properties?.title) || [];
  
  if (!existingSheets.includes(sheetName)) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }]
      }
    });
  }
}

/**
 * OVERWRITE: Menghapus semua isi sheet lalu menulis data baru.
 * Cocok untuk data master (Santri, Guru, Jadwal) agar selalu
 * mencerminkan kondisi database terkini.
 */
export async function overwriteSheet(sheetName: string, rows: (string | number | null)[][]): Promise<{ rowsWritten: number }> {
  const sheets = getAuthClient();
  
  await ensureSheetExists(sheets, sheetName);
  
  // 1. Clear semua isi sheet
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  
  // 2. Tulis data baru (jika ada)
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
  }
  
  return { rowsWritten: rows.length };
}

/**
 * APPEND UNIQUE: Menambah baris baru saja, melewati baris yang sudah ada.
 * Cek keunikan berdasarkan nilai di kolom tertentu (misal: kolom A = tanggal, kolom B = nama).
 * Cocok untuk data log transaksi (Rekap Absensi, Ketertiban).
 */
export async function appendSheetUnique(
  sheetName: string,
  headerRow: string[],
  newRows: (string | number | null)[][],
  uniqueKeyColumns: number[] // Indeks kolom yang menjadi kunci unik (0-based)
): Promise<{ appended: number; skipped: number }> {
  const sheets = getAuthClient();
  
  await ensureSheetExists(sheets, sheetName);
  
  // Ambil data yang sudah ada di sheet
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  
  const existingRows: string[][] = (existing.data.values as string[][]) || [];
  
  // Jika sheet kosong, tulis header terlebih dahulu
  if (existingRows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headerRow] },
    });
  }
  
  // Buat Set dari composite key baris yang sudah ada (mulai dari baris ke-2, skip header)
  const existingKeys = new Set<string>();
  for (let i = 1; i < existingRows.length; i++) {
    const key = uniqueKeyColumns.map(ci => String(existingRows[i][ci] || '')).join('||');
    existingKeys.add(key);
  }
  
  // Filter hanya baris baru yang belum ada
  const rowsToAppend = newRows.filter(row => {
    const key = uniqueKeyColumns.map(ci => String(row[ci] || '')).join('||');
    return !existingKeys.has(key);
  });
  
  // Append baris baru
  if (rowsToAppend.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rowsToAppend },
    });
  }
  
  return { appended: rowsToAppend.length, skipped: newRows.length - rowsToAppend.length };
}
