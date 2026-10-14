import { jsPDF } from 'jspdf';

export interface ReportPdfAccountRow {
  code: string;
  name: string;
  category?: string;
  openDr: number;
  openCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
}

export interface ReportPdfTotals {
  openingDr?: number;
  openDr?: number;
  openingCr?: number;
  openCr?: number;
  periodDr?: number;
  periodCr?: number;
  closingDr?: number;
  closingCr?: number;
  [key: string]: any;
}

export interface GenerateReportPdfOptions {
  reportTitle: string;
  reportSubtitle?: string;
  formatNumber: number;
  formatName: string;
  campusName: string;
  dateFrom: string;
  dateTo: string;
  schoolName: string;
  orientation?: 'portrait' | 'landscape';
  accountRows?: ReportPdfAccountRow[];
  totals?: ReportPdfTotals;
  vouchers?: any[];
  pettyCashTransactions?: any[];
}

export interface GenerateReportPdfResult {
  success: boolean;
  fileName: string;
  totalPages?: number;
}

export async function generateAndDownloadReportPdf(
  options: GenerateReportPdfOptions
): Promise<GenerateReportPdfResult> {
  const {
    reportTitle,
    reportSubtitle = '',
    formatNumber,
    formatName,
    campusName,
    dateFrom,
    dateTo,
    schoolName,
    orientation = 'portrait',
    accountRows = [],
    totals,
  } = options;

  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Header Colors & Style
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, margin, contentWidth, 22, 'F');

  // School & Report Brand
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), margin + 6, margin + 7);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text(reportTitle, margin + 6, margin + 13);

  // Format Tag
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Format #${formatNumber} — ${formatName}`, margin + 6, margin + 18);

  // Right-aligned Campus & Period details in header
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`CAMPUS: ${campusName.toUpperCase()}`, pageWidth - margin - 6, margin + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Period: ${dateFrom} to ${dateTo}`, pageWidth - margin - 6, margin + 13, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin - 6, margin + 18, { align: 'right' });

  let y = margin + 28;

  if (reportSubtitle) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(reportSubtitle, margin, y);
    y += 5;
  }

  // Draw table header
  const isLandscape = orientation === 'landscape';
  
  // Column definitions
  interface ColumnDef {
    header: string;
    width: number;
    align: 'left' | 'right' | 'center';
  }

  const columns: ColumnDef[] = isLandscape
    ? [
        { header: 'Code', width: 22, align: 'left' },
        { header: 'Account Title', width: 65, align: 'left' },
        { header: 'Category', width: 30, align: 'left' },
        { header: 'Open Dr', width: 25, align: 'right' },
        { header: 'Open Cr', width: 25, align: 'right' },
        { header: 'Period Dr', width: 28, align: 'right' },
        { header: 'Period Cr', width: 28, align: 'right' },
        { header: 'Close Dr', width: 27, align: 'right' },
        { header: 'Close Cr', width: 27, align: 'right' },
      ]
    : [
        { header: 'Code', width: 18, align: 'left' },
        { header: 'Account Title', width: 52, align: 'left' },
        { header: 'Open Dr', width: 20, align: 'right' },
        { header: 'Open Cr', width: 20, align: 'right' },
        { header: 'Period Dr', width: 20, align: 'right' },
        { header: 'Period Cr', width: 20, align: 'right' },
        { header: 'Close Dr', width: 20, align: 'right' },
        { header: 'Close Cr', width: 20, align: 'right' },
      ];

  const drawTableHeader = (currentY: number) => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    let x = margin;
    columns.forEach((col) => {
      const textX = col.align === 'right' ? x + col.width - 2 : col.align === 'center' ? x + col.width / 2 : x + 2;
      doc.text(col.header, textX, currentY + 4.8, { align: col.align });
      x += col.width;
    });
  };

  drawTableHeader(y);
  y += 7;

  // Format currency
  const fmt = (n?: number) => {
    if (!n || Math.abs(n) < 0.001) return '-';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  accountRows.forEach((row, idx) => {
    // Check if new page is needed
    if (y > pageHeight - 30) {
      doc.addPage();
      y = margin;
      drawTableHeader(y);
      y += 7;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
    }

    // Row zebra striping
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(margin, y, contentWidth, 5.5, 'F');
    }

    // Border line bottom
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.1);
    doc.line(margin, y + 5.5, margin + contentWidth, y + 5.5);

    let x = margin;
    doc.setTextColor(30, 41, 59);

    if (isLandscape) {
      // Code
      doc.setFont('helvetica', 'bold');
      doc.text(row.code, x + 2, y + 3.8);
      x += 22;

      // Name
      doc.setFont('helvetica', 'normal');
      const truncatedName = row.name.length > 36 ? row.name.substring(0, 34) + '..' : row.name;
      doc.text(truncatedName, x + 2, y + 3.8);
      x += 65;

      // Category
      doc.setTextColor(100, 116, 139);
      doc.text(row.category || 'Ledger', x + 2, y + 3.8);
      x += 30;

      // Opening Dr
      doc.setTextColor(30, 41, 59);
      doc.text(fmt(row.openDr), x + 25 - 2, y + 3.8, { align: 'right' });
      x += 25;

      // Opening Cr
      doc.text(fmt(row.openCr), x + 25 - 2, y + 3.8, { align: 'right' });
      x += 25;

      // Period Dr
      doc.text(fmt(row.periodDr), x + 28 - 2, y + 3.8, { align: 'right' });
      x += 28;

      // Period Cr
      doc.text(fmt(row.periodCr), x + 28 - 2, y + 3.8, { align: 'right' });
      x += 28;

      // Closing Dr
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(row.closingDr), x + 27 - 2, y + 3.8, { align: 'right' });
      x += 27;

      // Closing Cr
      doc.text(fmt(row.closingCr), x + 27 - 2, y + 3.8, { align: 'right' });
    } else {
      // Portrait
      doc.setFont('helvetica', 'bold');
      doc.text(row.code, x + 2, y + 3.8);
      x += 18;

      doc.setFont('helvetica', 'normal');
      const truncatedName = row.name.length > 28 ? row.name.substring(0, 26) + '..' : row.name;
      doc.text(truncatedName, x + 2, y + 3.8);
      x += 52;

      doc.text(fmt(row.openDr), x + 20 - 2, y + 3.8, { align: 'right' });
      x += 20;

      doc.text(fmt(row.openCr), x + 20 - 2, y + 3.8, { align: 'right' });
      x += 20;

      doc.text(fmt(row.periodDr), x + 20 - 2, y + 3.8, { align: 'right' });
      x += 20;

      doc.text(fmt(row.periodCr), x + 20 - 2, y + 3.8, { align: 'right' });
      x += 20;

      doc.setFont('helvetica', 'bold');
      doc.text(fmt(row.closingDr), x + 20 - 2, y + 3.8, { align: 'right' });
      x += 20;

      doc.text(fmt(row.closingCr), x + 20 - 2, y + 3.8, { align: 'right' });
    }

    y += 5.5;
  });

  // Totals Row
  if (totals) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    doc.line(margin, y + 7, margin + contentWidth, y + 7);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    let x = margin;
    const grandOpenDr = totals.openingDr ?? totals.openDr ?? 0;
    const grandOpenCr = totals.openingCr ?? totals.openCr ?? 0;

    if (isLandscape) {
      doc.text('GRAND TOTALS', x + 2, y + 4.8);
      x += 22 + 65 + 30;

      doc.text(fmt(grandOpenDr), x + 25 - 2, y + 4.8, { align: 'right' });
      x += 25;
      doc.text(fmt(grandOpenCr), x + 25 - 2, y + 4.8, { align: 'right' });
      x += 25;
      doc.text(fmt(totals.periodDr), x + 28 - 2, y + 4.8, { align: 'right' });
      x += 28;
      doc.text(fmt(totals.periodCr), x + 28 - 2, y + 4.8, { align: 'right' });
      x += 28;
      doc.text(fmt(totals.closingDr), x + 27 - 2, y + 4.8, { align: 'right' });
      x += 27;
      doc.text(fmt(totals.closingCr), x + 27 - 2, y + 4.8, { align: 'right' });
    } else {
      doc.text('GRAND TOTALS', x + 2, y + 4.8);
      x += 18 + 52;

      doc.text(fmt(grandOpenDr), x + 20 - 2, y + 4.8, { align: 'right' });
      x += 20;
      doc.text(fmt(grandOpenCr), x + 20 - 2, y + 4.8, { align: 'right' });
      x += 20;
      doc.text(fmt(totals.periodDr), x + 20 - 2, y + 4.8, { align: 'right' });
      x += 20;
      doc.text(fmt(totals.periodCr), x + 20 - 2, y + 4.8, { align: 'right' });
      x += 20;
      doc.text(fmt(totals.closingDr), x + 20 - 2, y + 4.8, { align: 'right' });
      x += 20;
      doc.text(fmt(totals.closingCr), x + 20 - 2, y + 4.8, { align: 'right' });
    }

    y += 12;
  }

  // Signatures section at bottom of document
  if (y > pageHeight - 30) {
    doc.addPage();
    y = pageHeight - 28;
  } else {
    y = Math.max(y + 8, pageHeight - 25);
  }

  const sigWidth = contentWidth / 4;
  const sigPositions = [
    { title: 'Prepared By (Accountant)', x: margin },
    { title: 'Checked By (Cashier/Lead)', x: margin + sigWidth },
    { title: 'Authorized (Campus Principal)', x: margin + sigWidth * 2 },
    { title: 'Audited (Platform Admin)', x: margin + sigWidth * 3 },
  ];

  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.2);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  sigPositions.forEach((sig) => {
    doc.line(sig.x + 4, y, sig.x + sigWidth - 4, y);
    doc.text(sig.title, sig.x + sigWidth / 2, y + 4, { align: 'center' });
  });

  // Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} — Official A+ School Multi-Campus Financial System Report — Confidential`,
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
  }

  const cleanFileName = `Aplus_Report_F${formatNumber}_${formatName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateFrom}_to_${dateTo}.pdf`;
  doc.save(cleanFileName);

  return {
    success: true,
    fileName: cleanFileName,
    totalPages,
  };
}
