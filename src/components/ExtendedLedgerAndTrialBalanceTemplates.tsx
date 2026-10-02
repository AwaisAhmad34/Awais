import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Table,
  Columns,
  Layers,
  TrendingUp,
  Scale,
  Wallet,
  Building2,
  Palette,
  Filter,
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

export type VisualPrintTheme =
  | 'chartered_classic'
  | 'executive_navy'
  | 'royal_emerald'
  | 'compact_audit';

function fmt(val: number): string {
  return Math.round(val || 0).toLocaleString('en-PK');
}

interface AccountRowAnalytics {
  head: {
    id: string;
    code: string;
    name: string;
    category: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
    mainAccount?: string;
    groupName?: string;
  };
  openDr: number;
  openCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
  plDr: number;
  plCr: number;
  bsDr: number;
  bsCr: number;
  drEntries: { date: string; voucherNo: string; narration: string; amount: number }[];
  crEntries: { date: string; voucherNo: string; narration: string; amount: number }[];
  hasActivity: boolean;
}

interface Props {
  selectedFormat: ExtendedReportId;
  accountAnalytics: AccountRowAnalytics[];
  activeAccountRows: AccountRowAnalytics[];
  scopedVouchers: any[];
  scopedPettyCash: any[];
  totals: {
    openDr: number;
    openCr: number;
    periodDr: number;
    periodCr: number;
    closingDr: number;
    closingCr: number;
    revenue: number;
    expense: number;
    netSurplus: number;
    assets: number;
    liabilities: number;
    equity: number;
  };
}

