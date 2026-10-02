import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Plus,
  Play,
  ShieldCheck,
  Trash2,
  Building2,
  Zap,
  Clock,
  AlertTriangle,
  FileCheck2,
  RefreshCw,
  Lock,
  Unlock,
} from 'lucide-react';
import { useAccounting, VoucherEntry } from '../core/aplusEngine';
import {
  saveRecurringVouchersToCloud,
  loadRecurringVouchersFromCloud,
} from '../services/firebaseSync';

export type RecurringFrequency = 'Monthly' | 'Quarterly' | 'Weekly' | 'Annual';
export type RecurringPermissionMode =
  | 'on_permission_prompt'
  | 'superadmin_permission_only'
  | 'preauthorized_auto';

export interface RecurringVoucherSchedule {
  id: string;
  title: string;
  categoryTag: 'Rent' | 'Electricity / WAPDA' | 'Gas & Water' | 'Internet / IT' | 'Security & Janitorial' | 'Other Recurring';
  campusId: string; // specific campus id or 'ALL_CAMPUSES'
  voucherType: 'JV' | 'BPV' | 'CPV';
  frequency: RecurringFrequency;
  dayOfMonth: number;
  nextRunDate: string; // YYYY-MM-DD
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  amount: number;
  narrationTemplate: string;
  refPrefix: string;
  permissionMode: RecurringPermissionMode;
  isActive: boolean;
  lastRunDate?: string;
  lastGeneratedVoucherNo?: string;
  totalGeneratedCount: number;
  createdBy: string;
  permittedBy?: string;
}

export interface RecurringExecutionLog {
  id: string;
  scheduleId: string;
  scheduleTitle: string;
  voucherNo: string;
  voucherType: string;
  campusName: string;
  amount: number;
  executedAt: string;
  permittedBy: string;
  mode: string;
}

const STORAGE_KEY = 'aplus_recurring_vouchers_v1';
const LOGS_STORAGE_KEY = 'aplus_recurring_voucher_logs_v1';

type SubListener = (schedules: RecurringVoucherSchedule[]) => void;
const listeners = new Set<SubListener>();

export function getStoredRecurringSchedules(): RecurringVoucherSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStoredRecurringSchedules(
  schedules: RecurringVoucherSchedule[],
  logs?: RecurringExecutionLog[]
) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    if (logs) {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
    }
  } catch {}
  listeners.forEach((fn) => fn(schedules));
  saveRecurringVouchersToCloud({
    schedules,
    logs: logs || getStoredRecurringLogs(),
  }).catch(() => {});
}

