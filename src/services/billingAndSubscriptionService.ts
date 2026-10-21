import { Campus } from '../core/aplusEngine';
import { SchoolClientOrganization } from './platformSiteAdminService';

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  tier: 'Starter' | 'Professional' | 'Enterprise';
  baseMonthlyFee: number;
  includedCampuses: number;
  chargePerAdditionalCampus: number;
  maxCampuses: number;
  maxUsers: number;
  includedModules: string[];
  description: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'Bank Transfer' | 'Cheque' | 'Cash' | 'Online Gateway';
  referenceNo: string;
  recordedBy: string;
  notes?: string;
}

export interface SubscriptionInvoice {
  id: string;
  invoiceNo: string; // e.g. INV-2026-APL-001
  clientId: string;
  clientName: string;
  clientCode: string;
  billingMonth: string; // e.g. "October" or "2026-10"
  billingYear: number;
  planId: string;
  planName: string;
  issueDate: string;
  dueDate: string;
  status: 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';
  
  // Financial Breakdowns
  baseMonthlyFee: number;
  includedCampuses: number;
  totalRegisteredCampuses: number;
  additionalCampusesCount: number;
  chargePerAdditionalCampus: number;
  additionalCampusesTotal: number;
  optionalModuleCharges: number;
  discountAmount: number;
  taxAmount: number;
  previousOutstandingBalance: number;
  
  subtotal: number;
  grandTotal: number;
  amountPaid: number;
  remainingBalance: number;

  lineItems: InvoiceLineItem[];
  payments: InvoicePaymentRecord[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  generatedBy: string;
}

const PLANS_STORAGE_KEY = 'aplus_platform_subscription_plans_v1';
const INVOICES_STORAGE_KEY = 'aplus_platform_subscription_invoices_v1';

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter Network Plan',
    code: 'STARTER',
    tier: 'Starter',
    baseMonthlyFee: 6000,
    includedCampuses: 1,
    chargePerAdditionalCampus: 1200,
    maxCampuses: 3,
    maxUsers: 10,
    includedModules: ['dashboard', 'campuses', 'transaction', 'pettycash', 'reports'],
    description: 'Entry-level subscription for single-campus or emerging small school branches.',
  },
  {
    id: 'plan-professional',
    name: 'Professional Multi-Campus Plan',
    code: 'PRO',
    tier: 'Professional',
    baseMonthlyFee: 10000,
    includedCampuses: 2,
    chargePerAdditionalCampus: 1500,
    maxCampuses: 8,
    maxUsers: 25,
    includedModules: [
      'dashboard',
      'campuses',
      'transaction',
      'alltransactions',
      'pettycash',
      'cashreconciliation',
      'reports',
      'accounts',
      'reconciliation',
      'activity',
    ],
    description: 'Standard plan for growing educational networks requiring multi-branch controls and consolidated reporting.',
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise School Group Matrix',
    code: 'ENTERPRISE',
    tier: 'Enterprise',
    baseMonthlyFee: 20000,
    includedCampuses: 5,
    chargePerAdditionalCampus: 1800,
    maxCampuses: 25,
    maxUsers: 100,
    includedModules: [
      'dashboard',
      'campuses',
      'multischool_admin',
      'transaction',
      'alltransactions',
      'pettycash',
      'cashreconciliation',
      'reports',
      'accounts',
      'reconciliation',
      'activity',
      'docs',
    ],
    description: 'Comprehensive tier for large school networks with unlimited sub-branches, custom chart of accounts, and multi-format reports.',
  },
];

