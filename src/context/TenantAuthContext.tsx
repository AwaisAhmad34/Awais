import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAccounting } from '../core/aplusEngine';
import {
  getStoredMultiSchoolRegistry,
  subscribeMultiSchoolRegistry,
  saveStoredMultiSchoolRegistry,
  MultiSchoolRegistryState,
  PlatformRoleType,
  SchoolInstituteAccount,
} from '../components/MultiSchoolAdminPanel';

export interface TenantPermissionScope {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  organizationStatus: SchoolInstituteAccount['status'];
  platformRole: PlatformRoleType;
  assignedCampusIds: string[];
  canAccessPlatformSuperAdmin: boolean;
  canAccessSchoolClientAdmin: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
  canDeactivate: boolean;
  canDeleteEntries: false; // Enforced non-deletable entry policy
  allowedModules: {
    allowVoucherPosting: boolean;
    allowPettyCash: boolean;
    allowModernErp: boolean;
    allowRecurringVouchers: boolean;
    allowReportExports: boolean;
  };
}

export interface TenantAuthContextValue {
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  platformRole: PlatformRoleType;
  assignedCampusIds: string[];
  permissionScope: TenantPermissionScope;
  serverSessionToken: string | null;
  activeOrganization: SchoolInstituteAccount;
  setPlatformRole: (role: PlatformRoleType) => void;
  switchOrganizationScope: (organizationId: string) => void;
  assertTenantAccess: (targetOrganizationId: string, targetCampusId?: string) => {
    allowed: boolean;
    reason?: string;
  };
  filterRecordsByTenantScope: <
    T extends { organizationId?: string; campusId?: string }
  >(
    records: T[]
  ) => T[];
}

const TenantAuthContext = createContext<TenantAuthContextValue | null>(null);

function useSafeAccountingAuth(): { currentUser: any; isSuperAdmin: boolean } {
  try {
    const acc = useAccounting();
    return {
      currentUser: acc?.currentUser ?? null,
      isSuperAdmin: Boolean(acc?.isSuperAdmin),
    };
  } catch {
    return {
      currentUser: {
        id: 'usr-fallback-superadmin',
        name: 'Site Owner / Super Admin',
        email: 'bajwaahmedsaad345@gmail.com',
        role: 'superadmin',
      },
      isSuperAdmin: true,
    };
  }
}

