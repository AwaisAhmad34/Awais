import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  LayoutGrid,
  GraduationCap,
  Users,
  ShoppingCart,
  Package,
  PieChart as PieChartIcon,
  Plus,
  CheckCircle2,
  ArrowUpRight,
  Building2,
  FileCheck2,
  Banknote,
  AlertTriangle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { PettyCashCategoryAnalytics } from './PettyCashCategoryAnalytics';
import { BudgetVarianceWidget, INSTITUTIONAL_DEPARTMENTS } from './BudgetVarianceWidget';
import { saveErpStateToCloud, loadErpStateFromCloud } from '../services/firebaseSync';

export interface StudentFeeChallan {
  id: string;
  challanNo: string;
  studentName: string;
  rollNo: string;
  grade: string;
  campusId: string;
  billingMonth: string;
  tuitionFee: number;
  labAndMiscFee: number;
  transportFee: number;
  status: 'Pending' | 'Paid' | 'Overdue';
  paymentMode?: 'CRV' | 'BRV';
  postedVoucherNo?: string;
}

export interface StaffPayrollRecord {
  id: string;
  empCode: string;
  name: string;
  designation: string;
  department: 'Teaching Faculty' | 'Administration' | 'Support Staff';
  campusId: string;
  salaryMonth: string;
  basicPay: number;
  allowances: number;
  deductions: number;
  status: 'Pending' | 'Disbursed';
  paymentMode?: 'BPV' | 'CPV';
  postedVoucherNo?: string;
}

export interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  vendorName: string;
  itemSummary: string;
  accountCode: string;
  accountName: string;
  campusId: string;
  orderDate: string;
  totalAmount: number;
  status: 'Ordered' | 'GRN Verified' | 'Paid & Posted';
  postedVoucherNo?: string;
}

export interface InventoryItemRecord {
  id: string;
  sku: string;
  itemName: string;
  category: 'Stationery & Exam' | 'Science & Computer Lab' | 'Furniture & Fixtures' | 'Janitorial & Maintenance';
  campusId: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  unitCost: number;
  lastUpdated: string;
}

interface ErpStateData {
  challans: StudentFeeChallan[];
  payroll: StaffPayrollRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  inventory: InventoryItemRecord[];
}

const ERP_STORAGE_KEY = 'aplus_modern_erp_suite_zero_scratch_v1';

const DEFAULT_ERP_STATE: ErpStateData = {
  challans: [],
  payroll: [],
  purchaseOrders: [],
  inventory: [],
};

function formatPKR(val: number): string {
  return `Rs. ${Math.round(val || 0).toLocaleString('en-PK')}`;
}

