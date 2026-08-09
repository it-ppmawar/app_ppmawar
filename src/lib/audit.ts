import pool from '@/lib/db';

interface AuditParams {
  userId: number | null;
  userNama: string;
  userRole: string;
  aksi: string;
  tabel: string;
  recordId?: number | null;
  keterangan?: string;
  dataLama?: any;
  dataBaru?: any;
  ipAddress?: string;
}

/**
 * Catat aksi ke tabel audit_log.
 * Sangat ringan: hanya INSERT 1 baris — tidak blocking.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const {
      userId,
      userNama,
      userRole,
      aksi,
      tabel,
      recordId = null,
      keterangan = '',
      dataLama = null,
      dataBaru = null,
      ipAddress = '',
    } = params;

    await pool.execute(
      `INSERT INTO audit_log
        (user_id, user_nama, user_role, aksi, tabel, record_id, keterangan, data_lama, data_baru, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userNama,
        userRole,
        aksi,
        tabel,
        recordId,
        keterangan,
        dataLama ? JSON.stringify(dataLama) : null,
        dataBaru ? JSON.stringify(dataBaru) : null,
        ipAddress,
      ]
    );
  } catch (e) {
    // Jangan throw — audit log TIDAK boleh menggagalkan operasi utama
    console.error('[AUDIT LOG ERROR]', e);
  }
}
