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
    const isSuper = Boolean(isSuperAdmin || currentUser?.isSuperAdmin || currentUser?.role === 'super_admin');
    const role: TenantAuthContextType['platformRole'] = isSuper
      ? 'super_admin'
      : (currentUser?.role === 'campus_admin' || currentUser?.campusId)
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
  if (!context) throw new Error('TenantAuthProvider is required for tenant-aware reports.');
  return context;
}
