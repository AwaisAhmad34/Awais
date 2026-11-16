import type { AccountHead, Campus } from '../core/aplusEngine';

export function isContraAssetAccount(
  code?: string,
  accountType?: string,
  name?: string
): boolean {
  const cleanCode = String(code || '').trim();
  const cleanType = String(accountType || '').trim();
  const cleanName = String(name || '').trim().toLowerCase();

  const cleanTypeLower = cleanType.toLowerCase();
  if (cleanName === 'cash in hand' || cleanTypeLower === 'cash & bank') {
    return false;
  }

  if (
    (cleanCode && (cleanCode.startsWith('100-2') || cleanCode === '100-2')) ||
    cleanType === 'Asset Depreciation' ||
    cleanType === 'Accumulated Depreciation' ||
    cleanName.startsWith('dep.') ||
    cleanName.includes('depreciation') ||
    cleanName.includes('allowance for doubtful') ||
    cleanCode === '1140' ||
    cleanCode === '1521' ||
    cleanCode === '1531' ||
    cleanCode === '1541' ||
    cleanCode === '1551' ||
    cleanCode === '1561' ||
    cleanCode === '1571' ||
    cleanCode === '1581' ||
    cleanCode === '1591'
  ) {
    return true;
  }

  const numCode = parseInt(cleanCode, 10);
  return (
    (numCode >= 1011 && numCode <= 1020) ||
    cleanCode === '1052' ||
    cleanCode === '1053'
  );
}

export function isDebitNormalAccount(head: Partial<AccountHead>): boolean {
  const isContra = isContraAssetAccount(head.code, head.accountType, head.name);
  return (head.category === 'Asset' && !isContra) || head.category === 'Expense';
}

function isCanonicalCashInHandHead(head?: Partial<AccountHead> | null): boolean {
  if (!head) return false;
  if (isContraAssetAccount(head.code, head.accountType, head.name)) return false;
  const id = String(head.id || '').trim();
  const code = String(head.code || '').trim();
  const ledgerCode = String(head.ledgerCode || '').trim();
  const accountId = String(head.accountId || '').trim();
  const name = String(head.name || '').trim().toLowerCase();

  return (
    id === 'acc-100-4-01' ||
    code === '100-4-01' ||
    ledgerCode === '100-4-01' ||
    accountId === '1031' ||
    code === '1031' ||
    name === 'cash in hand'
  );
}

export function isCashInHandAccountHead(head?: Partial<AccountHead> | null): boolean {
  if (!head) return false;
  if (isContraAssetAccount(head.code, head.accountType, head.name)) return false;
  if (isCanonicalCashInHandHead(head)) return true;

  const code = String(head.code || '').trim();
  const ledgerCode = String(head.ledgerCode || '').trim();
  const accountId = String(head.accountId || '').trim();

  return accountId === '1018' || code === '1018' || ledgerCode === '1018';
}

export function resolveCashInHandAccountHeadFromList(
  accountHeads: AccountHead[] = []
): AccountHead | undefined {
  const list = accountHeads || [];
  return (
    list.find((head) => isCanonicalCashInHandHead(head)) ||
    list.find((head) => isCashInHandAccountHead(head))
  );
}

export function resolveCapitalFundsAccountHead(
  accountHeads: AccountHead[] = []
): AccountHead | undefined {
  const list = accountHeads || [];
  return (
    list.find(
      (h) =>
        h.id === 'acc-200-1-01' ||
        h.code === '200-1-01' ||
        h.ledgerCode === '200-1-01' ||
        h.accountId === '2002'
    ) ||
    list.find(
      (h) =>
        h.id === 'acc-200-2-01' ||
        h.code === '200-2-01' ||
        h.code === '2001' ||
        h.accountId === '2001'
    ) ||
    list.find(
      (h) =>
        h.category === 'Equity' &&
        (String(h.name || '').toLowerCase().includes('capital') ||
          String(h.name || '').toLowerCase().includes('equity'))
    ) ||
    list.find((h) => h.category === 'Equity')
  );
}

