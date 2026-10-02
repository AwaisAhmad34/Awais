import React, { useEffect, useState } from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import {
  PlatformRoleType,
  MultiSchoolRegistryState,
  getStoredMultiSchoolRegistry,
  subscribeMultiSchoolRegistry,
  saveStoredMultiSchoolRegistry,
} from './MultiSchoolAdminPanel';

export type ProtectedEntryPoint =
  | 'platform_super_admin'
  | 'school_client_admin'
  | 'any_admin_dashboard'
  | 'campus_management'
  | 'voucher_approval';

/**
 * Evaluates whether the active user & platform role is authorized for a given
 * navigation entry point or dashboard route.
 */
export function evaluateNavigationPermission(
  entryPoint: ProtectedEntryPoint,
  registry: MultiSchoolRegistryState,
  isEngineSuperAdmin: boolean,
  engineUserRole?: string
): boolean {
  const platformRole: PlatformRoleType =
    registry?.currentPlatformRole || 'platform_super_admin';

  switch (entryPoint) {
    case 'platform_super_admin':
      // Strictly requires BOTH verified engine super-admin privileges AND platform_super_admin role
      return Boolean(isEngineSuperAdmin && platformRole === 'platform_super_admin');

    case 'school_client_admin':
      // Visible to verified School Client Admin (or Platform Super Admin inspecting client admin view)
      return (
        platformRole === 'school_client_admin' &&
        (isEngineSuperAdmin ||
          engineUserRole === 'SuperAdmin' ||
          engineUserRole === 'Approver' ||
          engineUserRole === 'Admin')
      );

    case 'any_admin_dashboard':
      // Either Platform Super Admin OR School Client Admin; hidden from Accountant, Cashier, Teacher, Viewer, etc.
      return (
        (isEngineSuperAdmin && platformRole === 'platform_super_admin') ||
        platformRole === 'school_client_admin'
      );

    case 'campus_management':
      return (
        platformRole === 'platform_super_admin' ||
        platformRole === 'school_client_admin' ||
        platformRole === 'campus_admin'
      );

    case 'voucher_approval':
      return (
        platformRole === 'platform_super_admin' ||
        platformRole === 'school_client_admin' ||
        platformRole === 'campus_admin' ||
        platformRole === 'principal'
      );

    default:
      return false;
  }
}

export interface NavigationPermissionGuardProps {
  /**
   * Which protected dashboard or navigation entry point is being guarded
   */
  entryPoint: ProtectedEntryPoint;
  /**
   * Optional fallback element when the user's role is not authorized (defaults to null so nav item is hidden)
   */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Permission-check wrapper for main navigation components.
 * Ensures only authorized roles can see the Platform Super Admin and School Client Admin
 * dashboard entry points in the navigation bar.
 */
export const NavigationPermissionGuard: React.FC<NavigationPermissionGuardProps> = ({
  entryPoint,
  fallback = null,
  children,
}) => {
  const { isSuperAdmin, currentUser } = useAccounting();
  const [registry, setRegistry] = useState<MultiSchoolRegistryState>(() =>
    getStoredMultiSchoolRegistry()
  );

  useEffect(() => {
    return subscribeMultiSchoolRegistry(setRegistry);
  }, []);

  const isAuthorized = evaluateNavigationPermission(
    entryPoint,
    registry,
    Boolean(isSuperAdmin),
    currentUser?.role
  );

  if (!isAuthorized) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Route-level permission wrapper for the Admin Dashboard view.
 * Prevents unauthorized roles (e.g., Accountant, Cashier, Teacher, Viewer) from accessing
 * the Platform Super Admin or School Client Admin dashboards via direct navigation.
 */
export const ProtectedAdminRouteWrapper: React.FC<{
  onReturnToDashboard?: () => void;
  children: React.ReactNode;
}> = ({ onReturnToDashboard, children }) => {
  const { isSuperAdmin, currentUser } = useAccounting();
  const [registry, setRegistry] = useState<MultiSchoolRegistryState>(() =>
    getStoredMultiSchoolRegistry()
  );

  useEffect(() => {
    return subscribeMultiSchoolRegistry(setRegistry);
  }, []);

  const canAccessAdminDashboard = evaluateNavigationPermission(
    'any_admin_dashboard',
    registry,
    Boolean(isSuperAdmin),
    currentUser?.role
  );

  if (!canAccessAdminDashboard) {
    return (
      <div className="max-w-2xl mx-auto my-10 p-6 bg-white rounded-2xl border-2 border-rose-500 shadow-lg text-center space-y-4 text-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-rose-600">
            403 Access Denied · Role Permission Guard Enforced
          </div>
          <h2 className="text-base font-black text-slate-900">
            Unauthorized Role for Admin Dashboard Entry Point
          </h2>
          <p className="text-slate-600">
            Your active session role (
            <strong className="font-mono text-rose-700">
              {registry.currentPlatformRole}
            </strong>
            ) is not permitted to view or access the{' '}
            <strong>Platform Super Admin</strong> or{' '}
            <strong>School Client Admin</strong> dashboards.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {onReturnToDashboard && (
            <button
              type="button"
              onClick={onReturnToDashboard}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Accounting Dashboard</span>
            </button>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                const next = {
                  ...registry,
                  currentPlatformRole: 'platform_super_admin' as PlatformRoleType,
                };
                setRegistry(next);
                saveStoredMultiSchoolRegistry(next);
              }}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer"
            >
              Restore Platform Super Admin Session
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
