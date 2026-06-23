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
  
  // Basic column width auto-adjustment (optional, can be improved)
  const colWidths = columns.map(c => ({ wch: Math.max(c.length, 10) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
