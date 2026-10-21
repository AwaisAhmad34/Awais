import type { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminDatabase } from './adminFirebase';
import type { TenantContext, PermissionLevel } from '../services/tenantIsolationService';

const levels: PermissionLevel[] = [
  'level_1_platform_super_admin', 'level_2_client_super_admin',
  'level_3_main_campus_admin', 'level_4_sub_campus_admin', 'level_5_departmental_staff',
];
export function contextFromMembership(uid: string, membership: any): TenantContext {
  if (!membership || membership.status !== 'active' || !levels.includes(membership.permissionLevel)) {
    throw Object.assign(new Error('Account membership is inactive or invalid.'), { statusCode: 403 });
  }
  const level = membership.permissionLevel as PermissionLevel;
  const platform = level === levels[0];
  if (!platform && (typeof membership.clientId !== 'string' || !membership.clientId)) {
    throw Object.assign(new Error('Organization membership is required.'), { statusCode: 403 });
  }
  return {
    userId: uid, userName: membership.name || uid, userRole: level, permissionLevel: level,
    clientId: membership.clientId || '', campusId: membership.campusId || null,
    delegatedCampusIds: Array.isArray(membership.delegatedCampusIds) ? membership.delegatedCampusIds : [],
    isPlatformAdmin: platform, isClientAdmin: level === levels[1],
  };
}
export async function requireAuthentication(req: Request, res: Response, next: NextFunction) {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'AuthenticationRequired' });
  try {
    const app = adminApp();
    const token = await getAuth(app).verifyIdToken(match[1], true);
    const membership = await adminDatabase()
      .collection('memberships').doc(token.uid).get();
    res.locals.tenantContext = contextFromMembership(token.uid, membership.data());
    next();
  } catch (error: any) {
    const configurationError = !error?.code?.startsWith('auth/') && !error?.statusCode;
    res.status(error.statusCode || (configurationError ? 503 : 401)).json({
      error: configurationError ? 'AuthenticationServiceUnavailable' : 'AccessDenied',
    });
  }
}
