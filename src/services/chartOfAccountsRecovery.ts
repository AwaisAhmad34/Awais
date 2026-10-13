import { AccountHead } from '../core/aplusEngine';

export const TRASH_BIN_KEY = 'ams_deleted_account_heads_bin';
export const ACCOUNT_HEADS_KEY = 'ams_account_heads_v8_157_grouped_coa';

export interface DeletedAccountHeadRecord extends AccountHead {
  deletedAt: string;
  reason?: string;
}

export function getDeletedAccountsTrashBin(): DeletedAccountHeadRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRASH_BIN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushAccountToTrashBin(account: AccountHead, reason?: string): void {
  if (typeof window === 'undefined' || !account) return;
  try {
    const bin = getDeletedAccountsTrashBin();
    const record: DeletedAccountHeadRecord = {
      ...account,
      deletedAt: new Date().toISOString(),
      reason: reason || 'Deleted by User',
    };
    const nextBin = [record, ...bin.filter((b) => b.id !== account.id && b.code !== account.code)].slice(0, 50);
    localStorage.setItem(TRASH_BIN_KEY, JSON.stringify(nextBin));
  } catch {}
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restoredAccount?: AccountHead | null;
  officialAccountsAdded?: number;
  totalActiveAccounts?: number;
}

/**
 * Recovers the last deleted account from the trash bin or official 157 Chart of Accounts master list
 */
export function restoreLastDeletedAccount(
  accountingContext: {
    accountHeads: AccountHead[];
    addAccountHead: (head: any) => void;
    importOfficialAccountsHeads: () => any;
  }
): RestoreResult {
  const bin = getDeletedAccountsTrashBin();
  let restoredAccount: AccountHead | null = null;

  // 1. If there's an account in the trash bin, restore the top item
  if (bin.length > 0) {
    const [latest, ...remaining] = bin;
    restoredAccount = latest;
    try {
      localStorage.setItem(TRASH_BIN_KEY, JSON.stringify(remaining));
    } catch {}

    // Check if it already exists in active account heads
    const exists = accountingContext.accountHeads.some(
      (a) => a.id === latest.id || a.code === latest.code
    );

    if (!exists) {
      accountingContext.addAccountHead(latest);
    }
  }

  // 2. Also run official account heads restore to ensure standard 157 accounts are complete
  let officialAdded = 0;
  if (typeof accountingContext.importOfficialAccountsHeads === 'function') {
    const res = accountingContext.importOfficialAccountsHeads();
    if (res && typeof res.added === 'number') {
      officialAdded = res.added;
    }
  }

  const message = restoredAccount
    ? `Successfully restored Chart of Account "${restoredAccount.code} — ${restoredAccount.name}" (${restoredAccount.category}) to the active ledger.`
    : officialAdded > 0
    ? `Successfully recovered ${officialAdded} missing standard account head(s) from the institutional Chart of Accounts master library.`
    : `All 157 standard Chart of Accounts heads are active and intact. No missing heads detected.`;

  return {
    success: true,
    message,
    restoredAccount,
    officialAccountsAdded: officialAdded,
    totalActiveAccounts: accountingContext.accountHeads.length + (restoredAccount ? 1 : 0) + officialAdded,
  };
}

/**
 * Restores all 157 official institutional Chart of Accounts heads
 */
export function restoreAllOfficialChartOfAccounts(
  importOfficialAccountsHeads: () => any
): RestoreResult {
  if (typeof importOfficialAccountsHeads !== 'function') {
    return {
      success: false,
      message: 'importOfficialAccountsHeads is not available in current context.',
    };
  }

  const res = importOfficialAccountsHeads();
  const added = res?.added ?? 0;
  const updated = res?.updated ?? 0;
  const total = res?.total ?? 157;

  return {
    success: true,
    message: `Chart of Accounts library synchronized! ${total} master accounts checked (${added} recovered/added, ${updated} verified).`,
    officialAccountsAdded: added,
  };
}
