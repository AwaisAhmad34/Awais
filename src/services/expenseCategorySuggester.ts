import { AccountHead, Transaction, PettyCashTransaction } from '../core/aplusEngine';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';

export interface CategorySuggestionResult {
  accountHead: AccountHead | null;
  accountCode: string;
  accountName: string;
  categoryGroup: string;
  confidence: number; // 0 - 100
  confidenceTier: 'high' | 'medium' | 'low';
  reason: string;
  matchedKeywords: string[];
  historicalMatchCount: number;
  suggestedVoucherType: 'BPV' | 'CPV' | 'CRV' | 'BRV' | 'JV';
  suggestedCreditAccountCode: string;
  suggestedCreditAccountName: string;
  alternatives: {
    accountCode: string;
    accountName: string;
    categoryGroup: string;
    confidence: number;
    reason: string;
  }[];
}

export interface LearnedExpensePattern {
  id: string;
  keyword: string;
  category: string;
  accountCode: string;
  accountName: string;
  frequency: number;
  confidence: number;
  campusId?: string;
  updatedAt: string;
}

// Institutional School Taxonomy Heuristics (Knowledge Base tailored for Aplus School System)
interface RulePattern {
  keywords: string[];
  accountCode: string;
  accountName: string;
  groupName: string;
  defaultVoucherType: 'BPV' | 'CPV' | 'CRV' | 'BRV' | 'JV';
  creditAccountCode: string; // e.g. 100-4-01 Cash or 100-4-02 Bank
  creditAccountName: string;
}

