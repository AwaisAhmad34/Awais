import React from 'react';

export interface Campus {
  id: string;
  code: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  accountantName?: string;
  pettyCashFloat: number;
  currentPettyCash: number;
  loginEnabled?: boolean;
  status: 'active' | 'inactive';
  allowedModules?: string[];
}

export interface VoucherEntry {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  refCheckNo?: string;
}

export interface Transaction {
  id: string;
  voucherNo: string;
  voucherType: 'BPV' | 'BRV' | 'CPV' | 'CRV' | 'JV';
  campusId: string;
  date: string;
  accountingPeriod?: string;
  narration: string;
  chequeNo?: string;
  entries: VoucherEntry[];
  totalDebit: number;
  totalCredit: number;
  status: 'Pending' | 'Approved' | 'Posted' | 'Rejected' | 'Draft' | 'Submitted' | 'Paid' | 'Cancelled';
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  verifiedBy?: string;
  rejectionReason?: string;
}

export interface PettyCashTransaction {
  id: string;
  voucherNo: string;
  trNo?: string | number;
  campusId: string;
  date: string;
  type: 'Disbursement' | 'Replenishment' | 'Opening';
  payee: string;
  category?: string;
  accountId?: string;
  accountCode?: string;
  amount: number;
  narration: string;
  receiptNo?: string;
  approvedBy?: string;
  balanceAfter: number;
}

export interface AccountHead {
  id: string;
  srNo?: number;
  accountId?: string;
  code: string;
  ledgerCode?: string;
  name: string;
  category: 'Asset' | 'Equity' | 'Liability' | 'Revenue' | 'Expense';
  type: string;
  balance: number;
  mainCode: string;
  mainAccount: string;
  groupCode: string;
  groupName: string;
  accountType?: string;
  description?: string;
}

export interface OrgSettings {
  schoolName: string;
  subTitle: string;
  tagline: string;
  headerLeftText?: string;
  headerRightText?: string;
  headerTopBarText?: string;
  loginTitle?: string;
  loginSubtitle?: string;
  loginDescription?: string;
  loginFooterLeft?: string;
  loginFooterRight?: string;
  footerLeftText?: string;
  footerRightText?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  taxId?: string;
  currency?: string;
  [key: string]: any;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  epochMs?: number;
  userId: string;
  username?: string;
  userEmail?: string;
  userName: string;
  userRole: string;
  campusId: string;
  campusName: string;
  action:
    | 'CREATE_VOUCHER'
    | 'UPDATE_VOUCHER'
    | 'DELETE_VOUCHER'
    | 'STATUS_CHANGE'
    | 'PETTY_CASH_EXPENSE'
    | 'PETTY_CASH_REPLENISH'
    | 'PERIOD_ACTION'
    | 'CAMPUS_UPDATE'
    | 'BACKUP_EXPORT'
    | 'BACKUP_RESTORE'
    | string;
  entityType: 'Voucher' | 'PettyCash' | 'Period' | 'Campus' | 'System' | string;
  entityId: string;
  details: string;
  amount?: number;
  integrityHash?: string;
  metadata?: {
    voucherId?: string;
    voucherNo?: string;
    voucherType?: string;
    status?: string;
    previousStatus?: string;
    newStatus?: string;
    reasonOrNotes?: string;
    beforeSnapshot?: any;
    afterSnapshot?: any;
    deletedSnapshot?: any;
    entriesSnapshot?: any[];
    entriesCount?: number;
    [key: string]: any;
  };
}

