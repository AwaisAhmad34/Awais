import { jsPDF } from 'jspdf';
import { AccountHead, Transaction, PettyCashTransaction, Campus, OrgSettings } from '../core/aplusEngine';

export interface FinancialReportPdfOptions {
  reportTitle: string;
  reportSubtitle?: string;
  formatNumber?: number;
  formatName?: string;
  campusName: string;
  dateFrom: string;
  dateTo: string;
  schoolName: string;
  orientation?: 'portrait' | 'landscape';
  accountRows?: Array<{
    code: string;
    name: string;
    category: string;
    openDr: number;
    openCr: number;
    periodDr: number;
    periodCr: number;
    closingDr: number;
    closingCr: number;
  }>;
  totals?: {
    openDr: number;
    openCr: number;
    periodDr: number;
    periodCr: number;
    closingDr: number;
    closingCr: number;
    revenue?: number;
    expense?: number;
    netSurplus?: number;
    assets?: number;
    liabilities?: number;
    equity?: number;
  };
  vouchers?: Transaction[];
  pettyCashTransactions?: PettyCashTransaction[];
  signatories?: Array<{
    title: string;
    name?: string;
    designation?: string;
  }>;
}

/**
 * Format currency number to PKR standard string
 */
export function formatPdfCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  if (amount === 0) return '-';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generates and triggers download of a high-fidelity, vector-formatted Financial Report PDF
 */
