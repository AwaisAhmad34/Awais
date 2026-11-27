import React, { createContext, useContext, useMemo } from 'react';
import { useAccounting, Campus } from '../core/aplusEngine';
import { filterCampusesForUser } from '../services/multiTenantDataService';

export interface TenantAuthContextType {
  platformRole: 'super_admin' | 'campus_admin' | 'auditor' | 'accountant';
  activeCampusId: string | null;
  activeCampusNode: Campus | null;
  isSuperAdmin: boolean;
  isClientOwner: boolean;
  isCampusAdmin: boolean;
  authorizedCampuses: Campus[];
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
        isClientOwner: false,
        isCampusAdmin: false,
        authorizedCampuses: [],
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
    const isClientOwner = Boolean(
      !isSuper &&
        (currentUser?.role === 'level_2_client_super_admin' ||
          currentUser?.permissionLevel === 'level_2_client_super_admin' ||
          (currentUser?.clientId && roleLower.includes('client_super_admin')))
    );
    const isAuditorOrViewer =
      Boolean(currentUser?.readOnly) ||
      roleLower.includes('auditor') ||
      roleLower.includes('viewer');
    const isCampusAdminLevel =
      !isSuper &&
      !isClientOwner &&
      !isAuditorOrViewer &&
      (currentUser?.permissionLevel === 'level_3_main_campus_admin' ||
        currentUser?.permissionLevel === 'level_4_sub_campus_admin' ||
        currentUser?.role === 'campus_admin' ||
        currentUser?.role === 'level_3_main_campus_admin' ||
        currentUser?.role === 'level_4_sub_campus_admin' ||
        currentUser?.role === 'level_3_sub_campus_admin' ||
        roleLower === 'principal' ||
        roleLower === 'admin');

    const authorizedCampuses = filterCampusesForUser(campuses || [], currentUser);

    const role: TenantAuthContextType['platformRole'] = isSuper
      ? 'super_admin'
      : isAuditorOrViewer
      ? 'auditor'
      : isCampusAdminLevel || isClientOwner
      ? 'campus_admin'
      : 'accountant';

    const canSwitchOwnCampuses = isSuper || isClientOwner;

    const activeCampusId = canSwitchOwnCampuses
      ? currentCampusId === 'all'
        ? null
        : currentCampusId || currentUser?.campusId || authorizedCampuses[0]?.id || null
      : currentUser?.campusId || currentCampusId || null;

    const activeCampusNode = activeCampusId
      ? authorizedCampuses.find((c) => c.id === activeCampusId) ||
        campuses.find((c) => c.id === activeCampusId) ||
        null
      : null;

    const campusName = activeCampusNode
      ? activeCampusNode.name
      : currentCampusId === 'all'
      ? isClientOwner
        ? 'All Own Campuses (Consolidated)'
        : 'All Campuses (Consolidated)'
      : 'Selected Campus';

    return {
      platformRole: role,
      activeCampusId,
      activeCampusNode,
      isSuperAdmin: isSuper,
      isClientOwner,
      isCampusAdmin: !canSwitchOwnCampuses && role === 'campus_admin' && Boolean(activeCampusId),
      authorizedCampuses,
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
      isClientOwner: false,
      isCampusAdmin: false,
      authorizedCampuses: [],
      campusName: 'Authentication Required',
    };
  }
  return context;
}