export function getConfiguredCampusOpeningBalance(
  campus?: Partial<Campus> | null
): number {
  if (!campus) return 0;
  const val = Number(campus.openingBalance);
  return Number.isFinite(val) ? val : 0;
}

function getExplicitCampusOpeningDrCr(
  head: AccountHead,
  campusId: string
): { debit: number; credit: number; hasExplicitNonZero: boolean } {
  const isDebitNormal = isDebitNormalAccount(head);
  let dr = (head.campusDebitBalances && Number(head.campusDebitBalances[campusId])) || 0;
  let cr = (head.campusCreditBalances && Number(head.campusCreditBalances[campusId])) || 0;

  if (
    dr === 0 &&
    cr === 0 &&
    head.campusBalances &&
    head.campusBalances[campusId] !== undefined
  ) {
    const val = Number(head.campusBalances[campusId]) || 0;
    if (isDebitNormal) {
      dr = val >= 0 ? val : 0;
      cr = val < 0 ? Math.abs(val) : 0;
    } else {
      cr = val >= 0 ? val : 0;
      dr = val < 0 ? Math.abs(val) : 0;
    }
  }

  return {
    debit: dr,
    credit: cr,
    hasExplicitNonZero: dr !== 0 || cr !== 0,
  };
}

/**
 * Resolves effective fiscal-year opening Dr / Cr / Net balance for an AccountHead and campus
 * (or 'all' for Consolidated view), honoring explicit Chart of Accounts campus opening entries
 * first and falling back to Campus.openingBalance without double-counting.
 */
export function resolveEffectiveAccountOpeningDrCr(
  head: AccountHead,
  campusId: string,
  campuses: Campus[] = [],
  accountHeads: AccountHead[] = []
): { debit: number; credit: number; net: number; side: 'Dr' | 'Cr' } {
  const isDebitNormal = isDebitNormalAccount(head);

  if (campusId === 'all') {
    const allCampusIds = new Set<string>();
    (campuses || []).forEach((c) => {
      if (c?.id && c.id !== 'all') allCampusIds.add(c.id);
    });
    Object.keys(head.campusDebitBalances || {}).forEach((id) => {
      if (id && id !== 'all') allCampusIds.add(id);
    });
    Object.keys(head.campusCreditBalances || {}).forEach((id) => {
      if (id && id !== 'all') allCampusIds.add(id);
    });
    Object.keys(head.campusBalances || {}).forEach((id) => {
      if (id && id !== 'all') allCampusIds.add(id);
    });

    if (allCampusIds.size === 0) {
      const legacyBal = Number(head.balance) || 0;
      const dr = isDebitNormal
        ? Math.max(0, legacyBal)
        : Math.max(0, -legacyBal);
      const cr = isDebitNormal
        ? Math.max(0, -legacyBal)
        : Math.max(0, legacyBal);
      return {
        debit: dr,
        credit: cr,
        net: isDebitNormal ? dr - cr : cr - dr,
        side: isDebitNormal ? 'Dr' : 'Cr',
      };
    }

    let totalDr = 0;
    let totalCr = 0;
    allCampusIds.forEach((cid) => {
      const single = resolveEffectiveAccountOpeningDrCr(
        head,
        cid,
        campuses,
        accountHeads
      );
      totalDr += single.debit;
      totalCr += single.credit;
    });

    return {
      debit: totalDr,
      credit: totalCr,
      net: isDebitNormal ? totalDr - totalCr : totalCr - totalDr,
      side: isDebitNormal ? 'Dr' : 'Cr',
    };
  }

  const explicit = getExplicitCampusOpeningDrCr(head, campusId);
  let dr = explicit.debit;
  let cr = explicit.credit;

  const campusObj = (campuses || []).find((c) => c.id === campusId);
  const configuredOpening = getConfiguredCampusOpeningBalance(campusObj);

  if (!explicit.hasExplicitNonZero && configuredOpening !== 0) {
    if (isCashInHandAccountHead(head)) {
      if (configuredOpening >= 0) {
        dr = configuredOpening;
        cr = 0;
      } else {
        dr = 0;
        cr = Math.abs(configuredOpening);
      }
    } else {
      const capitalHead = resolveCapitalFundsAccountHead(accountHeads);
      if (capitalHead && capitalHead.id === head.id) {
        const cashHead = resolveCashInHandAccountHeadFromList(accountHeads);
        const cashHasExplicit =
          cashHead && getExplicitCampusOpeningDrCr(cashHead, campusId).hasExplicitNonZero;
        if (!cashHasExplicit) {
          if (configuredOpening >= 0) {
            dr = 0;
            cr = configuredOpening;
          } else {
            dr = Math.abs(configuredOpening);
            cr = 0;
          }
        }
      }
    }
  }

  return {
    debit: dr,
    credit: cr,
    net: isDebitNormal ? dr - cr : cr - dr,
    side: isDebitNormal ? 'Dr' : 'Cr',
  };
}

