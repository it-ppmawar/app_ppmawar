import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: "Token invalid" }, { status: 401, headers: noCacheHeaders });

    const { searchParams } = new URL(request.url);
    const tipe = searchParams.get("tipe") || "madin";
    const murid_id = searchParams.get("murid_id");
    const guru_id = searchParams.get("guru_id");
    const bulan = searchParams.get("bulan");
    const tahun = searchParams.get("tahun");
    const tanggal_dari = searchParams.get("tanggal_dari");
    const tanggal_sampai = searchParams.get("tanggal_sampai");

    if (!murid_id && !guru_id) {
      return NextResponse.json({ error: "murid_id atau guru_id diperlukan" }, { status: 400, headers: noCacheHeaders });
    }

    const isRentang = !!(tanggal_dari && tanggal_sampai);
    let rows: RowDataPacket[] = [];

    if (tipe === "madin" && murid_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [murid_id, tanggal_dari, tanggal_sampai] : [murid_id, bulan, tahun];
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT a.tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(jm.hari, "") as hari,
          COALESCE(jm.jam_mulai, "") as jam_mulai,
          COALESCE(jm.jam_selesai, "") as jam_selesai,
          COALESCE(jm.mata_pelajaran, "Umum") as mata_pelajaran,
          COALESCE(km.nama_kelas, "-") as kelas_nama,
          "Madin" as tipe_label
         FROM absensi a
         LEFT JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
         LEFT JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
         WHERE a.murid_id = ? AND ${dateWhere}
         ORDER BY a.tanggal DESC, jm.jam_mulai ASC`,
        dateParams
      );
      rows = result;
    } else if (tipe === "quran" && murid_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [murid_id, tanggal_dari, tanggal_sampai] : [murid_id, bulan, tahun];
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT a.tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(jq.hari, "") as hari,
          COALESCE(jq.jam_mulai, "") as jam_mulai,
          COALESCE(jq.jam_selesai, "") as jam_selesai,
          COALESCE(jq.mata_pelajaran, "Tahfidz / Tilawah") as mata_pelajaran,
          COALESCE(kq.nama_kelas, "-") as kelas_nama,
          "Quran" as tipe_label
         FROM absensi_quran a
         LEFT JOIN jadwal_quran jq ON a.jadwal_quran_id = jq.id
         LEFT JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
         WHERE a.murid_id = ? AND ${dateWhere}
         ORDER BY a.tanggal DESC, jq.jam_mulai ASC`,
        dateParams
      );
      rows = result;
    } else if (tipe === "kegiatan" && murid_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [murid_id, tanggal_dari, tanggal_sampai] : [murid_id, bulan, tahun];
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT a.tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(jk.hari, "") as hari,
          COALESCE(jk.jam_mulai, "") as jam_mulai,
          COALESCE(jk.jam_selesai, "") as jam_selesai,
          COALESCE(jk.nama_kegiatan, "Kegiatan Asrama") as mata_pelajaran,
          COALESCE(k.nama_kamar, "-") as kelas_nama,
          "Kegiatan" as tipe_label
         FROM absensi_kegiatan a
         LEFT JOIN jadwal_kegiatan jk ON a.kegiatan_id = jk.kegiatan_id
         LEFT JOIN kamar k ON jk.kamar_id = k.kamar_id
         WHERE a.murid_id = ? AND ${dateWhere}
         ORDER BY a.tanggal DESC, jk.jam_mulai ASC`,
        dateParams
      );
      rows = result;
    } else if (tipe === "guru" && guru_id) {
      const dateWhere = isRentang ? "a.tanggal BETWEEN ? AND ?" : "MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?";
      const dateParams: any[] = isRentang ? [guru_id, tanggal_dari, tanggal_sampai] : [guru_id, bulan, tahun];
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT a.tanggal, a.status, COALESCE(a.keterangan, "") as keterangan,
          COALESCE(a.waktu_absensi, "") as jam_mulai,
          "" as jam_selesai, "" as hari,
          "Mengajar" as mata_pelajaran, "-" as kelas_nama, "Guru" as tipe_label
         FROM absensi_guru a
         WHERE a.guru_id = ? AND ${dateWhere}
         ORDER BY a.tanggal DESC`,
        dateParams
      );
      rows = result;
    }

    const hariNames = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const formatted = rows.map((r: any) => {
      const tgl = r.tanggal ? new Date(r.tanggal) : null;
      const hariLabel = (r.hari && r.hari.trim() !== "")
        ? r.hari
        : (tgl ? hariNames[tgl.getDay()] : "-");

      const statusRaw = (r.status || "").toString();
      const sl = statusRaw.toLowerCase();
      let statusNorm = "Alpha";
      if (sl === "hadir") statusNorm = "Hadir";
      else if (sl === "izin") statusNorm = "Izin";
      else if (sl === "sakit") statusNorm = "Sakit";

      const fmtTime = (t: any) => {
        if (!t || t === "") return "";
        const s = typeof t === "string" ? t : String(t);
        return s.slice(0, 5);
      };

      return {
        tanggal: tgl ? tgl.toISOString().slice(0, 10) : "-",
        hari: hariLabel,
        jam_mulai: fmtTime(r.jam_mulai),
        jam_selesai: fmtTime(r.jam_selesai),
        status: statusNorm,
        keterangan: (r.keterangan || "").trim(),
        mata_pelajaran: r.mata_pelajaran || "-",
        kelas_nama: r.kelas_nama || "-",
        tipe_label: r.tipe_label || tipe,
      };
    });

    return NextResponse.json({ success: true, data: formatted }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("[rekapitulasi/detail] error:", error.message);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500, headers: noCacheHeaders });
  }
}
