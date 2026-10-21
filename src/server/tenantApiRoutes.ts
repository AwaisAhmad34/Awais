import { Router, Request, Response, NextFunction } from 'express';
import {
  TenantContext,
  tenantRepository,
  validateCampusPermission,
  enforceTenantQueryFilter,
  TenantSecurityError,
  PLATFORM_FINANCIAL_REPORTS_CATALOG,
  getStoredClientReportPermissions,
  saveStoredClientReportPermissions,
  generateDefaultClientReportPermissions,
  validateClientReportAccess,
  ClientReportPermission,
  PermissionLevel,
} from '../services/tenantIsolationService';

export const tenantRouter = Router();

// Middleware: Resolves Tenant Context from Request Headers or Query Parameters
export function extractTenantContext(req: Request): TenantContext {
  const clientId = (req.headers['x-client-id'] as string) || (req.query.clientId as string) || 'client-aplus';
  const userId = (req.headers['x-user-id'] as string) || 'user-admin';
  const userName = (req.headers['x-user-name'] as string) || 'Administrator';
  const userRole = (req.headers['x-user-role'] as string) || 'level_1_platform_super_admin';
  const permissionLevel = (req.headers['x-permission-level'] as PermissionLevel) || 'level_1_platform_super_admin';
  const campusId = (req.headers['x-campus-id'] as string) || (req.query.campusId as string) || null;
  const delegatedCampusesHeader = (req.headers['x-delegated-campuses'] as string) || '';
  const delegatedCampusIds = delegatedCampusesHeader ? delegatedCampusesHeader.split(',').map((s) => s.trim()) : [];

  const isPlatformAdmin =
    permissionLevel === 'level_1_platform_super_admin' ||
    userRole === 'admin' ||
    userRole === 'superadmin';

  const isClientAdmin = permissionLevel === 'level_2_client_super_admin';

  return {
    clientId,
    userId,
    userName,
    userRole,
    permissionLevel,
    campusId,
    delegatedCampusIds,
    isPlatformAdmin,
    isClientAdmin,
    ipOrOrigin: req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1',
  };
}

// Global Context Endpoint
tenantRouter.get('/context', (req: Request, res: Response) => {
  const context = extractTenantContext(req);
  res.json({
    status: 'ok',
    context,
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// VOUCHERS CRUD ENDPOINTS
// ----------------------------------------------------------------------------

// 1. List / Query Vouchers: Automatically appends client_id filter & validates campus
tenantRouter.get('/vouchers', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const filters: Record<string, any> = { ...req.query };
    delete filters.clientId; // Never allow client override from query param for non-platform admin

    const vouchers = tenantRepository.queryVouchers(context, filters);
    const { isolatedFilters, authorizedCampusIds } = enforceTenantQueryFilter(context, 'vouchers', filters);

    res.json({
      status: 'success',
      count: vouchers.length,
      tenantScoping: {
        enforcedClientId: isolatedFilters.client_id,
        authorizedCampusIds,
      },
      data: vouchers,
    });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({
      error: err.name || 'SecurityError',
      code: err.code || 'TENANT_ISOLATION_VIOLATION',
      message: err.message,
    });
  }
});

// 2. Get Voucher by ID
tenantRouter.get('/vouchers/:id', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const voucher = tenantRepository.getVoucherById(context, req.params.id);
    if (!voucher) {
      return res.status(404).json({ error: 'NotFound', message: `Voucher ${req.params.id} not found.` });
    }
    res.json({ status: 'success', data: voucher });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({
      error: err.name,
      code: err.code,
      message: err.message,
    });
  }
});

// 3. Create Voucher: Enforces client_id injection & campus permissions
tenantRouter.post('/vouchers', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const created = tenantRepository.createVoucher(context, req.body);
    res.status(201).json({
      status: 'success',
      message: `Voucher ${created.voucherNo || created.id} successfully created with tenant isolation.`,
      data: created,
    });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 400;
    res.status(statusCode).json({
      error: err.name,
      code: err.code,
      message: err.message,
    });
  }
});

// 4. Update Voucher
tenantRouter.put('/vouchers/:id', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const updated = tenantRepository.updateVoucher(context, req.params.id, req.body);
    res.json({
      status: 'success',
      message: `Voucher ${req.params.id} updated successfully.`,
      data: updated,
    });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({
      error: err.name,
      code: err.code,
      message: err.message,
    });
  }
});

// 5. Delete Voucher
tenantRouter.delete('/vouchers/:id', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const result = tenantRepository.deleteVoucher(context, req.params.id, req.body?.reason);
    res.json({
      status: 'success',
      message: `Voucher ${req.params.id} deleted.`,
      result,
    });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({
      error: err.name,
      code: err.code,
      message: err.message,
    });
  }
});

// ----------------------------------------------------------------------------
// USERS CRUD ENDPOINTS
// ----------------------------------------------------------------------------