export const TenantAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser, isSuperAdmin } = useSafeAccountingAuth();
  const [registry, setRegistry] = useState<MultiSchoolRegistryState>(() =>
    getStoredMultiSchoolRegistry()
  );
  const [serverSessionToken, setServerSessionToken] = useState<string | null>(
    null
  );

  useEffect(() => {
    return subscribeMultiSchoolRegistry(setRegistry);
  }, []);

  const activeOrganization = useMemo(() => {
    return (
      registry.institutes.find((i) => i.id === registry.activeInstituteId) ||
      registry.institutes[0]
    );
  }, [registry]);

  const matchedTenantUser = useMemo(() => {
    if (!currentUser?.email) return null;
    return (
      registry.tenantUsers.find(
        (u) =>
          u.email.toLowerCase() === String(currentUser.email).toLowerCase() &&
          (u.organizationId === activeOrganization.id ||
            u.role === 'platform_super_admin')
      ) || null
    );
  }, [registry.tenantUsers, currentUser, activeOrganization]);

  const effectivePlatformRole: PlatformRoleType = useMemo(() => {
    if (!currentUser) return 'viewer';
    const selectedRole = registry.currentPlatformRole || 'platform_super_admin';
    if (isSuperAdmin) {
      return selectedRole;
    }
    if (matchedTenantUser) {
      return matchedTenantUser.role;
    }
    const rawRole = String(currentUser.role || '').toLowerCase();
    if (rawRole === 'superadmin') return 'platform_super_admin';
    if (rawRole === 'admin' || rawRole === 'approver') return 'school_client_admin';
    return 'accountant';
  }, [currentUser, isSuperAdmin, registry.currentPlatformRole, matchedTenantUser]);

  const assignedCampusIds = useMemo(() => {
    if (
      effectivePlatformRole === 'platform_super_admin' ||
      effectivePlatformRole === 'school_client_admin'
    ) {
      return ['ALL'];
    }
    if (matchedTenantUser?.assignedCampusIds?.length) {
      return matchedTenantUser.assignedCampusIds;
    }
    return registry.tenantCampuses
      .filter((c) => c.organizationId === activeOrganization.id && c.campusLoginEnabled)
      .map((c) => c.id);
  }, [effectivePlatformRole, matchedTenantUser, registry.tenantCampuses, activeOrganization]);

  const permissionScope: TenantPermissionScope = useMemo(() => {
    const isOperational = activeOrganization.status === 'Active';
    const isPlatformOwner = effectivePlatformRole === 'platform_super_admin';
    const isClientAdmin = effectivePlatformRole === 'school_client_admin';
    const isViewer = effectivePlatformRole === 'viewer';

    return {
      organizationId: activeOrganization.id,
      organizationCode: activeOrganization.code,
      organizationName: activeOrganization.name,
      organizationStatus: activeOrganization.status,
      platformRole: effectivePlatformRole,
      assignedCampusIds,
      canAccessPlatformSuperAdmin: Boolean(isSuperAdmin && isPlatformOwner),
      canAccessSchoolClientAdmin: Boolean(isClientAdmin),
      canView: true,
      // Site Owner (platform_super_admin) CANNOT create any voucher, petty cash, or ledger entry
      canCreate: isOperational && !isViewer && !isPlatformOwner,
      canEdit: isOperational && !isViewer && !isPlatformOwner,
      canApprove:
        isOperational &&
        (isClientAdmin ||
          effectivePlatformRole === 'campus_admin' ||
          effectivePlatformRole === 'principal'),
      canExport:
        activeOrganization.permissions?.allowReportExports !== false,
      canDeactivate: isPlatformOwner || isClientAdmin,
      canDeleteEntries: false,
      allowedModules: {
        allowVoucherPosting:
          isOperational &&
          !isPlatformOwner &&
          activeOrganization.permissions?.allowVoucherPosting !== false,
        allowPettyCash:
          isOperational &&
          !isPlatformOwner &&
          activeOrganization.permissions?.allowPettyCash !== false,
        allowModernErp:
          activeOrganization.permissions?.allowModernErp !== false,
        allowRecurringVouchers:
          isOperational &&
          !isPlatformOwner &&
          activeOrganization.permissions?.allowRecurringVouchers !== false,
        allowReportExports:
          activeOrganization.permissions?.allowReportExports !== false,
      },
    };
  }, [activeOrganization, effectivePlatformRole, assignedCampusIds, isSuperAdmin]);

  // Synchronize server-side HMAC session token whenever organizationId or role changes
  useEffect(() => {
    let cancelled = false;
    fetch('/api/tenant/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser?.id || 'usr-active',
        userName: currentUser?.name || 'Active User',
        email: currentUser?.email || activeOrganization.adminEmail,
        role:
          effectivePlatformRole === 'platform_super_admin' ||
          effectivePlatformRole === 'school_client_admin' ||
          effectivePlatformRole === 'campus_admin' ||
          effectivePlatformRole === 'accountant' ||
          effectivePlatformRole === 'viewer'
            ? effectivePlatformRole
            : 'accountant',
        organizationId: activeOrganization.id,
        organizationCode: activeOrganization.code,
        assignedCampusIds,
        accountStatus:
          activeOrganization.status === 'Active'
            ? 'Active'
            : activeOrganization.status === 'Closed'
            ? 'Closed'
            : 'Suspended',
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.token) {
          setServerSessionToken(data.token);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    currentUser?.id,
    currentUser?.name,
    currentUser?.email,
    effectivePlatformRole,
    activeOrganization.id,
    activeOrganization.code,
    activeOrganization.status,
    activeOrganization.adminEmail,
    assignedCampusIds,
  ]);

  const setPlatformRole = (role: PlatformRoleType) => {
    const next = { ...registry, currentPlatformRole: role };
    setRegistry(next);
    saveStoredMultiSchoolRegistry(next);
  };

  const switchOrganizationScope = (organizationId: string) => {
    const target = registry.institutes.find((i) => i.id === organizationId);
    if (!target) return;
    const next = { ...registry, activeInstituteId: target.id };
    setRegistry(next);
    saveStoredMultiSchoolRegistry(next);
  };

  const assertTenantAccess = (
    targetOrganizationId: string,
    targetCampusId?: string
  ): { allowed: boolean; reason?: string } => {
    if (effectivePlatformRole === 'platform_super_admin') {
      return { allowed: true };
    }
    if (targetOrganizationId !== activeOrganization.id) {
      return {
        allowed: false,
        reason: `Cross-Tenant Access Blocked: Active session is scoped to ${activeOrganization.code} (${activeOrganization.id}) and cannot access ${targetOrganizationId}.`,
      };
    }
    if (
      targetCampusId &&
      !assignedCampusIds.includes('ALL') &&
      !assignedCampusIds.includes(targetCampusId)
    ) {
      return {
        allowed: false,
        reason: `Campus Scope Blocked: User is not assigned to campus ${targetCampusId}.`,
      };
    }
    return { allowed: true };
  };

  const filterRecordsByTenantScope = <
    T extends { organizationId?: string; campusId?: string }
  >(
    records: T[]
  ): T[] => {
    return records.filter((rec) => {
      if (
        rec.organizationId &&
        rec.organizationId !== activeOrganization.id &&
        effectivePlatformRole !== 'platform_super_admin'
      ) {
        return false;
      }
      if (
        rec.campusId &&
        !assignedCampusIds.includes('ALL') &&
        !assignedCampusIds.includes(rec.campusId)
      ) {
        return false;
      }
      return true;
    });
  };

  const value: TenantAuthContextValue = {
    userId: currentUser?.id || 'usr-anonymous',
    userName: currentUser?.name || 'User',
    userEmail: currentUser?.email || activeOrganization.adminEmail,
    organizationId: activeOrganization.id,
    organizationCode: activeOrganization.code,
    organizationName: activeOrganization.name,
    platformRole: effectivePlatformRole,
    assignedCampusIds,
    permissionScope,
    serverSessionToken,
    activeOrganization,
    setPlatformRole,
    switchOrganizationScope,
    assertTenantAccess,
    filterRecordsByTenantScope,
  };

  return (
    <TenantAuthContext.Provider value={value}>
      {children}
    </TenantAuthContext.Provider>
  );
};

