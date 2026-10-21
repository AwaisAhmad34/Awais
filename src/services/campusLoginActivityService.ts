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

const STORAGE_KEY = 'aplus_campus_login_activities_v1';

const INITIAL_CAMPUS_LOGIN_ACTIVITIES: CampusLoginActivity[] = [
  {
    id: 'login-act-001',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    epochMs: Date.now() - 12 * 60 * 1000,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Sub-Campus',
    campusCode: 'KHL',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Khurram Shahzad',
    userRole: 'Accountant',
    userEmail: 'khurram.khiali@aplus.edu.pk',
    ipAddress: '192.168.10.45',
    device: 'Chrome 122 (Windows 11)',
    status: 'success',
    method: 'dynamic_auth',
    remarks: 'Authenticated via Dynamic Campus Vault Token [AES-256]',
  },
  {
    id: 'login-act-002',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    epochMs: Date.now() - 35 * 60 * 1000,
    campusId: 'campus-sub-2',
    campusName: 'Aplus Model Town Sub-Campus',
    campusCode: 'MTN',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Ayesha Malik',
    userRole: 'Campus Accountant',
    userEmail: 'ayesha.mtn@aplus.edu.pk',
    ipAddress: '192.168.14.88',
    device: 'Edge 121 (Windows 10)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Standard credentials verification completed successfully',
  },
  {
    id: 'login-act-003',
    timestamp: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    epochMs: Date.now() - 85 * 60 * 1000,
    campusId: 'campus-apex-2',
    campusName: 'Apex City Sub-Campus',
    campusCode: 'APX-2',
    clientId: 'client-apex',
    clientName: 'Apex Group of Colleges & Schools',
    userName: 'Tariq Mehmood',
    userRole: 'Accountant',
    userEmail: 'tariq.mehmood@apex.edu.pk',
    ipAddress: '10.0.4.12',
    device: 'Safari 17 (macOS Sonoma)',
    status: 'success',
    method: 'portal_login',
    remarks: 'Direct portal authentication',
  },
  {
    id: 'login-act-004',
    timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
    epochMs: Date.now() - 150 * 60 * 1000,
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Sub-Campus',
    campusCode: 'KHL',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Khurram Shahzad',
    userRole: 'Accountant',
    userEmail: 'khurram.khiali@aplus.edu.pk',
    ipAddress: '192.168.10.45',
    device: 'Chrome 122 (Windows 11)',
    status: 'failed',
    method: 'dynamic_auth',
    remarks: 'Invalid token retry attempt (resolved on subsequent login)',
  },
  {
    id: 'login-act-005',
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    epochMs: Date.now() - 240 * 60 * 1000,
    campusId: 'campus-sub-3',
    campusName: 'Aplus Wapda Town Sub-Campus',
    campusCode: 'WPD',
    clientId: 'client-aplus',
    clientName: 'Aplus School System Network',
    userName: 'Zainab Bibi',
    userRole: 'Cashier / Accountant',
    userEmail: 'zainab.wpd@aplus.edu.pk',
    ipAddress: '192.168.18.23',
    device: 'Firefox 123 (Ubuntu Linux)',
    status: 'success',
    method: 'vault_one_click',
    remarks: 'Platform Admin authorized one-click session emulation',
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CAMPUS_LOGIN_ACTIVITIES;
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
    const updated = [newActivity, ...existing].slice(0, 300); // keep recent 300
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