export const ExtendedLedgerAndTrialBalanceTemplates: React.FC<Props> = ({
  selectedFormat,
  accountAnalytics,
  activeAccountRows,
  scopedVouchers,
  scopedPettyCash,
  totals,
}) => {
  const [tbPattern, setTbPattern] = useState<
    '2col' | '4col' | '6col' | '8col_adjusted' | 'group_hierarchy' | 'category_matrix'
  >('6col');

  const [ledgerPattern, setLedgerPattern] = useState<
    'running_balance' | 't_account_split' | 'all_accounts_book' | 'voucher_type_matrix' | 'daily_summary'
  >('running_balance');

  const [plPattern, setPlPattern] = useState<
    'ifrs_multistep' | 't_format_ie' | 'common_size' | 'voucher_source'
  >('ifrs_multistep');

  const [bsPattern, setBsPattern] = useState<
    'classified_ias1' | 'horizontal_t' | 'working_capital' | 'common_size_bs'
  >('classified_ias1');

  const [selectedLedgerAccId, setSelectedLedgerAccId] = useState<string>('ALL_ACTIVE');
  const [showZeroAccounts, setShowZeroAccounts] = useState<boolean>(false);
  const [visualTheme, setVisualTheme] = useState<VisualPrintTheme>('chartered_classic');

  const displayRows = useMemo(
    () => (showZeroAccounts ? accountAnalytics : activeAccountRows),
    [showZeroAccounts, accountAnalytics, activeAccountRows]
  );

  const thClass =
    visualTheme === 'executive_navy'
      ? 'bg-slate-900 text-white border border-slate-700 p-2 font-black uppercase'
      : visualTheme === 'royal_emerald'
      ? 'bg-emerald-900 text-white border border-emerald-700 p-2 font-black uppercase'
      : visualTheme === 'compact_audit'
      ? 'bg-slate-100 text-black border border-black px-1.5 py-1 text-[10px] font-black uppercase'
      : 'bg-slate-100 text-black border border-black p-2 font-black uppercase';

  const tdClass =
    visualTheme === 'compact_audit'
      ? 'border border-black px-1.5 py-0.5 text-[11px]'
      : 'border border-black p-2 text-xs';

  return (
    <div className="space-y-4">
      {/* Sub-Pattern & Visual Theme Switcher Toolbar (Hidden on Print) */}
      <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Report Pattern:
          </span>

          {selectedFormat === 'format_11_all_trial_balances' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: '2col', label: '1. 2-Col Net Closing TB' },
                { id: '4col', label: '2. 4-Col Open + Closing TB' },
                { id: '6col', label: '3. 6-Col Extended TB' },
                { id: '8col_adjusted', label: '4. 8-Col Adjusted Audit TB' },
                { id: 'group_hierarchy', label: '5. Group-Wise Subtotals TB' },
                { id: 'category_matrix', label: '6. 5-Class Control Matrix TB' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTbPattern(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    tbPattern === p.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {selectedFormat === 'format_12_all_general_ledgers' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'running_balance', label: '1. Running Balance Ledger (Dr/Cr)' },
                { id: 't_account_split', label: '2. Two-Sided T-Account (Dr | Cr)' },
                { id: 'all_accounts_book', label: '3. Complete All-Accounts Ledger Book' },
                { id: 'voucher_type_matrix', label: '4. Ledger by Voucher Type (BPV/BRV/CPV/CRV/JV)' },
                { id: 'daily_summary', label: '5. Date-Wise Ledger Movement Summary' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLedgerPattern(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    ledgerPattern === p.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              <select
                value={selectedLedgerAccId}
                onChange={(e) => setSelectedLedgerAccId(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
              >
                <option value="ALL_ACTIVE">All Active Accounts ({activeAccountRows.length})</option>
                {accountAnalytics.map((a) => (
                  <option key={a.head.id} value={a.head.id}>
                    {a.head.code} — {a.head.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedFormat === 'format_14_income_statement_patterns' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ifrs_multistep', label: '1. Multi-Step Institutional P&L' },
                { id: 't_format_ie', label: '2. Two-Sided Income & Expenditure (Dr | Cr)' },
                { id: 'common_size', label: '3. Common-Size Vertical Analysis (% of Revenue)' },
                { id: 'voucher_source', label: '4. Revenue & Expense by Voucher Source' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlPattern(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    plPattern === p.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {selectedFormat === 'format_15_balance_sheet_patterns' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'classified_ias1', label: '1. IAS-1 Vertical Statement of Financial Position' },
                { id: 'horizontal_t', label: '2. Horizontal T-Format (Liabilities & Equity | Assets)' },
                { id: 'working_capital', label: '3. Net Current Assets & Liquidity Schedule' },
                { id: 'common_size_bs', label: '4. Common-Size Asset & Capital Structure (%)' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setBsPattern(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    bsPattern === p.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visual Print Theme & Zero-Balance Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showZeroAccounts}
              onChange={(e) => setShowZeroAccounts(e.target.checked)}
              className="rounded text-indigo-600"
            />
            <span>Include Zero-Balance Heads ({accountAnalytics.length})</span>
          </label>

          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={visualTheme}
              onChange={(e) => setVisualTheme(e.target.value as VisualPrintTheme)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
            >
              <option value="chartered_classic">Template: Chartered Classic Grid</option>
              <option value="executive_navy">Template: Executive Navy Header</option>
              <option value="royal_emerald">Template: Institutional Emerald</option>
              <option value="compact_audit">Template: High-Density Compact A4</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FORMAT 11: MULTI-PATTERN TRIAL BALANCE SUITE (6 PATTERNS)             */}
      {/* ===================================================================== */}
      {selectedFormat === 'format_11_all_trial_balances' && (
        <div className="space-y-4">
          {tbPattern === '2col' && (
            <table className="w-full border-collapse border-2 border-black text-xs">
              <thead>
                <tr>
                  <th className={thClass}>Code</th>
                  <th className={`${thClass} text-left`}>Account Head Title</th>
                  <th className={thClass}>Category</th>
                  <th className={`${thClass} text-right`}>Closing Debit (PKR)</th>
                  <th className={`${thClass} text-right`}>Closing Credit (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={r.head.id} className="border-b border-black">
                    <td className={`${tdClass} font-mono font-bold text-center`}>{r.head.code}</td>
                    <td className={`${tdClass} font-semibold`}>{r.head.name}</td>
                    <td className={`${tdClass} text-center`}>{r.head.category}</td>
                    <td className={`${tdClass} text-right font-mono font-bold`}>
                      {r.closingDr > 0 ? fmt(r.closingDr) : '-'}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-bold`}>
                      {r.closingCr > 0 ? fmt(r.closingCr) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-black font-black font-mono">
                  <td colSpan={3} className="border border-black p-2 text-right uppercase">
                    2-Column Net Closing Trial Balance Totals
                  </td>
                  <td className="border border-black p-2 text-right underline decoration-double">
                    {fmt(totals.closingDr)}
                  </td>
                  <td className="border border-black p-2 text-right underline decoration-double">
                    {fmt(totals.closingCr)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {tbPattern === '4col' && (
            <table className="w-full border-collapse border-2 border-black text-xs">
              <thead>
                <tr>
                  <th className={thClass}>Code</th>
                  <th className={`${thClass} text-left`}>Account Head Title</th>
                  <th className={`${thClass} text-right`}>Opening Net</th>
                  <th className={`${thClass} text-right`}>Period Net Movement</th>
                  <th className={`${thClass} text-right`}>Closing Debit</th>
                  <th className={`${thClass} text-right`}>Closing Credit</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => {
                  const openNet = r.openDr - r.openCr;
                  const periodNet = r.periodDr - r.periodCr;
                  return (
                    <tr key={r.head.id} className="border-b border-black">
                      <td className={`${tdClass} font-mono font-bold text-center`}>{r.head.code}</td>
                      <td className={`${tdClass} font-semibold`}>{r.head.name}</td>
                      <td className={`${tdClass} text-right font-mono`}>
                        {openNet === 0 ? '-' : `${fmt(Math.abs(openNet))} ${openNet > 0 ? 'Dr' : 'Cr'}`}
                      </td>
                      <td className={`${tdClass} text-right font-mono`}>
                        {periodNet === 0
                          ? '-'
                          : `${fmt(Math.abs(periodNet))} ${periodNet > 0 ? 'Dr' : 'Cr'}`}
                      </td>
                      <td className={`${tdClass} text-right font-mono font-bold`}>
                        {r.closingDr > 0 ? fmt(r.closingDr) : '-'}
                      </td>
                      <td className={`${tdClass} text-right font-mono font-bold`}>
                        {r.closingCr > 0 ? fmt(r.closingCr) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-black font-black font-mono">
                  <td colSpan={4} className="border border-black p-2 text-right uppercase">
                    4-Column Trial Balance Totals
                  </td>
                  <td className="border border-black p-2 text-right underline decoration-double">
                    {fmt(totals.closingDr)}
                  </td>
                  <td className="border border-black p-2 text-right underline decoration-double">
                    {fmt(totals.closingCr)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {(tbPattern === '6col' || tbPattern === '8col_adjusted') && (
            <table className="w-full border-collapse border-2 border-black text-xs">
              <thead>
                <tr>
                  <th className={thClass}>Code</th>
                  <th className={`${thClass} text-left`}>Account Title</th>
                  <th className={`${thClass} text-right`}>Open Dr</th>
                  <th className={`${thClass} text-right`}>Open Cr</th>
                  <th className={`${thClass} text-right`}>Movement Dr</th>
                  <th className={`${thClass} text-right`}>Movement Cr</th>
                  <th className={`${thClass} text-right`}>Closing Dr</th>
                  <th className={`${thClass} text-right`}>Closing Cr</th>
                  {tbPattern === '8col_adjusted' && (
                    <>
                      <th className={`${thClass} text-right`}>P&L (Net)</th>
                      <th className={`${thClass} text-right`}>B/S (Net)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={r.head.id} className="border-b border-black">
                    <td className={`${tdClass} font-mono font-bold text-center`}>{r.head.code}</td>
                    <td className={`${tdClass} font-semibold`}>{r.head.name}</td>
                    <td className={`${tdClass} text-right font-mono`}>
                      {r.openDr > 0 ? fmt(r.openDr) : '-'}
                    </td>
                    <td className={`${tdClass} text-right font-mono`}>
                      {r.openCr > 0 ? fmt(r.openCr) : '-'}
                    </td>
                    <td className={`${tdClass} text-right font-mono`}>
                      {r.periodDr > 0 ? fmt(r.periodDr) : '-'}
                    </td>
                    <td className={`${tdClass} text-right font-mono`}>
                      {r.periodCr > 0 ? fmt(r.periodCr) : '-'}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-black`}>
                      {r.closingDr > 0 ? fmt(r.closingDr) : '-'}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-black`}>
                      {r.closingCr > 0 ? fmt(r.closingCr) : '-'}
                    </td>
                    {tbPattern === '8col_adjusted' && (
                      <>
                        <td className={`${tdClass} text-right font-mono`}>
                          {r.plDr + r.plCr > 0 ? fmt(r.plDr || r.plCr) : '-'}
                        </td>
                        <td className={`${tdClass} text-right font-mono`}>
                          {r.bsDr + r.bsCr > 0 ? fmt(r.bsDr || r.bsCr) : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-black font-black font-mono">
                  <td colSpan={2} className="border border-black p-2 text-right uppercase">
                    Extended Trial Balance Totals
                  </td>
                  <td className="border border-black p-2 text-right">{fmt(totals.openDr)}</td>
                  <td className="border border-black p-2 text-right">{fmt(totals.openCr)}</td>
                  <td className="border border-black p-2 text-right">{fmt(totals.periodDr)}</td>
                  <td className="border border-black p-2 text-right">{fmt(totals.periodCr)}</td>
                  <td className="border border-black p-2 text-right underline decoration-double">
                    {fmt(totals.closingDr)}
                  </td>
                  <td className="border border-black p-2 text-right underline decoration-double">
                    {fmt(totals.closingCr)}
                  </td>
                  {tbPattern === '8col_adjusted' && (
                    <>
                      <td className="border border-black p-2 text-right">
                        {fmt(totals.revenue + totals.expense)}
                      </td>
                      <td className="border border-black p-2 text-right">
                        {fmt(totals.assets + totals.liabilities + totals.equity)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          )}

          {(tbPattern === 'group_hierarchy' || tbPattern === 'category_matrix') && (
            <div className="space-y-4">
              {(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((cat) => {
                const catRows = displayRows.filter((r) => r.head.category === cat);
                const subOpenDr = catRows.reduce((s, r) => s + r.openDr, 0);
                const subOpenCr = catRows.reduce((s, r) => s + r.openCr, 0);
                const subPerDr = catRows.reduce((s, r) => s + r.periodDr, 0);
                const subPerCr = catRows.reduce((s, r) => s + r.periodCr, 0);
                const subCloseDr = catRows.reduce((s, r) => s + r.closingDr, 0);
                const subCloseCr = catRows.reduce((s, r) => s + r.closingCr, 0);

                return (
                  <div key={cat} className="border-2 border-black">
                    <div className="bg-slate-200 border-b border-black px-3 py-1.5 font-black uppercase text-xs flex justify-between">
                      <span>
                        Main Account Class: {cat} ({catRows.length} Heads)
                      </span>
                      <span className="font-mono">
                        Closing Dr: {fmt(subCloseDr)} | Closing Cr: {fmt(subCloseCr)}
                      </span>
                    </div>
                    {tbPattern === 'group_hierarchy' && (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-black font-bold">
                            <th className="border border-black p-1.5 text-left w-24">Code</th>
                            <th className="border border-black p-1.5 text-left">Account Title</th>
                            <th className="border border-black p-1.5 text-right w-28">Open Dr/Cr</th>
                            <th className="border border-black p-1.5 text-right w-28">Movement Dr</th>
                            <th className="border border-black p-1.5 text-right w-28">Movement Cr</th>
                            <th className="border border-black p-1.5 text-right w-28">Closing Dr</th>
                            <th className="border border-black p-1.5 text-right w-28">Closing Cr</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catRows.map((r) => (
                            <tr key={r.head.id} className="border-b border-black">
                              <td className="border border-black p-1.5 font-mono font-bold">
                                {r.head.code}
                              </td>
                              <td className="border border-black p-1.5">{r.head.name}</td>
                              <td className="border border-black p-1.5 text-right font-mono">
                                {fmt(r.openDr || r.openCr)}
                              </td>
                              <td className="border border-black p-1.5 text-right font-mono">
                                {fmt(r.periodDr)}
                              </td>
                              <td className="border border-black p-1.5 text-right font-mono">
                                {fmt(r.periodCr)}
                              </td>
                              <td className="border border-black p-1.5 text-right font-mono font-bold">
                                {fmt(r.closingDr)}
                              </td>
                              <td className="border border-black p-1.5 text-right font-mono font-bold">
                                {fmt(r.closingCr)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-black font-mono">
                            <td colSpan={2} className="border border-black p-1.5 text-right">
                              Subtotal — {cat}
                            </td>
                            <td className="border border-black p-1.5 text-right">
                              {fmt(subOpenDr + subOpenCr)}
                            </td>
                            <td className="border border-black p-1.5 text-right">{fmt(subPerDr)}</td>
                            <td className="border border-black p-1.5 text-right">{fmt(subPerCr)}</td>
                            <td className="border border-black p-1.5 text-right">
                              {fmt(subCloseDr)}
                            </td>
                            <td className="border border-black p-1.5 text-right">
                              {fmt(subCloseCr)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FORMAT 12: ALL GENERAL LEDGER PATTERNS SUITE (5 PATTERNS)             */}
      {/* ===================================================================== */}
      {selectedFormat === 'format_12_all_general_ledgers' && (
        <div className="space-y-5">
          {(selectedLedgerAccId === 'ALL_ACTIVE'
            ? displayRows
            : accountAnalytics.filter((a) => a.head.id === selectedLedgerAccId)
          ).map((acc) => {
            // Build combined chronological lines for running balance ledger
            const combinedLines = [
              ...acc.drEntries.map((d) => ({ ...d, dr: d.amount, cr: 0 })),
              ...acc.crEntries.map((c) => ({ ...c, dr: 0, cr: c.amount })),
            ].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            let runningBal = acc.openDr - acc.openCr;

            return (
              <div key={acc.head.id} className="border-2 border-black break-inside-avoid">
                <div className="bg-slate-100 border-b-2 border-black px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-black text-black">[{acc.head.code}]</span>{' '}
                    <strong className="font-black uppercase text-black">{acc.head.name}</strong>{' '}
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-white border border-black ml-1">
                      {acc.head.category}
                    </span>
                  </div>
                  <div className="font-mono font-bold">
                    Opening: {fmt(acc.openDr || acc.openCr)}{' '}
                    {acc.openDr >= acc.openCr ? 'Dr' : 'Cr'} | Closing:{' '}
                    {fmt(acc.closingDr || acc.closingCr)}{' '}
                    {acc.closingDr >= acc.closingCr ? 'Dr' : 'Cr'}
                  </div>
                </div>

                {(ledgerPattern === 'running_balance' ||
                  ledgerPattern === 'all_accounts_book' ||
                  ledgerPattern === 'daily_summary') && (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className={thClass}>Date</th>
                        <th className={thClass}>Voucher #</th>
                        <th className={`${thClass} text-left`}>Particulars / Narration</th>
                        <th className={`${thClass} text-right`}>Debit (PKR)</th>
                        <th className={`${thClass} text-right`}>Credit (PKR)</th>
                        <th className={`${thClass} text-right`}>Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black bg-slate-50 font-semibold">
                        <td className={`${tdClass} font-mono`}>OPENING</td>
                        <td className={`${tdClass} font-mono`}>B/F</td>
                        <td className={tdClass}>Opening Balance Brought Forward</td>
                        <td className={`${tdClass} text-right font-mono`}>
                          {acc.openDr > 0 ? fmt(acc.openDr) : '-'}
                        </td>
                        <td className={`${tdClass} text-right font-mono`}>
                          {acc.openCr > 0 ? fmt(acc.openCr) : '-'}
                        </td>
                        <td className={`${tdClass} text-right font-mono font-bold`}>
                          {fmt(Math.abs(runningBal))} {runningBal >= 0 ? 'Dr' : 'Cr'}
                        </td>
                      </tr>
                      {combinedLines.map((ln, idx) => {
                        runningBal += ln.dr - ln.cr;
                        return (
                          <tr key={idx} className="border-b border-black">
                            <td className={`${tdClass} font-mono`}>{ln.date}</td>
                            <td className={`${tdClass} font-mono font-bold`}>{ln.voucherNo}</td>
                            <td className={tdClass}>{ln.narration}</td>
                            <td className={`${tdClass} text-right font-mono`}>
                              {ln.dr > 0 ? fmt(ln.dr) : '-'}
                            </td>
                            <td className={`${tdClass} text-right font-mono`}>
                              {ln.cr > 0 ? fmt(ln.cr) : '-'}
                            </td>
                            <td className={`${tdClass} text-right font-mono font-bold`}>
                              {fmt(Math.abs(runningBal))} {runningBal >= 0 ? 'Dr' : 'Cr'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {ledgerPattern === 't_account_split' && (
                  <div className="grid grid-cols-2 divide-x-2 divide-black text-xs">
                    <div>
                      <div className="bg-slate-100 border-b border-black p-1.5 font-black text-center uppercase">
                        DEBIT (Dr) SIDE
                      </div>
                      <table className="w-full border-collapse">
                        <tbody>
                          {acc.openDr > 0 && (
                            <tr className="border-b border-black font-semibold">
                              <td className="p-1.5 font-mono">B/F</td>
                              <td className="p-1.5">To Balance b/d</td>
                              <td className="p-1.5 text-right font-mono">{fmt(acc.openDr)}</td>
                            </tr>
                          )}
                          {acc.drEntries.map((d, i) => (
                            <tr key={i} className="border-b border-black">
                              <td className="p-1.5 font-mono">{d.date}</td>
                              <td className="p-1.5">
                                {d.voucherNo} — {d.narration}
                              </td>
                              <td className="p-1.5 text-right font-mono font-bold">
                                {fmt(d.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className="bg-slate-100 border-b border-black p-1.5 font-black text-center uppercase">
                        CREDIT (Cr) SIDE
                      </div>
                      <table className="w-full border-collapse">
                        <tbody>
                          {acc.openCr > 0 && (
                            <tr className="border-b border-black font-semibold">
                              <td className="p-1.5 font-mono">B/F</td>
                              <td className="p-1.5">By Balance b/d</td>
                              <td className="p-1.5 text-right font-mono">{fmt(acc.openCr)}</td>
                            </tr>
                          )}
                          {acc.crEntries.map((c, i) => (
                            <tr key={i} className="border-b border-black">
                              <td className="p-1.5 font-mono">{c.date}</td>
                              <td className="p-1.5">
                                {c.voucherNo} — {c.narration}
                              </td>
                              <td className="p-1.5 text-right font-mono font-bold">
                                {fmt(c.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {ledgerPattern === 'voucher_type_matrix' && (
                  <div className="p-3 text-xs font-mono flex flex-wrap items-center justify-between gap-2 bg-white">
                    <span>Opening Dr/Cr: {fmt(acc.openDr || acc.openCr)}</span>
                    <span>Total Debit Entries ({acc.drEntries.length}): {fmt(acc.periodDr)}</span>
                    <span>Total Credit Entries ({acc.crEntries.length}): {fmt(acc.periodCr)}</span>
                    <span className="font-black">
                      Closing Balance: {fmt(acc.closingDr || acc.closingCr)}{' '}
                      {acc.closingDr >= acc.closingCr ? 'Dr' : 'Cr'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FORMAT 13: TRIPLE-COLUMN CASH, BANK & TREASURY BOOK                   */}
      {/* ===================================================================== */}
      {selectedFormat === 'format_13_cash_bank_treasury' && (
        <table className="w-full border-collapse border-2 border-black text-xs">
          <thead>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>Voucher #</th>
              <th className={thClass}>Type</th>
              <th className={`${thClass} text-left`}>Particulars / Narration</th>
              <th className={`${thClass} text-right`}>Cash / Bank Receipt (Dr)</th>
              <th className={`${thClass} text-right`}>Cash / Bank Payment (Cr)</th>
            </tr>
          </thead>
          <tbody>
            {scopedVouchers.map((tx) => (
              <tr key={tx.id} className="border-b border-black">
                <td className={`${tdClass} font-mono`}>{tx.date}</td>
                <td className={`${tdClass} font-mono font-bold`}>{tx.voucherNo}</td>
                <td className={`${tdClass} text-center font-mono font-bold`}>{tx.voucherType}</td>
                <td className={tdClass}>{tx.narration}</td>
                <td className={`${tdClass} text-right font-mono font-bold`}>
                  {tx.voucherType === 'BRV' || tx.voucherType === 'CRV'
                    ? fmt(Number(tx.totalDebit) || 0)
                    : '-'}
                </td>
                <td className={`${tdClass} text-right font-mono font-bold`}>
                  {tx.voucherType === 'BPV' || tx.voucherType === 'CPV'
                    ? fmt(Number(tx.totalCredit) || 0)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ===================================================================== */}
      {/* FORMAT 14: INCOME & EXPENDITURE (P&L) MULTI-PATTERN SUITE             */}
      {/* ===================================================================== */}
      {selectedFormat === 'format_14_income_statement_patterns' && (
        <div className="space-y-4">
          {plPattern === 't_format_ie' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 border-2 border-black divide-y-2 md:divide-y-0 md:divide-x-2 divide-black text-xs">
              <div>
                <div className="bg-slate-100 border-b-2 border-black p-2 font-black uppercase text-center">
                  EXPENDITURE (Dr)
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {accountAnalytics
                      .filter((a) => a.head.category === 'Expense' && a.closingDr > 0)
                      .map((r) => (
                        <tr key={r.head.id} className="border-b border-black">
                          <td className="p-2 font-mono font-bold">{r.head.code}</td>
                          <td className="p-2">{r.head.name}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            {fmt(r.closingDr - r.closingCr)}
                          </td>
                        </tr>
                      ))}
                    <tr className="bg-slate-100 font-black">
                      <td colSpan={2} className="p-2 text-right uppercase">
                        Total Expenditure
                      </td>
                      <td className="p-2 text-right font-mono">{fmt(totals.expense)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <div className="bg-slate-100 border-b-2 border-black p-2 font-black uppercase text-center">
                  INCOME / REVENUE (Cr)
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {accountAnalytics
                      .filter((a) => a.head.category === 'Revenue' && a.closingCr > 0)
                      .map((r) => (
                        <tr key={r.head.id} className="border-b border-black">
                          <td className="p-2 font-mono font-bold">{r.head.code}</td>
                          <td className="p-2">{r.head.name}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            {fmt(r.closingCr - r.closingDr)}
                          </td>
                        </tr>
                      ))}
                    <tr className="bg-slate-100 font-black">
                      <td colSpan={2} className="p-2 text-right uppercase">
                        Total Revenue
                      </td>
                      <td className="p-2 text-right font-mono">{fmt(totals.revenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse border-2 border-black text-xs">
              <thead>
                <tr>
                  <th className={thClass}>Code</th>
                  <th className={`${thClass} text-left`}>Revenue / Expense Account Head</th>
                  <th className={thClass}>Classification</th>
                  <th className={`${thClass} text-right`}>Amount (PKR)</th>
                  {plPattern === 'common_size' && (
                    <th className={`${thClass} text-right`}>% of Total Revenue</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {accountAnalytics
                  .filter(
                    (a) =>
                      (a.head.category === 'Revenue' || a.head.category === 'Expense') &&
                      a.hasActivity
                  )
                  .map((r) => {
                    const amt =
                      r.head.category === 'Revenue'
                        ? Math.max(0, r.closingCr - r.closingDr)
                        : Math.max(0, r.closingDr - r.closingCr);
                    const pct = totals.revenue > 0 ? ((amt / totals.revenue) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={r.head.id} className="border-b border-black">
                        <td className={`${tdClass} font-mono font-bold text-center`}>
                          {r.head.code}
                        </td>
                        <td className={`${tdClass} font-semibold`}>{r.head.name}</td>
                        <td className={`${tdClass} text-center`}>{r.head.category}</td>
                        <td className={`${tdClass} text-right font-mono font-bold`}>{fmt(amt)}</td>
                        {plPattern === 'common_size' && (
                          <td className={`${tdClass} text-right font-mono`}>{pct}%</td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-black font-black font-mono">
                  <td colSpan={3} className="border border-black p-2 text-right uppercase">
                    Net Institutional Surplus / (Deficit)
                  </td>
                  <td className="border border-black p-2 text-right underline decoration-double">
                    Rs. {fmt(totals.netSurplus)}
                  </td>
                  {plPattern === 'common_size' && (
                    <td className="border border-black p-2 text-right">
                      {totals.revenue > 0
                        ? `${((totals.netSurplus / totals.revenue) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FORMAT 15: BALANCE SHEET / STATEMENT OF FINANCIAL POSITION PATTERNS   */}
      {/* ===================================================================== */}
      {selectedFormat === 'format_15_balance_sheet_patterns' && (
        <div className="space-y-4">
          {bsPattern === 'horizontal_t' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 border-2 border-black divide-y-2 md:divide-y-0 md:divide-x-2 divide-black text-xs">
              <div>
                <div className="bg-slate-100 border-b-2 border-black p-2 font-black uppercase text-center">
                  CAPITAL, FUNDS & LIABILITIES
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {accountAnalytics
                      .filter(
                        (a) =>
                          (a.head.category === 'Liability' || a.head.category === 'Equity') &&
                          a.hasActivity
                      )
                      .map((r) => (
                        <tr key={r.head.id} className="border-b border-black">
                          <td className="p-2 font-mono font-bold">{r.head.code}</td>
                          <td className="p-2">{r.head.name}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            {fmt(Math.max(0, r.closingCr - r.closingDr))}
                          </td>
                        </tr>
                      ))}
                    <tr className="border-b border-black font-bold">
                      <td className="p-2 font-mono">SURPLUS</td>
                      <td className="p-2">Current Period Net Surplus / (Deficit)</td>
                      <td className="p-2 text-right font-mono">{fmt(totals.netSurplus)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <div className="bg-slate-100 border-b-2 border-black p-2 font-black uppercase text-center">
                  PROPERTY & ASSETS
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {accountAnalytics
                      .filter((a) => a.head.category === 'Asset' && a.hasActivity)
                      .map((r) => (
                        <tr key={r.head.id} className="border-b border-black">
                          <td className="p-2 font-mono font-bold">{r.head.code}</td>
                          <td className="p-2">{r.head.name}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            {fmt(Math.max(0, r.closingDr - r.closingCr))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse border-2 border-black text-xs">
              <thead>
                <tr>
                  <th className={thClass}>Code</th>
                  <th className={`${thClass} text-left`}>Balance Sheet Account Head</th>
                  <th className={thClass}>Classification</th>
                  <th className={`${thClass} text-right`}>Closing Balance (PKR)</th>
                  {bsPattern === 'common_size_bs' && (
                    <th className={`${thClass} text-right`}>% of Assets</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {accountAnalytics
                  .filter(
                    (a) =>
                      (a.head.category === 'Asset' ||
                        a.head.category === 'Liability' ||
                        a.head.category === 'Equity') &&
                      a.hasActivity
                  )
                  .map((r) => {
                    const bal = Math.abs(r.closingDr - r.closingCr);
                    const pct = totals.assets > 0 ? ((bal / totals.assets) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={r.head.id} className="border-b border-black">
                        <td className={`${tdClass} font-mono font-bold text-center`}>
                          {r.head.code}
                        </td>
                        <td className={`${tdClass} font-semibold`}>{r.head.name}</td>
                        <td className={`${tdClass} text-center`}>{r.head.category}</td>
                        <td className={`${tdClass} text-right font-mono font-bold`}>{fmt(bal)}</td>
                        {bsPattern === 'common_size_bs' && (
                          <td className={`${tdClass} text-right font-mono`}>{pct}%</td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FORMAT 16: RECEIPTS & PAYMENTS ACCOUNT + CASH FLOW STATEMENT          */}
      {/* ===================================================================== */}
      {selectedFormat === 'format_16_receipts_payments_cashflow' && (
        <div className="grid grid-cols-1 md:grid-cols-2 border-2 border-black divide-y-2 md:divide-y-0 md:divide-x-2 divide-black text-xs">
          <div>
            <div className="bg-slate-100 border-b-2 border-black p-2 font-black uppercase text-center">
              RECEIPTS (BRV & CRV INFLOWS)
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {scopedVouchers
                  .filter((tx) => tx.voucherType === 'BRV' || tx.voucherType === 'CRV')
                  .map((tx) => (
                    <tr key={tx.id} className="border-b border-black">
                      <td className="p-2 font-mono">{tx.date}</td>
                      <td className="p-2 font-mono font-bold">{tx.voucherNo}</td>
                      <td className="p-2">{tx.narration}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {fmt(Number(tx.totalDebit) || 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="bg-slate-100 border-b-2 border-black p-2 font-black uppercase text-center">
              PAYMENTS (BPV, CPV & PETTY CASH OUTFLOWS)
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {scopedVouchers
                  .filter((tx) => tx.voucherType === 'BPV' || tx.voucherType === 'CPV')
                  .map((tx) => (
                    <tr key={tx.id} className="border-b border-black">
                      <td className="p-2 font-mono">{tx.date}</td>
                      <td className="p-2 font-mono font-bold">{tx.voucherNo}</td>
                      <td className="p-2">{tx.narration}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {fmt(Number(tx.totalCredit) || 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FORMAT 17 & 18: COUNTERPARTY SUB-LEDGER & GROUP CONTROL HIERARCHY     */}
      {/* ===================================================================== */}
      {(selectedFormat === 'format_17_subledger_counterparty' ||
        selectedFormat === 'format_18_group_control_hierarchy') && (
        <table className="w-full border-collapse border-2 border-black text-xs">
          <thead>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>Voucher #</th>
              <th className={thClass}>Type</th>
              <th className={`${thClass} text-left`}>Counterparty / Narration / Cheque Ref</th>
              <th className={`${thClass} text-right`}>Total Debit (PKR)</th>
              <th className={`${thClass} text-right`}>Total Credit (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {scopedVouchers.map((tx) => (
              <tr key={tx.id} className="border-b border-black">
                <td className={`${tdClass} font-mono`}>{tx.date}</td>
                <td className={`${tdClass} font-mono font-bold`}>{tx.voucherNo}</td>
                <td className={`${tdClass} text-center font-mono`}>{tx.voucherType}</td>
                <td className={tdClass}>{tx.narration}</td>
                <td className={`${tdClass} text-right font-mono font-bold`}>
                  {fmt(Number(tx.totalDebit) || 0)}
                </td>
                <td className={`${tdClass} text-right font-mono font-bold`}>
                  {fmt(Number(tx.totalCredit) || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
