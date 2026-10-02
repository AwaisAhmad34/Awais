import express, { Request, Response } from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_HMAC_SECRET =
  process.env.TENANT_HMAC_SECRET || 'aplus-multi-tenant-hmac-secret-2026-iso27001';

export interface VerifiedServerSession {
  userId: string;
  userName: string;
  email: string;
  role:
    | 'platform_super_admin'
    | 'school_client_admin'
    | 'campus_admin'
    | 'accountant'
    | 'viewer';
  organizationId: string; // Server-bound tenant ID (never trusted from client query/body)
  organizationCode: string;
  assignedCampusIds: string[];
  accountStatus: 'Active' | 'Suspended' | 'Closed';
  issuedAt: number;
  expiresAt: number;
}

export function issueSignedTenantToken(
  sessionPayload: Omit<VerifiedServerSession, 'issuedAt' | 'expiresAt'>
): string {
  const fullPayload: VerifiedServerSession = {
    ...sessionPayload,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 8,
  };
  const base64Data = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(base64Data)
    .digest('base64url');
  return `${base64Data}.${sig}`;
}

export function verifySignedTenantToken(
  token?: string
): VerifiedServerSession | null {
  if (!token || !token.includes('.')) return null;
  const [base64Data, providedSig] = token.split('.');
  if (!base64Data || !providedSig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(base64Data)
    .digest('base64url');
  if (expectedSig !== providedSig) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(base64Data, 'base64url').toString('utf8')
    ) as VerifiedServerSession;
    if (Date.now() > decoded.expiresAt) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Authoritative server-side multi-tenant fixture & ledger store
const SERVER_TENANT_STORE: Record<
  string,
  {
    organizationId: string;
    organizationCode: string;
    organizationName: string;
    status: 'Active' | 'Suspended' | 'Closed';
    campuses: { id: string; code: string; name: string }[];
    vouchers: {
      id: string;
      voucherNo: string;
      organizationId: string;
      campusId: string;
      amountPKR: number;
      narration: string;
    }[];
  }
> = {
  'inst-aplus-main': {
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    organizationName: 'Client A — A+ School System',
    status: 'Active',
    campuses: [
      { id: 'tcamp-aplus-main-1', code: 'CVT-MAIN', name: 'A+ Main Campus' },
      { id: 'tcamp-aplus-sub-1', code: 'CVT-SUB-JR', name: 'A+ Junior Sub-Campus' },
    ],
    vouchers: [
      {
        id: 'tx-client-a-001',
        voucherNo: 'BPV-APLUS-001',
        organizationId: 'inst-aplus-main',
        campusId: 'tcamp-aplus-main-1',
        amountPKR: 145000,
        narration: 'Client A Private Campus Building Rent Payment',
      },
    ],
  },
  'inst-apex-college': {
    organizationId: 'inst-apex-college',
    organizationCode: 'ORG-APEX-002',
    organizationName: 'Client B — Apex Science & Commerce Institute',
    status: 'Active',
    campuses: [
      { id: 'tcamp-apex-main-1', code: 'APEX-ISB-MAIN', name: 'Apex Islamabad Main Campus' },
    ],
    vouchers: [
      {
        id: 'tx-client-b-001',
        voucherNo: 'BPV-APEX-999',
        organizationId: 'inst-apex-college',
        campusId: 'tcamp-apex-main-1',
        amountPKR: 280000,
        narration: 'Client B Confidential Faculty Payroll & Lab Equipment Voucher',
      },
    ],
  },
  'inst-alhuda-academy': {
    organizationId: 'inst-alhuda-academy',
    organizationCode: 'ORG-ALHUDA-003',
    organizationName: 'Client C — Al-Huda Scholars Academy (Suspended)',
    status: 'Suspended',
    campuses: [
      { id: 'tcamp-alhuda-main-1', code: 'ALHUDA-FSD-01', name: 'Al-Huda Main Campus' },
    ],
    vouchers: [
      {
        id: 'tx-client-c-001',
        voucherNo: 'CPV-ALHUDA-101',
        organizationId: 'inst-alhuda-academy',
        campusId: 'tcamp-alhuda-main-1',
        amountPKR: 42000,
        narration: 'Client C Historical Utility Voucher',
      },
    ],
  },
};

/**
 * Pure Server-Side Authorization & Tenant Isolation Evaluator
 * Used by both Express HTTP endpoints and the automated test runner.
 */
export function evaluateServerTenantRequest(params: {
  token?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint:
    | 'READ_ORG_RECORDS'
    | 'WRITE_ORG_VOUCHER'
    | 'EXPORT_ORG_REPORTS'
    | 'CREATE_CLIENT_ORG'
    | 'ACCESS_PLATFORM_SUPER_ADMIN'
    | 'READ_CAMPUS_RECORDS'
    | 'DELETE_VOUCHER_ENTRY';
  targetOrganizationId?: string;
  spoofedBodyOrganizationId?: string;
  targetCampusId?: string;
}): {
  statusCode: 200 | 401 | 403;
  allowed: boolean;
  code: string;
  message: string;
  sessionOrg?: string;
  targetOrg?: string;
  data?: any;
} {
  const session = verifySignedTenantToken(params.token);
  if (!session) {
    return {
      statusCode: 401,
      allowed: false,
      code: 'UNAUTHENTICATED_SESSION',
      message: 'Server rejected request: Missing or invalid HMAC session token.',
    };
  }

  // 1. Site Owner / Platform Super Admin Zero-Delete Policy Check
  if (params.endpoint === 'DELETE_VOUCHER_ENTRY') {
    return {
      statusCode: 403,
      allowed: false,
      code: 'SITE_OWNER_NO_DELETE_POLICY_ENFORCED',
      sessionOrg: session.organizationId,
      targetOrg: params.targetOrganizationId,
      message:
        'Server blocked DELETE request: Site Owner & Platform policy strictly prohibits deleting any financial or client ledger entry (Show-Only Policy).',
    };
  }

  // 2. Platform Super Admin Dashboard / Client Creation Guard
  if (
    params.endpoint === 'ACCESS_PLATFORM_SUPER_ADMIN' ||
    params.endpoint === 'CREATE_CLIENT_ORG'
  ) {
    if (session.role !== 'platform_super_admin') {
      return {
        statusCode: 403,
        allowed: false,
        code: 'PLATFORM_SUPER_ADMIN_REQUIRED',
        sessionOrg: session.organizationId,
        targetOrg: params.targetOrganizationId,
        message: `Server blocked ${params.endpoint}: Authenticated role "${session.role}" (${session.organizationCode}) cannot access /platform-admin or create client organizations.`,
      };
    }
    return {
      statusCode: 200,
      allowed: true,
      code: 'AUTHORIZED_SUPER_ADMIN',
      sessionOrg: session.organizationId,
      message: 'Verified platform_super_admin authorization.',
    };
  }

  // 3. Detect Body/Query Organization ID Spoofing / Tampering
  if (
    params.spoofedBodyOrganizationId &&
    params.spoofedBodyOrganizationId !== session.organizationId &&
    session.role !== 'platform_super_admin'
  ) {
    return {
      statusCode: 403,
      allowed: false,
      code: 'TENANT_ID_SPOOFING_BLOCKED',
      sessionOrg: session.organizationId,
      targetOrg: params.spoofedBodyOrganizationId,
      message: `Server blocked parameter tampering: Session is bound to "${session.organizationId}" (${session.organizationCode}), but request payload attempted to inject organizationId="${params.spoofedBodyOrganizationId}".`,
    };
  }

  // 4. Enforce Organization-Level Data Isolation (Client A cannot access Client B)
  const targetOrgId = params.targetOrganizationId || session.organizationId;
  if (
    targetOrgId !== session.organizationId &&
    session.role !== 'platform_super_admin'
  ) {
    return {
      statusCode: 403,
      allowed: false,
      code: 'CROSS_TENANT_ISOLATION_VIOLATION',
      sessionOrg: session.organizationId,
      targetOrg: targetOrgId,
      message: `Server blocked Cross-Tenant Access: Authenticated as "${session.organizationCode}" (${session.organizationId}) — unauthorized to ${params.method} records belonging to "${targetOrgId}".`,
    };
  }

  // 5. Enforce Suspended / Closed Account Restrictions
  const orgRecord = SERVER_TENANT_STORE[targetOrgId];
  if (
    (orgRecord?.status === 'Suspended' || session.accountStatus === 'Suspended') &&
    params.method !== 'GET'
  ) {
    return {
      statusCode: 403,
      allowed: false,
      code: 'ACCOUNT_SUSPENDED_WRITE_BLOCKED',
      sessionOrg: session.organizationId,
      targetOrg: targetOrgId,
      message: `Server blocked write operation: Organization "${targetOrgId}" is currently Suspended (Read-Only Freeze).`,
    };
  }

  // 6. Enforce Campus-Level Scope Isolation
  if (params.endpoint === 'READ_CAMPUS_RECORDS' && params.targetCampusId) {
    const canAccessAllCampuses =
      session.role === 'platform_super_admin' ||
      session.role === 'school_client_admin' ||
      session.assignedCampusIds.includes('ALL');

    if (
      !canAccessAllCampuses &&
      !session.assignedCampusIds.includes(params.targetCampusId)
    ) {
      return {
        statusCode: 403,
        allowed: false,
        code: 'CAMPUS_SCOPE_ISOLATION_VIOLATION',
        sessionOrg: session.organizationId,
        targetOrg: targetOrgId,
        message: `Server blocked Campus Access: User "${session.email}" (${session.role}) is only assigned to [${session.assignedCampusIds.join(
          ', '
        )}] and cannot access campus "${params.targetCampusId}".`,
      };
    }
  }

  return {
    statusCode: 200,
    allowed: true,
    code: 'TENANT_ISOLATION_VERIFIED_OK',
    sessionOrg: session.organizationId,
    targetOrg: targetOrgId,
    message: `Authorized: Server verified session scope for "${session.organizationCode}" (${session.organizationId}).`,
    data: orgRecord?.vouchers || [],
  };
}

export function executeAutomatedServerIsolationTestSuite() {
  // 1. Issue real HMAC-signed tokens for Client A, Client B, Campus Admin, Suspended Client C, and Platform Super Admin
  const clientAToken = issueSignedTenantToken({
    userId: 'usr-client-a-admin',
    userName: 'Sir Nadeem (Client A Admin)',
    email: 'admin@aplusschool.edu.pk',
    role: 'school_client_admin',
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    assignedCampusIds: ['tcamp-aplus-main-1', 'tcamp-aplus-sub-1'],
    accountStatus: 'Active',
  });

  const clientACampus1AdminToken = issueSignedTenantToken({
    userId: 'usr-client-a-camp1',
    userName: 'Maqsood Ahmad (Campus 1 Admin)',
    email: 'maqsood@aplusschool.edu.pk',
    role: 'campus_admin',
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    assignedCampusIds: ['tcamp-aplus-main-1'], // Assigned ONLY to Main Campus 1, NOT Sub-Campus
    accountStatus: 'Active',
  });

  const suspendedClientCToken = issueSignedTenantToken({
    userId: 'usr-client-c-admin',
    userName: 'Prof. Usman Ghani (Suspended Client C)',
    email: 'accounts@alhudaacademy.org',
    role: 'school_client_admin',
    organizationId: 'inst-alhuda-academy',
    organizationCode: 'ORG-ALHUDA-003',
    assignedCampusIds: ['tcamp-alhuda-main-1'],
    accountStatus: 'Suspended',
  });

  const superAdminToken = issueSignedTenantToken({
    userId: 'usr-site-owner',
    userName: 'Site Owner / Platform Super Admin',
    email: 'bajwaahmedsaad345@gmail.com',
    role: 'platform_super_admin',
    organizationId: 'inst-aplus-main',
    organizationCode: 'PLATFORM-OWNER',
    assignedCampusIds: ['ALL'],
    accountStatus: 'Active',
  });

  const scenarios = [
    {
      id: 'ISO-01',
      name: 'Client A Authenticated Read of Own Records (Baseline)',
      actor: 'Client A Admin (ORG-APLUS-001)',
      target: 'GET /api/tenant/organizations/inst-aplus-main/records (Client A)',
      expectedStatus: 200,
      actual: evaluateServerTenantRequest({
        token: clientAToken,
        method: 'GET',
        endpoint: 'READ_ORG_RECORDS',
        targetOrganizationId: 'inst-aplus-main',
      }),
    },
    {
      id: 'ISO-02',
      name: 'Client A Attempting to Read Client B Financial Vouchers (Cross-Tenant Read Attack)',
      actor: 'Client A Admin (ORG-APLUS-001)',
      target: 'GET /api/tenant/organizations/inst-apex-college/records (Client B)',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: clientAToken,
        method: 'GET',
        endpoint: 'READ_ORG_RECORDS',
        targetOrganizationId: 'inst-apex-college',
      }),
    },
    {
      id: 'ISO-03',
      name: 'Client A Attempting to Post/Modify Voucher in Client B Ledger (Cross-Tenant Write Attack)',
      actor: 'Client A Admin (ORG-APLUS-001)',
      target: 'POST /api/tenant/organizations/inst-apex-college/vouchers (Client B)',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: clientAToken,
        method: 'POST',
        endpoint: 'WRITE_ORG_VOUCHER',
        targetOrganizationId: 'inst-apex-college',
      }),
    },
    {
      id: 'ISO-04',
      name: 'Client A Spoofing organizationId="inst-apex-college" in Request Body (Tenant ID Tampering)',
      actor: 'Client A Admin (ORG-APLUS-001)',
      target: 'POST /api/tenant/organizations/inst-aplus-main/vouchers (Body orgId=inst-apex-college)',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: clientAToken,
        method: 'POST',
        endpoint: 'WRITE_ORG_VOUCHER',
        targetOrganizationId: 'inst-aplus-main',
        spoofedBodyOrganizationId: 'inst-apex-college',
      }),
    },
    {
      id: 'ISO-05',
      name: 'Client A Attempting to Export Client B Financial Reports (Cross-Tenant Export Attack)',
      actor: 'Client A Admin (ORG-APLUS-001)',
      target: 'GET /api/tenant/organizations/inst-apex-college/export (Client B)',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: clientAToken,
        method: 'GET',
        endpoint: 'EXPORT_ORG_REPORTS',
        targetOrganizationId: 'inst-apex-college',
      }),
    },
    {
      id: 'ISO-06',
      name: 'Client A Attempting to Create Another Independent Client Organization',
      actor: 'Client A Admin (ORG-APLUS-001)',
      target: 'POST /api/tenant/organizations (Create Client Org)',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: clientAToken,
        method: 'POST',
        endpoint: 'CREATE_CLIENT_ORG',
      }),
    },
    {
      id: 'ISO-07',
      name: 'Client A Attempting Direct Access to /platform-admin API Endpoint',
      actor: 'Client A Admin (ORG-APLUS-001)',
      target: 'GET /api/tenant/platform-admin',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: clientAToken,
        method: 'GET',
        endpoint: 'ACCESS_PLATFORM_SUPER_ADMIN',
      }),
    },
    {
      id: 'ISO-08',
      name: 'Campus 1 Admin Attempting to Access Unassigned Sub-Campus Records',
      actor: 'Campus 1 Admin (Assigned only to CVT-MAIN)',
      target: 'GET /api/tenant/campuses/tcamp-aplus-sub-1/records (Unassigned Sub-Campus)',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: clientACampus1AdminToken,
        method: 'GET',
        endpoint: 'READ_CAMPUS_RECORDS',
        targetOrganizationId: 'inst-aplus-main',
        targetCampusId: 'tcamp-aplus-sub-1',
      }),
    },
    {
      id: 'ISO-09',
      name: 'Suspended Client Organization Attempting to Post New Voucher',
      actor: 'Client C Admin (ORG-ALHUDA-003 — Suspended)',
      target: 'POST /api/tenant/organizations/inst-alhuda-academy/vouchers',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: suspendedClientCToken,
        method: 'POST',
        endpoint: 'WRITE_ORG_VOUCHER',
        targetOrganizationId: 'inst-alhuda-academy',
      }),
    },
    {
      id: 'ISO-10',
      name: 'Site Owner / Super Admin Attempting to Delete a Financial Voucher Entry (Zero-Delete Policy)',
      actor: 'Site Owner (platform_super_admin)',
      target: 'DELETE /api/tenant/organizations/inst-aplus-main/vouchers/tx-client-a-001',
      expectedStatus: 403,
      actual: evaluateServerTenantRequest({
        token: superAdminToken,
        method: 'DELETE',
        endpoint: 'DELETE_VOUCHER_ENTRY',
        targetOrganizationId: 'inst-aplus-main',
      }),
    },
  ];

  const results = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    actor: s.actor,
    target: s.target,
    expectedStatus: s.expectedStatus,
    actualStatus: s.actual.statusCode,
    errorCode: s.actual.code,
    serverMessage: s.actual.message,
    passed: s.actual.statusCode === s.expectedStatus,
  }));

  return {
    executedAt: new Date().toISOString(),
    engine: 'Express Server-Side HMAC Session & Tenant Isolation Verifier',
    totalTests: results.length,
    passedCount: results.filter((r) => r.passed).length,
    failedCount: results.filter((r) => !r.passed).length,
    allPassed: results.every((r) => r.passed),
    results,
  };
}

