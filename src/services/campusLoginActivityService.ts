import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface CampusLoginActivity {
  id: string;
  timestamp: string;
  epochMs: number;
  campusId: string;
  campusName: string;
  campusCode: string;
  clientId?: string;
  clientName?: string;
  userName: string;
  userRole: string;
  userEmail?: string;
  ipAddress: string;
  device: string;
  status: 'success' | 'failed' | 'locked';
  method: 'portal_login' | 'vault_one_click' | 'dynamic_auth' | 'switch_branch';
  remarks?: string;
}

export interface CampusActivitySummary {
  campusId: string;
  campusCode: string;
  campusName: string;
  clientName: string;
  totalLogins: number;
  successCount: number;
  failedCount: number;
  percentage: number;
  uniqueUsers: number;
  lastLoginEpoch: number;
  lastLoginFormatted: string;
  mostActiveUser: string;
}

export interface RoleActivitySummary {
  roleKey: string;
  roleDisplayName: string;
  levelBadge: string;
  colorClass: string;
  totalLogins: number;
  percentage: number;
  successRate: number;
  uniqueUsers: number;
  lastLoginFormatted: string;
}

export interface HourlyActivityBucket {
  hour: number;
  label: string; // e.g. "08:00", "09:00"
  logins: number;
  success: number;
  failed: number;
}

export interface SystemUserActivityReport {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  overallSuccessRate: number;
  uniqueActiveUsers: number;
  activeCampusesCount: number;
  peakOperatingHour: string;
  mostActiveCampus: { name: string; count: number };
  mostActiveRole: { name: string; count: number };
  campusBreakdown: CampusActivitySummary[];
  roleBreakdown: RoleActivitySummary[];
  hourlyTrend: HourlyActivityBucket[];
  recentActivities: CampusLoginActivity[];
}

const STORAGE_KEY = 'aplus_campus_login_activities_v2';