export function resolveEffectiveAccountOpeningBalance(
  head: AccountHead,
  campusId: string,
  campuses: Campus[] = [],
  accountHeads: AccountHead[] = []
): number {
  return resolveEffectiveAccountOpeningDrCr(
    head,
    campusId,
    campuses,
    accountHeads
  ).net;
}

/**
 * Synchronizes a campus's configured Opening Balance (PKR) into the double-entry
 * Chart of Accounts heads for the fiscal year:
 * - Cash In Hand (100-4-01) holds the campus's cash opening balance (Dr).
 * - Capital Funds (200-1-01) is adjusted by the exact net delta (Cr) so Trial Balance
 *   remains in strict IAS-1 double-entry equilibrium while preserving other head balances.
 */
export function applyCampusOpeningBalanceToAccountHeads(
  accountHeads: AccountHead[] = [],
  campusId: string,
  openingBalance: number
): AccountHead[] {
  if (!campusId || !Array.isArray(accountHeads) || accountHeads.length === 0) {
    return accountHeads;
  }

  const normalizedOpening = Number.isFinite(Number(openingBalance))
    ? Number(openingBalance)
    : 0;

  const cashHead = resolveCashInHandAccountHeadFromList(accountHeads);
  const capitalHead = resolveCapitalFundsAccountHead(accountHeads);

  if (!cashHead) {
    return accountHeads;
  }

  const prevCash = getExplicitCampusOpeningDrCr(cashHead, campusId);
  const prevNetCash = prevCash.debit - prevCash.credit;
  const delta = normalizedOpening - prevNetCash;

  return accountHeads.map((head) => {
    if (head.id === cashHead.id) {
      const nextDr = normalizedOpening >= 0 ? normalizedOpening : 0;
      const nextCr = normalizedOpening < 0 ? Math.abs(normalizedOpening) : 0;
      const campusDebitBalances = {
        ...(head.campusDebitBalances || {}),
        [campusId]: nextDr,
      };
      const campusCreditBalances = {
        ...(head.campusCreditBalances || {}),
        [campusId]: nextCr,
      };
      const campusBalances = {
        ...(head.campusBalances || {}),
        [campusId]: normalizedOpening,
      };
      const totalBalance = Object.values(campusBalances).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      );
      return {
        ...head,
        campusDebitBalances,
        campusCreditBalances,
        campusBalances,
        balance: totalBalance,
      };
    }

    if (capitalHead && head.id === capitalHead.id && delta !== 0) {
      const prevCap = getExplicitCampusOpeningDrCr(head, campusId);
      const prevNetCap = prevCap.credit - prevCap.debit;
      const nextNetCap = prevNetCap + delta;
      const nextDr = nextNetCap < 0 ? Math.abs(nextNetCap) : 0;
      const nextCr = nextNetCap >= 0 ? nextNetCap : 0;

      const campusDebitBalances = {
        ...(head.campusDebitBalances || {}),
        [campusId]: nextDr,
      };
      const campusCreditBalances = {
        ...(head.campusCreditBalances || {}),
        [campusId]: nextCr,
      };
      const campusBalances = {
        ...(head.campusBalances || {}),
        [campusId]: nextNetCap,
      };
      const totalBalance = Object.values(campusBalances).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      );
      return {
        ...head,
        campusDebitBalances,
        campusCreditBalances,
        campusBalances,
        balance: totalBalance,
      };
    }

    return head;
  });
}