const BUILT_IN_EXPENSE_RULES: RulePattern[] = [
  // Generator & Fuel
  {
    keywords: ['diesel', 'generator', 'fuel', 'petrol', 'mobil oil', 'filter change', 'genset'],
    accountCode: '500-7-01',
    accountName: 'Generators Maintenance Expense',
    groupName: 'Machinery & Vehicles Maintenance Expense',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
  // Electricity & Utilities
  {
    keywords: ['electricity', 'wapda', 'gepco', 'lesco', 'bijli', 'power bill', 'meter reading'],
    accountCode: '500-2-01',
    accountName: 'Electric Bill',
    groupName: 'Utilities Expense',
    defaultVoucherType: 'BPV',
    creditAccountCode: '100-4-02',
    creditAccountName: 'Meezan Bank (09070104317815)',
  },
  // Sui Gas
  {
    keywords: ['sui gas', 'gas bill', 'cylinder', 'lpg', 'heating bill'],
    accountCode: '500-2-02',
    accountName: 'Sui Gas Bill',
    groupName: 'Utilities Expense',
    defaultVoucherType: 'BPV',
    creditAccountCode: '100-4-02',
    creditAccountName: 'Meezan Bank (09070104317815)',
  },
  // Telephone, Internet & Mobile
  {
    keywords: ['telephone', 'ptcl', 'internet', 'broadband', 'wifi', 'moblink', 'jazz', 'optix', 'stormfiber'],
    accountCode: '500-3-01',
    accountName: 'Telephone Bill',
    groupName: 'Telephone & Mobile Expenses',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
  // Printing, Stationery, Exam Papers
  {
    keywords: [
      'printing',
      'stationery',
      'paper',
      'ream',
      'photocopy',
      'copies',
      'toner',
      'cartridge',
      'whiteboard',
      'marker',
      'duster',
      'diary',
      'register',
      'exam sheet',
      'datesheet',
      'result card',
    ],
    accountCode: '500-4-02',
    accountName: 'Printing & Stationery',
    groupName: 'Genral & Administrative Expenses',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
  // Faculty & Staff Salaries
  {
    keywords: ['salary', 'salaries', 'payroll', 'faculty pay', 'teacher pay', 'stipend', 'staff salary'],
    accountCode: '500-1-01',
    accountName: 'Cost of Revenue - Salaries',
    groupName: 'Cost Of Revenue Expenses',
    defaultVoucherType: 'BPV',
    creditAccountCode: '100-4-02',
    creditAccountName: 'Meezan Bank (09070104317815)',
  },
  // Repair & Maintenance
  {
    keywords: [
      'repair',
      'maintenance',
      'plumber',
      'electrician',
      'paint',
      'carpenter',
      'whitewash',
      'mason',
      'sanitary',
      'tap repair',
      'door lock',
      'roof leak',
    ],
    accountCode: '500-5-01',
    accountName: 'Building Repair & Maintenance',
    groupName: 'Repair & Maintenance Expense',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
  // Vehicle & School Van Maintenance
  {
    keywords: ['van repair', 'bus diesel', 'tyre', 'transport maintenance', 'oil change', 'school bus'],
    accountCode: '500-7-02',
    accountName: 'Vehicles Maintenance Expense',
    groupName: 'Machinery & Vehicles Maintenance Expense',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
  // Refreshment & Hospitality
  {
    keywords: ['refreshment', 'tea', 'guest', 'biscuit', 'catering', 'meeting snacks', 'water dispenser', 'nestle'],
    accountCode: '500-4-03',
    accountName: 'Entertainment & Refreshment',
    groupName: 'Genral & Administrative Expenses',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
  // Science Laboratory Apparatus & Chemicals
  {
    keywords: ['lab chemicals', 'science lab', 'beaker', 'microscope', 'test tube', 'physics apparatus', 'biology specimen'],
    accountCode: '100-1-04',
    accountName: 'Laboratory Equipment',
    groupName: 'Fixed Assets',
    defaultVoucherType: 'BPV',
    creditAccountCode: '100-4-02',
    creditAccountName: 'Meezan Bank (09070104317815)',
  },
  // Library Books & Periodicals
  {
    keywords: ['library', 'books', 'novels', 'encyclopedia', 'magazine', 'journal'],
    accountCode: '100-1-02',
    accountName: 'Library Books',
    groupName: 'Fixed Assets',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
  // Legal & Audit
  {
    keywords: ['audit fee', 'advocate', 'legal', 'tax consultant', 'lawyer', 'fbr consultant'],
    accountCode: '500-6-01',
    accountName: 'Legal & Professional Expenses',
    groupName: 'Legal & Professional Expenses',
    defaultVoucherType: 'BPV',
    creditAccountCode: '100-4-02',
    creditAccountName: 'Meezan Bank (09070104317815)',
  },
  // Security Contractors & Guards
  {
    keywords: ['security guard', 'guard salary', 'security company', 'ammunition', 'surveillance'],
    accountCode: '300-1-04',
    accountName: 'Security Contractors Payable',
    groupName: 'Accounts Payable',
    defaultVoucherType: 'BPV',
    creditAccountCode: '100-4-02',
    creditAccountName: 'Meezan Bank (09070104317815)',
  },
  // EOBI & Social Security
  {
    keywords: ['eobi', 'social security', 'pessi', 'contribution'],
    accountCode: '300-3-01',
    accountName: 'EOBI Payable',
    groupName: 'Statutory & Social Payables',
    defaultVoucherType: 'BPV',
    creditAccountCode: '100-4-02',
    creditAccountName: 'Meezan Bank (09070104317815)',
  },
  // Advertising & Admissions Marketing
  {
    keywords: ['advertising', 'banner', 'panaflex', 'flyer', 'cable ad', 'admissions campaign', 'social media ad'],
    accountCode: '500-4-04',
    accountName: 'Advertisement & Publicity',
    groupName: 'Genral & Administrative Expenses',
    defaultVoucherType: 'CPV',
    creditAccountCode: '100-4-01',
    creditAccountName: 'Cash In Hand',
  },
];

// Helper to tokenize and normalize text
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// In-memory learned patterns cache
let learnedPatternsCache: LearnedExpensePattern[] = [];
let patternsLoadedFromDb = false;

export async function loadExpensePatternsFromFirestore(): Promise<LearnedExpensePattern[]> {
  try {
    const snap = await getDocs(collection(db, 'expense_patterns'));
    if (!snap.empty) {
      learnedPatternsCache = snap.docs.map((d) => d.data() as LearnedExpensePattern);
      patternsLoadedFromDb = true;
      return learnedPatternsCache;
    }
  } catch (err) {
    console.warn('Could not load expense patterns from Firestore:', err);
  }
  return learnedPatternsCache;
}

export async function saveLearnedPatternToFirestore(pattern: LearnedExpensePattern): Promise<void> {
  try {
    await setDoc(doc(db, 'expense_patterns', pattern.id), {
      ...pattern,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    // Update local cache
    const existingIdx = learnedPatternsCache.findIndex((p) => p.id === pattern.id);
    if (existingIdx >= 0) {
      learnedPatternsCache[existingIdx] = pattern;
    } else {
      learnedPatternsCache.push(pattern);
    }
  } catch (err) {
    console.warn('Could not save expense pattern to Firestore:', err);
  }
}

/**
 * Core Algorithm: Analyzes transaction description, payee, amount, and historical patterns
 * across all existing vouchers and petty cash records to produce a categorized recommendation.
 */
export function suggestExpenseCategory(params: {
  narration: string;
  payee?: string;
  amount?: number;
  voucherType?: string;
  campusId?: string;
  historicalTransactions?: Transaction[];
  historicalPettyCash?: PettyCashTransaction[];
  accountHeads: AccountHead[];
}): CategorySuggestionResult {
  const {
    narration = '',
    payee = '',
    amount = 0,
    voucherType,
    campusId,
    historicalTransactions = [],
    historicalPettyCash = [],
    accountHeads = [],
  } = params;

  const combinedText = `${narration} ${payee}`.toLowerCase().trim();
  const tokens = tokenize(combinedText);

  // Score accumulator for account heads: map from accountCode -> { score, matchedKeywords, historicalMatches }
  interface HeadCandidate {
    head: AccountHead;
    score: number;
    matchedKeywords: Set<string>;
    historicalMatches: number;
    sources: string[];
  }

  const candidateMap = new Map<string, HeadCandidate>();

  const getOrCreateCandidate = (head: AccountHead): HeadCandidate => {
    let cand = candidateMap.get(head.code);
    if (!cand) {
      cand = {
        head,
        score: 0,
        matchedKeywords: new Set<string>(),
        historicalMatches: 0,
        sources: [],
      };
      candidateMap.set(head.code, cand);
    }
    return cand;
  };

  // STEP 1: HISTORICAL PATTERN ANALYSIS (Vouchers / Transactions)
  // Scan all past transactions to find similarity in narrations or line item descriptions
  if (tokens.length > 0) {
    historicalTransactions.forEach((tx) => {
      const txNarr = (tx.narration || '').toLowerCase();
      const txEntries = tx.entries || [];
      const campusMatchMultiplier = campusId && tx.campusId === campusId ? 1.3 : 1.0;

      // Check how many query tokens appear in the historical transaction narration
      let matchedTokensInTx = 0;
      const txTokens = tokenize(txNarr);
      tokens.forEach((t) => {
        if (txTokens.includes(t)) {
          matchedTokensInTx++;
        }
      });

      if (matchedTokensInTx > 0) {
        // Find debit entries in this transaction (in double entry, debit = expense)
        txEntries.forEach((entry) => {
          if (entry.debit > 0 && entry.accountCode) {
            const head = accountHeads.find(
              (a) => a.code === entry.accountCode || a.accountId === entry.accountCode
            );
            if (head) {
              const cand = getOrCreateCandidate(head);
              const pointBoost = matchedTokensInTx * 18 * campusMatchMultiplier;
              cand.score += pointBoost;
              cand.historicalMatches++;
              cand.sources.push(`Voucher ${tx.voucherNo}`);
              tokens.forEach((t) => {
                if (txTokens.includes(t)) cand.matchedKeywords.add(t);
              });
            }
          }
        });
      }
    });

    // STEP 2: HISTORICAL PATTERN ANALYSIS (Petty Cash Records)
    historicalPettyCash.forEach((pc) => {
      const pcNarr = `${pc.narration || ''} ${pc.payee || ''} ${pc.category || ''}`.toLowerCase();
      const pcTokens = tokenize(pcNarr);

      let matchedTokensInPc = 0;
      tokens.forEach((t) => {
        if (pcTokens.includes(t)) matchedTokensInPc++;
      });

      if (matchedTokensInPc > 0) {
        // Attempt to match petty cash category or accountCode
        const targetCode = pc.accountCode || (pc.accountId ? pc.accountId : null);
        let head: AccountHead | undefined;

        if (targetCode) {
          head = accountHeads.find((a) => a.code === targetCode || a.accountId === targetCode);
        } else if (pc.category) {
          // Category string match against accountHeads name
          const catLower = pc.category.toLowerCase();
          head = accountHeads.find(
            (a) =>
              a.category === 'Expense' &&
              (a.name.toLowerCase().includes(catLower) || catLower.includes(a.name.toLowerCase()))
          );
        }

        if (head) {
          const cand = getOrCreateCandidate(head);
          cand.score += matchedTokensInPc * 14;
          cand.historicalMatches++;
          cand.sources.push(`PettyCash ${pc.voucherNo}`);
          tokens.forEach((t) => {
            if (pcTokens.includes(t)) cand.matchedKeywords.add(t);
          });
        }
      }
    });

    // STEP 3: PERSISTENT LEARNED PATTERNS FROM FIRESTORE
    learnedPatternsCache.forEach((lp) => {
      const kw = lp.keyword.toLowerCase();
      if (tokens.some((t) => t.includes(kw) || kw.includes(t))) {
        const head = accountHeads.find(
          (a) => a.code === lp.accountCode || a.name.toLowerCase() === lp.accountName.toLowerCase()
        );
        if (head) {
          const cand = getOrCreateCandidate(head);
          cand.score += (lp.confidence || 50) * 0.8;
          cand.matchedKeywords.add(kw);
          cand.sources.push(`Rule: ${kw}`);
        }
      }
    });

    // STEP 4: INSTITUTIONAL SCHOOL EXPENSE TAXONOMY HEURISTICS
    BUILT_IN_EXPENSE_RULES.forEach((rule) => {
      let ruleMatches = 0;
      const matchedWords: string[] = [];

      rule.keywords.forEach((kw) => {
        if (combinedText.includes(kw)) {
          ruleMatches++;
          matchedWords.push(kw);
        }
      });

      if (ruleMatches > 0) {
        // Find matching head in accountHeads
        let head = accountHeads.find((a) => a.code === rule.accountCode);
        if (!head) {
          // Fallback search by name
          head = accountHeads.find(
            (a) => a.name.toLowerCase().includes(rule.accountName.toLowerCase().slice(0, 8))
          );
        }

        if (head) {
          const cand = getOrCreateCandidate(head);
          // High baseline heuristic score
          cand.score += ruleMatches * 28 + 20;
          matchedWords.forEach((w) => cand.matchedKeywords.add(w));
          cand.sources.push(`Taxonomy: ${rule.accountName}`);
        }
      }
    });
  }

  // STEP 5: DIRECT ACCOUNT NAME MATCHING
  // If the description literally mentions the account name (e.g. "Telephone", "Sui Gas", "Salaries")
  accountHeads
    .filter((a) => a.category === 'Expense')
    .forEach((head) => {
      const hName = head.name.toLowerCase();
      if (hName.length > 3 && combinedText.includes(hName)) {
        const cand = getOrCreateCandidate(head);
        cand.score += 45;
        cand.matchedKeywords.add(hName);
        cand.sources.push('Direct Account Name Match');
      }
    });

  // Sort candidates by score descending
  const sortedCandidates = Array.from(candidateMap.values())
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // If no candidates matched, find a sensible default General & Administrative Expense head
  if (sortedCandidates.length === 0) {
    const defaultExpenseHead =
      accountHeads.find((a) => a.code === '500-4-02' || a.name.includes('Stationery')) ||
      accountHeads.find((a) => a.category === 'Expense') ||
      null;

    return {
      accountHead: defaultExpenseHead,
      accountCode: defaultExpenseHead?.code || '500-4-02',
      accountName: defaultExpenseHead?.name || 'Printing & Stationery',
      categoryGroup: defaultExpenseHead?.groupName || 'Genral & Administrative Expenses',
      confidence: 25,
      confidenceTier: 'low',
      reason: 'General institutional expense suggestion (no historical pattern matches detected).',
      matchedKeywords: [],
      historicalMatchCount: 0,
      suggestedVoucherType: 'CPV',
      suggestedCreditAccountCode: '100-4-01',
      suggestedCreditAccountName: 'Cash In Hand',
      alternatives: [],
    };
  }

  const best = sortedCandidates[0];
  const maxPossibleScore = 120;
  const rawConfidence = Math.min(99, Math.round((best.score / maxPossibleScore) * 100));
  const confidence = Math.max(best.historicalMatches > 0 ? 65 : 35, rawConfidence);

  const confidenceTier: 'high' | 'medium' | 'low' =
    confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low';

  // Construct readable explanation
  const kwList = Array.from(best.matchedKeywords);
  let reason = '';
  if (best.historicalMatches > 0) {
    reason = `Matched ${best.historicalMatches} historical voucher(s) with pattern [${kwList.slice(0, 3).join(', ')}] mapped to ${best.head.name}`;
  } else if (kwList.length > 0) {
    reason = `Identified keywords [${kwList.slice(0, 3).join(', ')}] strongly correlated with ${best.head.groupName || best.head.name}`;
  } else {
    reason = `Heuristic match to ${best.head.name} under ${best.head.groupName || 'Expenses'}`;
  }

  // Determine suggested voucher type & credit counter-account
  let suggestedVoucherType: 'BPV' | 'CPV' | 'CRV' | 'BRV' | 'JV' = (voucherType as any) || 'CPV';
  let creditCode = '100-4-01';
  let creditName = 'Cash In Hand';

  // If amount is high (> 25,000) or keywords mention bank/cheque/bill, suggest BPV
  const isBankKeywords = /cheque|cross|online|pay order|bank|transfer|gepco|wapda|lesco|ptcl/i.test(combinedText);
  if (amount > 25000 || isBankKeywords) {
    suggestedVoucherType = 'BPV';
    creditCode = '100-4-02';
    creditName = 'Meezan Bank (09070104317815)';
  }

  // Prepare top alternative recommendations
  const alternatives = sortedCandidates.slice(1, 4).map((cand) => ({
    accountCode: cand.head.code,
    accountName: cand.head.name,
    categoryGroup: cand.head.groupName || cand.head.category,
    confidence: Math.min(92, Math.round((cand.score / maxPossibleScore) * 100)),
    reason: `Keywords: ${Array.from(cand.matchedKeywords).slice(0, 2).join(', ') || 'Alternative'}`,
  }));

  return {
    accountHead: best.head,
    accountCode: best.head.code,
    accountName: best.head.name,
    categoryGroup: best.head.groupName || best.head.category,
    confidence,
    confidenceTier,
    reason,
    matchedKeywords: kwList,
    historicalMatchCount: best.historicalMatches,
    suggestedVoucherType,
    suggestedCreditAccountCode: creditCode,
    suggestedCreditAccountName: creditName,
    alternatives,
  };
}

/**
 * Batch analysis helper: Scans an array of pending vouchers and predicts categories for each.
 */
export function batchAnalyzeVouchers(params: {
  vouchers: Transaction[];
  accountHeads: AccountHead[];
  historicalTransactions?: Transaction[];
  historicalPettyCash?: PettyCashTransaction[];
}): {
  voucherId: string;
  voucherNo: string;
  narration: string;
  currentExpenseHeadName?: string;
  suggestion: CategorySuggestionResult;
  isDifferentFromCurrent: boolean;
}[] {
  const { vouchers, accountHeads, historicalTransactions = [], historicalPettyCash = [] } = params;

  return vouchers.map((v) => {
    // Current primary debit account
    const debitEntry = v.entries?.find((e) => e.debit > 0);
    const currentName = debitEntry?.accountName || '';

    const suggestion = suggestExpenseCategory({
      narration: v.narration || '',
      amount: v.totalDebit,
      voucherType: v.voucherType,
      campusId: v.campusId,
      historicalTransactions,
      historicalPettyCash,
      accountHeads,
    });

    const isDifferentFromCurrent =
      !debitEntry ||
      (suggestion.accountCode !== debitEntry.accountCode &&
        suggestion.accountName.toLowerCase() !== currentName.toLowerCase());

    return {
      voucherId: v.id,
      voucherNo: v.voucherNo,
      narration: v.narration,
      currentExpenseHeadName: currentName,
      suggestion,
      isDifferentFromCurrent,
    };
  });
}

/**
 * Returns overall statistics of learned patterns across the system.
 */
export function getHistoricalPatternSummary(
  transactions: Transaction[] = [],
  pettyCash: PettyCashTransaction[] = []
): {
  totalAnalyzedTransactions: number;
  uniqueVocabularyCount: number;
  topCategories: { category: string; count: number; percentage: number }[];
  topRecurringExpenses: { pattern: string; count: number; avgAmount: number }[];
} {
  const total = transactions.length + pettyCash.length;
  const wordFreq = new Map<string, number>();
  const catCount = new Map<string, number>();
  const recurringMap = new Map<string, { count: number; totalAmt: number }>();

  // Extract from vouchers
  transactions.forEach((tx) => {
    const tokens = tokenize(tx.narration || '');
    tokens.forEach((t) => wordFreq.set(t, (wordFreq.get(t) || 0) + 1));

    // Debit entries
    tx.entries?.forEach((entry) => {
      if (entry.debit > 0 && entry.accountName) {
        catCount.set(entry.accountName, (catCount.get(entry.accountName) || 0) + 1);
      }
    });

    if (tokens.length > 0) {
      const keyPattern = tokens.slice(0, 2).join(' ');
      const existing = recurringMap.get(keyPattern) || { count: 0, totalAmt: 0 };
      existing.count += 1;
      existing.totalAmt += tx.totalDebit || 0;
      recurringMap.set(keyPattern, existing);
    }
  });

  // Extract from petty cash
  pettyCash.forEach((pc) => {
    const tokens = tokenize(pc.narration || '');
    tokens.forEach((t) => wordFreq.set(t, (wordFreq.get(t) || 0) + 1));
    const cat = pc.category || 'General Petty Cash';
    catCount.set(cat, (catCount.get(cat) || 0) + 1);

    if (tokens.length > 0) {
      const keyPattern = tokens.slice(0, 2).join(' ');
      const existing = recurringMap.get(keyPattern) || { count: 0, totalAmt: 0 };
      existing.count += 1;
      existing.totalAmt += pc.amount || 0;
      recurringMap.set(keyPattern, existing);
    }
  });

  const totalCatHits = Array.from(catCount.values()).reduce((a, b) => a + b, 0) || 1;
  const topCategories = Array.from(catCount.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / totalCatHits) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const topRecurringExpenses = Array.from(recurringMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      avgAmount: Math.round(data.totalAmt / (data.count || 1)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalAnalyzedTransactions: total,
    uniqueVocabularyCount: wordFreq.size,
    topCategories,
    topRecurringExpenses,
  };
}
