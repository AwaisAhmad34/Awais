import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();

// Color Palette
const primaryNavy = [15, 23, 42];     // slate-900
const accentIndigo = [79, 70, 229];   // indigo-600
const accentEmerald = [16, 185, 129]; // emerald-500
const darkText = [30, 41, 59];        // slate-800
const lightMuted = [100, 116, 139];   // slate-500
const cardBg = [248, 250, 252];       // slate-50
const cardBorder = [226, 232, 240];   // slate-200

// Helper Header
function drawHeader(title, pageNum, totalPages) {
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('APLUS MULTI-CAMPUS SCHOOL ERP SYSTEM', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(199, 210, 254);
  doc.text('Master System Credentials & Production Deployment Directory (IAS-1 & GAAP Compliant)', 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`PAGE ${pageNum} OF ${totalPages}`, pageWidth - 14, 14, { align: 'right' });
}

function drawFooter() {
  doc.setDrawColor(...cardBorder);
  doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...lightMuted);
  doc.text('Aplus Multi-Campus ERP • Production Security & Clearance Directory • Vercel Deployment Guide', 14, pageHeight - 7);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
}

// ================= PAGE 1 =================
drawHeader('Master System Credentials', 1, 2);

let y = 32;

// Document Title Block
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.setTextColor(...primaryNavy);
doc.text('Production Access Credentials & Roles Directory', 14, y);
y += 6;

doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(...lightMuted);
doc.text('Official account credentials across all 5 operational clearance tiers for staging, testing, and production deployment on Vercel.', 14, y);
y += 9;

// Notice Box for Vercel Deployments
doc.setFillColor(238, 242, 255); // indigo-50
doc.setDrawColor(199, 210, 254); // indigo-200
doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'FD');

doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.setTextColor(...accentIndigo);
doc.text('CRITICAL NOTICE FOR VERCEL PRODUCTION DEPLOYMENTS:', 18, y + 6);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(...darkText);
doc.text('When launching on Vercel, fresh visitor browsers have empty localStorage. The application features an automatic production bootstrap', 18, y + 11);
doc.text('layer that pre-provisions all seed accounts below immediately upon page load. If testing on a new domain, use any account below.', 18, y + 16);
doc.text('For cloud multi-device sync, ensure your Vercel domain (*.vercel.app) is authorized in Firebase Authentication settings.', 18, y + 21);
y += 29;

// Table Section Title
doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.setTextColor(...primaryNavy);
doc.text('1. Master Accounts & Login Clearance Matrix', 14, y);
y += 5;

