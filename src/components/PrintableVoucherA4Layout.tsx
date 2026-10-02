import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  Sliders,
  FileText,
  CheckCircle2,
  X,
  Building2,
} from 'lucide-react';
import {
  Transaction,
  Campus,
  OrgSettings,
  SchoolLogo,
  useAccounting,
  generateElementPdf,
  printOrDownloadElement,
} from '../core/aplusEngine';
import { DynamicReportSignatureBlock } from './ReportSignatureManager';

export type StandardVoucherType = 'BPV' | 'BRV' | 'CPV' | 'CRV' | 'JV';

export type A4PaddingPreset = 'compact' | 'standard' | 'spacious';
export type A4TypographyScale = '10pt' | '11pt' | '12pt';

export interface PrintableVoucherA4LayoutProps {
  voucher: Transaction & {
    createdBy?: string;
    approvedAt?: string;
  };
  campus?: Campus;
  orgSettings?: OrgSettings;
  customDateRange?: string;
  payTo?: string;
  postedBy?: string;
  paddingPreset?: A4PaddingPreset;
  typographyScale?: A4TypographyScale;
  showConfigureBar?: boolean;
  className?: string;
}

const VOUCHER_TYPE_META: Record<
  StandardVoucherType,
  {
    fullTitle: string;
    shortCode: StandardVoucherType;
    partyLabel: string;
    instrumentLabel: string;
    voucherCategoryLabel: string;
  }
> = {
  BPV: {
    fullTitle: 'Bank Payment Voucher',
    shortCode: 'BPV',
    partyLabel: 'Pay to',
    instrumentLabel: 'Cheque / Instrument No',
    voucherCategoryLabel: 'BANK DISBURSEMENT INSTRUMENT (BPV)',
  },
  BRV: {
    fullTitle: 'Bank Receipt Voucher',
    shortCode: 'BRV',
    partyLabel: 'Received from',
    instrumentLabel: 'Deposit Slip / Instrument No',
    voucherCategoryLabel: 'BANK RECEIPT INSTRUMENT (BRV)',
  },
  CPV: {
    fullTitle: 'Cash Payment Voucher',
    shortCode: 'CPV',
    partyLabel: 'Pay to',
    instrumentLabel: 'Cash Voucher / Bill Ref',
    voucherCategoryLabel: 'CASH DISBURSEMENT INSTRUMENT (CPV)',
  },
  CRV: {
    fullTitle: 'Cash Receipt Voucher',
    shortCode: 'CRV',
    partyLabel: 'Received from',
    instrumentLabel: 'Cash Receipt / Challan No',
    voucherCategoryLabel: 'CASH RECEIPT INSTRUMENT (CRV)',
  },
  JV: {
    fullTitle: 'Journal Voucher',
    shortCode: 'JV',
    partyLabel: 'Account Reference',
    instrumentLabel: 'Journal Reference No',
    voucherCategoryLabel: 'GENERAL JOURNAL ADJUSTMENT (JV)',
  },
};

function formatVoucherDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatPKR(val?: number): string {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberToWordsPKR(amount?: number): string {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Rupees Zero Only';

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const convertBelowThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    }
    return (
      ones[Math.floor(n / 100)] +
      ' Hundred' +
      (n % 100 !== 0 ? ' and ' + convertBelowThousand(n % 100) : '')
    );
  };

  let remaining = Math.abs(num);
  const parts: string[] = [];

  const billions = Math.floor(remaining / 1_000_000_000);
  if (billions > 0) {
    parts.push(`${convertBelowThousand(billions)} Billion`);
    remaining %= 1_000_000_000;
  }

  const millions = Math.floor(remaining / 1_000_000);
  if (millions > 0) {
    parts.push(`${convertBelowThousand(millions)} Million`);
    remaining %= 1_000_000;
  }

  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    parts.push(`${convertBelowThousand(thousands)} Thousand`);
    remaining %= 1000;
  }

  if (remaining > 0) {
    parts.push(convertBelowThousand(remaining));
  }

  return `Rupees ${parts.join(' ')} Only`;
}