export async function generateAndDownloadReportPdf(
  options: FinancialReportPdfOptions
): Promise<{ success: boolean; fileName: string }> {
  const orientation = options.orientation || 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const primaryColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const accentColor: [number, number, number] = [79, 70, 229]; // Indigo 600
  const headerBgColor: [number, number, number] = [241, 245, 249]; // Slate 100
  const borderColor: [number, number, number] = [203, 213, 225]; // Slate 300

  // Helper to add institutional header on each page
  const renderHeader = (pageNumber: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, margin, contentWidth, 2, 'F');

    // School Name & Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text(options.schoolName || 'A+ School System', margin, cursorY + 7);

    // Format & Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...accentColor);
    const headerTitle = options.formatName
      ? `${options.formatName}`
      : options.reportTitle;
    doc.text(headerTitle, margin, cursorY + 12);

    if (options.reportSubtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(options.reportSubtitle.slice(0, 95), margin, cursorY + 16);
    }

    // Right-aligned Meta Box (Campus, Period, Date)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    const rightAlignX = pageWidth - margin;
    doc.text(`Campus: ${options.campusName}`, rightAlignX, cursorY + 7, { align: 'right' });
    doc.text(`Period: ${options.dateFrom} to ${options.dateTo}`, rightAlignX, cursorY + 11, {
      align: 'right',
    });
    doc.text(
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      rightAlignX,
      cursorY + 15,
      { align: 'right' }
    );

    // Dividing rule
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    doc.line(margin, cursorY + 19, pageWidth - margin, cursorY + 19);

    cursorY += 23;
  };

  // Helper to render footer with pagination and compliance
  const renderFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 8;
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'A+ Financial Accounting & ERP System · IAS 1 / GAAP Compliant · Confidential',
      margin,
      footerY
    );
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, footerY, {
      align: 'right',
    });
  };

  // Check page break
  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 20) {
      doc.addPage();
      cursorY = margin;
      renderHeader(doc.getNumberOfPages());
      return true;
    }
    return false;
  };

  // Initial header
  renderHeader(1);

  // Summary Metrics Banner (if totals provided)
  if (options.totals) {
    const t = options.totals;
    const bannerHeight = 16;
    checkPageBreak(bannerHeight + 4);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(margin, cursorY, contentWidth, bannerHeight, 1.5, 1.5, 'FD');

    const colWidth = contentWidth / 4;
    const metrics = [
      { label: 'TOTAL OPENING (DR)', val: formatPdfCurrency(t.openDr) },
      { label: 'PERIOD DEBIT (DR)', val: formatPdfCurrency(t.periodDr) },
      { label: 'PERIOD CREDIT (CR)', val: formatPdfCurrency(t.periodCr) },
      { label: 'CLOSING BALANCE', val: formatPdfCurrency(t.closingDr) },
    ];

    if (t.netSurplus !== undefined) {
      metrics[3] = {
        label: t.netSurplus >= 0 ? 'NET SURPLUS (SURPLUS)' : 'NET DEFICIT',
        val: formatPdfCurrency(Math.abs(t.netSurplus)),
      };
    }

    metrics.forEach((m, i) => {
      const colX = margin + i * colWidth + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label, colX, cursorY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`PKR ${m.val}`, colX, cursorY + 12);
    });

    cursorY += bannerHeight + 5;
  }

  // Render Tabular Data (Account Rows or Vouchers)
  if (options.accountRows && options.accountRows.length > 0) {
    // Column widths for landscape vs portrait
    let colWidths: number[];
    let headers: string[];

    if (orientation === 'landscape') {
      // Code, Title, Category, Opening Dr, Opening Cr, Period Dr, Period Cr, Closing Dr, Closing Cr
      colWidths = [22, 60, 28, 28, 28, 28, 28, 28, 28];
      headers = [
        'Code',
        'Account Title',
        'Category',
        'Open Dr',
        'Open Cr',
        'Period Dr',
        'Period Cr',
        'Closing Dr',
        'Closing Cr',
      ];
    } else {
      // Portrait: Code, Title, Category, Period Dr, Period Cr, Net Balance
      colWidths = [24, 60, 24, 26, 26, 26];
      headers = ['Code', 'Account Title', 'Type', 'Period Dr', 'Period Cr', 'Closing Balance'];
    }

    const renderTableHeader = () => {
      doc.setFillColor(...primaryColor);
      doc.rect(margin, cursorY, contentWidth, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);

      let currentX = margin;
      headers.forEach((h, idx) => {
        const w = colWidths[idx] || 25;
        const isRightAligned = idx >= (orientation === 'landscape' ? 3 : 3);
        if (isRightAligned) {
          doc.text(h, currentX + w - 2, cursorY + 4.5, { align: 'right' });
        } else {
          doc.text(h, currentX + 2, cursorY + 4.5);
        }
        currentX += w;
      });
      cursorY += 6.5;
    };

    renderTableHeader();

    options.accountRows.forEach((row, rowIndex) => {
      checkPageBreak(6);

      // Zebra striping
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, cursorY, contentWidth, 5.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      let currentX = margin;
      if (orientation === 'landscape') {
        const cells = [
          row.code,
          row.name.length > 32 ? row.name.slice(0, 30) + '..' : row.name,
          row.category,
          formatPdfCurrency(row.openDr),
          formatPdfCurrency(row.openCr),
          formatPdfCurrency(row.periodDr),
          formatPdfCurrency(row.periodCr),
          formatPdfCurrency(row.closingDr),
          formatPdfCurrency(row.closingCr),
        ];

        cells.forEach((val, idx) => {
          const w = colWidths[idx];
          const isRightAligned = idx >= 3;
          if (isRightAligned) {
            doc.text(val, currentX + w - 2, cursorY + 4, { align: 'right' });
          } else {
            doc.text(val, currentX + 2, cursorY + 4);
          }
          currentX += w;
        });
      } else {
        const closing = row.closingDr > 0 ? row.closingDr : row.closingCr;
        const cells = [
          row.code,
          row.name.length > 30 ? row.name.slice(0, 28) + '..' : row.name,
          row.category,
          formatPdfCurrency(row.periodDr),
          formatPdfCurrency(row.periodCr),
          formatPdfCurrency(closing),
        ];

        cells.forEach((val, idx) => {
          const w = colWidths[idx];
          const isRightAligned = idx >= 3;
          if (isRightAligned) {
            doc.text(val, currentX + w - 2, cursorY + 4, { align: 'right' });
          } else {
            doc.text(val, currentX + 2, cursorY + 4);
          }
          currentX += w;
        });
      }

      cursorY += 5.5;
    });

    // Totals Row
    if (options.totals) {
      checkPageBreak(8);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, cursorY, contentWidth, 7, 'F');
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.3);
      doc.line(margin, cursorY, margin + contentWidth, cursorY);
      doc.line(margin, cursorY + 7, margin + contentWidth, cursorY + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);

      let currentX = margin;
      if (orientation === 'landscape') {
        doc.text('CONSOLIDATED TOTALS', currentX + 2, cursorY + 5);
        currentX += colWidths[0] + colWidths[1] + colWidths[2];

        const tCells = [
          formatPdfCurrency(options.totals.openDr),
          formatPdfCurrency(options.totals.openCr),
          formatPdfCurrency(options.totals.periodDr),
          formatPdfCurrency(options.totals.periodCr),
          formatPdfCurrency(options.totals.closingDr),
          formatPdfCurrency(options.totals.closingCr),
        ];

        tCells.forEach((val, idx) => {
          const w = colWidths[idx + 3];
          doc.text(val, currentX + w - 2, cursorY + 5, { align: 'right' });
          currentX += w;
        });
      } else {
        doc.text('CONSOLIDATED TOTALS', currentX + 2, cursorY + 5);
        currentX += colWidths[0] + colWidths[1] + colWidths[2];

        doc.text(
          formatPdfCurrency(options.totals.periodDr),
          currentX + colWidths[3] - 2,
          cursorY + 5,
          { align: 'right' }
        );
        currentX += colWidths[3];
        doc.text(
          formatPdfCurrency(options.totals.periodCr),
          currentX + colWidths[4] - 2,
          cursorY + 5,
          { align: 'right' }
        );
        currentX += colWidths[4];
        doc.text(
          formatPdfCurrency(options.totals.closingDr),
          currentX + colWidths[5] - 2,
          cursorY + 5,
          { align: 'right' }
        );
      }

      cursorY += 10;
    }
  }

  // 6-Tier Official Signatures Block
  checkPageBreak(28);
  cursorY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('STATUTORY VERIFICATION & SIGNATURE APPROVAL BLOCK', margin, cursorY);
  cursorY += 3;

  const sigBlockY = cursorY;
  const numSigs = options.signatories?.length || 6;
  const sigColWidth = contentWidth / numSigs;

  const defaultSignatories = [
    { title: 'PREPARED BY', designation: 'Branch Accountant' },
    { title: 'CHECKED BY', designation: 'Accounts Officer' },
    { title: 'VERIFIED BY', designation: 'Internal Auditor' },
    { title: 'CAMPUS HEAD', designation: 'Principal / Director' },
    { title: 'FINANCE DIRECTOR', designation: 'Central Secretariat' },
    { title: 'CHAIRMAN / TRUSTEE', designation: 'Governing Board' },
  ];

  const actualSignatories = options.signatories || defaultSignatories;

  actualSignatories.forEach((sig, idx) => {
    const colX = margin + idx * sigColWidth + 2;
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    doc.line(colX, sigBlockY + 14, colX + sigColWidth - 4, sigBlockY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(sig.title, colX + (sigColWidth - 4) / 2, sigBlockY + 18, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.designation || '', colX + (sigColWidth - 4) / 2, sigBlockY + 22, {
      align: 'center',
    });
  });

  // Stamp / Watermark text
  cursorY += 28;

  // Render footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(i, totalPages);
  }

  // Trigger Save / Download
  const safeTitle = (options.reportTitle || 'Financial_Report')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 45);
  const fileName = `APlus_${safeTitle}_${options.dateFrom}_to_${options.dateTo}.pdf`;

  doc.save(fileName);

  return { success: true, fileName };
}
