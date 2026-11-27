export interface KelasMuridSection<T = any> {
  key: string;
  namaKelas: string;
  items: T[];
}

/**
 * Mengelompokkan daftar santri berdasarkan kelas madin untuk tampilan buka/tutup per kelas
 * ketika filter "Semua Kelas" dipilih di halaman Input & Leger Nilai.
 */
export function groupMuridByKelas<T extends { nama_kelas?: string }>(
  murids: T[],
  preserveGroupOrder = false
): KelasMuridSection<T>[] {
  const sections: KelasMuridSection<T>[] = [];
  const sectionMap = new Map<string, T[]>();

  murids.forEach((m) => {
    const namaKelas = (m.nama_kelas || 'Tanpa Kelas').trim() || 'Tanpa Kelas';
    let bucket = sectionMap.get(namaKelas);
    if (!bucket) {
      bucket = [];
      sectionMap.set(namaKelas, bucket);
      sections.push({ key: namaKelas, namaKelas, items: bucket });
    }
    bucket.push(m);
  });

  if (!preserveGroupOrder) {
    sections.sort((a, b) =>
      a.namaKelas.localeCompare(b.namaKelas, 'id', { numeric: true, sensitivity: 'base' })
    );
  }

  return sections;
}