export interface AccountingContextType {
  campuses: Campus[];
  currentCampusId: string;
  setCurrentCampusId: (id: string) => void;
  currentCampus?: Campus;
  transactions: Transaction[];
  pettyCashTransactions: PettyCashTransaction[];
  accountHeads: AccountHead[];
  activityLogs: AuditLogEntry[];
  logActivity: (
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    campusId?: string,
    amount?: number,
    metadata?: Record<string, any>
  ) => void;
  clearActivityLogs: () => void;
  notifications: any[];
  unreadNotificationsCount: number;
  orgSettings: OrgSettings;
  updateOrgSettings: (partial: Partial<OrgSettings>) => void;
  currentUser: any;
  users: any[];
  isSuperAdmin: boolean;
  isModuleAllowed: (moduleId: string) => boolean;
  getUserAllowedModules: () => string[];
  updateCampusModules?: (campusId: string, modules: string[]) => void;
  updateUserModules?: (userId: string, modules: string[]) => void;
  activePeriod: any;
  periods: any[];
  addTransaction: (tx: any) => Transaction;
  updateTransaction: (id: string, tx: any) => void;
  deleteTransaction: (id: string) => void;
  updateVoucherStatus: (id: string, status: string, officer?: string, role?: string, remarks?: string) => void;
  addVoucherAuditLog?: (id: string, auditEntry: any) => void;
  addPettyCashTransaction: (tx: any) => void;
  replenishPettyCash: (campusId: string, amount: number, bankAccountId: string, chequeNo: string, date: string) => void;
  addCampus: (campus: any) => Campus;
  updateCampus: (id: string, updates: any) => void;
  deleteCampus?: (id: string) => void;
  addAccountHead: (head: any) => void;
  updateAccountHead: (id: string, updates: any) => void;
  deleteAccountHead: (id: string) => { success: boolean; message?: string };
  getAccountOpeningDrCr?: (head: any, campusId: string) => { debit: number; credit: number };
  updateCampusOpeningDrCr: (accountId: string, campusId: string, debit: number, credit: number) => void;
  importOfficialAccountsHeads: () => void;
  getNextVoucherNumber: (type: string, campusId?: string) => string;
  getNextPettyCashNumber: (campusId?: string) => string;
  clearAllData: () => void;
  resetData?: () => void;
  exportSystemState: (campusId?: string) => any;
  importSystemState: (data: any, options?: { mode?: 'replace' | 'merge'; restoreCampuses?: boolean; restoreSettings?: boolean }) => {
    success: boolean;
    message: string;
    transactionsCount: number;
    accountHeadsCount: number;
    pettyCashCount: number;
    errors?: string[];
  };
}

export const AccountingProvider: React.FC<{ children: React.ReactNode }>;
export const useAccounting: () => AccountingContextType;
export const MainApp: React.FC;
export const RootApp: React.FC;
export const SchoolLogo: React.FC<{ campusId?: string; className?: string; size?: string; showBorder?: boolean }>;
export const OriginalDocs: React.FC;

// Modular Core Components exported from engine
export const CoreDashboard: React.FC<{
  onNavigate: (tab: string) => void;
  onOpenCampusModal: (campusId?: string) => void;
  onOpenNotifications: () => void;
}>;
export const CoreVoucherEntry: React.FC;
export const CoreVoucherAudit: React.FC<{ onNewVoucherClick: () => void }>;
export const CorePettyCash: React.FC;
export const CoreFinancialReports: React.FC;
export const CoreChartOfAccounts: React.FC;
export const CoreBankReconciliation: React.FC;
export const CoreOpeningBalance: React.FC;
export const CoreAccountingPeriods: React.FC;
export const CoreAssetDepreciation: React.FC;
export const CoreCampusBranches: React.FC<{
  onOpenCampusModal: (campusId?: string) => void;
  onOpenUserModal: () => void;
}>;
export const CoreActivityLog: React.FC<{ onNavigate: (tab: string) => void }>;
export const CoreSidebar: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCampusModal: () => void;
  onOpenUserModal: () => void;
  onOpenNotifications: () => void;
  transactionCount: number;
  pettyCashCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}>;
export const CoreNavbar: React.FC<{
  activeTab: string;
  onOpenMobileSidebar: () => void;
  onOpenCampusModal: () => void;
  onOpenUserModal: () => void;
  onOpenNotifications: () => void;
  onOpenBackupModal: () => void;
}>;
export const CoreSettingsDrawer: React.FC;
export const CoreCampusModal: React.FC<{ initialCampusId: string | null; onClose: () => void }>;
export const CoreUserModal: React.FC<{ onClose: () => void }>;
export const CoreNotificationsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, payload?: any) => void;
}>;
export const CoreBackupModal: React.FC<{ isOpen: boolean; onClose: () => void }>;
export const CoreLoginScreen: React.FC;