export const ModernErpSuite: React.FC<{
  activeTab: string;
  onNavigate: (tab: string) => void;
}> = ({ activeTab, onNavigate }) => {
  const {
    campuses,
    currentCampusId,
    setCurrentCampusId,
    transactions,
    pettyCashTransactions,
    accountHeads,
    addTransaction,
    addPettyCashTransaction,
    getNextVoucherNumber,
    getNextPettyCashNumber,
    currentUser,
    logActivity,
  } = useAccounting();

  const [erpState, setErpState] = useState<ErpStateData>(() => {
    try {
      const saved = localStorage.getItem(ERP_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.challans)) return parsed;
      }
    } catch {}
    return DEFAULT_ERP_STATE;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Student Challan Form
  const [showChallanForm, setShowChallanForm] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newRollNo, setNewRollNo] = useState('');
  const [newGrade, setNewGrade] = useState('Grade 10 - Science');
  const [newTuition, setNewTuition] = useState('8500');
  const [newLabFee, setNewLabFee] = useState('1500');
  const [newTransportFee, setNewTransportFee] = useState('0');

  // New Payroll Record Form
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newDesignation, setNewDesignation] = useState('Senior Subject Teacher');
  const [newBasicPay, setNewBasicPay] = useState('55000');
  const [newAllowances, setNewAllowances] = useState('5000');
  const [newDeductions, setNewDeductions] = useState('1500');

  // New Purchase Order Form
  const [showPoForm, setShowPoForm] = useState(false);
  const [newVendor, setNewVendor] = useState('');
  const [newItemSummary, setNewItemSummary] = useState('');
  const [newPoAccountCode, setNewPoAccountCode] = useState('5014');
  const [newPoAmount, setNewPoAmount] = useState('');

  // Load ERP state from Firestore on mount
  useEffect(() => {
    let mounted = true;
    loadErpStateFromCloud().then((cloudData) => {
      if (mounted && cloudData && Array.isArray(cloudData.challans)) {
        setErpState(cloudData);
        try {
          localStorage.setItem(ERP_STORAGE_KEY, JSON.stringify(cloudData));
        } catch {}
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persistErpState = (next: ErpStateData) => {
    setErpState(next);
    try {
      localStorage.setItem(ERP_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    saveErpStateToCloud(next);
  };

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const targetCampusId =
    currentCampusId === 'all' ? campuses[0]?.id || 'campus-khiali' : currentCampusId;

  // Scoped ERP datasets
  const scopedChallans = useMemo(
    () =>
      erpState.challans.filter(
        (c) =>
          (currentCampusId === 'all' || c.campusId === currentCampusId) &&
          (!searchQuery ||
            c.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.challanNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [erpState.challans, currentCampusId, searchQuery]
  );

  const scopedPayroll = useMemo(
    () =>
      erpState.payroll.filter(
        (p) =>
          (currentCampusId === 'all' || p.campusId === currentCampusId) &&
          (!searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.designation.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [erpState.payroll, currentCampusId, searchQuery]
  );

  const scopedPOs = useMemo(
    () =>
      erpState.purchaseOrders.filter(
        (po) =>
          (currentCampusId === 'all' || po.campusId === currentCampusId) &&
          (!searchQuery ||
            po.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            po.itemSummary.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [erpState.purchaseOrders, currentCampusId, searchQuery]
  );

  const scopedInventory = useMemo(
    () =>
      erpState.inventory.filter(
        (inv) =>
          (currentCampusId === 'all' || inv.campusId === currentCampusId) &&
          (!searchQuery ||
            inv.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.sku.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [erpState.inventory, currentCampusId, searchQuery]
  );

  // Compute Executive Monthly Revenue vs Expense Recharts Data from Live Ledger
  const monthlyLedgerFlowData = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; expenses: number; pettyCash: number }> = {};

    (transactions || []).forEach((tx) => {
      if (tx.status === 'Rejected' || tx.status === 'Cancelled') return;
      if (currentCampusId !== 'all' && tx.campusId !== currentCampusId) return;
      const ym = (tx.date || '').slice(0, 7) || '2026-09';
      if (!map[ym]) {
        map[ym] = { month: ym, revenue: 0, expenses: 0, pettyCash: 0 };
      }
      (tx.entries || []).forEach((ent) => {
        const head = accountHeads.find(
          (a) => a.id === ent.accountId || a.code === ent.accountCode || a.accountId === ent.accountCode
        );
        const cat = head?.category || (String(ent.accountCode).startsWith('4') ? 'Revenue' : String(ent.accountCode).startsWith('5') ? 'Expense' : '');
        if (cat === 'Revenue') {
          map[ym].revenue += Math.max(0, (Number(ent.credit) || 0) - (Number(ent.debit) || 0));
        } else if (cat === 'Expense') {
          map[ym].expenses += Math.max(0, (Number(ent.debit) || 0) - (Number(ent.credit) || 0));
        }
      });
    });

    (pettyCashTransactions || []).forEach((pc) => {
      if (pc.type !== 'Disbursement') return;
      if (currentCampusId !== 'all' && pc.campusId !== currentCampusId) return;
      const ym = (pc.date || '').slice(0, 7) || '2026-09';
      if (!map[ym]) {
        map[ym] = { month: ym, revenue: 0, expenses: 0, pettyCash: 0 };
      }
      map[ym].pettyCash += Number(pc.amount) || 0;
    });

    const sortedMonths = Object.keys(map).sort();
    return sortedMonths.map((ym) => {
      const [y, m] = ym.split('-').map(Number);
      const label = y && m ? new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ym;
      return {
        monthLabel: label,
        Revenue: Math.round(map[ym].revenue),
        Expenses: Math.round(map[ym].expenses + map[ym].pettyCash),
        PettyCash: Math.round(map[ym].pettyCash),
        NetSurplus: Math.round(map[ym].revenue - (map[ym].expenses + map[ym].pettyCash)),
      };
    });
  }, [transactions, pettyCashTransactions, accountHeads, currentCampusId]);

  // 1-Click Auto-Post Student Fee Challan to General Ledger (CRV or BRV)
  const handleCollectFeeChallan = (challan: StudentFeeChallan, mode: 'CRV' | 'BRV') => {
    const totalFee = challan.tuitionFee + challan.labAndMiscFee + challan.transportFee;
    const voucherNo = getNextVoucherNumber(mode, challan.campusId);
    const debitAccount =
      mode === 'CRV'
        ? accountHeads.find((a) => a.accountId === '1018' || a.name.toLowerCase().includes('cash in hand')) || accountHeads[0]
        : accountHeads.find((a) => a.accountId === '1020' || a.type === 'Bank') || accountHeads[0];
    const tuitionHead =
      accountHeads.find((a) => a.accountId === '4001' || a.name.toLowerCase().includes('tuition')) || {
        id: 'acc-4001',
        code: '400-1-01',
        name: 'Tuition Fee Income',
      };

    addTransaction({
      voucherNo,
      voucherType: mode,
      campusId: challan.campusId,
      date: new Date().toISOString().slice(0, 10),
      narration: `Student Fee Challan ${challan.challanNo} collected from ${challan.studentName} (${challan.rollNo} - ${challan.grade})`,
      entries: [
        {
          id: `ent-dr-${Date.now()}`,
          accountId: debitAccount?.id || 'acc-1018',
          accountCode: debitAccount?.code || '100-4-01',
          accountName: debitAccount?.name || (mode === 'CRV' ? 'Cash in Hand' : 'Main Bank Account'),
          description: `Fee received against ${challan.challanNo}`,
          debit: totalFee,
          credit: 0,
        },
        {
          id: `ent-cr-${Date.now()}`,
          accountId: tuitionHead.id,
          accountCode: tuitionHead.code,
          accountName: tuitionHead.name,
          description: `Tuition & Lab Fee (${challan.billingMonth}) - ${challan.studentName}`,
          debit: 0,
          credit: totalFee,
        },
      ],
      totalDebit: totalFee,
      totalCredit: totalFee,
      status: 'Posted',
      preparedBy: currentUser?.name || 'Campus Accountant',
      approvedBy: 'Principal / Finance Controller',
    });

    logActivity(
      'CREATE_VOUCHER',
      'Voucher',
      voucherNo,
      `ERP Auto-Posted ${mode} ${voucherNo} (${formatPKR(totalFee)}) for Student Fee Challan ${challan.challanNo} (${challan.studentName})`,
      challan.campusId,
      totalFee
    );

    const updated: ErpStateData = {
      ...erpState,
      challans: erpState.challans.map((c) =>
        c.id === challan.id
          ? { ...c, status: 'Paid', paymentMode: mode, postedVoucherNo: voucherNo }
          : c
      ),
    };
    persistErpState(updated);
    showNotice(`Collected ${formatPKR(totalFee)} for ${challan.studentName} & auto-posted ${voucherNo} to General Ledger!`);
  };

  // 1-Click Auto-Post Staff Salary to General Ledger (BPV or CPV)
  const handleDisburseSalary = (staff: StaffPayrollRecord, mode: 'BPV' | 'CPV') => {
    const netSalary = staff.basicPay + staff.allowances - staff.deductions;
    const voucherNo = getNextVoucherNumber(mode, staff.campusId);
    const creditAccount =
      mode === 'CPV'
        ? accountHeads.find((a) => a.accountId === '1018' || a.name.toLowerCase().includes('cash in hand')) || accountHeads[0]
        : accountHeads.find((a) => a.accountId === '1020' || a.type === 'Bank') || accountHeads[0];
    const salaryHead =
      accountHeads.find((a) => a.accountId === '5001' || a.name.toLowerCase().includes('salaries')) || {
        id: 'acc-5001',
        code: '500-1-01',
        name: 'Teaching Staff Salaries',
      };

    addTransaction({
      voucherNo,
      voucherType: mode,
      campusId: staff.campusId,
      date: new Date().toISOString().slice(0, 10),
      narration: `Monthly Salary Disbursement (${staff.salaryMonth}) to ${staff.name} (${staff.empCode} - ${staff.designation})`,
      entries: [
        {
          id: `ent-dr-${Date.now()}`,
          accountId: salaryHead.id,
          accountCode: salaryHead.code,
          accountName: salaryHead.name,
          description: `Salary & Allowances (${staff.salaryMonth}) - ${staff.name}`,
          debit: netSalary,
          credit: 0,
        },
        {
          id: `ent-cr-${Date.now()}`,
          accountId: creditAccount?.id || 'acc-1020',
          accountCode: creditAccount?.code || '100-4-03',
          accountName: creditAccount?.name || (mode === 'BPV' ? 'Main Bank Account' : 'Cash in Hand'),
          description: `Net salary transfer to ${staff.name}`,
          debit: 0,
          credit: netSalary,
        },
      ],
      totalDebit: netSalary,
      totalCredit: netSalary,
      status: 'Posted',
      preparedBy: currentUser?.name || 'HR & Payroll Officer',
      approvedBy: 'Principal / Finance Controller',
    });

    logActivity(
      'CREATE_VOUCHER',
      'Voucher',
      voucherNo,
      `ERP Payroll Auto-Posted ${mode} ${voucherNo} (${formatPKR(netSalary)}) for ${staff.name} (${staff.empCode})`,
      staff.campusId,
      netSalary
    );

    const updated: ErpStateData = {
      ...erpState,
      payroll: erpState.payroll.map((p) =>
        p.id === staff.id
          ? { ...p, status: 'Disbursed', paymentMode: mode, postedVoucherNo: voucherNo }
          : p
      ),
    };
    persistErpState(updated);
    showNotice(`Disbursed ${formatPKR(netSalary)} to ${staff.name} & auto-posted ${voucherNo} to General Ledger!`);
  };

  // 1-Click Auto-Post Vendor Purchase Order Bill to General Ledger (BPV)
  const handlePostPurchaseOrder = (po: PurchaseOrderRecord) => {
    const voucherNo = getNextVoucherNumber('BPV', po.campusId);
    const bankAccount =
      accountHeads.find((a) => a.accountId === '1020' || a.type === 'Bank') || accountHeads[0];
    const expenseHead =
      accountHeads.find((a) => a.accountId === po.accountCode || a.code === po.accountCode) || {
        id: `acc-${po.accountCode}`,
        code: po.accountCode,
        name: po.accountName,
      };

    addTransaction({
      voucherNo,
      voucherType: 'BPV',
      campusId: po.campusId,
      date: new Date().toISOString().slice(0, 10),
      narration: `Vendor Bill Settlement against ${po.poNumber} (${po.vendorName}) - ${po.itemSummary}`,
      entries: [
        {
          id: `ent-dr-${Date.now()}`,
          accountId: expenseHead.id,
          accountCode: expenseHead.code,
          accountName: expenseHead.name,
          description: `${po.poNumber}: ${po.itemSummary}`,
          debit: po.totalAmount,
          credit: 0,
        },
        {
          id: `ent-cr-${Date.now()}`,
          accountId: bankAccount?.id || 'acc-1020',
          accountCode: bankAccount?.code || '100-4-03',
          accountName: bankAccount?.name || 'Main Bank Account',
          description: `Payment to vendor ${po.vendorName}`,
          debit: 0,
          credit: po.totalAmount,
        },
      ],
      totalDebit: po.totalAmount,
      totalCredit: po.totalAmount,
      status: 'Posted',
      preparedBy: currentUser?.name || 'Procurement Officer',
      approvedBy: 'Principal / Finance Controller',
    });

    logActivity(
      'CREATE_VOUCHER',
      'Voucher',
      voucherNo,
      `ERP Procurement Auto-Posted BPV ${voucherNo} (${formatPKR(po.totalAmount)}) for ${po.poNumber} (${po.vendorName})`,
      po.campusId,
      po.totalAmount
    );

    const updated: ErpStateData = {
      ...erpState,
      purchaseOrders: erpState.purchaseOrders.map((item) =>
        item.id === po.id
          ? { ...item, status: 'Paid & Posted', postedVoucherNo: voucherNo }
          : item
      ),
    };
    persistErpState(updated);
    showNotice(`Settled ${po.poNumber} (${formatPKR(po.totalAmount)}) & auto-posted ${voucherNo} to General Ledger!`);
  };

  // Issue or Restock Inventory Item (with optional Petty Cash slip on restock)
  const handleInventoryAdjust = (item: InventoryItemRecord, delta: number, viaPettyCash = false) => {
    const nextQty = Math.max(0, item.quantity + delta);
    const updated: ErpStateData = {
      ...erpState,
      inventory: erpState.inventory.map((inv) =>
        inv.id === item.id
          ? { ...inv, quantity: nextQty, lastUpdated: new Date().toISOString().slice(0, 10) }
          : inv
      ),
    };
    persistErpState(updated);

    if (viaPettyCash && delta > 0) {
      const cost = delta * item.unitCost;
      const pcNo = getNextPettyCashNumber(item.campusId);
      addPettyCashTransaction({
        voucherNo: pcNo,
        trNo: String((pettyCashTransactions?.length || 0) + 1),
        campusId: item.campusId,
        date: new Date().toISOString().slice(0, 10),
        type: 'Disbursement',
        payee: 'Campus Store Urgent Restock',
        category:
          item.category === 'Stationery & Exam'
            ? 'Stationery & Printing'
            : item.category === 'Science & Computer Lab'
            ? 'Lab & Teaching Aids'
            : 'Cleaning & Sanitation',
        accountCode: '5014',
        amount: cost,
        narration: `Restocked +${delta} ${item.unit} of ${item.itemName} (${item.sku})`,
        receiptNo: `INV-${item.sku}`,
        approvedBy: 'Campus Accountant',
      });
      showNotice(`Restocked +${delta} ${item.unit} of ${item.itemName} & logged ${formatPKR(cost)} Petty Cash slip (${pcNo})!`);
    } else {
      showNotice(
        delta > 0
          ? `Added +${delta} ${item.unit} to ${item.itemName}`
          : `Issued ${Math.abs(delta)} ${item.unit} of ${item.itemName} to department`
      );
    }
  };

  const handleCreateChallan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const item: StudentFeeChallan = {
      id: `ch-${Date.now()}`,
      challanNo: `CHL-2026-${900 + erpState.challans.length + 1}`,
      studentName: newStudentName.trim(),
      rollNo: newRollNo.trim() || `APS-${100 + erpState.challans.length + 1}`,
      grade: newGrade,
      campusId: targetCampusId,
      billingMonth: new Date().toISOString().slice(0, 7),
      tuitionFee: Number(newTuition) || 0,
      labAndMiscFee: Number(newLabFee) || 0,
      transportFee: Number(newTransportFee) || 0,
      status: 'Pending',
    };
    persistErpState({ ...erpState, challans: [item, ...erpState.challans] });
    setNewStudentName('');
    setNewRollNo('');
    setShowChallanForm(false);
    showNotice(`Generated Fee Challan ${item.challanNo} for ${item.studentName}`);
  };

  const handleCreatePayroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    const item: StaffPayrollRecord = {
      id: `pay-${Date.now()}`,
      empCode: `EMP-${100 + erpState.payroll.length + 1}`,
      name: newEmpName.trim(),
      designation: newDesignation,
      department: 'Teaching Faculty',
      campusId: targetCampusId,
      salaryMonth: new Date().toISOString().slice(0, 7),
      basicPay: Number(newBasicPay) || 0,
      allowances: Number(newAllowances) || 0,
      deductions: Number(newDeductions) || 0,
      status: 'Pending',
    };
    persistErpState({ ...erpState, payroll: [item, ...erpState.payroll] });
    setNewEmpName('');
    setShowPayrollForm(false);
    showNotice(`Added ${item.name} (${item.empCode}) to Monthly Payroll Register`);
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.trim() || !newPoAmount) return;
    const head = accountHeads.find((a) => a.accountId === newPoAccountCode || a.code === newPoAccountCode);
    const item: PurchaseOrderRecord = {
      id: `po-${Date.now()}`,
      poNumber: `PO-2026-${400 + erpState.purchaseOrders.length + 1}`,
      vendorName: newVendor.trim(),
      itemSummary: newItemSummary.trim() || 'Campus Operational Supplies',
      accountCode: newPoAccountCode,
      accountName: head?.name || 'Printing & Stationery',
      campusId: targetCampusId,
      orderDate: new Date().toISOString().slice(0, 10),
      totalAmount: Number(newPoAmount) || 0,
      status: 'GRN Verified',
    };
    persistErpState({ ...erpState, purchaseOrders: [item, ...erpState.purchaseOrders] });
    setNewVendor('');
    setNewItemSummary('');
    setNewPoAmount('');
    setShowPoForm(false);
    showNotice(`Created Purchase Order ${item.poNumber} (${formatPKR(item.totalAmount)})`);
  };

  const erpTabs = [
    { id: 'erp_overview', label: '360° ERP Command', icon: LayoutGrid },
    { id: 'erp_fees', label: 'Student Fee ERP', icon: GraduationCap },
    { id: 'erp_payroll', label: 'HR & Payroll ERP', icon: Users },
    { id: 'erp_procurement', label: 'Procurement & POs', icon: ShoppingCart },
    { id: 'erp_inventory', label: 'Inventory & Store', icon: Package },
    { id: 'erp_budgeting', label: 'Budget & Variance', icon: PieChartIcon },
  ];

  // KPI aggregations
  const feePaidTotal = scopedChallans
    .filter((c) => c.status === 'Paid')
    .reduce((s, c) => s + c.tuitionFee + c.labAndMiscFee + c.transportFee, 0);
  const feePendingTotal = scopedChallans
    .filter((c) => c.status !== 'Paid')
    .reduce((s, c) => s + c.tuitionFee + c.labAndMiscFee + c.transportFee, 0);

  const payrollTotal = scopedPayroll.reduce(
    (s, p) => s + (p.basicPay + p.allowances - p.deductions),
    0
  );
  const inventoryValuation = scopedInventory.reduce(
    (s, i) => s + i.quantity * i.unitCost,
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
      {/* Modernized ERP Unified Navigation Header */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              <span>A+ School System</span>
              <span aria-hidden="true">·</span>
              <span>Modernized 360° Institutional ERP & General Ledger Suite</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
              {erpTabs.find((t) => t.id === activeTab)?.label || '360° ERP Command Center'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
              <Building2 className="w-4 h-4 text-blue-400" />
              <select
                value={currentCampusId}
                onChange={(e) => setCurrentCampusId(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                aria-label="Select ERP Campus Branch"
              >
                <option value="all" className="text-slate-900">
                  All Campuses (Consolidated ERP)
                </option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students, staff, POs..."
                className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 w-48 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Interactive ERP Module Switcher Bar */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {erpTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onNavigate(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('transaction')}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Voucher Entry</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pettycash')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Petty Cash</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Notification Banner */}
      {toastMessage && (
        <div className="bg-emerald-900 text-white px-5 py-3 rounded-xl border border-emerald-700 flex items-center justify-between text-xs font-bold shadow-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Student Fee Collection
          </div>
          <div className="mt-1.5 text-xl font-black text-emerald-700 font-mono">
            {formatPKR(feePaidTotal)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Receivable Dues: <span className="font-mono font-bold text-amber-700">{formatPKR(feePendingTotal)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Monthly Payroll Obligation
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {formatPKR(payrollTotal)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {scopedPayroll.filter((p) => p.status === 'Disbursed').length} / {scopedPayroll.length} staff disbursed
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Active Procurement Pipeline
          </div>
          <div className="mt-1.5 text-xl font-black text-blue-700 font-mono">
            {formatPKR(scopedPOs.reduce((s, p) => s + p.totalAmount, 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {scopedPOs.length} purchase orders · {scopedPOs.filter((p) => p.status === 'Paid & Posted').length} posted to GL
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Campus Store Stock Valuation
          </div>
          <div className="mt-1.5 text-xl font-black text-indigo-700 font-mono">
            {formatPKR(inventoryValuation)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {scopedInventory.filter((i) => i.quantity <= i.reorderLevel).length} low-stock alerts active
          </div>
        </div>
      </div>

      {/* TAB 1: ERP COMMAND CENTER OVERVIEW */}
      {activeTab === 'erp_overview' && (
        <div className="space-y-6">
          {/* Recharts Monthly Revenue vs Expenditure Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Real-Time General Ledger Telemetry
                </div>
                <h2 className="text-base font-black text-slate-900">
                  Monthly Institutional Revenue vs Expenditure & Net Surplus (Recharts)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open Audited Trial Balance</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyLedgerFlowData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  />
                  <YAxis
                    tickFormatter={(v) =>
                      Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [formatPKR(Number(value)), name]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="Revenue"
                    name="400-Series Revenue (PKR)"
                    stroke="#059669"
                    fill="#10b981"
                    fillOpacity={0.2}
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Expenses"
                    name="500-Series Expenses + Petty Cash (PKR)"
                    stroke="#dc2626"
                    fill="#ef4444"
                    fillOpacity={0.16}
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Embedded Monthly Petty Cash Expenses by Category Recharts Component */}
          <div className="-mx-4 sm:-mx-6">
            <PettyCashCategoryAnalytics onNavigate={onNavigate} compact />
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT FEE & CHALLAN ERP */}
      {activeTab === 'erp_fees' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Student Fee Challan Register & 1-Click CRV/BRV General Ledger Posting
              </h2>
              <p className="text-xs text-slate-500">
                Collecting a fee challan automatically generates and posts a balanced Cash Receipt (CRV) or Bank Receipt (BRV) voucher to Account 4001
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowChallanForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Issue Student Challan</span>
            </button>
          </div>

          {showChallanForm && (
            <form
              onSubmit={handleCreateChallan}
              className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Student Name</label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Ali Hassan"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Roll No</label>
                <input
                  type="text"
                  value={newRollNo}
                  onChange={(e) => setNewRollNo(e.target.value)}
                  placeholder="APS-KHL-405"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Class / Section</label>
                <input
                  type="text"
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tuition Fee (4001)</label>
                <input
                  type="number"
                  value={newTuition}
                  onChange={(e) => setNewTuition(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Lab & Misc (4004)</label>
                <input
                  type="number"
                  value={newLabFee}
                  onChange={(e) => setNewLabFee(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                >
                  Save Challan
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Challan #</th>
                  <th className="py-3 px-4">Student & Roll No</th>
                  <th className="py-3 px-4">Class / Campus</th>
                  <th className="py-3 px-4 text-right">Tuition + Lab + Trans</th>
                  <th className="py-3 px-4">Status & GL Ref</th>
                  <th className="py-3 px-4 text-right">Auto-Post to Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scopedChallans.map((c) => {
                  const total = c.tuitionFee + c.labAndMiscFee + c.transportFee;
                  const campusName = campuses.find((cp) => cp.id === c.campusId)?.name || c.campusId;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.challanNo}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{c.studentName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{c.rollNo}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{c.grade}</div>
                        <div className="text-[11px] text-slate-500">{campusName}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {formatPKR(total)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold ${
                            c.status === 'Paid'
                              ? 'text-emerald-700'
                              : c.status === 'Overdue'
                              ? 'text-rose-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {c.status}
                        </span>
                        {c.postedVoucherNo && (
                          <span className="block text-[11px] font-mono text-slate-500">
                            GL Voucher: {c.postedVoucherNo}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.status === 'Paid' ? (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Posted ({c.paymentMode})
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCollectFeeChallan(c, 'CRV')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Collect Cash (CRV)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCollectFeeChallan(c, 'BRV')}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Bank Deposit (BRV)
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HR & STAFF PAYROLL ERP */}
      {activeTab === 'erp_payroll' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Faculty & Staff Payroll Register (Auto-Posts BPV / CPV to Account 500-1)
              </h2>
              <p className="text-xs text-slate-500">
                Disbursing staff salary automatically records a balanced Bank Payment (BPV) or Cash Payment (CPV) voucher under 500-1 Salaries & Benefits
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPayrollForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Faculty / Staff</span>
            </button>
          </div>

          {showPayrollForm && (
            <form
              onSubmit={handleCreatePayroll}
              className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="e.g. Prof. Salman"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation</label>
                <input
                  type="text"
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Basic Pay (PKR)</label>
                <input
                  type="number"
                  value={newBasicPay}
                  onChange={(e) => setNewBasicPay(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Allowances</label>
                <input
                  type="number"
                  value={newAllowances}
                  onChange={(e) => setNewAllowances(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Deductions / Tax</label>
                <input
                  type="number"
                  value={newDeductions}
                  onChange={(e) => setNewDeductions(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                >
                  Add to Payroll
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Emp Code</th>
                  <th className="py-3 px-4">Employee & Designation</th>
                  <th className="py-3 px-4 text-right">Basic + Allowances</th>
                  <th className="py-3 px-4 text-right">Deductions</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4">Status & GL Voucher</th>
                  <th className="py-3 px-4 text-right">Disburse & Post</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scopedPayroll.map((p) => {
                  const net = p.basicPay + p.allowances - p.deductions;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.empCode}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.designation} · {p.department}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatPKR(p.basicPay + p.allowances)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600">
                        -{formatPKR(p.deductions)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {formatPKR(net)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold ${
                            p.status === 'Disbursed' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {p.status}
                        </span>
                        {p.postedVoucherNo && (
                          <span className="block text-[11px] font-mono text-slate-500">
                            GL: {p.postedVoucherNo}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.status === 'Disbursed' ? (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Posted ({p.paymentMode})
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDisburseSalary(p, 'BPV')}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Bank Transfer (BPV)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDisburseSalary(p, 'CPV')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Cash Salary (CPV)
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PROCUREMENT & PURCHASE ORDERS ERP */}
      {activeTab === 'erp_procurement' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Vendor Purchase Orders, GRN Verification & Automated BPV Bill Settlement
              </h2>
              <p className="text-xs text-slate-500">
                Approve vendor Purchase Orders and settle bills directly into the 157-Account General Ledger
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPoForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          </div>

          {showPoForm && (
            <form
              onSubmit={handleCreatePO}
              className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Vendor Name</label>
                <input
                  type="text"
                  required
                  value={newVendor}
                  onChange={(e) => setNewVendor(e.target.value)}
                  placeholder="e.g. Oxford University Press"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Items Description</label>
                <input
                  type="text"
                  required
                  value={newItemSummary}
                  onChange={(e) => setNewItemSummary(e.target.value)}
                  placeholder="Science kits & lab glassware"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">COA Account Head</label>
                <select
                  value={newPoAccountCode}
                  onChange={(e) => setNewPoAccountCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="5014">5014 - Printing & Stationery</option>
                  <option value="5049">5049 - Science & Computer Lab Consumables</option>
                  <option value="1002">1002 - Library Books (Fixed Asset)</option>
                  <option value="1003">1003 - Furniture & Fixtures (Fixed Asset)</option>
                  <option value="1005">1005 - Computers & IT Equipment</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Total Bill (PKR)</label>
                <input
                  type="number"
                  required
                  value={newPoAmount}
                  onChange={(e) => setNewPoAmount(e.target.value)}
                  placeholder="35000"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                >
                  Issue PO
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Vendor & Order Summary</th>
                  <th className="py-3 px-4">Target COA Account</th>
                  <th className="py-3 px-4 text-right">Amount (PKR)</th>
                  <th className="py-3 px-4">Status & GL Ref</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scopedPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {po.poNumber}
                      <span className="block text-[10px] text-slate-500">{po.orderDate}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{po.vendorName}</div>
                      <div className="text-[11px] text-slate-600">{po.itemSummary}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {po.accountCode} · {po.accountName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                      {formatPKR(po.totalAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold ${
                          po.status === 'Paid & Posted' ? 'text-emerald-700' : 'text-blue-700'
                        }`}
                      >
                        {po.status}
                      </span>
                      {po.postedVoucherNo && (
                        <span className="block text-[11px] font-mono text-slate-500">
                          GL: {po.postedVoucherNo}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {po.status === 'Paid & Posted' ? (
                        <span className="text-[11px] font-semibold text-emerald-700">
                          Settled via BPV
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePostPurchaseOrder(po)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Approve & Post BPV
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: CAMPUS INVENTORY & STORE REGISTER ERP */}
      {activeTab === 'erp_inventory' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Campus Store & Inventory Register (Department Issuance & Petty Cash Restock)
              </h2>
              <p className="text-xs text-slate-500">
                Track real-time stock quantities, reorder thresholds, and restock items directly through Petty Cash
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Item Description & Category</th>
                  <th className="py-3 px-4 text-right">In Stock</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Total Value</th>
                  <th className="py-3 px-4">Stock Health</th>
                  <th className="py-3 px-4 text-right">Store Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scopedInventory.map((inv) => {
                  const isLow = inv.quantity <= inv.reorderLevel;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.sku}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{inv.itemName}</div>
                        <div className="text-[11px] text-slate-500">
                          {inv.category} · Updated {inv.lastUpdated}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {inv.quantity} {inv.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatPKR(inv.unitCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatPKR(inv.quantity * inv.unitCost)}
                      </td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Low Stock (Reorder ≤ {inv.reorderLevel})</span>
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700">Optimal Stock</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInventoryAdjust(inv, -1, false)}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] cursor-pointer"
                          >
                            Issue (-1)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInventoryAdjust(inv, 5, true)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Restock +5 (Petty Cash)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: DYNAMIC BUDGETING & VARIANCE CONTROL ERP */}
      {activeTab === 'erp_budgeting' && (
        <div className="-mx-4 sm:-mx-6">
          <BudgetVarianceWidget onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
};