// Rich, realistic initial activity seed data across campuses, roles, and timestamps
const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const INITIAL_CAMPUS_LOGIN_ACTIVITIES: CampusLoginActivity[] = [
  {
    id: 'act-seed-01',
    timestamp: new Date(NOW - 5 * 60 * 1000).toISOString(),
    epochMs: NOW - 5 * 60 * 1000,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL-MAIN',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Khurram Shahzad',
    userRole: 'Level 3 Main Campus Admin',
    userEmail: 'khurram.khiali@aplus.edu.pk',
    ipAddress: '192.168.10.45',
    device: 'Chrome 122 (Windows 11)',
    status: 'success',
    method: 'dynamic_auth',
    remarks: 'Authenticated via Dynamic Campus Vault Token [AES-256]',
  },
  {
    id: 'act-seed-02',
    timestamp: new Date(NOW - 18 * 60 * 1000).toISOString(),
    epochMs: NOW - 18 * 60 * 1000,
    campusId: 'campus-sub-2',
    campusName: 'Aplus Model Town Sub-Campus',
    campusCode: 'MTN-C2',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Ayesha Malik',
    userRole: 'Level 4 Sub-Campus Admin',
    userEmail: 'ayesha.mtn@aplus.edu.pk',
    ipAddress: '192.168.14.88',
    device: 'Edge 121 (Windows 10)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Standard credentials verification completed successfully',
  },
  {
    id: 'act-seed-03',
    timestamp: new Date(NOW - 45 * 60 * 1000).toISOString(),
    epochMs: NOW - 45 * 60 * 1000,
    campusId: 'campus-apex-main',
    campusName: 'Apex Academy Main Campus',
    campusCode: 'APX-MAIN',
    clientId: 'client-apex',
    clientName: 'Apex Group of Colleges & Schools',
    userName: 'Dr. Tariq Mehmood',
    userRole: 'Level 2 Client Super Admin',
    userEmail: 'head@apexacademy.edu.pk',
    ipAddress: '10.0.4.12',
    device: 'Safari 17 (macOS Sonoma)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Apex client centralized governance session opened',
  },
  {
    id: 'act-seed-04',
    timestamp: new Date(NOW - 72 * 60 * 1000).toISOString(),
    epochMs: NOW - 72 * 60 * 1000,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL-MAIN',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Muhammad Usman',
    userRole: 'Level 5 Departmental Staff',
    userEmail: 'usman.cash@aplus.edu.pk',
    ipAddress: '192.168.10.99',
    device: 'Chrome 122 (Windows 10)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Imprest petty cash shift sign-in',
  },
  {
    id: 'act-seed-05',
    timestamp: new Date(NOW - 110 * 60 * 1000).toISOString(),
    epochMs: NOW - 110 * 60 * 1000,
    campusId: 'campus-sub-3',
    campusName: 'Aplus Wapda Town Sub-Campus',
    campusCode: 'WPD-C3',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Zainab Bibi',
    userRole: 'Level 4 Sub-Campus Admin',
    userEmail: 'zainab.wpd@aplus.edu.pk',
    ipAddress: '192.168.18.23',
    device: 'Firefox 123 (Ubuntu Linux)',
    status: 'success',
    method: 'vault_one_click',
    remarks: 'Platform Admin authorized one-click session emulation',
  },
  {
    id: 'act-seed-06',
    timestamp: new Date(NOW - 145 * 60 * 1000).toISOString(),
    epochMs: NOW - 145 * 60 * 1000,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL-MAIN',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'System Administrator',
    userRole: 'Level 1 Platform Super Admin',
    userEmail: 'siteowner@platform.org',
    ipAddress: '127.0.0.1 (Internal Gateway)',
    device: 'Admin Console (PWA)',
    status: 'success',
    method: 'portal_login',
    remarks: 'System-wide maintenance and audit verification',
  },
  {
    id: 'act-seed-07',
    timestamp: new Date(NOW - 190 * 60 * 1000).toISOString(),
    epochMs: NOW - 190 * 60 * 1000,
    campusId: 'campus-sub-2',
    campusName: 'Aplus Model Town Sub-Campus',
    campusCode: 'MTN-C2',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Unknown Client',
    userRole: 'Level 5 Departmental Staff',
    userEmail: 'cashier@mtn.school',
    ipAddress: '192.168.14.102',
    device: 'Edge 121 (Windows 10)',
    status: 'failed',
    method: 'portal_login',
    remarks: 'Failed credentials entry — incorrect password token',
  },
  {
    id: 'act-seed-08',
    timestamp: new Date(NOW - 260 * 60 * 1000).toISOString(),
    epochMs: NOW - 260 * 60 * 1000,
    campusId: 'campus-apex-2',
    campusName: 'Apex City Sub-Campus',
    campusCode: 'APX-2',
    clientId: 'client-apex',
    clientName: 'Apex Group of Colleges & Schools',
    userName: 'Rizwan Qureshi',
    userRole: 'Level 4 Sub-Campus Admin',
    userEmail: 'rizwan.city@apex.edu.pk',
    ipAddress: '10.0.6.21',
    device: 'Chrome 122 (macOS)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Voucher journal entry & batch posting session',
  },
  {
    id: 'act-seed-09',
    timestamp: new Date(NOW - 340 * 60 * 1000).toISOString(),
    epochMs: NOW - 340 * 60 * 1000,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL-MAIN',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Hamza Bilal',
    userRole: 'Internal Auditor & Compliance',
    userEmail: 'auditor@aplus.edu.pk',
    ipAddress: '192.168.10.15',
    device: 'Chrome 122 (Windows 11)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Read-only cross-branch ledger compliance audit',
  },
  {
    id: 'act-seed-10',
    timestamp: new Date(NOW - 420 * 60 * 1000).toISOString(),
    epochMs: NOW - 420 * 60 * 1000,
    campusId: 'campus-sub-4',
    campusName: 'Aplus Peoples Colony Sub-Campus',
    campusCode: 'PPL-C4',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Bilal Ahmad',
    userRole: 'Level 4 Sub-Campus Admin',
    userEmail: 'bilal.ppl@aplus.edu.pk',
    ipAddress: '192.168.22.44',
    device: 'Firefox 123 (Windows 10)',
    status: 'success',
    method: 'dynamic_auth',
    remarks: 'Branch daily cash collection sign-in',
  },
  {
    id: 'act-seed-11',
    timestamp: new Date(NOW - 510 * 60 * 1000).toISOString(),
    epochMs: NOW - 510 * 60 * 1000,
    campusId: 'campus-apex-main',
    campusName: 'Apex Academy Main Campus',
    campusCode: 'APX-MAIN',
    clientId: 'client-apex',
    clientName: 'Apex Group of Colleges & Schools',
    userName: 'Fatima Noor',
    userRole: 'Level 3 Main Campus Admin',
    userEmail: 'fatima.noor@apex.edu.pk',
    ipAddress: '10.0.4.55',
    device: 'Safari 17 (iPadOS)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Authorization matrix review session',
  },
  {
    id: 'act-seed-12',
    timestamp: new Date(NOW - 650 * 60 * 1000).toISOString(),
    epochMs: NOW - 650 * 60 * 1000,
    campusId: 'campus-sub-2',
    campusName: 'Aplus Model Town Sub-Campus',
    campusCode: 'MTN-C2',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Ayesha Malik',
    userRole: 'Level 4 Sub-Campus Admin',
    userEmail: 'ayesha.mtn@aplus.edu.pk',
    ipAddress: '192.168.14.88',
    device: 'Edge 121 (Windows 10)',
    status: 'success',
    method: 'switch_branch',
    remarks: 'Operational ledger jump from Main Campus',
  },
  {
    id: 'act-seed-13',
    timestamp: new Date(NOW - 800 * 60 * 1000).toISOString(),
    epochMs: NOW - 800 * 60 * 1000,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL-MAIN',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Khurram Shahzad',
    userRole: 'Level 3 Main Campus Admin',
    userEmail: 'khurram.khiali@aplus.edu.pk',
    ipAddress: '192.168.10.45',
    device: 'Chrome 122 (Windows 11)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Morning opening float ledger session',
  },
  {
    id: 'act-seed-14',
    timestamp: new Date(NOW - 1 * DAY - 2 * HOUR).toISOString(),
    epochMs: NOW - 1 * DAY - 2 * HOUR,
    campusId: 'campus-sub-3',
    campusName: 'Aplus Wapda Town Sub-Campus',
    campusCode: 'WPD-C3',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Zainab Bibi',
    userRole: 'Level 4 Sub-Campus Admin',
    userEmail: 'zainab.wpd@aplus.edu.pk',
    ipAddress: '192.168.18.23',
    device: 'Firefox 123 (Ubuntu Linux)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Vendor invoice clearance entry',
  },
  {
    id: 'act-seed-15',
    timestamp: new Date(NOW - 1 * DAY - 5 * HOUR).toISOString(),
    epochMs: NOW - 1 * DAY - 5 * HOUR,
    campusId: 'campus-beacon-main',
    campusName: 'Beacon Crest Main Campus',
    campusCode: 'BCN-MAIN',
    clientId: 'client-beacon',
    clientName: 'Beacon Crest International',
    userName: 'Sohail Anwar',
    userRole: 'Level 2 Client Super Admin',
    userEmail: 'sohail@beaconcrest.edu.pk',
    ipAddress: '172.16.2.14',
    device: 'Chrome 122 (Windows 11)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Monthly subscription & billing dashboard view',
  },
  {
    id: 'act-seed-16',
    timestamp: new Date(NOW - 2 * DAY - 3 * HOUR).toISOString(),
    epochMs: NOW - 2 * DAY - 3 * HOUR,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL-MAIN',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Muhammad Usman',
    userRole: 'Level 5 Departmental Staff',
    userEmail: 'usman.cash@aplus.edu.pk',
    ipAddress: '192.168.10.99',
    device: 'Chrome 122 (Windows 10)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Daily petty cash replenishment voucher',
  },
  {
    id: 'act-seed-17',
    timestamp: new Date(NOW - 3 * DAY - 4 * HOUR).toISOString(),
    epochMs: NOW - 3 * DAY - 4 * HOUR,
    campusId: 'campus-apex-main',
    campusName: 'Apex Academy Main Campus',
    campusCode: 'APX-MAIN',
    clientId: 'client-apex',
    clientName: 'Apex Group of Colleges & Schools',
    userName: 'Dr. Tariq Mehmood',
    userRole: 'Level 2 Client Super Admin',
    userEmail: 'head@apexacademy.edu.pk',
    ipAddress: '10.0.4.12',
    device: 'Safari 17 (macOS)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Chart of Accounts and sub-account code configuration',
  },
];

