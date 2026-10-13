import React from 'react';
import {
  Table,
  BookOpen,
  Wallet,
  BarChart3,
  Columns,
  FileCheck2,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';

export type ExtendedReportId =
  | 'format_11_all_trial_balances'
  | 'format_12_all_general_ledgers'
  | 'format_13_cash_bank_treasury'
  | 'format_14_income_statement_patterns'
  | 'format_15_balance_sheet_patterns'
  | 'format_16_receipts_payments_cashflow'
  | 'format_17_subledger_counterparty'
  | 'format_18_group_control_hierarchy';

export interface ExtendedLedgerAndTrialBalanceTemplatesProps {
  selectedFormat: ExtendedReportId;
  accountAnalytics?: any;
  activeAccountRows: any[];
  scopedVouchers: any[];
  scopedPettyCash: any[];
  totals: {
    openingDr?: number;
    openingCr?: number;
    openDr?: number;
    openCr?: number;
    periodDr: number;
    periodCr: number;
    closingDr: number;
    closingCr: number;
    [key: string]: any;
  };
}

function formatPKR(val: number): string {
  return Math.round(val || 0).toLocaleString('en-PK');
}

export const ExtendedLedgerAndTrialBalanceTemplates: React.FC<
  ExtendedLedgerAndTrialBalanceTemplatesProps
> = ({
  selectedFormat,
  activeAccountRows = [],
  scopedVouchers = [],
  scopedPettyCash = [],
  totals,
}) => {
  // Format 11: Multi-Pattern Trial Balance Suite
  if (selectedFormat === 'format_11_all_trial_balances') {
    return (
      <div className="space-y-4 my-4">
        <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm tracking-wide">
              FORMAT 11: MULTI-PATTERN 6-COLUMN STATUTORY TRIAL BALANCE
            </h3>
          </div>
          <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded font-mono">
            {activeAccountRows.length} Ledger Heads
          </span>
        </div>

        <div className="overflow-x-auto border border-black rounded">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-black font-bold text-slate-900">
                <th className="border-r border-black p-2 text-left w-20">Code</th>
                <th className="border-r border-black p-2 text-left">Account Head & Classification</th>
                <th className="border-r border-black p-2 text-right w-28 bg-blue-50/50">Opening (Dr)</th>
                <th className="border-r border-black p-2 text-right w-28 bg-blue-50/50">Opening (Cr)</th>
                <th className="border-r border-black p-2 text-right w-28 bg-amber-50/50">Debits (PKR)</th>
                <th className="border-r border-black p-2 text-right w-28 bg-amber-50/50">Credits (PKR)</th>
                <th className="border-r border-black p-2 text-right w-32 bg-emerald-50/50">Closing Dr</th>
                <th className="p-2 text-right w-32 bg-emerald-50/50">Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {activeAccountRows.map((row, idx) => (
                <tr
                  key={row.code || idx}
                  className={`border-b border-slate-200 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                  }`}
                >
                  <td className="border-r border-black p-2 font-mono font-bold">{row.code}</td>
                  <td className="border-r border-black p-2 font-medium">
                    <span className="font-semibold text-slate-900">{row.name}</span>
                    <span className="ml-2 text-[10px] text-slate-500 font-mono">({row.category})</span>
                  </td>
                  <td className="border-r border-black p-2 text-right font-mono">
                    {row.openingDr > 0 ? formatPKR(row.openingDr) : '-'}
                  </td>
                  <td className="border-r border-black p-2 text-right font-mono">
                    {row.openingCr > 0 ? formatPKR(row.openingCr) : '-'}
                  </td>
                  <td className="border-r border-black p-2 text-right font-mono text-blue-700">
                    {row.periodDr > 0 ? formatPKR(row.periodDr) : '-'}
                  </td>
                  <td className="border-r border-black p-2 text-right font-mono text-purple-700">
                    {row.periodCr > 0 ? formatPKR(row.periodCr) : '-'}
                  </td>
                  <td className="border-r border-black p-2 text-right font-mono font-bold text-slate-900">
                    {row.closingDr > 0 ? `Rs. ${formatPKR(row.closingDr)}` : '-'}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-slate-900">
                    {row.closingCr > 0 ? `Rs. ${formatPKR(row.closingCr)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold border-t-2 border-black text-slate-900">
                <td colSpan={2} className="border-r border-black p-2.5 text-right uppercase">
                  Statutory Balanced Totals
                </td>
                <td className="border-r border-black p-2 text-right font-mono">
                  {formatPKR(totals.openingDr ?? totals.openDr ?? 0)}
                </td>
                <td className="border-r border-black p-2 text-right font-mono">
                  {formatPKR(totals.openingCr ?? totals.openCr ?? 0)}
                </td>
                <td className="border-r border-black p-2 text-right font-mono">
                  {formatPKR(totals.periodDr)}
                </td>
                <td className="border-r border-black p-2 text-right font-mono">
                  {formatPKR(totals.periodCr)}
                </td>
                <td className="border-r border-black p-2.5 text-right font-mono underline decoration-double">
                  Rs. {formatPKR(totals.closingDr)}
                </td>
                <td className="p-2.5 text-right font-mono underline decoration-double">
                  Rs. {formatPKR(totals.closingCr)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  // Format 12: General Ledger Suite
  if (selectedFormat === 'format_12_all_general_ledgers') {
    return (
      <div className="space-y-4 my-4">
        <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm tracking-wide">
              FORMAT 12: COMPREHENSIVE GENERAL LEDGER RUNNING BALANCE BOOK
            </h3>
          </div>
          <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded font-mono">
            {scopedVouchers.length} Transactions
          </span>
        </div>

        <div className="overflow-x-auto border border-black rounded">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-black font-bold">
                <th className="border-r border-black p-2 text-left w-24">Date</th>
                <th className="border-r border-black p-2 text-left w-24">Voucher No</th>
                <th className="border-r border-black p-2 text-left w-16">Type</th>
                <th className="border-r border-black p-2 text-left">Narration & Description</th>
                <th className="border-r border-black p-2 text-right w-28">Debit (PKR)</th>
                <th className="border-r border-black p-2 text-right w-28">Credit (PKR)</th>
                <th className="p-2 text-center w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {scopedVouchers.slice(0, 50).map((v, i) => (
                <tr
                  key={v.id || i}
                  className={`border-b border-slate-200 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  <td className="border-r border-black p-2 font-mono">{v.date}</td>
                  <td className="border-r border-black p-2 font-mono font-bold text-indigo-700">
                    {v.voucherNo}
                  </td>
                  <td className="border-r border-black p-2 font-bold">{v.voucherType}</td>
                  <td className="border-r border-black p-2 text-slate-800 truncate max-w-xs">
                    {v.narration || 'General Voucher Entry'}
                  </td>
                  <td className="border-r border-black p-2 text-right font-mono font-bold text-emerald-700">
                    {v.totalDebit > 0 ? formatPKR(v.totalDebit) : '-'}
                  </td>
                  <td className="border-r border-black p-2 text-right font-mono font-bold text-rose-700">
                    {v.totalCredit > 0 ? formatPKR(v.totalCredit) : '-'}
                  </td>
                  <td className="p-2 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                      {v.status || 'Posted'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Format 13: Cash & Bank Book
  if (selectedFormat === 'format_13_cash_bank_treasury') {
    const cashBankVouchers = scopedVouchers.filter((v) =>
      ['BPV', 'BRV', 'CPV', 'CRV'].includes(v.voucherType)
    );
    return (
      <div className="space-y-4 my-4">
        <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm tracking-wide">
              FORMAT 13: TREASURY, CASH & BANK REGISTER (BPV · BRV · CPV · CRV)
            </h3>
          </div>
          <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded font-mono">
            {cashBankVouchers.length} Cash/Bank Entries
          </span>
        </div>

        <div className="overflow-x-auto border border-black rounded">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-black font-bold">
                <th className="border-r border-black p-2 text-left w-24">Date</th>
                <th className="border-r border-black p-2 text-left w-24">Voucher No</th>
                <th className="border-r border-black p-2 text-left w-16">Type</th>
                <th className="border-r border-black p-2 text-left">Payee / Payer & Details</th>
                <th className="border-r border-black p-2 text-right w-28 bg-emerald-50">Receipts (Dr)</th>
                <th className="p-2 text-right w-28 bg-rose-50">Disbursements (Cr)</th>
              </tr>
            </thead>
            <tbody>
              {cashBankVouchers.slice(0, 40).map((v, i) => (
                <tr key={v.id || i} className="border-b border-slate-200">
                  <td className="border-r border-black p-2 font-mono">{v.date}</td>
                  <td className="border-r border-black p-2 font-mono font-bold">{v.voucherNo}</td>
                  <td className="border-r border-black p-2 font-bold">{v.voucherType}</td>
                  <td className="border-r border-black p-2 truncate max-w-xs">{v.narration}</td>
                  <td className="border-r border-black p-2 text-right font-mono font-bold text-emerald-700">
                    {['BRV', 'CRV'].includes(v.voucherType) ? formatPKR(v.totalDebit) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-rose-700">
                    {['BPV', 'CPV'].includes(v.voucherType) ? formatPKR(v.totalDebit) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Format 14: Multi-Pattern Income Statement
  if (selectedFormat === 'format_14_income_statement_patterns') {
    const revenueRows = activeAccountRows.filter((r) => r.category === 'Revenue');
    const expenseRows = activeAccountRows.filter((r) => r.category === 'Expense');
    const totalRev = revenueRows.reduce((s, r) => s + (r.closingCr || r.periodCr || 0), 0);
    const totalExp = expenseRows.reduce((s, r) => s + (r.closingDr || r.periodDr || 0), 0);
    const netSurplus = totalRev - totalExp;

    return (
      <div className="space-y-4 my-4">
        <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm tracking-wide">
              FORMAT 14: MULTI-PATTERN INCOME & EXPENDITURE STATEMENT (P&L)
            </h3>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded font-bold ${
              netSurplus >= 0 ? 'bg-emerald-800 text-emerald-200' : 'bg-rose-800 text-rose-200'
            }`}
          >
            Net: Rs. {formatPKR(netSurplus)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-black rounded p-3 bg-emerald-50/30">
            <h4 className="font-bold text-emerald-900 border-b border-black pb-1 mb-2">
              400 — REVENUE & INCOME HEADS
            </h4>
            <div className="space-y-1">
              {revenueRows.map((r) => (
                <div key={r.code} className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span>{r.code} · {r.name}</span>
                  <span className="font-mono font-bold">Rs. {formatPKR(r.closingCr || r.periodCr || 0)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 font-bold text-sm text-emerald-900">
                <span>Total Operating Revenue</span>
                <span className="font-mono underline">Rs. {formatPKR(totalRev)}</span>
              </div>
            </div>
          </div>

          <div className="border border-black rounded p-3 bg-rose-50/30">
            <h4 className="font-bold text-rose-900 border-b border-black pb-1 mb-2">
              500 — OPERATING EXPENSES
            </h4>
            <div className="space-y-1">
              {expenseRows.map((r) => (
                <div key={r.code} className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span>{r.code} · {r.name}</span>
                  <span className="font-mono font-bold">Rs. {formatPKR(r.closingDr || r.periodDr || 0)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 font-bold text-sm text-rose-900">
                <span>Total Operating Expenses</span>
                <span className="font-mono underline">Rs. {formatPKR(totalExp)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for Formats 15–18: Clean Institutional Summary Table
  return (
    <div className="space-y-4 my-4">
      <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-sm tracking-wide uppercase">
            {selectedFormat.replace(/_/g, ' ')}
          </h3>
        </div>
        <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded font-mono">
          {activeAccountRows.length} Accounts
        </span>
      </div>

      <div className="border border-black rounded p-4 bg-white overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-black font-bold">
              <th className="p-2 border-r border-black text-left">Code</th>
              <th className="p-2 border-r border-black text-left">Account Title</th>
              <th className="p-2 border-r border-black text-left">Group</th>
              <th className="p-2 border-r border-black text-right">Debit Balance</th>
              <th className="p-2 text-right">Credit Balance</th>
            </tr>
          </thead>
          <tbody>
            {activeAccountRows.slice(0, 30).map((r, i) => (
              <tr key={r.code || i} className="border-b border-slate-200">
                <td className="p-2 border-r border-black font-mono font-bold">{r.code}</td>
                <td className="p-2 border-r border-black font-semibold">{r.name}</td>
                <td className="p-2 border-r border-black text-slate-500">{r.category}</td>
                <td className="p-2 border-r border-black text-right font-mono">
                  {r.closingDr > 0 ? formatPKR(r.closingDr) : '-'}
                </td>
                <td className="p-2 text-right font-mono">
                  {r.closingCr > 0 ? formatPKR(r.closingCr) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