export function generateElementPdf(
  element: HTMLElement,
  filename: string,
  orientation?: 'portrait' | 'landscape',
  scale?: number,
  options?: { addPageNumbers?: boolean; margin?: number; docTitle?: string; institutionName?: string }
): Promise<void>;

export function printOrDownloadElement(
  element: HTMLElement | null,
  options?: { title?: string; orientation?: 'portrait' | 'landscape'; fallbackFileName?: string; scale?: number }
): Promise<{ success: boolean; downloadedPdf: boolean; message: string }>;

export type ImportCategoryTab =
  | 'coa'
  | 'all'
  | 'vouchers'
  | 'pettycash'
  | 'campuses'
  | 'openingbalance'
  | 'erp';

declare global {
  interface Window {
    __APLUS_CLOUD_SYNC__?: {
      syncCampus?: (campus: any) => Promise<void>;
      deleteCampus?: (campusId: string) => Promise<void>;
      syncVoucher?: (voucher: any) => Promise<void>;
      deleteVoucher?: (voucherId: string) => Promise<void>;
      syncPettyCash?: (pettyCash: any) => Promise<void>;
      deletePettyCash?: (pettyCashId: string) => Promise<void>;
      reconcileBankTx?: (txId: string, reconciled: boolean) => Promise<void>;
      syncActivityLog?: (log: any) => Promise<void>;
      seedAll?: (campuses: any[], vouchers: any[], pettyCash: any[]) => Promise<void>;
      autoSaveMasterState?: (state: any) => void;
    };
    __APLUS_HYDRATE_FROM_CLOUD__?: (cloudData: any) => void;
    __APLUS_GET_CURRENT_STATE__?: () => any;
    __APLUS_MARK_CLOUD_READY__?: () => void;
    __APLUS_SW_READY__?: boolean;
    __APLUS_TRIGGER_VOUCHER_SAVE__?: () => void;
    __APLUS_TRIGGER_PETTY_SAVE__?: () => void;
    __APLUS_CUSTOM_DOCS__?: React.ComponentType<{ LegacyDocs: React.ComponentType; onNavigate: (tab: string) => void }>;
    __APLUS_AUDIT_TRAIL__?: React.ComponentType<{ LegacyActivityLog: React.ComponentType<{ onNavigate: (tab: string) => void }>; onNavigate: (tab: string) => void }>;
    __APLUS_VOUCHER_PRINT_LAYOUT__?: React.ComponentType<any>;
    __APLUS_CASH_RECONCILIATION__?: React.ComponentType<{ onNavigate?: (tab: string) => void }>;
    __APLUS_BUDGET_VARIANCE_WIDGET__?: React.ComponentType<{ onNavigate?: (tab: string) => void }>;
    __APLUS_PETTY_CASH_CHART__?: React.ComponentType<{ onNavigate?: (tab: string) => void; compact?: boolean; defaultCollapsed?: boolean }>;
    __APLUS_MODERN_ERP__?: React.ComponentType<{ activeTab: string; onNavigate: (tab: string) => void }>;
    __APLUS_BULK_VOUCHER_HUB__?: React.ComponentType<{ onNavigate?: (tab: string) => void; mode?: 'ledger' | 'standalone' }>;
    __APLUS_SUGGESTIONS_HUB__?: React.ComponentType<{ onNavigate?: (tab: string) => void }>;
    __APLUS_MULTI_FORMAT_REPORTS__?: React.ComponentType<{ LegacyReportsHub: React.ComponentType<any> }>;
    __APLUS_REPORT_SIGNATURES_BLOCK__?: React.ComponentType<any>;
    __APLUS_VISIBILITY_CHECK__?: (moduleId: string, user?: any, campuses?: any[]) => boolean;
    __APLUS_TOP_BAR__?: React.ComponentType<{ activeTab: string; onNavigate: (tab: string) => void }>;
    __OPEN_SUPER_ADMIN_IMPORT__?: (initialTab?: ImportCategoryTab) => void;
  }
}