// Table Header
const colX = [14, 52, 86, 122, 160];
const colW = [38, 34, 36, 38, 36];
doc.setFillColor(...primaryNavy);
doc.rect(14, y, pageWidth - 28, 7, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(7.5);
doc.setTextColor(255, 255, 255);
doc.text('ROLE / TIER', colX[0] + 2, y + 4.8);
doc.text('USERNAME', colX[1] + 2, y + 4.8);
doc.text('PASSWORD', colX[2] + 2, y + 4.8);
doc.text('ORGANIZATION / BRANCH', colX[3] + 2, y + 4.8);
doc.text('PERMISSIONS & SCOPE', colX[4] + 2, y + 4.8);
y += 7;

// Table Rows Data
const rows = [
  {
    role: 'Level 1: Site Owner\n(Platform Super Admin)',
    user: 'admin',
    pass: 'admin',
    org: 'Global Platform\n(All Clients & Campuses)',
    scope: 'Full Control: Site Admin Hub, Module Governance, Cloud Sync, Edit/Delete Any Campus',
    highlight: true,
  },
  {
    role: 'Level 2: Client Admin\n(Aplus School System)',
    user: 'client.admin',
    pass: 'campus',
    org: 'Aplus School System\n(Tenant Client Hub)',
    scope: 'Tenant Management Hub: Sub-Campus Management, Branch Accounts, Consolidated P&L',
    highlight: false,
  },
  {
    role: 'Level 2: Client Admin\n(Apex Grammar Academy)',
    user: 'apex.admin',
    pass: 'campus',
    org: 'Apex Grammar Academy\n(Isolated Workspace)',
    scope: 'Tenant Management Hub: Apex Branch Overview, Sub-Campus Registration, Client Reports',
    highlight: false,
  },
  {
    role: 'Level 3/4: Branch Accountant\n(Khiali Main Campus)',
    user: 'main',
    pass: 'campus',
    org: 'Khiali Campus\n(Main Branch - Aplus)',
    scope: 'Operational Ledger: Cash & Bank Vouchers (BPV, BRV, CPV, CRV, JV), Petty Cash Imprest',
    highlight: false,
  },
  {
    role: 'Level 3/4: Branch Accountant\n(People\'s Colony Branch)',
    user: 'peoples',
    pass: 'campus',
    org: 'People\'s Colony Campus\n(Satellite Sub-Campus)',
    scope: 'Branch Cashbook: Daily Petty Cash Disbursements, Voucher Queue, Physical Cash Audit',
    highlight: false,
  },
  {
    role: 'Level 3/4: Branch Accountant\n(DC Colony Branch)',
    user: 'dc',
    pass: 'campus',
    org: 'DC Colony Campus\n(Satellite Sub-Campus)',
    scope: 'Branch Operations: Cash Reconciliation, Voucher Submissions, Local Branch Ledger',
    highlight: false,
  },
  {
    role: 'Level 3/4: Branch Accountant\n(Model Town Branch)',
    user: 'model',
    pass: 'campus',
    org: 'Model Town Campus\n(Satellite Sub-Campus)',
    scope: 'Branch Accounting: Petty Cash Float Replenishment, Daily Voucher Posting, Reports',
    highlight: false,
  },
  {
    role: 'Level 3/4: Branch Accountant\n(Cantt Branch)',
    user: 'cantt',
    pass: 'campus',
    org: 'Cantt Campus\n(Satellite Sub-Campus)',
    scope: 'Branch Accounting: Double-entry Bookkeeping, Vouchers, Local Balance Sheet',
    highlight: false,
  },
  {
    role: 'Level 3/4: Branch Accountant\n(City Campus Branch)',
    user: 'city',
    pass: 'campus',
    org: 'City Campus\n(Satellite Sub-Campus)',
    scope: 'Branch Operations: Daily Cashbook, Local Bank Reconciliations, Expense Logs',
    highlight: false,
  },
  {
    role: 'Level 5: Senior Auditor\n(Internal Compliance)',
    user: 'auditor',
    pass: 'campus',
    org: 'Global System\n(Independent Review)',
    scope: 'Read-Only Audit: Multi-Campus Ledger Review, 7-Day Physical Cash Vault Logs, Audit Trail',
    highlight: false,
  },
];

rows.forEach((r, idx) => {
  const rowHeight = 11.5;
  const isAlt = idx % 2 === 1;

  if (r.highlight) {
    doc.setFillColor(236, 253, 245); // emerald-50
  } else if (isAlt) {
    doc.setFillColor(248, 250, 252); // slate-50
  } else {
    doc.setFillColor(255, 255, 255);
  }

  doc.rect(14, y, pageWidth - 28, rowHeight, 'F');
  doc.setDrawColor(...cardBorder);
  doc.line(14, y + rowHeight, pageWidth - 14, y + rowHeight);

  // Role
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...darkText);
  doc.text(r.role, colX[0] + 2, y + 3.8);

  // Username
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...(r.highlight ? accentEmerald : accentIndigo));
  doc.text(r.user, colX[1] + 2, y + 5);

  // Password
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(r.pass, colX[2] + 2, y + 5);

  // Organization
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...darkText);
  doc.text(r.org, colX[3] + 2, y + 3.8);

  // Scope
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...lightMuted);
  const splitScope = doc.splitTextToSize(r.scope, 34);
  doc.text(splitScope, colX[4] + 2, y + 3.5);

  y += rowHeight;
});

drawFooter();

// ================= PAGE 2 =================
doc.addPage();
drawHeader('Production & Vercel Guide', 2, 2);