export function getStoredCampusLoginActivities(): CampusLoginActivity[] {
  try {
    if (typeof window === 'undefined') return INITIAL_CAMPUS_LOGIN_ACTIVITIES;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CAMPUS_LOGIN_ACTIVITIES));
      return INITIAL_CAMPUS_LOGIN_ACTIVITIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CAMPUS_LOGIN_ACTIVITIES));
    return INITIAL_CAMPUS_LOGIN_ACTIVITIES;
  } catch {
    return INITIAL_CAMPUS_LOGIN_ACTIVITIES;
  }
}

export function recordCampusLoginActivity(
  activity: Omit<CampusLoginActivity, 'id' | 'timestamp' | 'epochMs'>
): CampusLoginActivity {
  const newActivity: CampusLoginActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    epochMs: Date.now(),
    ...activity,
  };

  try {
    const existing = getStoredCampusLoginActivities();
    const updated = [newActivity, ...existing].slice(0, 500); // keep recent 500
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    // Background push to Firestore
    const docRef = doc(db, 'campus_login_activities', newActivity.id);
    setDoc(docRef, newActivity).catch(() => {});
  } catch {}

  return newActivity;
}

export function clearCampusLoginActivities(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

/**
 * Normalizes user role strings into standardized 5-tier architecture categories
 */
export function normalizeRoleCategory(roleString: string): {
  key: string;
  displayName: string;
  levelBadge: string;
  colorClass: string;
} {
  const r = (roleString || '').toLowerCase();

  if (r.includes('level_1') || r.includes('platform') || r.includes('site owner') || r.includes('site_admin')) {
    return {
      key: 'level_1',
      displayName: 'Level 1: Platform Super Admin',
      levelBadge: 'Tier 1 Creator',
      colorClass: 'text-indigo-400 bg-indigo-950/80 border-indigo-700',
    };
  }

  if (r.includes('level_2') || r.includes('client_super') || r.includes('client_admin') || r.includes('client owner') || r.includes('director')) {
    return {
      key: 'level_2',
      displayName: 'Level 2: School Client Super Admin',
      levelBadge: 'Tier 2 Client',
      colorClass: 'text-purple-400 bg-purple-950/80 border-purple-700',
    };
  }

  if (r.includes('level_3') || r.includes('main_campus') || r.includes('head office') || r.includes('principal')) {
    return {
      key: 'level_3',
      displayName: 'Level 3: Main Campus Admin',
      levelBadge: 'Tier 3 Main HQ',
      colorClass: 'text-emerald-400 bg-emerald-950/80 border-emerald-700',
    };
  }

  if (r.includes('level_4') || r.includes('sub_campus') || r.includes('sub_branch') || r.includes('branch admin')) {
    return {
      key: 'level_4',
      displayName: 'Level 4: Sub-Campus Admin',
      levelBadge: 'Tier 4 Branch',
      colorClass: 'text-sky-400 bg-sky-950/80 border-sky-700',
    };
  }

  if (r.includes('read_only') || r.includes('audit')) {
    return {
      key: 'auditor',
      displayName: 'Auditor & Compliance Officer',
      levelBadge: 'Tier Oversight',
      colorClass: 'text-amber-400 bg-amber-950/80 border-amber-700',
    };
  }

  // Default to Level 5 Staff / Cashier / Accountant
  return {
    key: 'level_5',
    displayName: 'Level 5: Departmental Staff & Accountant',
    levelBadge: 'Tier 5 Staff',
    colorClass: 'text-teal-400 bg-teal-950/80 border-teal-700',
  };
}

/**
 * Calculates aggregated activity metrics, frequencies by campus, frequencies by role, and hourly buckets.
 */
export function calculateUserActivityStats(
  activities: CampusLoginActivity[],
  timeFilter: 'all' | '24h' | '7d' | '30d' = 'all',
  campusFilter: string = 'all',
  roleFilter: string = 'all'
): SystemUserActivityReport {
  const currentEpoch = Date.now();
  let filtered = activities;

  // 1. Time Filter
  if (timeFilter === '24h') {
    const cutoff = currentEpoch - 24 * 60 * 60 * 1000;
    filtered = filtered.filter((a) => a.epochMs >= cutoff);
  } else if (timeFilter === '7d') {
    const cutoff = currentEpoch - 7 * 24 * 60 * 60 * 1000;
    filtered = filtered.filter((a) => a.epochMs >= cutoff);
  } else if (timeFilter === '30d') {
    const cutoff = currentEpoch - 30 * 24 * 60 * 60 * 1000;
    filtered = filtered.filter((a) => a.epochMs >= cutoff);
  }

  // 2. Campus Filter
  if (campusFilter && campusFilter !== 'all') {
    filtered = filtered.filter(
      (a) => a.campusId === campusFilter || a.campusCode?.toLowerCase() === campusFilter.toLowerCase()
    );
  }

  // 3. Role Filter
  if (roleFilter && roleFilter !== 'all') {
    filtered = filtered.filter((a) => {
      const norm = normalizeRoleCategory(a.userRole);
      return norm.key === roleFilter;
    });
  }

  const totalLogins = filtered.length;
  const successfulLogins = filtered.filter((a) => a.status === 'success').length;
  const failedLogins = filtered.filter((a) => a.status === 'failed' || a.status === 'locked').length;
  const overallSuccessRate = totalLogins > 0 ? Math.round((successfulLogins / totalLogins) * 1000) / 10 : 100;

  const uniqueUsersSet = new Set(filtered.map((a) => a.userName.toLowerCase()));
  const uniqueActiveUsers = uniqueUsersSet.size;

  // Campus Frequency Map
  const campusMap = new Map<
    string,
    {
      campusId: string;
      campusCode: string;
      campusName: string;
      clientName: string;
      total: number;
      success: number;
      failed: number;
      lastEpoch: number;
      users: Map<string, number>;
    }
  >();

  filtered.forEach((act) => {
    const cId = act.campusId || 'unknown-campus';
    let entry = campusMap.get(cId);
    if (!entry) {
      entry = {
        campusId: cId,
        campusCode: act.campusCode || 'CAMP',
        campusName: act.campusName || 'Unspecified Branch',
        clientName: act.clientName || 'General Network',
        total: 0,
        success: 0,
        failed: 0,
        lastEpoch: 0,
        users: new Map(),
      };
      campusMap.set(cId, entry);
    }
    entry.total += 1;
    if (act.status === 'success') entry.success += 1;
    else entry.failed += 1;
    if (act.epochMs > entry.lastEpoch) entry.lastEpoch = act.epochMs;
    const userCount = entry.users.get(act.userName) || 0;
    entry.users.set(act.userName, userCount + 1);
  });

  const campusBreakdown: CampusActivitySummary[] = Array.from(campusMap.values())
    .map((c) => {
      let topUser = 'N/A';
      let maxCount = 0;
      c.users.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count;
          topUser = name;
        }
      });

      return {
        campusId: c.campusId,
        campusCode: c.campusCode,
        campusName: c.campusName,
        clientName: c.clientName,
        totalLogins: c.total,
        successCount: c.success,
        failedCount: c.failed,
        percentage: totalLogins > 0 ? Math.round((c.total / totalLogins) * 1000) / 10 : 0,
        uniqueUsers: c.users.size,
        lastLoginEpoch: c.lastEpoch,
        lastLoginFormatted: c.lastEpoch ? formatRelativeTime(c.lastEpoch) : 'Never',
        mostActiveUser: topUser,
      };
    })
    .sort((a, b) => b.totalLogins - a.totalLogins);

  // Role Frequency Map
  const roleMap = new Map<
    string,
    {
      roleKey: string;
      roleDisplayName: string;
      levelBadge: string;
      colorClass: string;
      total: number;
      success: number;
      lastEpoch: number;
      users: Set<string>;
    }
  >();

  // Ensure all 5 main tiers are represented
  const STANDARD_ROLE_KEYS = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'auditor'];
  STANDARD_ROLE_KEYS.forEach((key) => {
    const dummy = normalizeRoleCategory(key);
    roleMap.set(key, {
      roleKey: key,
      roleDisplayName: dummy.displayName,
      levelBadge: dummy.levelBadge,
      colorClass: dummy.colorClass,
      total: 0,
      success: 0,
      lastEpoch: 0,
      users: new Set(),
    });
  });

  filtered.forEach((act) => {
    const norm = normalizeRoleCategory(act.userRole);
    let entry = roleMap.get(norm.key);
    if (!entry) {
      entry = {
        roleKey: norm.key,
        roleDisplayName: norm.displayName,
        levelBadge: norm.levelBadge,
        colorClass: norm.colorClass,
        total: 0,
        success: 0,
        lastEpoch: 0,
        users: new Set(),
      };
      roleMap.set(norm.key, entry);
    }
    entry.total += 1;
    if (act.status === 'success') entry.success += 1;
    if (act.epochMs > entry.lastEpoch) entry.lastEpoch = act.epochMs;
    entry.users.add(act.userName);
  });

  const roleBreakdown: RoleActivitySummary[] = Array.from(roleMap.values())
    .map((r) => ({
      roleKey: r.roleKey,
      roleDisplayName: r.roleDisplayName,
      levelBadge: r.levelBadge,
      colorClass: r.colorClass,
      totalLogins: r.total,
      percentage: totalLogins > 0 ? Math.round((r.total / totalLogins) * 1000) / 10 : 0,
      successRate: r.total > 0 ? Math.round((r.success / r.total) * 1000) / 10 : 100,
      uniqueUsers: r.users.size,
      lastLoginFormatted: r.lastEpoch ? formatRelativeTime(r.lastEpoch) : 'No recent login',
    }))
    .sort((a, b) => b.totalLogins - a.totalLogins);

  // Hourly Trend (0 to 23 hours)
  const hourlyBuckets: HourlyActivityBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, '0')}:00`,
    logins: 0,
    success: 0,
    failed: 0,
  }));

  filtered.forEach((act) => {
    const date = new Date(act.epochMs);
    const h = date.getHours();
    if (hourlyBuckets[h]) {
      hourlyBuckets[h].logins += 1;
      if (act.status === 'success') hourlyBuckets[h].success += 1;
      else hourlyBuckets[h].failed += 1;
    }
  });

  // Calculate Peak Hour
  let peakH = 9;
  let peakCount = 0;
  hourlyBuckets.forEach((b) => {
    if (b.logins > peakCount) {
      peakCount = b.logins;
      peakH = b.hour;
    }
  });
  const peakOperatingHour = `${peakH.toString().padStart(2, '0')}:00 - ${(peakH + 1).toString().padStart(2, '0')}:00 (${peakCount} logins)`;

  const mostActiveCampus = campusBreakdown[0]
    ? { name: campusBreakdown[0].campusName, count: campusBreakdown[0].totalLogins }
    : { name: 'None', count: 0 };

  const mostActiveRole = roleBreakdown[0]
    ? { name: roleBreakdown[0].roleDisplayName, count: roleBreakdown[0].totalLogins }
    : { name: 'None', count: 0 };

  return {
    totalLogins,
    successfulLogins,
    failedLogins,
    overallSuccessRate,
    uniqueActiveUsers,
    activeCampusesCount: campusBreakdown.length,
    peakOperatingHour,
    mostActiveCampus,
    mostActiveRole,
    campusBreakdown,
    roleBreakdown,
    hourlyTrend: hourlyBuckets,
    recentActivities: filtered.slice(0, 50),
  };
}

export function formatRelativeTime(epochMs: number): string {
  const diffSec = Math.floor((Date.now() - epochMs) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Simulates an authenticated user login event for testing real-time telemetry updates
 */
export function simulateRandomLoginActivity(
  campuses: Array<{ id: string; name: string; code: string; clientId?: string }>,
  users: Array<{ id: string; name: string; role: string; email?: string; campusId?: string | null }>
): CampusLoginActivity {
  const sampleCamp =
    campuses[Math.floor(Math.random() * campuses.length)] || {
      id: 'campus-khiali',
      name: 'Aplus Khiali Main Campus',
      code: 'KHL-MAIN',
    };

  const sampleUser =
    users[Math.floor(Math.random() * users.length)] || {
      id: 'user-sample',
      name: 'Campus Staff Accountant',
      role: 'level_4_sub_campus_admin',
      email: 'staff@school.edu.pk',
    };

  const methods: CampusLoginActivity['method'][] = [
    'portal_login',
    'dynamic_auth',
    'vault_one_click',
    'switch_branch',
  ];
  const chosenMethod = methods[Math.floor(Math.random() * methods.length)];

  const isSuccess = Math.random() > 0.08; // 92% success rate
  const devices = [
    'Chrome 122 (Windows 11)',
    'Edge 121 (Windows 10)',
    'Safari 17 (macOS Sonoma)',
    'Firefox 123 (Ubuntu Linux)',
    'Chrome Mobile (Android 14)',
  ];

  return recordCampusLoginActivity({
    campusId: sampleCamp.id,
    campusName: sampleCamp.name,
    campusCode: sampleCamp.code,
    clientId: sampleCamp.clientId || 'client-aplus',
    clientName: sampleCamp.name.includes('Apex') ? 'Apex Group of Colleges' : 'Aplus School System',
    userName: sampleUser.name,
    userRole: sampleUser.role || 'Level 4 Sub-Campus Admin',
    userEmail: sampleUser.email || `${sampleCamp.code.toLowerCase()}@school.edu.pk`,
    ipAddress: `192.168.${Math.floor(Math.random() * 20) + 10}.${Math.floor(Math.random() * 200) + 10}`,
    device: devices[Math.floor(Math.random() * devices.length)],
    status: isSuccess ? 'success' : 'failed',
    method: chosenMethod,
    remarks: isSuccess
      ? `Real-time simulated telemetry session for ${sampleCamp.name}`
      : 'Simulated authentication challenge retry attempt',
  });
}