const PADDING_CLASS_MAP: Record<A4PaddingPreset, string> = {
  compact: 'a4-voucher-pad-compact',
  standard: 'a4-voucher-pad-standard',
  spacious: 'a4-voucher-pad-spacious',
};

const TYPOGRAPHY_CLASS_MAP: Record<A4TypographyScale, string> = {
  '10pt': 'a4-voucher-typo-10pt',
  '11pt': 'a4-voucher-typo-11pt',
  '12pt': 'a4-voucher-typo-12pt',
};

export const PrintableVoucherA4Layout: React.FC<PrintableVoucherA4LayoutProps> = ({
  voucher,
  campus,
  orgSettings,
  customDateRange,
  payTo,
  postedBy,
  paddingPreset: initialPadding = 'standard',
  typographyScale: initialTypo = '11pt',
  showConfigureBar = true,
  className = '',
}) => {
  const [paddingPreset, setPaddingPreset] = useState<A4PaddingPreset>(initialPadding);
  const [typographyScale, setTypographyScale] =
    useState<A4TypographyScale>(initialTypo);

  const vType: StandardVoucherType =
    voucher.voucherType && VOUCHER_TYPE_META[voucher.voucherType]
      ? voucher.voucherType
      : 'BPV';
  const meta = VOUCHER_TYPE_META[vType];

  const formattedDate = formatVoucherDate(voucher.date);
  const dateRangeDisplay = customDateRange || `${formattedDate} to ${formattedDate}`;

  const campusDisplayName = (campus?.name || 'CVT Campus')
    .replace(/A\+\s*School\s*System\s*\(?|\)?/gi, '')
    .trim()
    .toUpperCase();

  const resolvedPartyName =
    payTo ||
    (vType === 'BPV' || vType === 'CPV'
      ? voucher.entries?.find((e) => e.debit > 0)?.accountName || ''
      : voucher.entries?.find((e) => e.credit > 0)?.accountName || '');

  const resolvedPostedBy =
    postedBy || voucher.preparedBy || campus?.accountantName || 'Maqsood Ahmad';

  const resolvedInstrumentNo =
    voucher.chequeNo ||
    voucher.entries?.find((e) => e.refCheckNo)?.refCheckNo ||
    '';

  return (
    <div className="w-full">
      {/* Screen-only A4 Layout Padding & Typography Controls */}
      {showConfigureBar && (
        <div
          data-no-print="true"
          className="print:hidden mb-3 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700"
        >
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>A4 Print Layout Specification ({meta.shortCode}):</span>
            <span className="font-mono text-[11px] text-slate-500 font-normal">
              ISO A4 (210mm × 297mm) • Print-Exact Borders & Tabular Numerals
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600">
                A4 Margin / Padding:
              </span>
              {(['compact', 'standard', 'spacious'] as A4PaddingPreset[]).map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPaddingPreset(preset)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                      paddingPreset === preset
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset === 'compact'
                      ? 'Compact (8mm)'
                      : preset === 'standard'
                      ? 'Standard (12mm)'
                      : 'Spacious (16mm)'}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600">
                Typography:
              </span>
              {(['10pt', '11pt', '12pt'] as A4TypographyScale[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setTypographyScale(sz)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    typographyScale === sz
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Printable A4 Voucher Document Surface */}
      <div
        className={`official-voucher-document a4-voucher-sheet bg-white text-black mx-auto ${PADDING_CLASS_MAP[paddingPreset]} ${TYPOGRAPHY_CLASS_MAP[typographyScale]} ${className}`}
      >
        {/* Top Institutional Header Row */}
        <div className="flex items-start justify-between gap-4 pb-2.5">
          <div className="flex items-center gap-4">
            <SchoolLogo
              campusId={voucher.campusId || campus?.id}
              size="lg"
              className="w-16 h-16 shrink-0"
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-black font-sans">
                {orgSettings?.schoolName || 'A+ School System'} •{' '}
                {meta.voucherCategoryLabel}
              </div>
              <h1 className="a4-voucher-title font-serif font-bold text-black tracking-tight leading-tight mt-0.5">
                {meta.fullTitle}
              </h1>
              <div className="text-xs font-bold text-black mt-1 font-sans">
                {dateRangeDisplay}
              </div>
            </div>
          </div>

          <div className="border-2 border-black text-center shrink-0 min-w-[175px] bg-white">
            <div className="text-[11px] font-bold text-black uppercase border-b-2 border-black py-1 px-3 tracking-wide">
              Campus Name
            </div>
            <div className="text-sm font-black text-black uppercase py-1.5 px-3 tracking-wider">
              {campusDisplayName || 'CVT CAMPUS'}
            </div>
            <div className="text-[10px] font-mono font-bold text-black border-t border-black py-0.5 px-2">
              Voucher Type: {meta.shortCode}
            </div>
          </div>
        </div>

        <hr className="border-t-2 border-black my-3" />

        {/* Payee / Payer, Rupees, Instrument & Narration Lines */}
        <div className="space-y-2.5 my-3.5 text-black a4-voucher-body-text">
          <div className="flex items-baseline gap-2">
            <span className="font-bold shrink-0 w-24">{meta.partyLabel}:</span>
            <div className="flex-1 border-b border-black pb-0.5 px-2 font-semibold min-h-[20px]">
              {resolvedPartyName}
            </div>
            <span className="font-bold shrink-0 ml-3">Rupees (PKR):</span>
            <div className="w-56 border-b border-black pb-0.5 px-2 font-bold font-mono tabular-nums text-right min-h-[20px]">
              {formatPKR(voucher.totalDebit)}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold shrink-0 w-24">On Account of:</span>
            <div className="flex-1 border-b border-black pb-0.5 px-2 font-medium min-h-[20px]">
              {voucher.narration || ''}
            </div>
            {resolvedInstrumentNo && (
              <>
                <span className="font-bold shrink-0 ml-3">
                  {vType === 'BPV' || vType === 'BRV' ? 'Cheque / Ref:' : 'Ref No:'}
                </span>
                <div className="w-40 border-b border-black pb-0.5 px-2 font-mono font-bold min-h-[20px]">
                  {resolvedInstrumentNo}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Double-Entry Ledger Table */}
        <div className="my-4">
          <table className="w-full border-collapse border-2 border-black a4-voucher-table">
            <thead>
              <tr className="border-b-2 border-black font-bold bg-white">
                <td
                  colSpan={3}
                  className="border-r-2 border-black px-3 py-1.5 text-left font-bold text-black"
                >
                  Voucher No:{' '}
                  <span className="font-mono font-bold">{voucher.voucherNo}</span>
                </td>
                <td
                  colSpan={2}
                  className="border-r-2 border-black px-3 py-1.5 text-left font-bold text-black"
                >
                  Tr Date : <span className="font-bold">{formattedDate}</span>
                </td>
                <td
                  colSpan={2}
                  className="px-3 py-1.5 text-left font-bold text-black"
                >
                  Period:{' '}
                  <span className="font-bold">
                    {voucher.accountingPeriod || 'FY 2025-2026'}
                  </span>
                </td>
              </tr>
              <tr className="border-b-2 border-black font-bold text-center bg-white text-black">
                <th className="border-r-2 border-black py-1.5 px-1.5 w-10 text-center">
                  S#
                </th>
                <th className="border-r-2 border-black py-1.5 px-2 w-24 text-center font-mono">
                  Acc#
                </th>
                <th className="border-r-2 border-black py-1.5 px-2.5 min-w-[185px] text-left">
                  Account Name
                </th>
                <th className="border-r-2 border-black py-1.5 px-2 w-28 text-center">
                  Ref/Check No
                </th>
                <th className="border-r-2 border-black py-1.5 px-2.5 text-left">
                  Description / Particulars
                </th>
                <th className="border-r-2 border-black py-1.5 px-2.5 w-28 text-right font-mono">
                  Debit
                </th>
                <th className="py-1.5 px-2.5 w-28 text-right font-mono">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(voucher.entries || []).map((entry, idx) => (
                <tr
                  key={entry.id || idx}
                  className="border-b border-black text-black bg-white"
                >
                  <td className="border-r-2 border-black py-1.5 px-1.5 text-center font-medium tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="border-r-2 border-black py-1.5 px-2 text-center font-mono font-bold text-black tabular-nums">
                    {entry.accountCode}
                  </td>
                  <td className="border-r-2 border-black py-1.5 px-2.5 font-semibold text-left">
                    {entry.accountName}
                  </td>
                  <td className="border-r-2 border-black py-1.5 px-2 text-center font-mono text-[11px]">
                    {entry.refCheckNo || voucher.chequeNo || ''}
                  </td>
                  <td className="border-r-2 border-black py-1.5 px-2.5 text-left">
                    {entry.description || voucher.narration || ''}
                  </td>
                  <td className="border-r-2 border-black py-1.5 px-2.5 text-right font-mono font-medium tabular-nums">
                    {entry.debit > 0 ? formatPKR(entry.debit) : '0.00'}
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-medium tabular-nums">
                    {entry.credit > 0 ? formatPKR(entry.credit) : '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-bold bg-white text-black">
                <td
                  colSpan={5}
                  className="border-r-2 border-black px-3 py-2 text-left font-bold"
                >
                  {numberToWordsPKR(voucher.totalDebit)}
                </td>
                <td className="border-r-2 border-black px-2.5 py-2 text-right font-mono font-bold tabular-nums">
                  {formatPKR(voucher.totalDebit)}
                </td>
                <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums">
                  {formatPKR(voucher.totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Dynamic Institutional Signatory Matrix (Controlled by Super Admin & Campus Signature Rules) */}
        <DynamicReportSignatureBlock
          reportKey="vouchers_pettycash"
          campusIdOverride={voucher.campusId}
          dateText={formattedDate}
          docRef={voucher.voucherNo}
          periodText={voucher.accountingPeriod || 'FY 2026-2027'}
          campusRef={campus?.code || 'MAIN'}
        />

        {/* Verification & Audit Metadata Footer */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-black border-t border-black pt-1.5 font-mono">
          <div>
            <span>
              Verification Status: <strong>{voucher.status}</strong>
            </span>
            {voucher.approvedAt && (
              <span>
                {' '}
                • Approved At:{' '}
                {new Date(voucher.approvedAt).toLocaleDateString('en-GB')}
              </span>
            )}
            <span> • Type: {meta.shortCode} ({meta.fullTitle})</span>
          </div>
          <div>
            <span>Audit Log ID: {voucher.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SAMPLE_FOUR_VOUCHERS: Record<StandardVoucherType, Transaction> = {
  BPV: {
    id: 'sample-bpv-001',
    voucherNo: 'BPV-C1-26-001',
    voucherType: 'BPV',
    campusId: 'campus-khiali',
    date: '2026-03-25',
    accountingPeriod: 'FY 2025-2026',
    narration: 'Monthly electricity utility bill payment via crossed cheque',
    chequeNo: 'CHQ-8849201',
    status: 'Approved',
    preparedBy: 'Maqsood Ahmad',
    approvedBy: 'Sir Naveed Sab',
    totalDebit: 85400,
    totalCredit: 85400,
    entries: [
      {
        id: '1',
        accountId: 'acc-500-2-01',
        accountCode: '500-2-01',
        accountName: 'Electricity Bill Expense',
        description: 'GEPCO electricity bill for March 2026',
        debit: 85400,
        credit: 0,
        refCheckNo: 'CHQ-8849201',
      },
      {
        id: '2',
        accountId: 'acc-100-4-02',
        accountCode: '100-4-02',
        accountName: 'Meezan Bank (09070104317815)',
        description: 'Paid via Meezan Bank Cheque #8849201',
        debit: 0,
        credit: 85400,
        refCheckNo: 'CHQ-8849201',
      },
    ],
  },
  BRV: {
    id: 'sample-brv-001',
    voucherNo: 'BRV-C1-26-001',
    voucherType: 'BRV',
    campusId: 'campus-khiali',
    date: '2026-03-25',
    accountingPeriod: 'FY 2025-2026',
    narration: 'Student tuition fee challans collected via bank deposit',
    chequeNo: 'DEP-2026-319',
    status: 'Approved',
    preparedBy: 'Maqsood Ahmad',
    approvedBy: 'Sir Naveed Sab',
    totalDebit: 245000,
    totalCredit: 245000,
    entries: [
      {
        id: '1',
        accountId: 'acc-100-4-03',
        accountCode: '100-4-03',
        accountName: 'Bank of Punjab (6020204062600026)',
        description: 'Tuition fee batch deposit slip #DEP-2026-319',
        debit: 245000,
        credit: 0,
        refCheckNo: 'DEP-2026-319',
      },
      {
        id: '2',
        accountId: 'acc-400-1-01',
        accountCode: '400-1-01',
        accountName: 'Tution Fee',
        description: 'Monthly tuition fee collection for March 2026',
        debit: 0,
        credit: 245000,
        refCheckNo: 'DEP-2026-319',
      },
    ],
  },
  CPV: {
    id: 'sample-cpv-001',
    voucherNo: 'CPV-C1-26-001',
    voucherType: 'CPV',
    campusId: 'campus-khiali',
    date: '2026-03-25',
    accountingPeriod: 'FY 2025-2026',
    narration: 'Cash payment for examination question papers & stationery',
    chequeNo: 'BILL-4092',
    status: 'Approved',
    preparedBy: 'Maqsood Ahmad',
    approvedBy: 'Sir Naveed Sab',
    totalDebit: 18500,
    totalCredit: 18500,
    entries: [
      {
        id: '1',
        accountId: 'acc-500-4-04',
        accountCode: '500-4-04',
        accountName: 'Examination & Stationery Expense',
        description: 'Printed answer sheets and exam paper reams',
        debit: 18500,
        credit: 0,
        refCheckNo: 'BILL-4092',
      },
      {
        id: '2',
        accountId: 'acc-100-4-01',
        accountCode: '100-4-01',
        accountName: 'Cash In Hand',
        description: 'Cash paid from campus treasury against Bill #4092',
        debit: 0,
        credit: 18500,
        refCheckNo: 'BILL-4092',
      },
    ],
  },
  CRV: {
    id: 'sample-crv-001',
    voucherNo: 'CRV-C1-26-001',
    voucherType: 'CRV',
    campusId: 'campus-khiali',
    date: '2026-03-25',
    accountingPeriod: 'FY 2025-2026',
    narration: 'Cash received against new student admissions and annual dues',
    chequeNo: 'RCPT-9012',
    status: 'Approved',
    preparedBy: 'Maqsood Ahmad',
    approvedBy: 'Sir Naveed Sab',
    totalDebit: 64000,
    totalCredit: 64000,
    entries: [
      {
        id: '1',
        accountId: 'acc-100-4-01',
        accountCode: '100-4-01',
        accountName: 'Cash In Hand',
        description: 'Cash received at campus fee counter (Receipt #9012)',
        debit: 64000,
        credit: 0,
        refCheckNo: 'RCPT-9012',
      },
      {
        id: '2',
        accountId: 'acc-400-1-03',
        accountCode: '400-1-03',
        accountName: 'Admission Fee',
        description: 'New admission fee receipts',
        debit: 0,
        credit: 40000,
        refCheckNo: 'RCPT-9012',
      },
      {
        id: '3',
        accountId: 'acc-400-1-02',
        accountCode: '400-1-02',
        accountName: 'Annual Dues',
        description: 'Annual registration & examination dues',
        debit: 0,
        credit: 24000,
        refCheckNo: 'RCPT-9012',
      },
    ],
  },
  JV: {
    id: 'sample-jv-001',
    voucherNo: 'JV-C1-26-001',
    voucherType: 'JV',
    campusId: 'campus-khiali',
    date: '2026-03-25',
    accountingPeriod: 'FY 2025-2026',
    narration: 'Monthly depreciation adjustment entry on office equipment',
    status: 'Approved',
    preparedBy: 'Maqsood Ahmad',
    approvedBy: 'Sir Naveed Sab',
    totalDebit: 12000,
    totalCredit: 12000,
    entries: [],
  },
};

export const VoucherA4PrintStudioModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { transactions, campuses, orgSettings } = useAccounting();
  const [selectedType, setSelectedType] = useState<'BPV' | 'BRV' | 'CPV' | 'CRV'>('BPV');
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>('sample');
  const [paddingPreset, setPaddingPreset] = useState<A4PaddingPreset>('standard');
  const [typographyScale, setTypographyScale] = useState<A4TypographyScale>('11pt');
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const matchingVouchers = transactions.filter(
    (t) => t.voucherType === selectedType
  );

  const activeVoucher =
    selectedVoucherId !== 'sample'
      ? matchingVouchers.find((v) => v.id === selectedVoucherId) ||
        matchingVouchers[0] ||
        SAMPLE_FOUR_VOUCHERS[selectedType]
      : matchingVouchers[0] || SAMPLE_FOUR_VOUCHERS[selectedType];

  const activeCampus =
    campuses.find((c) => c.id === activeVoucher.campusId) || campuses[0];

  const handleDownloadPdf = async () => {
    if (!printRef.current || busy) return;
    setBusy(true);
    try {
      await generateElementPdf(
        printRef.current,
        `A4_${activeVoucher.voucherType}_${activeVoucher.voucherNo}.pdf`,
        'portrait'
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    await printOrDownloadElement(printRef.current, {
      title: `${activeVoucher.voucherType} — ${activeVoucher.voucherNo}`,
      fallbackFileName: `A4_${activeVoucher.voucherType}_${activeVoucher.voucherNo}`,
      orientation: 'portrait',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-slate-100 rounded-2xl max-w-5xl w-full border border-slate-300 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[94vh] print:max-h-none print:border-none print:shadow-none">
        {/* Top Studio Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div>
            <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
              ISO A4 Document Generator (210mm × 297mm) • Four Voucher Standard
            </div>
            <h3 className="text-base font-black">
              A4 Print-Friendly Four-Voucher Layout Studio (BPV · BRV · CPV · CRV)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={busy}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{busy ? 'Generating A4 PDF...' : 'Download A4 PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Voucher Type & Record Selector Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['BPV', 'BRV', 'CPV', 'CRV'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setSelectedVoucherId('sample');
                }}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  selectedType === type
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {type} — {VOUCHER_TYPE_META[type].fullTitle}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Select Voucher:</span>
            <select
              value={selectedVoucherId}
              onChange={(e) => setSelectedVoucherId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-mono font-bold text-slate-800"
            >
              {matchingVouchers.length > 0 ? (
                matchingVouchers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voucherNo} — PKR {Number(v.totalDebit || 0).toLocaleString()} ({v.date})
                  </option>
                ))
              ) : (
                <option value="sample">
                  Standard {selectedType} Template ({SAMPLE_FOUR_VOUCHERS[selectedType].voucherNo})
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Scrollable A4 Document Preview Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div ref={printRef} id="printable-voucher-document">
            <PrintableVoucherA4Layout
              voucher={activeVoucher}
              campus={activeCampus}
              orgSettings={orgSettings}
              paddingPreset={paddingPreset}
              typographyScale={typographyScale}
              showConfigureBar={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