export const INITIAL_SUBSCRIPTION_INVOICES: SubscriptionInvoice[] = [
  {
    id: 'inv-aplus-2026-10',
    invoiceNo: 'INV-2026-APL-001',
    clientId: 'client-aplus',
    clientName: 'Aplus School System',
    clientCode: 'APLUS',
    billingMonth: 'October',
    billingYear: 2026,
    planId: 'plan-professional',
    planName: 'Professional Multi-Campus Plan',
    issueDate: '2026-10-01',
    dueDate: '2026-10-25',
    status: 'Partially Paid',
    baseMonthlyFee: 10000,
    includedCampuses: 2,
    totalRegisteredCampuses: 4,
    additionalCampusesCount: 2,
    chargePerAdditionalCampus: 1500,
    additionalCampusesTotal: 3000,
    optionalModuleCharges: 2500,
    discountAmount: 500,
    taxAmount: 0,
    previousOutstandingBalance: 0,
    subtotal: 15500,
    grandTotal: 15000,
    amountPaid: 10000,
    remainingBalance: 5000,
    lineItems: [
      {
        id: 'item-1',
        description: 'Professional Multi-Campus Plan Base Subscription (Included 2 Campuses)',
        quantity: 1,
        unitPrice: 10000,
        total: 10000,
      },
      {
        id: 'item-2',
        description: 'Additional Sub-Campuses Expansion (Aplus Khiali, Aplus Campus 2)',
        quantity: 2,
        unitPrice: 1500,
        total: 3000,
      },
      {
        id: 'item-3',
        description: 'Advanced Multi-Format Financial PDF Export Module & Cloud Sync',
        quantity: 1,
        unitPrice: 2500,
        total: 2500,
      },
      {
        id: 'item-4',
        description: 'Loyalty Network Discount (Contract Signed)',
        quantity: 1,
        unitPrice: -500,
        total: -500,
      },
    ],
    payments: [
      {
        id: 'pay-aplus-01',
        date: '2026-10-12',
        amount: 10000,
        method: 'Bank Transfer',
        referenceNo: 'HBL-FT-994821',
        recordedBy: 'Platform Billing Officer',
        notes: 'Initial monthly installment received via Habib Bank.',
      },
    ],
    notes: 'Standard monthly invoice for Aplus School System. Remaining balance PKR 5,000 due on 25th October.',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-12T14:30:00.000Z',
    generatedBy: 'Platform Super Admin',
  },
  {
    id: 'inv-apex-2026-10',
    invoiceNo: 'INV-2026-APX-001',
    clientId: 'client-apex',
    clientName: 'Apex School System',
    clientCode: 'APEX',
    billingMonth: 'October',
    billingYear: 2026,
    planId: 'plan-professional',
    planName: 'Professional Multi-Campus Plan',
    issueDate: '2026-10-01',
    dueDate: '2026-10-25',
    status: 'Paid',
    baseMonthlyFee: 10000,
    includedCampuses: 2,
    totalRegisteredCampuses: 3,
    additionalCampusesCount: 1,
    chargePerAdditionalCampus: 1500,
    additionalCampusesTotal: 1500,
    optionalModuleCharges: 1000,
    discountAmount: 500,
    taxAmount: 0,
    previousOutstandingBalance: 0,
    subtotal: 12500,
    grandTotal: 12000,
    amountPaid: 12000,
    remainingBalance: 0,
    lineItems: [
      {
        id: 'item-apex-1',
        description: 'Professional Multi-Campus Plan Base Subscription (Included 2 Campuses)',
        quantity: 1,
        unitPrice: 10000,
        total: 10000,
      },
      {
        id: 'item-apex-2',
        description: 'Additional Sub-Campus Expansion (Apex Campus 2)',
        quantity: 1,
        unitPrice: 1500,
        total: 1500,
      },
      {
        id: 'item-apex-3',
        description: 'Dedicated Imprest Petty Cash Tracker Module',
        quantity: 1,
        unitPrice: 1000,
        total: 1000,
      },
      {
        id: 'item-apex-4',
        description: 'Promotional Onboarding Discount',
        quantity: 1,
        unitPrice: -500,
        total: -500,
      },
    ],
    payments: [
      {
        id: 'pay-apex-01',
        date: '2026-10-05',
        amount: 12000,
        method: 'Online Gateway',
        referenceNo: 'MZN-PY-882194',
        recordedBy: 'Platform Billing Officer',
        notes: 'Full payment received with zero outstanding balance.',
      },
    ],
    notes: 'Paid in full for October 2026.',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-05T11:00:00.000Z',
    generatedBy: 'Platform Super Admin',
  },
];

