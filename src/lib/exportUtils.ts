import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportOptions {
  title: string;
  subtitle?: string;
  period?: string;
  columns: string[];
  rows: any[][];
  filename: string;
}

export const exportToPDF = (options: ExportOptions & { previewOnly?: boolean }): string | void => {
  const { title, subtitle, period, columns, rows, filename, previewOnly } = options;

  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, 20, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  // Info
  let startY = 30;
  if (subtitle) {
    doc.text(subtitle, 14, startY);
    startY += 6;
  }
  if (period) {
    doc.text(`Periode: ${period}`, 14, startY);
    startY += 6;
  }
  
  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: startY + 6,
    theme: 'grid',
    styles: { fontSize: 9, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], fontStyle: 'bold' } // Formal white design
  });

  if (previewOnly) {
    const blobURL = doc.output('bloburl');
    return blobURL.toString();
  } else {
    doc.save(`${filename}.pdf`);
  }
};

export const exportToExcel = (options: ExportOptions) => {
  const { title, subtitle, period, columns, rows, filename } = options;
  
  const headerData = [
    [title],
  ];
  if (subtitle) headerData.push([subtitle]);
  if (period) headerData.push([`Periode: ${period}`]);
  headerData.push([]); // Empty row
  headerData.push(columns);

  const ws = XLSX.utils.aoa_to_sheet([...headerData, ...rows]);
  
  // Basic column width auto-adjustment
  const colWidths = columns.map(c => ({ wch: Math.max(c.length, 10) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ─── Jadwal Matrix (Pivot) PDF Export ────────────────────────────────────────
// Format: Baris = Kelas (kiri), Kolom = Hari (atas), Sel = Mapel + Guru + Jam
export interface MatrixExportOptions {
  title: string;
  subtitle?: string;
  institution?: string;
  orientation: 'landscape' | 'portrait';
  /** Config setiap baris kelas: key = DB class key, label = teks singkat */
  klasList: { key: string; label: string }[];
  /** Config setiap kolom hari */
  hariList: { key: string; label: string }[];
  /** Map data sel: key = `${hariKey}_${kelasKey}` */
  cellData: { [key: string]: { mapel: string; guruCode: string; jam: string } | null };
  /** Legenda kode guru */
  teacherLegend: { code: string; nama: string }[];
  /** Catatan tambahan di bawah tabel */
  notes?: string[];
  filename: string;
  previewOnly?: boolean;
  /** Menampilkan NGAJI UMUM pada hari Senin (khusus Madin) */
  hasNgajiUmum?: boolean;
}

export const exportMatrixPDF = (options: MatrixExportOptions): string | void => {
  const {
    title, subtitle, institution, orientation,
    klasList, hariList, cellData,
    teacherLegend, notes, filename, previewOnly,
    hasNgajiUmum
  } = options;

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;
  const marginL = 10;
  const marginR = 10;
  const contentWidth = pageWidth - marginL - marginR;

  let curY = 12;

  // ── Header Institusi ────────────────────────────────────────────────────────
  if (institution) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(institution, pageWidth / 2, curY, { align: 'center' });
    curY += 5;
  }

  // ── Judul ───────────────────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 80, 40);
  doc.text(title, pageWidth / 2, curY, { align: 'center' });
  curY += 5;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(subtitle, pageWidth / 2, curY, { align: 'center' });
    curY += 5;
  }

  // Garis pemisah header
  doc.setDrawColor(0, 120, 60);
  doc.setLineWidth(0.5);
  doc.line(marginL, curY, pageWidth - marginR, curY);
  curY += 4;

  // ── Tabel Pivot ─────────────────────────────────────────────────────────────
  // Header: KELAS | Hari1 | Hari2 | ...
  const tableHead = [['KELAS', ...hariList.map(h => h.label)]];

  const tableBody: any[][] = klasList.map(kelas => {
    const row: any[] = [kelas.label];
    hariList.forEach(hari => {
      if (hasNgajiUmum && hari.key === 'Senin') {
        row.push('NGAJI\nUMUM');
      } else {
        const cell = cellData[`${hari.key}_${kelas.key}`];
        if (cell) {
          row.push(`${cell.mapel}\n[${cell.guruCode}]  ${cell.jam}`);
        } else {
          row.push('-');
        }
      }
    });
    return row;
  });

  // Lebar kolom
  const kelasColWidth = orientation === 'landscape' ? 26 : 22;
  const hariCols = hariList.length;
  const hariColWidth = (contentWidth - kelasColWidth) / hariCols;

  // Buat columnStyles dinamis
  const columnStyles: any = {
    0: {
      fillColor: [230, 255, 240],
      fontStyle: 'bold',
      textColor: [0, 80, 30],
      halign: 'center',
      cellWidth: kelasColWidth,
      fontSize: 7.5,
    },
  };
  hariList.forEach((h, i) => {
    if (hasNgajiUmum && h.key === 'Senin') {
      columnStyles[i + 1] = {
        cellWidth: hariColWidth,
        fillColor: [220, 255, 235],
        fontStyle: 'bold',
        textColor: [0, 100, 50],
      };
    } else {
      columnStyles[i + 1] = { cellWidth: hariColWidth };
    }
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: curY,
    margin: { left: marginL, right: marginR },
    theme: 'grid',
    styles: {
      fontSize: 7,
      textColor: [20, 20, 20],
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      cellPadding: 2,
      valign: 'middle',
      halign: 'center',
      overflow: 'linebreak',
      minCellHeight: 11,
    },
    headStyles: {
      fillColor: [0, 100, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 9,
    },
    columnStyles,
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index > 0) {
        const val = (data.cell.raw || '') as string;
        if (val && val !== '-' && val !== 'NGAJI\nUMUM') {
          data.cell.styles.fillColor = [245, 255, 250];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? curY + 10;
  curY = finalY + 6;

  // ── Legenda Guru ─────────────────────────────────────────────────────────────
  if (teacherLegend.length > 0 && curY < pageHeight - 30) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 80, 40);
    doc.text('KODE GURU / ASATIDZAH:', marginL, curY);
    curY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(6.5);

    const colsPerRow = orientation === 'landscape' ? 5 : 3;
    const legendColWidth = contentWidth / colsPerRow;
    teacherLegend.forEach((t, i) => {
      const col = i % colsPerRow;
      const row = Math.floor(i / colsPerRow);
      const x = marginL + col * legendColWidth;
      const y = curY + row * 4;
      if (y < pageHeight - 20) {
        doc.text(`[${t.code}]  ${t.nama}`, x, y);
      }
    });

    curY += Math.ceil(teacherLegend.length / colsPerRow) * 4 + 4;
  }

  // ── Catatan ──────────────────────────────────────────────────────────────────
  if (notes && notes.length > 0 && curY < pageHeight - 15) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(marginL, curY - 1, pageWidth - marginR, curY - 1);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 60, 0);
    doc.text('CATATAN:', marginL, curY + 2);
    curY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7);
    notes.forEach((note, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${note}`, contentWidth);
      lines.forEach((line: string) => {
        if (curY < pageHeight - 12) {
          doc.text(line, marginL, curY);
          curY += 3.5;
        }
      });
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  const printDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.text(`Dicetak: ${printDate}`, pageWidth / 2, pageHeight - 6, { align: 'center' });

  if (previewOnly) {
    return doc.output('bloburl').toString();
  } else {
    doc.save(`${filename}.pdf`);
  }
};

export const exportMatrixExcel = (options: MatrixExportOptions) => {
  const {
    title, subtitle, institution,
    klasList, hariList, cellData,
    teacherLegend, notes, filename,
    hasNgajiUmum
  } = options;

  const headerData: any[][] = [];
  if (institution) headerData.push([institution]);
  headerData.push([title]);
  if (subtitle) headerData.push([subtitle]);
  headerData.push([]); // Empty row

  // Table Header
  const tableHead = ['KELAS', ...hariList.map(h => h.label.replace(/\n/g, ' '))];
  headerData.push(tableHead);

  // Table Body
  const tableBody: any[][] = klasList.map(kelas => {
    const row: any[] = [kelas.label];
    hariList.forEach(hari => {
      if (hasNgajiUmum && hari.key === 'Senin') {
        row.push('NGAJI UMUM');
      } else {
        const cell = cellData[`${hari.key}_${kelas.key}`];
        if (cell) {
          row.push(`${cell.mapel}\n[${cell.guruCode}] ${cell.jam}`);
        } else {
          row.push('-');
        }
      }
    });
    return row;
  });

  const wsData = [...headerData, ...tableBody];
  
  // Teacher Legend
  if (teacherLegend.length > 0) {
    wsData.push([]);
    wsData.push(['KODE GURU / ASATIDZAH:']);
    const legendRows: any[][] = [];
    for (let i = 0; i < teacherLegend.length; i += 5) {
      legendRows.push(teacherLegend.slice(i, i + 5).map(t => `[${t.code}] ${t.nama}`));
    }
    wsData.push(...legendRows);
  }

  // Notes
  if (notes && notes.length > 0) {
    wsData.push([]);
    wsData.push(['CATATAN:']);
    notes.forEach((note, i) => {
      wsData.push([`${i + 1}. ${note}`]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