export function getStoredRecurringLogs(): RecurringExecutionLog[] {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function subscribeRecurringSchedules(fn: SubListener) {
  listeners.add(fn);
  fn(getStoredRecurringSchedules());
  return () => {
    listeners.delete(fn);
  };
}

export function computeNextRecurringDate(
  currentDateStr: string,
  frequency: RecurringFrequency,
  dayOfMonth: number
): string {
  try {
    const [y, m, d] = currentDateStr.split('-').map(Number);
    const dt = new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
    if (frequency === 'Monthly') {
      dt.setMonth(dt.getMonth() + 1);
      dt.setDate(Math.min(dayOfMonth || 1, 28));
    } else if (frequency === 'Quarterly') {
      dt.setMonth(dt.getMonth() + 3);
      dt.setDate(Math.min(dayOfMonth || 1, 28));
    } else if (frequency === 'Weekly') {
      dt.setDate(dt.getDate() + 7);
    } else {
      dt.setFullYear(dt.getFullYear() + 1);
    }
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export const RecurringVoucherManager: React.FC<{
  compactMode?: boolean;
}> = ({ compactMode = false }) => {
  const {
    accountHeads,
    campuses,
    currentCampusId,
    currentUser,
    isSuperAdmin,
    activePeriod,
    addTransaction,
    getNextVoucherNumber,
  } = useAccounting();

  const [schedules, setSchedules] = useState<RecurringVoucherSchedule[]>(() =>
    getStoredRecurringSchedules()
  );
  const [logs, setLogs] = useState<RecurringExecutionLog[]>(() =>
    getStoredRecurringLogs()
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!compactMode);

  // Single-click account dropdown states
  const [openAccPicker, setOpenAccPicker] = useState<'debit' | 'credit' | null>(null);
  const [debitSearch, setDebitSearch] = useState('');
  const [creditSearch, setCreditSearch] = useState('');

  // Form fields for new Recurring Schedule
  const todayStr = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('Monthly Campus Building Rent');
  const [categoryTag, setCategoryTag] =
    useState<RecurringVoucherSchedule['categoryTag']>('Rent');
  const [targetCampusId, setTargetCampusId] = useState<string>(
    currentCampusId === 'all' ? campuses[0]?.id || 'c1' : currentCampusId
  );
  const [voucherType, setVoucherType] = useState<'JV' | 'BPV' | 'CPV'>('JV');
  const [frequency, setFrequency] = useState<RecurringFrequency>('Monthly');
  const [dayOfMonth, setDayOfMonth] = useState<number>(5);
  const [nextRunDate, setNextRunDate] = useState<string>(todayStr);
  const [amount, setAmount] = useState<string>('120000');
  const [narrationTemplate, setNarrationTemplate] = useState<string>(
    'Automated Monthly Building Rent Journal / Payment Entry for {{MONTH}}'
  );
  const [refPrefix, setRefPrefix] = useState<string>('REC-RENT');
  const [permissionMode, setPermissionMode] =
    useState<RecurringPermissionMode>('on_permission_prompt');

  // Default Expense & Bank/Payable accounts
  const defaultDebitAcc = useMemo(
    () =>
      accountHeads.find(
        (a) =>
          a.name.toLowerCase().includes('rent') ||
          a.name.toLowerCase().includes('utility') ||
          a.category === 'Expense'
      ) || accountHeads[0],
    [accountHeads]
  );
  const defaultCreditAcc = useMemo(
    () =>
      accountHeads.find(
        (a) =>
          a.type === 'Bank' ||
          a.type === 'Cash' ||
          a.category === 'Liability' ||
          a.category === 'Asset'
      ) || accountHeads[1] || accountHeads[0],
    [accountHeads]
  );

  const [debitAccId, setDebitAccId] = useState<string>(defaultDebitAcc?.id || '');
  const [creditAccId, setCreditAccId] = useState<string>(defaultCreditAcc?.id || '');

  useEffect(() => {
    if (!debitAccId && defaultDebitAcc) setDebitAccId(defaultDebitAcc.id);
    if (!creditAccId && defaultCreditAcc) setCreditAccId(defaultCreditAcc.id);
  }, [defaultDebitAcc, defaultCreditAcc, debitAccId, creditAccId]);

  useEffect(() => {
    const unsub = subscribeRecurringSchedules(setSchedules);
    loadRecurringVouchersFromCloud()
      .then((cloud) => {
        if (cloud && Array.isArray(cloud.schedules) && cloud.schedules.length > 0) {
          setSchedules(cloud.schedules);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud.schedules));
        }
        if (cloud && Array.isArray(cloud.logs) && cloud.logs.length > 0) {
          setLogs(cloud.logs);
          localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(cloud.logs));
        }
      })
      .catch(() => {});
    return unsub;
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  // Preset Quick Templates (Rent, Electricity/WAPDA, Gas/Water, Internet)
  const applyPreset = (
    preset: 'rent' | 'electricity' | 'gas_water' | 'internet' | 'security'
  ) => {
    if (preset === 'rent') {
      setTitle('Monthly Campus Building Rent');
      setCategoryTag('Rent');
      setVoucherType('JV');
      setAmount('150000');
      setRefPrefix('REC-RENT');
      setNarrationTemplate('Monthly Campus Building Rent Expense accrued/paid for {{MONTH}}');
      const rentAcc = accountHeads.find((a) => a.name.toLowerCase().includes('rent'));
      if (rentAcc) setDebitAccId(rentAcc.id);
    } else if (preset === 'electricity') {
      setTitle('Monthly Electricity / WAPDA Utility Bill');
      setCategoryTag('Electricity / WAPDA');
      setVoucherType('BPV');
      setAmount('65000');
      setRefPrefix('REC-WAPDA');
      setNarrationTemplate('Monthly Campus Electricity & Utility Bill for {{MONTH}}');
      const elecAcc = accountHeads.find(
        (a) =>
          a.name.toLowerCase().includes('electric') ||
          a.name.toLowerCase().includes('utility')
      );
      if (elecAcc) setDebitAccId(elecAcc.id);
    } else if (preset === 'gas_water') {
      setTitle('Monthly Sui Gas & Water Utility Charges');
      setCategoryTag('Gas & Water');
      setVoucherType('CPV');
      setAmount('18500');
      setRefPrefix('REC-UTIL');
      setNarrationTemplate('Monthly Sui Gas & Water Utility Bill for {{MONTH}}');
    } else if (preset === 'internet') {
      setTitle('Monthly Fiber Internet & ERP Cloud Link');
      setCategoryTag('Internet / IT');
      setVoucherType('BPV');
      setAmount('22000');
      setRefPrefix('REC-NET');
      setNarrationTemplate('Monthly Campus High-Speed Internet & IT Subscription for {{MONTH}}');
    } else if (preset === 'security') {
      setTitle('Monthly Security & Janitorial Services Contract');
      setCategoryTag('Security & Janitorial');
      setVoucherType('BPV');
      setAmount('85000');
      setRefPrefix('REC-SEC');
      setNarrationTemplate('Monthly Campus Security & Janitorial Services for {{MONTH}}');
    }
    setShowForm(true);
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount) || 0;
    const drHead = accountHeads.find((a) => a.id === debitAccId) || defaultDebitAcc;
    const crHead = accountHeads.find((a) => a.id === creditAccId) || defaultCreditAcc;
    if (!drHead || !crHead || numAmt <= 0) {
      triggerToast('Please select valid Debit & Credit Account Heads and an amount > 0.');
      return;
    }

    const newItem: RecurringVoucherSchedule = {
      id: `rec-${Date.now()}`,
      title: title.trim() || 'Monthly Recurring Expense',
      categoryTag,
      campusId: targetCampusId,
      voucherType,
      frequency,
      dayOfMonth: Number(dayOfMonth) || 1,
      nextRunDate: nextRunDate || todayStr,
      debitAccountId: drHead.id,
      debitAccountCode: drHead.code,
      debitAccountName: drHead.name,
      creditAccountId: crHead.id,
      creditAccountCode: crHead.code,
      creditAccountName: crHead.name,
      amount: numAmt,
      narrationTemplate:
        narrationTemplate.trim() || `Recurring ${title} for {{MONTH}}`,
      refPrefix: refPrefix.trim() || 'REC-AUTO',
      permissionMode,
      isActive: true,
      totalGeneratedCount: 0,
      createdBy: currentUser?.name || 'Administrator',
      permittedBy: isSuperAdmin ? currentUser?.name : undefined,
    };

    const nextList = [newItem, ...schedules];
    setSchedules(nextList);
    saveStoredRecurringSchedules(nextList, logs);
    triggerToast(`Created Recurring Voucher Schedule: "${newItem.title}"`);
  };

  // Execute & Post Automated Journal/Voucher Entry ON PERMISSION
  const handlePermitAndGenerateVoucher = (sched: RecurringVoucherSchedule) => {
    if (
      sched.permissionMode === 'superadmin_permission_only' &&
      !isSuperAdmin &&
      currentUser?.role !== 'Approver'
    ) {
      triggerToast(
        'Super Admin or Approver permission is required to execute this recurring voucher.'
      );
      return;
    }

    const targetCampuses =
      sched.campusId === 'ALL_CAMPUSES'
        ? campuses
        : campuses.filter((c) => c.id === sched.campusId);

    const effectiveCampuses =
      targetCampuses.length > 0 ? targetCampuses : [campuses[0]];

    const monthLabel = new Date(sched.nextRunDate || todayStr).toLocaleDateString(
      'en-US',
      { month: 'long', year: 'numeric' }
    );

    const newLogs: RecurringExecutionLog[] = [];
    let lastVNo = '';

    effectiveCampuses.forEach((camp) => {
      if (!camp) return;
      const vNo = getNextVoucherNumber
        ? getNextVoucherNumber(sched.voucherType, camp.id)
        : `${sched.voucherType}-REC-${Date.now().toString().slice(-4)}`;
      lastVNo = vNo;

      const resolvedNarration = (sched.narrationTemplate || sched.title)
        .replace(/\{\{MONTH\}\}/gi, monthLabel)
        .replace(/\{\{CAMPUS\}\}/gi, camp.name);

      const refNo = `${sched.refPrefix}-${(sched.nextRunDate || todayStr).slice(0, 7)}`;

      const entries: VoucherEntry[] = [
        {
          id: `rec-dr-${Date.now()}-1`,
          accountId: sched.debitAccountId,
          accountCode: sched.debitAccountCode,
          accountName: sched.debitAccountName,
          description: `${resolvedNarration} (Dr)`,
          debit: sched.amount,
          credit: 0,
          refCheckNo: refNo,
        },
        {
          id: `rec-cr-${Date.now()}-2`,
          accountId: sched.creditAccountId,
          accountCode: sched.creditAccountCode,
          accountName: sched.creditAccountName,
          description: `${resolvedNarration} (Cr)`,
          debit: 0,
          credit: sched.amount,
          refCheckNo: refNo,
        },
      ];

      addTransaction({
        voucherNo: vNo,
        voucherType: sched.voucherType,
        campusId: camp.id,
        date: sched.nextRunDate || todayStr,
        accountingPeriod: activePeriod?.name || 'FY 2026-2027',
        narration: `[Recurring Auto-Journal] ${resolvedNarration}`,
        entries,
        totalDebit: sched.amount,
        totalCredit: sched.amount,
        status: isSuperAdmin ? 'Posted' : 'Pending',
        preparedBy: sched.createdBy || currentUser?.name || 'Recurring Engine',
        approvedBy: `${currentUser?.name || 'Super Admin'} (Permitted Recurring Entry)`,
      });

      newLogs.push({
        id: `reclog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        scheduleId: sched.id,
        scheduleTitle: sched.title,
        voucherNo: vNo,
        voucherType: sched.voucherType,
        campusName: camp.name,
        amount: sched.amount,
        executedAt: new Date().toISOString(),
        permittedBy: `${currentUser?.name || 'Super Admin'} (${currentUser?.role || 'Admin'})`,
        mode:
          sched.permissionMode === 'superadmin_permission_only'
            ? 'Super Admin Permission Granted'
            : 'Permitted & Auto-Generated',
      });
    });

    const nextDate = computeNextRecurringDate(
      sched.nextRunDate || todayStr,
      sched.frequency,
      sched.dayOfMonth
    );

    const updatedSchedules = schedules.map((s) =>
      s.id === sched.id
        ? {
            ...s,
            lastRunDate: todayStr,
            lastGeneratedVoucherNo: lastVNo,
            nextRunDate: nextDate,
            totalGeneratedCount: (s.totalGeneratedCount || 0) + effectiveCampuses.length,
            permittedBy: currentUser?.name || 'Super Admin',
          }
        : s
    );

    const updatedLogs = [...newLogs, ...logs].slice(0, 100);
    setSchedules(updatedSchedules);
    setLogs(updatedLogs);
    saveStoredRecurringSchedules(updatedSchedules, updatedLogs);

    triggerToast(
      `Permission Granted! Auto-Created ${sched.voucherType} Voucher #${lastVNo} (PKR ${sched.amount.toLocaleString()}) & advanced next schedule to ${nextDate}.`
    );
  };

  const handleDeleteSchedule = (id: string) => {
    const nextList = schedules.filter((s) => s.id !== id);
    setSchedules(nextList);
    saveStoredRecurringSchedules(nextList, logs);
  };

  const dueSchedules = useMemo(
    () =>
      schedules.filter(
        (s) => s.isActive && (s.nextRunDate || todayStr) <= todayStr
      ),
    [schedules, todayStr]
  );

  const handlePermitAllDue = () => {
    dueSchedules.forEach((s) => handlePermitAndGenerateVoucher(s));
  };

  const selectedDebitHead = accountHeads.find((a) => a.id === debitAccId);
  const selectedCreditHead = accountHeads.find((a) => a.id === creditAccId);

  return (
    <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden text-xs">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-300">
              <span>Recurring Monthly Expense & Automated Journal Engine</span>
              <span>·</span>
              <span className="text-emerald-300">Executes On Permission</span>
            </div>
            <h2 className="text-sm sm:text-base font-black text-white">
              Schedule Recurring Rent, Electricity, Utility & Contract Vouchers (JV / BPV / CPV)
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dueSchedules.length > 0 && (
            <button
              type="button"
              onClick={handlePermitAllDue}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                Grant Permission & Post All Due ({dueSchedules.length})
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showForm ? 'Hide Schedule Form' : '+ New Recurring Schedule'}</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-emerald-950 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Quick 1-Click Monthly Expense Template Presets */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-black text-slate-700 uppercase text-[11px] flex items-center gap-1 mr-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            1-Click Monthly Expense Templates:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('rent')}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-300 font-bold text-slate-800 cursor-pointer"
          >
            🏢 Building Rent (JV)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('electricity')}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-300 font-bold text-slate-800 cursor-pointer"
          >
            ⚡ Electricity / WAPDA Bill (BPV)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('gas_water')}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-300 font-bold text-slate-800 cursor-pointer"
          >
            🔥 Sui Gas & Water (CPV)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('internet')}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-300 font-bold text-slate-800 cursor-pointer"
          >
            🌐 Fiber Internet Bill (BPV)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('security')}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-300 font-bold text-slate-800 cursor-pointer"
          >
            🛡️ Security & Janitorial (BPV)
          </button>
        </div>
      </div>

      {/* Create Recurring Voucher Form */}
      {showForm && (
        <form
          onSubmit={handleCreateSchedule}
          className="p-5 border-b border-slate-200 bg-white space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Recurring Schedule Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-900"
                placeholder="e.g. Monthly Campus Building Rent"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Target Campus *
              </label>
              <select
                value={targetCampusId}
                onChange={(e) => setTargetCampusId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
              >
                <option value="ALL_CAMPUSES">All Campuses (Batch)</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Voucher Type *
              </label>
              <select
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 bg-white"
              >
                <option value="JV">JV — Automated Journal Entry</option>
                <option value="BPV">BPV — Bank Payment Voucher</option>
                <option value="CPV">CPV — Cash Payment Voucher</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Frequency & Day *
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Annual">Annual</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value) || 1)}
                  className="w-14 px-2 py-1.5 rounded-lg border border-slate-300 font-mono text-center font-bold"
                  title="Day of Month (1-28)"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Next Scheduled Date *
              </label>
              <input
                type="date"
                value={nextRunDate}
                onChange={(e) => setNextRunDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold"
              />
            </div>
          </div>

          {/* Double-Entry Account Selection (Single-Click Account Pick) + Amount & Permission Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            {/* Debit Expense Account (Single-Click Picker) */}
            <div className="lg:col-span-4 relative">
              <label className="block font-bold text-slate-700 mb-1">
                Debit Expense Account Head (1-Click Pick) *
              </label>
              <input
                type="text"
                value={
                  openAccPicker === 'debit'
                    ? debitSearch
                    : selectedDebitHead
                    ? `${selectedDebitHead.code} — ${selectedDebitHead.name}`
                    : ''
                }
                onFocus={() => {
                  setDebitSearch('');
                  setOpenAccPicker('debit');
                }}
                onClick={() => {
                  setDebitSearch('');
                  setOpenAccPicker('debit');
                }}
                onChange={(e) => {
                  setDebitSearch(e.target.value);
                  setOpenAccPicker('debit');
                }}
                placeholder="Single-click to pick Debit Expense Account..."
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-900 bg-white cursor-pointer"
              />
              {openAccPicker === 'debit' && (
                <div
                  className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto py-1 divide-y divide-slate-100"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {accountHeads
                    .filter((a) => {
                      const q = debitSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        a.code.toLowerCase().includes(q) ||
                        a.name.toLowerCase().includes(q) ||
                        a.category.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 160)
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDebitAccId(a.id);
                          setOpenAccPicker(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="truncate font-semibold text-slate-900">
                          <strong className="font-mono text-blue-700">{a.code}</strong> — {a.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">{a.category}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Credit Bank / Cash / Payable Account (Single-Click Picker) */}
            <div className="lg:col-span-4 relative">
              <label className="block font-bold text-slate-700 mb-1">
                Credit Bank / Cash / Payable Head (1-Click Pick) *
              </label>
              <input
                type="text"
                value={
                  openAccPicker === 'credit'
                    ? creditSearch
                    : selectedCreditHead
                    ? `${selectedCreditHead.code} — ${selectedCreditHead.name}`
                    : ''
                }
                onFocus={() => {
                  setCreditSearch('');
                  setOpenAccPicker('credit');
                }}
                onClick={() => {
                  setCreditSearch('');
                  setOpenAccPicker('credit');
                }}
                onChange={(e) => {
                  setCreditSearch(e.target.value);
                  setOpenAccPicker('credit');
                }}
                placeholder="Single-click to pick Credit Bank/Payable Account..."
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-900 bg-white cursor-pointer"
              />
              {openAccPicker === 'credit' && (
                <div
                  className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto py-1 divide-y divide-slate-100"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {accountHeads
                    .filter((a) => {
                      const q = creditSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        a.code.toLowerCase().includes(q) ||
                        a.name.toLowerCase().includes(q) ||
                        a.category.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 160)
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCreditAccId(a.id);
                          setOpenAccPicker(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="truncate font-semibold text-slate-900">
                          <strong className="font-mono text-emerald-700">{a.code}</strong> — {a.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">{a.category}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Monthly Amount (PKR) *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Execution Permission *
              </label>
              <select
                value={permissionMode}
                onChange={(e) =>
                  setPermissionMode(e.target.value as RecurringPermissionMode)
                }
                className="w-full px-2 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-950 font-bold"
              >
                <option value="on_permission_prompt">
                  Prompt for Permission Before Posting
                </option>
                <option value="superadmin_permission_only">
                  Super Admin Permission Only
                </option>
                <option value="preauthorized_auto">
                  Pre-Authorized (1-Click Auto Run)
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <input
              type="text"
              value={narrationTemplate}
              onChange={(e) => setNarrationTemplate(e.target.value)}
              placeholder="Journal narration template (use {{MONTH}} for automatic month name)..."
              className="flex-1 min-w-[260px] px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Save Recurring Voucher Schedule</span>
            </button>
          </div>
        </form>
      )}

      {/* Scheduled Recurring Vouchers Table */}
      <div className="p-5 space-y-4">
        {schedules.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
            No recurring monthly expense schedules configured yet. Click one of the{' '}
            <strong>1-Click Monthly Expense Templates</strong> above (Building Rent, Electricity, Gas/Water, Internet) or submit the form to schedule automated journal entries on permission.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2.5 border-r border-slate-200">Schedule Title & Type</th>
                  <th className="p-2.5 border-r border-slate-200">Campus</th>
                  <th className="p-2.5 border-r border-slate-200">Automated Double-Entry (Dr / Cr)</th>
                  <th className="p-2.5 border-r border-slate-200 text-right">Amount (PKR)</th>
                  <th className="p-2.5 border-r border-slate-200 text-center">Next Due Date</th>
                  <th className="p-2.5 border-r border-slate-200">Permission Control</th>
                  <th className="p-2.5 text-center">Execute On Permission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {schedules.map((s) => {
                  const isDue = s.isActive && (s.nextRunDate || todayStr) <= todayStr;
                  const campName =
                    s.campusId === 'ALL_CAMPUSES'
                      ? 'All Campuses'
                      : campuses.find((c) => c.id === s.campusId)?.name || s.campusId;

                  return (
                    <tr
                      key={s.id}
                      className={isDue ? 'bg-amber-50/70' : 'hover:bg-slate-50'}
                    >
                      <td className="p-2.5 border-r border-slate-200">
                        <div className="font-black text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[10px]">
                            {s.voucherType}
                          </span>
                          <span>{s.title}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {s.frequency} (Day {s.dayOfMonth}) · Runs: {s.totalGeneratedCount || 0}
                          {s.lastGeneratedVoucherNo
                            ? ` · Last: ${s.lastGeneratedVoucherNo}`
                            : ''}
                        </div>
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-800">
                        {campName}
                      </td>
                      <td className="p-2.5 border-r border-slate-200">
                        <div className="text-blue-900 font-semibold">
                          <strong>Dr:</strong> [{s.debitAccountCode}] {s.debitAccountName}
                        </div>
                        <div className="text-emerald-900 font-semibold mt-0.5">
                          <strong>Cr:</strong> [{s.creditAccountCode}] {s.creditAccountName}
                        </div>
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right font-mono font-black text-slate-900">
                        {s.amount.toLocaleString()}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-mono">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            isDue
                              ? 'bg-amber-200 text-amber-950'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {s.nextRunDate} {isDue ? '(DUE)' : ''}
                        </span>
                      </td>
                      <td className="p-2.5 border-r border-slate-200">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-[10px]">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" />
                          {s.permissionMode === 'superadmin_permission_only'
                            ? 'Super Admin Permission'
                            : s.permissionMode === 'preauthorized_auto'
                            ? 'Pre-Authorized'
                            : 'Generate On Permission'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePermitAndGenerateVoucher(s)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Grant permission and automatically create & post double-entry journal/payment voucher now"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Permit & Generate Voucher</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(s.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Delete recurring schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