export function getStoredSubscriptionPlans(): SubscriptionPlan[] {
  try {
    if (typeof window === 'undefined') return DEFAULT_SUBSCRIPTION_PLANS;
    const raw = localStorage.getItem(PLANS_STORAGE_KEY);
    if (!raw) {
      saveStoredSubscriptionPlans(DEFAULT_SUBSCRIPTION_PLANS);
      return DEFAULT_SUBSCRIPTION_PLANS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SUBSCRIPTION_PLANS;
  } catch {
    return DEFAULT_SUBSCRIPTION_PLANS;
  }
}

export function saveStoredSubscriptionPlans(plans: SubscriptionPlan[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
    }
  } catch {}
}

export function getStoredSubscriptionInvoices(): SubscriptionInvoice[] {
  try {
    if (typeof window === 'undefined') return INITIAL_SUBSCRIPTION_INVOICES;
    const raw = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) {
      saveStoredSubscriptionInvoices(INITIAL_SUBSCRIPTION_INVOICES);
      return INITIAL_SUBSCRIPTION_INVOICES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SUBSCRIPTION_INVOICES;
  } catch {
    return INITIAL_SUBSCRIPTION_INVOICES;
  }
}

export function saveStoredSubscriptionInvoices(invoices: SubscriptionInvoice[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
    }
  } catch {}
}

/**
 * Calculate Monthly Invoice details dynamically based on client and active campuses
 */
export function calculateClientMonthlyBilling(params: {
  client: SchoolClientOrganization;
  allCampuses: Campus[];
  plan: SubscriptionPlan;
  billingMonth: string;
  billingYear: number;
  optionalModuleCharges?: number;
  discountAmount?: number;
  taxRatePct?: number;
  previousOutstandingBalance?: number;
}): Omit<SubscriptionInvoice, 'id' | 'invoiceNo' | 'payments' | 'createdAt' | 'updatedAt' | 'generatedBy'> {
  const {
    client,
    allCampuses,
    plan,
    billingMonth,
    billingYear,
    optionalModuleCharges = 0,
    discountAmount = 0,
    taxRatePct = 0,
    previousOutstandingBalance = 0,
  } = params;

  // Filter campuses registered under this client
  const clientCampuses = allCampuses.filter(
    (c) => c.clientId === client.id || (!c.clientId && client.id === 'client-aplus')
  );
  const totalRegisteredCampuses = clientCampuses.length;
  const includedCampuses = plan.includedCampuses;
  const additionalCampusesCount = Math.max(0, totalRegisteredCampuses - includedCampuses);
  const additionalCampusesTotal = additionalCampusesCount * plan.chargePerAdditionalCampus;

  const baseMonthlyFee = plan.baseMonthlyFee;
  const subtotal = baseMonthlyFee + additionalCampusesTotal + optionalModuleCharges;
  const taxAmount = taxRatePct > 0 ? Math.round((subtotal - discountAmount) * (taxRatePct / 100)) : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount + previousOutstandingBalance);

  const lineItems: InvoiceLineItem[] = [
    {
      id: `li-base-${Date.now()}`,
      description: `${plan.name} Base Subscription (${includedCampuses} campus${includedCampuses === 1 ? '' : 'es'} included)`,
      quantity: 1,
      unitPrice: baseMonthlyFee,
      total: baseMonthlyFee,
    },
  ];

  if (additionalCampusesCount > 0) {
    lineItems.push({
      id: `li-extra-${Date.now()}`,
      description: `Additional Sub-Campuses (${additionalCampusesCount} @ PKR ${plan.chargePerAdditionalCampus.toLocaleString()}/campus)`,
      quantity: additionalCampusesCount,
      unitPrice: plan.chargePerAdditionalCampus,
      total: additionalCampusesTotal,
    });
  }

  if (optionalModuleCharges > 0) {
    lineItems.push({
      id: `li-mod-${Date.now()}`,
      description: 'Optional Advanced Modules & Analytics Pack',
      quantity: 1,
      unitPrice: optionalModuleCharges,
      total: optionalModuleCharges,
    });
  }

  if (discountAmount > 0) {
    lineItems.push({
      id: `li-disc-${Date.now()}`,
      description: 'Special Customer Loyalty / Term Discount',
      quantity: 1,
      unitPrice: -discountAmount,
      total: -discountAmount,
    });
  }

  if (previousOutstandingBalance > 0) {
    lineItems.push({
      id: `li-prev-${Date.now()}`,
      description: 'Brought Forward Previous Outstanding Balance',
      quantity: 1,
      unitPrice: previousOutstandingBalance,
      total: previousOutstandingBalance,
    });
  }

  const issueDate = new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + 25);
  const dueDate = due.toISOString().slice(0, 10);

  return {
    clientId: client.id,
    clientName: client.name,
    clientCode: client.code,
    billingMonth,
    billingYear,
    planId: plan.id,
    planName: plan.name,
    issueDate,
    dueDate,
    status: 'Issued',
    baseMonthlyFee,
    includedCampuses,
    totalRegisteredCampuses,
    additionalCampusesCount,
    chargePerAdditionalCampus: plan.chargePerAdditionalCampus,
    additionalCampusesTotal,
    optionalModuleCharges,
    discountAmount,
    taxAmount,
    previousOutstandingBalance,
    subtotal,
    grandTotal,
    amountPaid: 0,
    remainingBalance: grandTotal,
    lineItems,
    notes: `Monthly subscription invoice for ${client.name}. Total campuses billed: ${totalRegisteredCampuses}.`,
  };
}