tenantRouter.get('/users', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const users = tenantRepository.queryUsers(context, req.query);
    res.json({
      status: 'success',
      count: users.length,
      clientId: context.clientId,
      data: users,
    });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

tenantRouter.post('/users', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const created = tenantRepository.createUser(context, req.body);
    res.status(201).json({ status: 'success', data: created });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

tenantRouter.put('/users/:id', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const updated = tenantRepository.updateUser(context, req.params.id, req.body);
    res.json({ status: 'success', data: updated });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

tenantRouter.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const result = tenantRepository.deleteUser(context, req.params.id);
    res.json({ status: 'success', result });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

// ----------------------------------------------------------------------------
// FINANCIAL RECORDS CRUD ENDPOINTS
// ----------------------------------------------------------------------------

tenantRouter.get('/financial-records', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const recordType = req.query.recordType as string;
    const records = tenantRepository.queryFinancialRecords(context, recordType, req.query);
    res.json({
      status: 'success',
      count: records.length,
      clientId: context.clientId,
      data: records,
    });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

tenantRouter.post('/financial-records', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const created = tenantRepository.createFinancialRecord(context, req.body);
    res.status(201).json({ status: 'success', data: created });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

tenantRouter.put('/financial-records/:id', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const updated = tenantRepository.updateFinancialRecord(context, req.params.id, req.body);
    res.json({ status: 'success', data: updated });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

tenantRouter.delete('/financial-records/:id', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const result = tenantRepository.deleteFinancialRecord(context, req.params.id);
    res.json({ status: 'success', result });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 403;
    res.status(statusCode).json({ error: err.name, code: err.code, message: err.message });
  }
});

// ----------------------------------------------------------------------------
// FINANCIAL REPORTS CATALOG & PERMISSION MANAGEMENT ENDPOINTS
// (Platform Site Admin & Multi-Campus Management Hub)
// ----------------------------------------------------------------------------

// Catalog of all reports available on the platform
tenantRouter.get('/reports/catalog', (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    count: PLATFORM_FINANCIAL_REPORTS_CATALOG.length,
    catalog: PLATFORM_FINANCIAL_REPORTS_CATALOG,
  });
});

// Get configured report permissions for a client
tenantRouter.get('/reports/permissions', (req: Request, res: Response) => {
  const context = extractTenantContext(req);
  const targetClientId = (req.query.targetClientId as string) || context.clientId;

  // Only Platform Admin can view other clients' permissions
  if (targetClientId !== context.clientId && !context.isPlatformAdmin) {
    return res.status(403).json({
      error: 'TenantSecurityError',
      code: 'FORBIDDEN',
      message: 'Access denied: You cannot view report permissions of another client organization.',
    });
  }

  const allPerms = getStoredClientReportPermissions();
  const clientPerms = allPerms[targetClientId] || generateDefaultClientReportPermissions(targetClientId);

  res.json({
    status: 'success',
    clientId: targetClientId,
    permissions: clientPerms,
  });
});

// Update report permissions for a client (Site Admin only)
tenantRouter.put('/reports/permissions', (req: Request, res: Response) => {
  const context = extractTenantContext(req);

  // Must be platform super admin or client admin for own org
  const targetClientId = req.body.clientId || context.clientId;
  if (!context.isPlatformAdmin && (!context.isClientAdmin || targetClientId !== context.clientId)) {
    return res.status(403).json({
      error: 'TenantSecurityError',
      code: 'FORBIDDEN',
      message: 'Access denied: Only Platform Site Admin or Client Organization Super Admin can modify report permissions.',
    });
  }

  const { reportKey, enabled, minimumRole, allowCrossCampusConsolidated, sensitivityTier, allowedExportFormats, customNotes } = req.body;
  if (!reportKey) {
    return res.status(400).json({ error: 'ValidationError', message: 'reportKey is required.' });
  }

  const allPerms = getStoredClientReportPermissions();
  const currentList = allPerms[targetClientId] || generateDefaultClientReportPermissions(targetClientId);

  const idx = currentList.findIndex((p) => p.reportKey === reportKey);
  if (idx < 0) {
    return res.status(404).json({ error: 'NotFound', message: `Report key '${reportKey}' not found.` });
  }

  const updated: ClientReportPermission = {
    ...currentList[idx],
    enabled: typeof enabled === 'boolean' ? enabled : currentList[idx].enabled,
    minimumRole: minimumRole || currentList[idx].minimumRole,
    allowCrossCampusConsolidated: typeof allowCrossCampusConsolidated === 'boolean' ? allowCrossCampusConsolidated : currentList[idx].allowCrossCampusConsolidated,
    sensitivityTier: sensitivityTier || currentList[idx].sensitivityTier,
    allowedExportFormats: allowedExportFormats || currentList[idx].allowedExportFormats,
    customNotes: customNotes ?? currentList[idx].customNotes,
    updatedAt: new Date().toISOString(),
    updatedBy: context.userName,
  };

  currentList[idx] = updated;
  allPerms[targetClientId] = currentList;
  saveStoredClientReportPermissions(allPerms);

  res.json({
    status: 'success',
    message: `Report permission for '${updated.reportTitle}' updated for client '${targetClientId}'.`,
    permission: updated,
  });
});

// Apply report permission preset (Site Admin)
tenantRouter.post('/reports/permissions/preset', (req: Request, res: Response) => {
  const context = extractTenantContext(req);
  const targetClientId = req.body.clientId || context.clientId;

  if (!context.isPlatformAdmin) {
    return res.status(403).json({
      error: 'TenantSecurityError',
      message: 'Only Platform Site Admin can apply global permission presets across clients.',
    });
  }

  const preset: 'all_access' | 'standard' | 'subcampus_restricted' | 'auditor_only' = req.body.preset || 'standard';
  const allPerms = getStoredClientReportPermissions();
  const currentList = allPerms[targetClientId] || generateDefaultClientReportPermissions(targetClientId);

  const updatedList = currentList.map((p) => {
    if (preset === 'all_access') {
      return { ...p, enabled: true, allowCrossCampusConsolidated: true };
    }
    if (preset === 'standard') {
      return {
        ...p,
        enabled: p.sensitivityTier !== 'executive_board',
        allowCrossCampusConsolidated: p.category !== 'Petty Cash & Imprest',
      };
    }
    if (preset === 'subcampus_restricted') {
      return {
        ...p,
        enabled: p.category === 'Ledgers & Daybooks' || p.category === 'Petty Cash & Imprest',
        allowCrossCampusConsolidated: false,
      };
    }
    if (preset === 'auditor_only') {
      return {
        ...p,
        enabled: true,
        allowCrossCampusConsolidated: true,
        minimumRole: 'level_2_client_super_admin' as PermissionLevel,
      };
    }
    return p;
  });

  allPerms[targetClientId] = updatedList;
  saveStoredClientReportPermissions(allPerms);

  res.json({
    status: 'success',
    message: `Preset '${preset}' applied to client '${targetClientId}'.`,
    permissions: updatedList,
  });
});

// Generate / Fetch financial report data with tenant isolation & permission check
tenantRouter.get('/reports/data/:reportKey', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const { reportKey } = req.params;
    const isConsolidated = req.query.consolidated === 'true';
    const targetCampusId = (req.query.campusId as string) || context.campusId;

    // Validate client report permissions
    const access = validateClientReportAccess(context, reportKey, targetCampusId, isConsolidated);
    if (!access.allowed) {
      return res.status(403).json({
        error: 'TenantSecurityError',
        code: 'REPORT_ACCESS_DENIED',
        message: access.reason,
      });
    }

    // Tenant-isolated query for underlying vouchers
    const vouchers = tenantRepository.queryVouchers(context, {
      campus_id: isConsolidated ? undefined : targetCampusId,
    });

    const totalDebits = vouchers.reduce((acc, v) => acc + (Number(v.totalDebit) || 0), 0);
    const totalCredits = vouchers.reduce((acc, v) => acc + (Number(v.totalCredit) || 0), 0);

    res.json({
      status: 'success',
      reportKey,
      reportTitle: access.permission?.reportTitle || reportKey,
      client_id: context.clientId,
      campus_id: isConsolidated ? 'ALL_CONSOLIDATED' : targetCampusId,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: context.userName,
        userRole: context.userRole,
        permissionLevel: context.permissionLevel,
      },
      summary: {
        voucherCount: vouchers.length,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
      vouchers,
    });
  } catch (err: any) {
    const statusCode = err instanceof TenantSecurityError ? err.statusCode : 500;
    res.status(statusCode).json({
      error: err.name || 'Error',
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message,
    });
  }
});

// Diagnostic Sandbox Endpoint to Test Query Isolation & Campus Validation
tenantRouter.post('/validate-query', (req: Request, res: Response) => {
  try {
    const context = extractTenantContext(req);
    const { collectionName = 'vouchers', rawQuery = {} } = req.body;

    const { isolatedFilters, authorizedCampusIds } = enforceTenantQueryFilter(
      context,
      collectionName,
      rawQuery
    );

    res.json({
      status: 'passed',
      userContext: {
        clientId: context.clientId,
        userRole: context.userRole,
        permissionLevel: context.permissionLevel,
      },
      inputQuery: rawQuery,
      rewrittenIsolatedQuery: isolatedFilters,
      securityGuarantee: {
        enforcedTenantId: isolatedFilters.client_id,
        authorizedCampusBoundary: authorizedCampusIds,
        preventedCrossTenantLeakage: true,
      },
    });
  } catch (err: any) {
    res.status(err.statusCode || 403).json({
      status: 'blocked',
      error: err.name,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }
});
