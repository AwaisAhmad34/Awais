import type { Campus } from '../core/aplusEngine';
import {
  getStoredSchoolClients,
  type SchoolClientOrganization,
} from '../services/platformSiteAdminService';

export type CampusWithBrand = Campus & {
  logoType?: string;
  logoBase64?: string;
  logoCustomUrl?: string;
};

export interface ResolvedOrganizationBrand {
  clientId?: string;
  name: string;
  code?: string;
  logoUrl?: string;
}

export function resolveOrganizationBrand(params: {
  currentUser?: any;
  campus?: CampusWithBrand | null;
  campuses?: CampusWithBrand[];
  currentCampusId?: string;
  orgSettings?: {
    schoolName?: string;
    schoolLogo?: string;
    logoType?: string;
    logoBase64?: string;
    logoCustomUrl?: string;
  } | null;
  clients?: SchoolClientOrganization[];
}): ResolvedOrganizationBrand {
  const {
    currentUser,
    campus,
    campuses = [],
    currentCampusId,
    orgSettings,
    clients,
  } = params;

  const activeCampus =
    campus ||
    (currentCampusId && currentCampusId !== 'all'
      ? campuses.find((c) => c.id === currentCampusId)
      : undefined) ||
    (currentUser?.campusId
      ? campuses.find((c) => c.id === currentUser.campusId)
      : undefined);

  const clientList = clients || getStoredSchoolClients();
  const targetClientId =
    activeCampus?.clientId ||
    currentUser?.clientId ||
    campuses.find((c) => c.clientId)?.clientId;

  const matchedClient = targetClientId
    ? clientList.find((c) => c.id === targetClientId)
    : undefined;

  const rawSettingsName = String(orgSettings?.schoolName || '').trim();
  const rawUserOrgName = String(
    currentUser?.organizationName || currentUser?.clientName || ''
  ).trim();
  const clientName = String(matchedClient?.name || '').trim();

  const isDefaultName = (v: string) =>
    !v ||
    v.toLowerCase() === 'a+ school system' ||
    v.toLowerCase() === 'aplus school system';

  const resolvedName =
    (clientName && (!isDefaultName(clientName) || isDefaultName(rawSettingsName)))
      ? clientName
      : (!isDefaultName(rawUserOrgName) ? rawUserOrgName : '') ||
        (!isDefaultName(rawSettingsName) ? rawSettingsName : '') ||
        clientName ||
        rawSettingsName ||
        'A+ School System';

  const campusLogo =
    activeCampus?.logoType === 'upload' && activeCampus.logoBase64
      ? activeCampus.logoBase64
      : activeCampus?.logoType === 'url' && activeCampus.logoCustomUrl
      ? activeCampus.logoCustomUrl
      : undefined;

  const settingsLogo =
    orgSettings?.logoType === 'upload' && orgSettings.logoBase64
      ? orgSettings.logoBase64
      : orgSettings?.logoType === 'url' && orgSettings.logoCustomUrl
      ? orgSettings.logoCustomUrl
      : orgSettings?.schoolLogo || orgSettings?.logoBase64 || orgSettings?.logoCustomUrl;

  const resolvedLogoUrl =
    campusLogo || matchedClient?.logoUrl || settingsLogo || undefined;

  return {
    clientId: targetClientId,
    name: resolvedName,
    code: matchedClient?.code,
    logoUrl: resolvedLogoUrl,
  };
}