/**
 * Generate and store a new Monthly Invoice with strict duplicate prevention
 */
export function generateMonthlyInvoice(
  params: {
    client: SchoolClientOrganization;
    allCampuses: Campus[];
    plan: SubscriptionPlan;
    billingMonth: string;
    billingYear: number;
    optionalModuleCharges?: number;
    discountAmount?: number;
    taxRatePct?: number;
    previousOutstandingBalance?: number;
    generatedBy?: string;
  },
  options: { allowDuplicate?: boolean } = {}
): { success: boolean; invoice?: SubscriptionInvoice; message: string } {
  const currentInvoices = getStoredSubscriptionInvoices();

  // Check for duplicate invoice for this client and billing month/year
  const exists = currentInvoices.find(
    (inv) =>
      inv.clientId === params.client.id &&
      inv.billingMonth.toLowerCase() === params.billingMonth.toLowerCase() &&
      inv.billingYear === params.billingYear &&
      inv.status !== 'Cancelled'
  );

  if (exists && !options.allowDuplicate) {
    return {
      success: false,
      invoice: exists,
      message: `An active invoice (${exists.invoiceNo}) already exists for ${params.client.name} for ${params.billingMonth} ${params.billingYear}. Duplicate invoice creation blocked.`,
    };
  }

  const billingData = calculateClientMonthlyBilling(params);
  const countForClient = currentInvoices.filter((inv) => inv.clientId === params.client.id).length + 1;
  const paddedNo = countForClient.toString().padStart(3, '0');
  const invoiceNo = `INV-${params.billingYear}-${params.client.code}-${paddedNo}`;

  const newInvoice: SubscriptionInvoice = {
    ...billingData,
    id: `inv-${params.client.id}-${params.billingYear}-${Date.now().toString(36)}`,
    invoiceNo,
    payments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generatedBy: params.generatedBy || 'Platform Super Admin',
  };

  const updatedInvoices = [newInvoice, ...currentInvoices];
  saveStoredSubscriptionInvoices(updatedInvoices);

  return {
    success: true,
    invoice: newInvoice,
    message: `Successfully generated invoice ${invoiceNo} for ${params.client.name} (PKR ${newInvoice.grandTotal.toLocaleString()}).`,
  };
}