export async function startAppServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json());

  // 1. Issue a signed session token for testing/verification
  app.post('/api/tenant/session', (req: Request, res: Response) => {
    const {
      userId = 'usr-client-a',
      userName = 'Client A Admin',
      email = 'admin@aplusschool.edu.pk',
      role = 'school_client_admin',
      organizationId = 'inst-aplus-main',
      organizationCode = 'ORG-APLUS-001',
      assignedCampusIds = ['tcamp-aplus-main-1'],
      accountStatus = 'Active',
    } = req.body || {};

    const token = issueSignedTenantToken({
      userId,
      userName,
      email,
      role,
      organizationId,
      organizationCode,
      assignedCampusIds,
      accountStatus,
    });

    res.status(200).json({ token, organizationId, role });
  });

  // 2. Protected Organization Records Endpoint (Server-Side Tenant Isolation)
  app.get('/api/tenant/organizations/:orgId/records', (req: Request, res: Response) => {
    const token =
      (req.headers['x-tenant-session-token'] as string) ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const decision = evaluateServerTenantRequest({
      token,
      method: 'GET',
      endpoint: 'READ_ORG_RECORDS',
      targetOrganizationId: String(req.params.orgId),
    });
    res.status(decision.statusCode).json(decision);
  });

  // 3. Protected Organization Voucher Write Endpoint (Blocks Cross-Tenant Writes & Spoofed Body Org IDs)
  app.post('/api/tenant/organizations/:orgId/vouchers', (req: Request, res: Response) => {
    const token =
      (req.headers['x-tenant-session-token'] as string) ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const decision = evaluateServerTenantRequest({
      token,
      method: 'POST',
      endpoint: 'WRITE_ORG_VOUCHER',
      targetOrganizationId: String(req.params.orgId),
      spoofedBodyOrganizationId: req.body?.organizationId,
    });
    res.status(decision.statusCode).json(decision);
  });

  // 3b. Protected Organization Settings Modification Endpoint (Blocks Cross-Tenant PUT)
  app.put('/api/tenant/organizations/:orgId/settings', (req: Request, res: Response) => {
    const token =
      (req.headers['x-tenant-session-token'] as string) ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const decision = evaluateServerTenantRequest({
      token,
      method: 'PUT',
      endpoint: 'WRITE_ORG_VOUCHER',
      targetOrganizationId: String(req.params.orgId),
      spoofedBodyOrganizationId: req.body?.organizationId,
    });
    res.status(decision.statusCode).json(decision);
  });

  // 3c. Protected Organization Financial Export Endpoint (Blocks Cross-Tenant GET Export)
  app.get('/api/tenant/organizations/:orgId/export', (req: Request, res: Response) => {
    const token =
      (req.headers['x-tenant-session-token'] as string) ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const decision = evaluateServerTenantRequest({
      token,
      method: 'GET',
      endpoint: 'EXPORT_ORG_REPORTS',
      targetOrganizationId: String(req.params.orgId),
    });
    res.status(decision.statusCode).json(decision);
  });

  // 4. Protected Delete Endpoint (Enforces Site Owner Non-Deletable Entry Policy)
  app.delete(
    '/api/tenant/organizations/:orgId/vouchers/:voucherId',
    (req: Request, res: Response) => {
      const token =
        (req.headers['x-tenant-session-token'] as string) ||
        req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const decision = evaluateServerTenantRequest({
        token,
        method: 'DELETE',
        endpoint: 'DELETE_VOUCHER_ENTRY',
        targetOrganizationId: String(req.params.orgId),
      });
      res.status(decision.statusCode).json(decision);
    }
  );

  // 5. Execute Full Automated Server-Side Cross-Tenant Isolation Test Suite
  app.post('/api/tenant/run-isolation-suite', (_req: Request, res: Response) => {
    const report = executeAutomatedServerIsolationTestSuite();
    res.status(200).json(report);
  });

  // 6. Server-Side Advanced Filtering & Multi-Column Sorting for School Clients
  app.post('/api/tenant/admin/query-clients', (req: Request, res: Response) => {
    const {
      clients = [],
      filters = {},
      sortRules = [],
    }: {
      clients: any[];
      filters: {
        search?: string;
        status?: string;
        plan?: string;
        city?: string;
      };
      sortRules: { column: string; direction: 'asc' | 'desc' }[];
    } = req.body || {};

    const q = String(filters.search || '').trim().toLowerCase();
    const filtered = (Array.isArray(clients) ? clients : []).filter((c) => {
      if (filters.status && filters.status !== 'ALL' && c.status !== filters.status) {
        return false;
      }
      if (
        filters.plan &&
        filters.plan !== 'ALL' &&
        c.subscriptionPlan !== filters.plan
      ) {
        return false;
      }
      if (
        filters.city &&
        filters.city !== 'ALL' &&
        String(c.city || '').toLowerCase() !== filters.city.toLowerCase()
      ) {
        return false;
      }
      if (q) {
        const hay = `${c.code || ''} ${c.name || ''} ${c.adminEmail || ''} ${
          c.ownerContactName || ''
        } ${c.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      for (const rule of Array.isArray(sortRules) ? sortRules : []) {
        const col = rule.column;
        const dir = rule.direction === 'desc' ? -1 : 1;
        const valA = a?.[col];
        const valB = b?.[col];
        if (valA === valB) continue;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * dir;
        }
        return (
          String(valA ?? '').localeCompare(String(valB ?? ''), undefined, {
            numeric: true,
            sensitivity: 'base',
          }) * dir
        );
      }
      return 0;
    });

    res.status(200).json({
      totalMatched: sorted.length,
      executedBy: 'Express Server-Side Multi-Column Query Engine',
      items: sorted,
    });
  });

  // 7. Server-Side Advanced Filtering & Multi-Column Sorting for Tenant Users
  app.post('/api/tenant/admin/query-users', (req: Request, res: Response) => {
    const {
      users = [],
      filters = {},
      sortRules = [],
    }: {
      users: any[];
      filters: {
        search?: string;
        organizationId?: string;
        role?: string;
        status?: string;
      };
      sortRules: { column: string; direction: 'asc' | 'desc' }[];
    } = req.body || {};

    const q = String(filters.search || '').trim().toLowerCase();
    const filtered = (Array.isArray(users) ? users : []).filter((u) => {
      if (
        filters.organizationId &&
        filters.organizationId !== 'ALL' &&
        u.organizationId !== filters.organizationId
      ) {
        return false;
      }
      if (filters.role && filters.role !== 'ALL' && u.role !== filters.role) {
        return false;
      }
      if (filters.status && filters.status !== 'ALL' && u.status !== filters.status) {
        return false;
      }
      if (q) {
        const hay = `${u.name || ''} ${u.email || ''} ${u.role || ''} ${
          u.organizationId || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      for (const rule of Array.isArray(sortRules) ? sortRules : []) {
        const col = rule.column;
        const dir = rule.direction === 'desc' ? -1 : 1;
        const valA = a?.[col];
        const valB = b?.[col];
        if (valA === valB) continue;
        return (
          String(valA ?? '').localeCompare(String(valB ?? ''), undefined, {
            numeric: true,
            sensitivity: 'base',
          }) * dir
        );
      }
      return 0;
    });

    res.status(200).json({
      totalMatched: sorted.length,
      executedBy: 'Express Server-Side Multi-Column Query Engine',
      items: sorted,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(
      `[Multi-Tenant Server] Listening on http://0.0.0.0:${port} (Server-Side Tenant Isolation Active)`
    );
  });
}

// Start server if invoked directly as main entry point
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename)
) {
  startAppServer();
}