export function useTenantAuth(): TenantAuthContextValue {
  const ctx = useContext(TenantAuthContext);
  if (!ctx) {
    const reg = getStoredMultiSchoolRegistry();
    const org =
      reg.institutes.find((i) => i.id === reg.activeInstituteId) ||
      reg.institutes[0];
    return {
      userId: 'usr-default',
      userName: 'Platform User',
      userEmail: org.adminEmail,
      organizationId: org.id,
      organizationCode: org.code,
      organizationName: org.name,
      platformRole: reg.currentPlatformRole || 'platform_super_admin',
      assignedCampusIds: ['ALL'],
      permissionScope: {
        organizationId: org.id,
        organizationCode: org.code,
        organizationName: org.name,
        organizationStatus: org.status,
        platformRole: reg.currentPlatformRole || 'platform_super_admin',
        assignedCampusIds: ['ALL'],
        canAccessPlatformSuperAdmin:
          (reg.currentPlatformRole || 'platform_super_admin') ===
          'platform_super_admin',
        canAccessSchoolClientAdmin:
          reg.currentPlatformRole === 'school_client_admin',
        canView: true,
        canCreate: org.status === 'Active',
        canEdit: org.status === 'Active',
        canApprove: org.status === 'Active',
        canExport: true,
        canDeactivate: true,
        canDeleteEntries: false,
        allowedModules: {
          allowVoucherPosting: org.permissions?.allowVoucherPosting ?? true,
          allowPettyCash: org.permissions?.allowPettyCash ?? true,
          allowModernErp: org.permissions?.allowModernErp ?? true,
          allowRecurringVouchers: org.permissions?.allowRecurringVouchers ?? true,
          allowReportExports: org.permissions?.allowReportExports ?? true,
        },
      },
      serverSessionToken: null,
      activeOrganization: org,
      setPlatformRole: () => {},
      switchOrganizationScope: () => {},
      assertTenantAccess: (targetOrgId: string) => ({
        allowed:
          reg.currentPlatformRole === 'platform_super_admin' ||
          targetOrgId === org.id,
      }),
      filterRecordsByTenantScope: (records) => records,
    };
  }
  return ctx;
}
