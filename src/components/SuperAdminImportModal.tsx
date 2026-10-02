import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileJson,
  Layers,
  Database,
  Building2,
  Receipt,
  Wallet,
  Scale,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Sparkles,
  CloudDownload,
  CloudUpload,
} from 'lucide-react';
import {
  useAccounting,
  ImportCategoryTab,
  AccountHead,
} from '../core/aplusEngine';
import {
  pushMasterCloudSnapshot,
  pullMasterCloudSnapshot,
} from '../services/firebaseSync';

interface SuperAdminImportModalProps {
  isOpen: boolean;
  initialTab?: ImportCategoryTab;
  onClose: () => void;
}

function parseCsvRows(csvText: string): string[][] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  return lines.map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function triggerDownload(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const SuperAdminImportModal: React.FC<SuperAdminImportModalProps> = ({
  isOpen,
  initialTab = 'coa',
  onClose,
}) => {
  const {
    isSuperAdmin,
    accountHeads,
    transactions,
    pettyCashTransactions,
    campuses,
    currentCampusId,
    importOfficialAccountsHeads,
    importSystemState,
    exportSystemState,
    addAccountHead,
    updateAccountHead,
    addTransaction,
    addPettyCashTransaction,
    addCampus,
    updateCampus,
    updateCampusOpeningDrCr,
    logActivity,
  } = useAccounting();

  const [activeTab, setActiveTab] = useState<ImportCategoryTab>(initialTab);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [restoreCampuses, setRestoreCampuses] = useState<boolean>(true);
  const [restoreSettings, setRestoreSettings] = useState<boolean>(true);
  const [pasteText, setPasteText] = useState<string>('');
  const [selectedCampusForOb, setSelectedCampusForOb] = useState<string>(
    currentCampusId === 'all' ? campuses[0]?.id || 'campus-khiali' : currentCampusId
  );
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
      setStatusBanner(null);
    }
  }, [isOpen, initialTab]);

  // Strictly Super Admin Only
  if (!isOpen || !isSuperAdmin) return null;

  const showStatus = (type: 'success' | 'error' | 'info', message: string) => {
    setStatusBanner({ type, message });
  };

  // Helper to infer mainCode / category from account code
  const inferAccountMeta = (code: string, rawCategory?: string, rawGroupCode?: string, rawGroupName?: string) => {
    const cleanCode = code.trim();
    const prefix = cleanCode.split('-')[0] || cleanCode.slice(0, 3);
    let category: 'Asset' | 'Equity' | 'Liability' | 'Revenue' | 'Expense' = 'Expense';
    let mainCode = '500';
    let mainAccount = '500 — EXPENSES';

    if (prefix.startsWith('1') || rawCategory?.toLowerCase() === 'asset') {
      category = 'Asset';
      mainCode = '100';
      mainAccount = '100 — ASSETS';
    } else if (prefix.startsWith('2') || rawCategory?.toLowerCase() === 'equity') {
      category = 'Equity';
      mainCode = '200';
      mainAccount = '200 — EQUITY / CAPITAL';
    } else if (prefix.startsWith('3') || rawCategory?.toLowerCase() === 'liability') {
      category = 'Liability';
      mainCode = '300';
      mainAccount = '300 — LIABILITIES';
    } else if (prefix.startsWith('4') || rawCategory?.toLowerCase() === 'revenue' || rawCategory?.toLowerCase() === 'income') {
      category = 'Revenue';
      mainCode = '400';
      mainAccount = '400 — REVENUE / INCOME';
    }

    const parts = cleanCode.split('-');
    const groupCode = rawGroupCode || (parts.length >= 2 ? `${parts[0]}-${parts[1]}` : `${mainCode}-1`);
    const groupName = rawGroupName || `${category.toUpperCase()} GROUP`;

    return { category, mainCode, mainAccount, groupCode, groupName };
  };

  // Import Chart of Accounts from parsed objects or CSV rows
  const processCoaImport = (items: any[]) => {
    if (!Array.isArray(items) || items.length === 0) {
      showStatus('error', 'No valid Chart of Accounts rows found to import.');
      return;
    }

    const normalizedHeads: AccountHead[] = [];
    items.forEach((item, idx) => {
      const code = String(item.code || item.accountCode || item.ledgerCode || item['Account Id'] || '').trim();
      const name = String(item.name || item.accountName || item['Account Name'] || '').trim();
      if (!code || !name) return;

      const meta = inferAccountMeta(
        code,
        item.category || item.Category,
        item.groupCode,
        item.groupName || item.accountType || item['Account Type']
      );

      normalizedHeads.push({
        id: item.id || `acc-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${idx}`,
        code,
        ledgerCode: code,
        name,
        category: meta.category,
        type: item.type || meta.category,
        accountType: meta.groupName,
        mainCode: meta.mainCode,
        mainAccount: meta.mainAccount,
        groupCode: meta.groupCode,
        groupName: meta.groupName,
        balance: Number(item.balance ?? item['Balance (PKR)'] ?? 0) || 0,
        description: item.description || item.Description || `${name} (${code})`,
      });
    });

    if (normalizedHeads.length === 0) {
      showStatus('error', 'Could not parse any valid Account Code + Account Name pairs.');
      return;
    }

    if (importMode === 'replace') {
      const res = importSystemState(
        {
          accountHeads: normalizedHeads,
          transactions,
          pettyCashTransactions,
        },
        { mode: 'replace', restoreCampuses: false, restoreSettings: false }
      );
      if (res.success) {
        showStatus(
          'success',
          `Replaced Chart of Accounts with ${normalizedHeads.length} imported account heads!`
        );
      } else {
        showStatus('error', res.message);
      }
    } else {
      let added = 0;
      let updated = 0;
      normalizedHeads.forEach((nh) => {
        const existing = accountHeads.find(
          (a) => a.code.toLowerCase() === nh.code.toLowerCase()
        );
        if (existing) {
          updateAccountHead(existing.id, {
            name: nh.name,
            category: nh.category,
            type: nh.type,
            accountType: nh.accountType,
            balance: nh.balance,
            description: nh.description,
          });
          updated++;
        } else {
          addAccountHead(nh);
          added++;
        }
      });
      logActivity(
        'COA_IMPORT',
        'AccountHead',
        `coa-import-${Date.now()}`,
        `Super Admin imported Chart of Accounts: ${added} new heads added, ${updated} existing heads updated.`
      );
      showStatus(
        'success',
        `Chart of Accounts Import Complete: ${added} new accounts added, ${updated} existing accounts updated!`
      );
    }
  };

  // Import Vouchers from parsed objects
  const processVouchersImport = (items: any[]) => {
    let importedCount = 0;
    items.forEach((item, idx) => {
      // If it already has full entries[] array (from JSON export)
      if (Array.isArray(item.entries) && item.entries.length > 0) {
        addTransaction({
          ...item,
          id: item.id || `tx-imp-${Date.now()}-${idx}`,
        });
        importedCount++;
        return;
      }

      // Otherwise build from CSV / flat object
      const voucherNo = String(item.voucherNo || item['Voucher No'] || `BPV-IMP-${Date.now()}-${idx}`).trim();
      const rawType = String(item.voucherType || item.type || 'CPV').toUpperCase().trim();
      const voucherType = (['BPV', 'BRV', 'CPV', 'CRV', 'JV'].includes(rawType) ? rawType : 'CPV') as any;
      const campusId = String(item.campusId || item.campus || campuses[0]?.id || 'campus-khiali').trim();
      const date = String(item.date || new Date().toISOString().slice(0, 10)).trim();
      const amount = Math.abs(Number(item.amount || item.totalDebit || 0));
      if (!amount || amount <= 0) return;

      const drCode = String(item.debitAccountCode || item.drCode || '500-3-01').trim();
      const crCode = String(item.creditAccountCode || item.crCode || '100-4-01').trim();
      const drAcc =
        accountHeads.find((a) => a.code === drCode) ||
        accountHeads.find((a) => a.category === 'Expense') ||
        accountHeads[0];
      const crAcc =
        accountHeads.find((a) => a.code === crCode) ||
        accountHeads.find((a) => a.category === 'Asset') ||
        accountHeads[0];

      const narration = String(item.narration || item.description || `Imported ${voucherType} Voucher`).trim();

      addTransaction({
        voucherNo,
        voucherType,
        campusId,
        date,
        narration,
        chequeNo: item.chequeNo || '',
        status: item.status || 'Approved',
        preparedBy: item.preparedBy || 'Super Admin Import',
        approvedBy: 'Super Administrator',
        totalDebit: amount,
        totalCredit: amount,
        entries: [
          {
            id: `imp-dr-${Date.now()}-${idx}`,
            accountId: drAcc.id,
            accountCode: drAcc.code,
            accountName: drAcc.name,
            description: narration,
            debit: amount,
            credit: 0,
          },
          {
            id: `imp-cr-${Date.now()}-${idx}`,
            accountId: crAcc.id,
            accountCode: crAcc.code,
            accountName: crAcc.name,
            description: narration,
            debit: 0,
            credit: amount,
          },
        ],
      });
      importedCount++;
    });

    if (importedCount > 0) {
      showStatus('success', `Successfully imported ${importedCount} Vouchers into the General Ledger!`);
    } else {
      showStatus('error', 'No valid vouchers found in the provided file/text.');
    }
  };

  // Import Petty Cash from parsed objects
  const processPettyCashImport = (items: any[]) => {
    let importedCount = 0;
    items.forEach((item, idx) => {
      const amount = Math.abs(Number(item.amount || 0));
      if (!amount || amount <= 0) return;
      const campusId = String(item.campusId || item.campus || campuses[0]?.id || 'campus-khiali').trim();
      const accCode = String(item.accountCode || '500-3-01').trim();
      const acc = accountHeads.find((a) => a.code === accCode) || accountHeads[0];

      addPettyCashTransaction({
        voucherNo: String(item.voucherNo || `PCV-IMP-${Date.now()}-${idx}`).trim(),
        campusId,
        date: String(item.date || new Date().toISOString().slice(0, 10)).trim(),
        type: item.type === 'Replenishment' ? 'Replenishment' : 'Disbursement',
        payee: String(item.payee || 'Supplier / Staff').trim(),
        category: String(item.category || acc?.name || 'Stationery').trim(),
        accountId: acc?.id,
        accountCode: acc?.code,
        amount,
        narration: String(item.narration || item.description || 'Imported petty cash entry').trim(),
        receiptNo: String(item.receiptNo || '').trim(),
        approvedBy: 'Super Administrator',
      });
      importedCount++;
    });

    if (importedCount > 0) {
      showStatus('success', `Successfully imported ${importedCount} Petty Cash transactions!`);
    } else {
      showStatus('error', 'No valid petty cash rows found to import.');
    }
  };

  // Import Campuses
  const processCampusesImport = (items: any[]) => {
    let added = 0;
    let updated = 0;
    items.forEach((item) => {
      const code = String(item.code || '').trim().toUpperCase();
      const name = String(item.name || '').trim();
      if (!code || !name) return;

      const existing = campuses.find(
        (c) => c.code.toUpperCase() === code || c.id === item.id
      );
      if (existing) {
        updateCampus(existing.id, {
          name,
          code,
          city: item.city || existing.city,
          address: item.address || existing.address,
          phone: item.phone || existing.phone,
          email: item.email || existing.email,
          accountantName: item.accountantName || existing.accountantName,
          pettyCashFloat: Number(item.pettyCashFloat ?? existing.pettyCashFloat) || 100000,
        });
        updated++;
      } else {
        addCampus({
          name,
          code,
          city: item.city || 'Gujranwala',
          address: item.address || 'Campus Address',
          phone: item.phone || '+92 55 0000000',
          email: item.email || `${code.toLowerCase()}@aplusschool.edu.pk`,
          accountantName: item.accountantName || 'Campus Accountant',
          pettyCashFloat: Number(item.pettyCashFloat) || 100000,
          currentPettyCash: Number(item.currentPettyCash ?? item.pettyCashFloat) || 100000,
        });
        added++;
      }
    });

    if (added > 0 || updated > 0) {
      showStatus('success', `Campuses Import Complete: ${added} new campuses added, ${updated} campuses updated!`);
    } else {
      showStatus('error', 'No valid campus records found (requires code and name).');
    }
  };

  // Import Opening Balances
  const processOpeningBalanceImport = (items: any[]) => {
    let updatedCount = 0;
    items.forEach((item) => {
      const code = String(item.accountCode || item.code || '').trim();
      const targetCampus = String(item.campusId || selectedCampusForOb).trim();
      const debit = Math.max(0, Number(item.debit || 0));
      const credit = Math.max(0, Number(item.credit || 0));
      const acc = accountHeads.find(
        (a) => a.code.toLowerCase() === code.toLowerCase() || a.id === item.accountId
      );
      if (acc) {
        updateCampusOpeningDrCr(acc.id, targetCampus, debit, credit);
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      showStatus(
        'success',
        `Updated Opening Balances (Dr/Cr) for ${updatedCount} accounts in ${
          campuses.find((c) => c.id === selectedCampusForOb)?.name || selectedCampusForOb
        }!`
      );
    } else {
      showStatus('error', 'No matching account codes found for Opening Balance import.');
    }
  };

  // Unified File Upload Handler (CSV or JSON)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '').trim();
      if (!content) {
        showStatus('error', 'Uploaded file is empty.');
        return;
      }

      try {
        if (file.name.toLowerCase().endsWith('.json') || content.startsWith('{') || content.startsWith('[')) {
          const parsed = JSON.parse(content);

          if (activeTab === 'all') {
            const res = importSystemState(parsed, {
              mode: importMode,
              restoreCampuses,
              restoreSettings,
            });
            showStatus(res.success ? 'success' : 'error', res.message);
            return;
          }

          if (activeTab === 'coa') {
            const arr = Array.isArray(parsed) ? parsed : parsed.accountHeads || [];
            processCoaImport(arr);
          } else if (activeTab === 'vouchers') {
            const arr = Array.isArray(parsed) ? parsed : parsed.transactions || parsed.vouchers || [];
            processVouchersImport(arr);
          } else if (activeTab === 'pettycash') {
            const arr = Array.isArray(parsed) ? parsed : parsed.pettyCashTransactions || [];
            processPettyCashImport(arr);
          } else if (activeTab === 'campuses') {
            const arr = Array.isArray(parsed) ? parsed : parsed.campuses || [];
            processCampusesImport(arr);
          } else if (activeTab === 'openingbalance') {
            const arr = Array.isArray(parsed) ? parsed : parsed.openingBalances || [];
            processOpeningBalanceImport(arr);
          }
        } else {
          // Parse CSV
          handleParseCsvContent(content);
        }
      } catch (err: any) {
        showStatus('error', `Failed to parse file: ${err?.message || 'Invalid format'}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Parse CSV text (from file or textarea paste)
  const handleParseCsvContent = (rawCsv: string) => {
    const rows = parseCsvRows(rawCsv);
    if (rows.length === 0) {
      showStatus('error', 'No CSV rows found.');
      return;
    }

    // Detect if first row is header
    const firstRowLower = rows[0].map((c) => c.toLowerCase());
    const hasHeader =
      firstRowLower.includes('code') ||
      firstRowLower.includes('account id') ||
      firstRowLower.includes('accountcode') ||
      firstRowLower.includes('voucherno') ||
      firstRowLower.includes('name');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (activeTab === 'coa') {
      // Support both exported 8-column COA CSV (Sr#,Account Id,Account Name,Account Type,Category,Balance...) and simple (code,name,category,groupCode,groupName,balance,description)
      const isExportFormat = firstRowLower[0]?.includes('sr#') || firstRowLower[1]?.includes('account id');
      const items = dataRows.map((r) =>
        isExportFormat
          ? {
              code: r[1],
              name: r[2],
              groupName: r[3],
              category: r[4],
              balance: r[5],
              description: r[7] || r[6],
            }
          : {
              code: r[0],
              name: r[1],
              category: r[2],
              groupCode: r[3],
              groupName: r[4],
              balance: r[5],
              description: r[6],
            }
      );
      processCoaImport(items);
    } else if (activeTab === 'vouchers') {
      const items = dataRows.map((r) => ({
        voucherNo: r[0],
        voucherType: r[1],
        campusId: r[2],
        date: r[3],
        debitAccountCode: r[4],
        creditAccountCode: r[5],
        amount: r[6],
        narration: r[7],
        chequeNo: r[8],
        status: r[9] || 'Approved',
      }));
      processVouchersImport(items);
    } else if (activeTab === 'pettycash') {
      const items = dataRows.map((r) => ({
        voucherNo: r[0],
        campusId: r[1],
        date: r[2],
        type: r[3] || 'Disbursement',
        payee: r[4],
        category: r[5],
        accountCode: r[6],
        amount: r[7],
        narration: r[8],
        receiptNo: r[9],
      }));
      processPettyCashImport(items);
    } else if (activeTab === 'campuses') {
      const items = dataRows.map((r) => ({
        code: r[0],
        name: r[1],
        city: r[2],
        address: r[3],
        phone: r[4],
        email: r[5],
        accountantName: r[6],
        pettyCashFloat: r[7],
      }));
      processCampusesImport(items);
    } else if (activeTab === 'openingbalance') {
      const items = dataRows.map((r) => ({
        accountCode: r[0],
        debit: r[1],
        credit: r[2],
      }));
      processOpeningBalanceImport(items);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">
                  Super Admin Universal Data Import & Migration Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Super Admin Exclusive
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Import Chart of Accounts (COA), All System Data, Vouchers, Petty Cash, Campuses & Opening Balances via CSV, JSON, or Cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 pt-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'coa', label: `Chart of Accounts (${accountHeads.length})`, icon: Layers },
            { id: 'all', label: 'All Things (Full System JSON / Cloud)', icon: Database },
            { id: 'vouchers', label: `Vouchers (${transactions.length})`, icon: Receipt },
            { id: 'pettycash', label: `Petty Cash (${pettyCashTransactions.length})`, icon: Wallet },
            { id: 'campuses', label: `Campuses (${campuses.length})`, icon: Building2 },
            { id: 'openingbalance', label: 'Opening Balances (IAS 1)', icon: Scale },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id as ImportCategoryTab);
                  setStatusBanner(null);
                  setPasteText('');
                }}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white border-indigo-600 text-indigo-950 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {statusBanner && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                statusBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : statusBanner.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-blue-50 border-blue-300 text-blue-950'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusBanner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{statusBanner.message}</span>
              </div>
              <button onClick={() => setStatusBanner(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={activeTab === 'all' ? '.json' : '.csv,.json,.txt'}
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* TAB 1: CHART OF ACCOUNTS (COA) IMPORT */}
          {activeTab === 'coa' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: 1-Click Official 157 Heads */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                      Official Standard
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-1.5">
                      1. Sync 157 Official PDF Account Heads
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Instantly import and synchronize all 157 institutional Chart of Accounts heads (100 Assets to 500 Expenses).
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      importOfficialAccountsHeads();
                      showStatus(
                        'success',
                        '157 Official Institutional PDF Account Heads synchronized successfully!'
                      );
                    }}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Sync 157 Official Heads Now</span>
                  </button>
                </div>

                {/* Card 2: Upload CSV / JSON COA */}
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px] uppercase">
                      File Upload (.CSV / .JSON)
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-1.5">
                      2. Upload Chart of Accounts File
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Import custom account heads from a CSV spreadsheet or JSON file. Supports Merge or Complete Replace.
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[11px]">
                      <label className="flex items-center gap-1 font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="coaMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                        />
                        Merge / Update
                      </label>
                      <label className="flex items-center gap-1 font-bold text-rose-700 cursor-pointer">
                        <input
                          type="radio"
                          name="coaMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                        />
                        Replace All
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select COA .CSV or .JSON File</span>
                  </button>
                </div>

                {/* Card 3: Templates & Current Export */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[10px] uppercase">
                      Templates & Export
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-1.5">
                      3. Download Sample Templates
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Download a ready-to-fill CSV or JSON template for Chart of Accounts, or export current {accountHeads.length} heads.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        triggerDownload(
                          'Aplus_Sample_Chart_Of_Accounts_Template.csv',
                          'code,name,category,groupCode,groupName,balance,description\n100-4-05,HBL Main School Account,Asset,100-4,CASH & BANK,0,Official campus operational bank account\n500-3-09,Classroom Smart Markers,Expense,500-3,ACADEMIC SUPPLIES,0,Whiteboard markers and dusters for classrooms\n'
                        )
                      }
                      className="py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sample CSV</span>
                    </button>
                    <button
                      onClick={() =>
                        triggerDownload(
                          `Aplus_Chart_Of_Accounts_Full_${new Date().toISOString().slice(0, 10)}.json`,
                          JSON.stringify(accountHeads, null, 2),
                          'application/json'
                        )
                      }
                      className="py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileJson className="w-3.5 h-3.5 text-blue-600" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct CSV / Excel Paste Box for COA */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Or Paste Chart of Accounts Rows Directly (CSV format: <code className="font-mono text-indigo-700">code,name,category,groupCode,groupName,balance,description</code>)
                  </label>
                  <button
                    onClick={() =>
                      setPasteText(
                        '100-4-09,Meezan Bank Fee Collection Account,Asset,100-4,CASH & BANK,0,Meezan Bank fee collection account\n500-3-12,Science Lab Consumables,Expense,500-3,ACADEMIC SUPPLIES,0,Chemicals and glassware for school labs'
                      )
                    }
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Fill Example Rows
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="100-4-09,Meezan Bank Fee Collection Account,Asset,100-4,CASH & BANK,0,Meezan Bank fee collection account"
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleParseCsvContent(pasteText)}
                    disabled={!pasteText.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Import Pasted Account Heads
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL THINGS (COMPLETE SYSTEM BACKUP / MIGRATION) */}
          {activeTab === 'all' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-3">
                <h4 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Import All System Data (COA + Vouchers + Petty Cash + Campuses + Settings)</span>
                </h4>
                <p className="text-xs text-slate-600">
                  Restore or merge a complete master JSON package containing Chart of Accounts, General Ledger Vouchers (BPV, BRV, CPV, CRV, JV), Petty Cash Register, Campus Branches, and Institutional Settings.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-bold text-slate-900">Import Strategy</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                      />
                      <span>
                        <strong>Merge & Append (Recommended):</strong> Keep existing records and add new items
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-rose-800 cursor-pointer">
                      <input
                        type="radio"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                      />
                      <span>
                        <strong>Complete Replace:</strong> Overwrite ledger & COA with imported file
                      </span>
                    </label>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-bold text-slate-900">Included Modules</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreCampuses}
                        onChange={(e) => setRestoreCampuses(e.target.checked)}
                      />
                      <span>Import & Restore Campus Branches</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreSettings}
                        onChange={(e) => setRestoreSettings(e.target.checked)}
                      />
                      <span>Import & Restore School Settings & Signatures</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Complete System .JSON File (All Things)</span>
                  </button>

                  <button
                    onClick={() => {
                      const state = exportSystemState('all');
                      triggerDownload(
                        `APLUS_Complete_System_Backup_${new Date().toISOString().slice(0, 10)}.json`,
                        JSON.stringify(state, null, 2),
                        'application/json'
                      );
                      showStatus('success', 'Exported complete system state (All Things) to JSON!');
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export All Things (.JSON)</span>
                  </button>

                  <button
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const cloudState = await pullMasterCloudSnapshot();
                        if (cloudState) {
                          const res = importSystemState(cloudState, {
                            mode: importMode,
                            restoreCampuses,
                            restoreSettings,
                          });
                          showStatus(res.success ? 'success' : 'error', res.message);
                        } else {
                          showStatus('info', 'No cloud snapshot found in Firebase Firestore yet.');
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <CloudDownload className="w-4 h-4 text-blue-400" />
                    <span>Import All Things from Firebase Cloud</span>
                  </button>

                  <button
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const state = exportSystemState('all');
                        await pushMasterCloudSnapshot(state);
                        showStatus('success', 'Saved complete system state (All Things) to Firebase Cloud!');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <CloudUpload className="w-4 h-4 text-emerald-400" />
                    <span>Save All Things to Firebase Cloud</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VOUCHERS IMPORT */}
          {activeTab === 'vouchers' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Import General Ledger Vouchers (BPV, BRV, CPV, CRV, JV)
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Upload a CSV or JSON file of vouchers. CSV columns:{' '}
                    <code className="font-mono text-indigo-700">
                      voucherNo,voucherType,campusId,date,debitAccountCode,creditAccountCode,amount,narration,chequeNo,status
                    </code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      triggerDownload(
                        'Aplus_Sample_Vouchers_Import_Template.csv',
                        'voucherNo,voucherType,campusId,date,debitAccountCode,creditAccountCode,amount,narration,chequeNo,status\nAPS-EXP-00101,CPV,campus-khiali,2026-09-30,500-3-01,100-4-01,4500,Stationery purchased for administrative and classroom use,CASH-101,Approved\nBPV-2026-102,BPV,campus-cvt,2026-09-30,500-2-01,100-4-02,35000,Monthly electricity bill payment via bank cheque,CHQ-99201,Approved\n'
                      )
                    }
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sample Vouchers CSV</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Vouchers (.CSV / .JSON)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Paste Voucher Rows (CSV)
                  </label>
                  <button
                    onClick={() =>
                      setPasteText(
                        'APS-EXP-00105,CPV,campus-khiali,2026-09-30,500-3-01,100-4-01,4500,Stationery purchased for administrative and classroom use,CASH-105,Approved'
                      )
                    }
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Fill Sample Voucher Row
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="APS-EXP-00105,CPV,campus-khiali,2026-09-30,500-3-01,100-4-01,4500,Stationery purchased for administrative and classroom use,CASH-105,Approved"
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleParseCsvContent(pasteText)}
                    disabled={!pasteText.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Import Pasted Vouchers
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PETTY CASH IMPORT */}
          {activeTab === 'pettycash' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Import Petty Cash Transactions (Disbursements & Replenishments)
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    CSV columns:{' '}
                    <code className="font-mono text-indigo-700">
                      voucherNo,campusId,date,type,payee,category,accountCode,amount,narration,receiptNo
                    </code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      triggerDownload(
                        'Aplus_Sample_Petty_Cash_Import_Template.csv',
                        'voucherNo,campusId,date,type,payee,category,accountCode,amount,narration,receiptNo\nPCV-2026-051,campus-khiali,2026-09-30,Disbursement,Stationery Supplier,Stationery,500-3-01,4500,Stationery purchased for administrative office use,BILL-501\n'
                      )
                    }
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sample Petty Cash CSV</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Petty Cash (.CSV / .JSON)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Paste Petty Cash Rows (CSV)
                  </label>
                  <button
                    onClick={() =>
                      setPasteText(
                        'PCV-2026-055,campus-khiali,2026-09-30,Disbursement,Al-Karam Book Depot,Stationery,500-3-01,2500,Registers and markers for examination branch,RCPT-882'
                      )
                    }
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Fill Sample Petty Cash Row
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleParseCsvContent(pasteText)}
                    disabled={!pasteText.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Import Pasted Petty Cash
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CAMPUSES IMPORT */}
          {activeTab === 'campuses' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Import School Campus Branches
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    CSV columns:{' '}
                    <code className="font-mono text-indigo-700">
                      code,name,city,address,phone,email,accountantName,pettyCashFloat
                    </code>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      processCampusesImport([
                        {
                          code: 'APS-01',
                          name: 'Main Campus',
                          city: 'Gujranwala',
                          address: 'Main Campus Block, Gujranwala',
                          phone: '+92 55 3829101',
                          email: 'aps01@aplusschool.edu.pk',
                          accountantName: 'Main Campus Accountant',
                          pettyCashFloat: 100000,
                        },
                        {
                          code: 'APS-02',
                          name: 'Campus 2',
                          city: 'Gujranwala',
                          address: 'Sector B, Campus 2',
                          phone: '+92 55 3829102',
                          email: 'aps02@aplusschool.edu.pk',
                          accountantName: 'Campus 2 Accountant',
                          pettyCashFloat: 100000,
                        },
                      ])
                    }
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    + Quick Import APS-01 & APS-02
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Campuses (.CSV / .JSON)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Paste Campus Rows (CSV)
                </label>
                <textarea
                  rows={3}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="APS-01,Main Campus,Gujranwala,Main Road,055-3829100,main@aplusschool.edu.pk,Mr. Ahmad,100000"
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleParseCsvContent(pasteText)}
                    disabled={!pasteText.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Import Pasted Campuses
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: OPENING BALANCES IMPORT */}
          {activeTab === 'openingbalance' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900">
                    Import Campus Opening Balances (IAS 1 Debit / Credit)
                  </h4>
                  <p className="text-xs text-slate-600">
                    CSV columns:{' '}
                    <code className="font-mono text-indigo-700">
                      accountCode,debit,credit
                    </code>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedCampusForOb}
                    onChange={(e) => setSelectedCampusForOb(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        Target: {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      triggerDownload(
                        'Aplus_Sample_Opening_Balances_Template.csv',
                        'accountCode,debit,credit\n100-4-01,250000,0\n200-1-01,0,250000\n'
                      )
                    }
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sample OB CSV</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Opening Balances (.CSV / .JSON)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Paste Opening Balance Rows (<code className="font-mono">accountCode,debit,credit</code>)
                </label>
                <textarea
                  rows={3}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="100-4-01,500000,0&#10;200-1-01,0,500000"
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleParseCsvContent(pasteText)}
                    disabled={!pasteText.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Apply Pasted Opening Balances
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Protected by Super Administrator Role Policy • Automatic Audit Trail & Firebase Sync
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer"
          >
            Close Import Hub
          </button>
        </div>
      </div>
    </div>
  );
};
