import React, { createContext, useContext, useMemo } from 'react';
import { useAccounting, Campus } from '../core/aplusEngine';

export interface TenantAuthContextType {
  platformRole: 'super_admin' | 'campus_admin' | 'auditor' | 'accountant';
  activeCampusId: string | null;
  activeCampusNode: Campus | null;
  isSuperAdmin: boolean;
  isCampusAdmin: boolean;
  campusName: string;
}

const TenantAuthContext = createContext<TenantAuthContextType | undefined>(undefined);

export const TenantAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isSuperAdmin, currentCampusId, campuses } = useAccounting();

  const value = useMemo<TenantAuthContextType>(() => {
    if (!currentUser) {
      return {
        platformRole: 'accountant',
        activeCampusId: null,
        activeCampusNode: null,
        isSuperAdmin: false,
        isCampusAdmin: false,
        campusName: 'Authentication Required',
      };
    }

    const isSuper = Boolean(
      isSuperAdmin ||
        currentUser?.isSuperAdmin ||
        currentUser?.role === 'super_admin' ||
        currentUser?.role === 'level_1_platform_super_admin' ||
        currentUser?.permissionLevel === 'level_1_platform_super_admin'
    );
    const roleLower = String(currentUser?.role || currentUser?.departmentalRole || '').toLowerCase();
    const isAuditorOrViewer =
      Boolean(currentUser?.readOnly) ||
      roleLower.includes('auditor') ||
      roleLower.includes('viewer');
    const isCampusAdminLevel =
      !isSuper &&
      !isAuditorOrViewer &&
      (currentUser?.permissionLevel === 'level_2_client_super_admin' ||
        currentUser?.permissionLevel === 'level_3_main_campus_admin' ||
        currentUser?.permissionLevel === 'level_4_sub_campus_admin' ||
        currentUser?.role === 'campus_admin' ||
        currentUser?.role === 'level_2_client_super_admin' ||
        currentUser?.role === 'level_3_main_campus_admin' ||
        currentUser?.role === 'level_4_sub_campus_admin' ||
        currentUser?.role === 'level_3_sub_campus_admin' ||
        roleLower === 'principal' ||
        roleLower === 'admin');

    const role: TenantAuthContextType['platformRole'] = isSuper
      ? 'super_admin'
      : isAuditorOrViewer
      ? 'auditor'
      : isCampusAdminLevel
      ? 'campus_admin'
      : 'accountant';

    const activeCampusId = isSuper
      ? currentCampusId === 'all'
        ? null
        : currentCampusId
      : currentUser?.campusId || currentCampusId || null;

    const activeCampusNode = activeCampusId
      ? campuses.find((c) => c.id === activeCampusId) || null
      : null;

    const campusName = activeCampusNode
      ? activeCampusNode.name
      : currentCampusId === 'all'
      ? 'All Campuses (Consolidated)'
      : 'Selected Campus';

    return {
      platformRole: role,
      activeCampusId,
      activeCampusNode,
      isSuperAdmin: isSuper,
      isCampusAdmin: role === 'campus_admin' && Boolean(activeCampusId),
      campusName,
    };
  }, [currentUser, isSuperAdmin, currentCampusId, campuses]);

  return (
    <TenantAuthContext.Provider value={value}>
      {children}
    </TenantAuthContext.Provider>
  );
};

export function useTenantAuth(): TenantAuthContextType {
  const context = useContext(TenantAuthContext);
  if (!context) {
    return {
      platformRole: 'accountant',
      activeCampusId: null,
      activeCampusNode: null,
      isSuperAdmin: false,
      isCampusAdmin: false,
      campusName: 'Authentication Required',
    };
  }
  return context;
}