y = 32;

doc.setFont('helvetica', 'bold');
doc.setFontSize(14);
doc.setTextColor(...primaryNavy);
doc.text('2. Step-by-Step Vercel Deployment & Production Setup', 14, y);
y += 6;

doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...lightMuted);
doc.text('Follow these standard deployment instructions to guarantee immediate login and uninterrupted database sync on Vercel.', 14, y);
y += 8;

// Deployment Steps Cards
const steps = [
  {
    num: 'STEP 01',
    title: 'Deploy Directly from GitHub Repository',
    desc: 'Push your codebase to GitHub and import the repository into your Vercel Dashboard. The build preset automatically uses "vite build" with output directory "dist". No build command overrides are required.',
  },
  {
    num: 'STEP 02',
    title: 'First-Time Sign In with Master Site Owner Account',
    desc: 'Open your generated Vercel production URL (e.g., https://your-app.vercel.app). At the unified login gateway, enter username: "admin" and password: "admin". You will be immediately granted Level 1 Site Owner access.',
  },
  {
    num: 'STEP 03',
    title: 'Authorize Vercel Domain in Firebase Console',
    desc: 'Open the Firebase Console for your project (gen-lang-client-0191400825). Navigate to Authentication > Settings > Authorized Domains. Click "Add Domain" and add your Vercel domain (e.g., your-project.vercel.app). This unlocks cloud sync.',
  },
  {
    num: 'STEP 04',
    title: 'Initialize & Push Initial Cloud Snapshot',
    desc: 'From the Platform Site Admin Hub, go to Section 10 (Cloud Sync & Backup) and click "Sync to Cloud". This establishes the master snapshot in Firestore so changes made by any user propagate across all devices in real-time.',
  },
  {
    num: 'STEP 05',
    title: 'Distribute Branch & Auditor Credentials',
    desc: 'Provide your campus accountants with their branch username (e.g., "main", "peoples", "cantt") and default password "campus". Branch accountants can only view their authorized campus ledgers and petty cash books.',
  },
];

steps.forEach((s) => {
  doc.setFillColor(...cardBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(14, y, pageWidth - 28, 17, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...accentIndigo);
  doc.text(s.num, 18, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text(s.title, 36, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...darkText);
  const splitDesc = doc.splitTextToSize(s.desc, pageWidth - 54);
  doc.text(splitDesc, 18, y + 9.5);

  y += 19.5;
});

y += 3;

// Section 3: Executive Dashboard & Governance Rules
doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.setTextColor(...primaryNavy);
doc.text('3. Executive Dashboard & Role Governance Constitution', 14, y);
y += 5;

const governancePoints = [
  '• Executive Dashboard Isolation: The Executive Dashboard is reserved strictly for high-level financial KPIs, revenue vs expense telemetry, petty cash breakdown charts, and campus budget comparisons.',
  '• Site Owner Exclusivity: Permission Engine, AI Expense Suggester, Approval Matrix, Cloud Sync/Load, Bulk Approvals, Restore Deleted COA, Audit Trail, and System Settings are strictly reserved for Level 1 Site Owner ("admin").',
  '• Multi-Tenant Isolation: Level 2 Client Super Admins can only see and manage branches belonging to their own organization. All child transactions and cash records are completely isolated.',
  '• Branch Accountant Least Privilege: Campus accountants (Levels 3 & 4) only operate daily voucher entry, petty cash logs, and vault reconciliation within their designated campus boundary.',
];

governancePoints.forEach((pt) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkText);
  const splitPt = doc.splitTextToSize(pt, pageWidth - 32);
  doc.text(splitPt, 16, y);
  y += splitPt.length * 4 + 1;
});

drawFooter();

// Output PDF to public directory
const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(path.join(outDir, 'SYSTEM_CREDENTIALS_DIRECTORY.pdf'), pdfBuffer);

console.log('Successfully generated public/SYSTEM_CREDENTIALS_DIRECTORY.pdf (' + pdfBuffer.length + ' bytes)');