/**
 * Record a payment against an invoice
 */
export function recordInvoicePayment(params: {
  invoiceId: string;
  amount: number;
  method: 'Bank Transfer' | 'Cheque' | 'Cash' | 'Online Gateway';
  referenceNo: string;
  recordedBy: string;
  notes?: string;
}): { success: boolean; invoice?: SubscriptionInvoice; message: string } {
  const currentInvoices = getStoredSubscriptionInvoices();
  const targetIndex = currentInvoices.findIndex((inv) => inv.id === params.invoiceId);

  if (targetIndex === -1) {
    return { success: false, message: 'Invoice not found.' };
  }

  const invoice = currentInvoices[targetIndex];
  if (invoice.status === 'Cancelled') {
    return { success: false, message: 'Cannot record payment for a cancelled invoice.' };
  }

  const paymentAmount = Math.max(0, Number(params.amount) || 0);
  if (paymentAmount <= 0) {
    return { success: false, message: 'Payment amount must be greater than zero.' };
  }

  const newTotalPaid = invoice.amountPaid + paymentAmount;
  const newRemaining = Math.max(0, invoice.grandTotal - newTotalPaid);
  let newStatus: SubscriptionInvoice['status'] = invoice.status;

  if (newRemaining <= 0) {
    newStatus = 'Paid';
  } else if (newTotalPaid > 0) {
    newStatus = 'Partially Paid';
  }

  const newPayment: InvoicePaymentRecord = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString().slice(0, 10),
    amount: paymentAmount,
    method: params.method,
    referenceNo: params.referenceNo.trim() || `REF-${Date.now().toString(36).toUpperCase()}`,
    recordedBy: params.recordedBy,
    notes: params.notes,
  };

  const updatedInvoice: SubscriptionInvoice = {
    ...invoice,
    amountPaid: newTotalPaid,
    remainingBalance: newRemaining,
    status: newStatus,
    payments: [...invoice.payments, newPayment],
    updatedAt: new Date().toISOString(),
  };

  currentInvoices[targetIndex] = updatedInvoice;
  saveStoredSubscriptionInvoices(currentInvoices);

  return {
    success: true,
    invoice: updatedInvoice,
    message: `Payment of PKR ${paymentAmount.toLocaleString()} recorded for invoice ${invoice.invoiceNo}. Remaining balance: PKR ${newRemaining.toLocaleString()}.`,
  };
}

/**
 * Get Client-Scoped Billing Summary (Used for Main Campus Administrator Dashboard)
 */
export function getClientBillingSummary(clientId: string, allCampuses: Campus[]) {
  const invoices = getStoredSubscriptionInvoices().filter((inv) => inv.clientId === clientId);
  const clientCampuses = allCampuses.filter(
    (c) => c.clientId === clientId || (!c.clientId && clientId === 'client-aplus')
  );

  const activeCampuses = clientCampuses.filter((c) => c.status === 'active').length;
  const inactiveCampuses = clientCampuses.filter((c) => c.status !== 'active').length;

  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.status !== 'Cancelled' ? inv.grandTotal : 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.status !== 'Cancelled' ? inv.amountPaid : 0), 0);
  const outstandingBalance = invoices.reduce(
    (sum, inv) => sum + (inv.status !== 'Cancelled' ? inv.remainingBalance : 0),
    0
  );

  const latestInvoice = invoices.length > 0 ? invoices[0] : null;

  return {
    totalCampuses: clientCampuses.length,
    activeCampuses,
    inactiveCampuses,
    totalBilled,
    totalPaid,
    outstandingBalance,
    latestInvoice,
    invoices,
  };
}
