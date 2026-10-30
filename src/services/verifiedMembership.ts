const roles: Record<string, string> = {
  level_1_platform_super_admin: 'level_1_platform_super_admin',
  level_2_client_super_admin: 'level_2_client_super_admin',
  level_3_main_campus_admin: 'level_3_main_campus_admin',
  level_4_sub_campus_admin: 'level_4_sub_campus_admin',
  level_5_departmental_staff: 'campus_accountant',
};

export function resolveUserEmail(input: string): string {
  const clean = input.trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  const aliases: Record<string, string> = {
    admin: 'siteowner@platform.org', siteowner: 'siteowner@platform.org',
    'client.admin': 'director@aplus.edu.pk', aplus: 'director@aplus.edu.pk',
    'apex.admin': 'head@apexacademy.edu.pk', apex: 'head@apexacademy.edu.pk',
    auditor: 'auditor@aplus.edu.pk', 'campus.khl': 'khiali@aplus.edu.pk', khiali: 'khiali@aplus.edu.pk',
    'campus.peoples': 'peoples@aplus.edu.pk', 'campus.mc': 'mastercity@aplus.edu.pk',
    'campus.cvt': 'civil@aplus.edu.pk', 'campus.ghkr': 'ghakhar@aplus.edu.pk', 'campus.apex': 'apexmain@apexacademy.edu.pk',
  };
  return aliases[clean] || `${clean.replace(/[^a-z0-9._-]/g, '')}@aplus.edu.pk`;
}

export function profileFromMembership(uid: string, email: string | null, membership: any) {
  if (!membership || membership.status !== 'active' || !Object.hasOwn(roles, membership.permissionLevel)) throw new Error('No active authorized membership exists. Contact your administrator.');
  const platform = membership.permissionLevel === 'level_1_platform_super_admin';
  if (!platform && (typeof membership.clientId !== 'string' || !membership.clientId.trim())) throw new Error('An organization membership is required.');
  if (!platform && membership.permissionLevel !== 'level_2_client_super_admin' && !membership.campusId) throw new Error('A campus assignment is required.');
  const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
  return {
    id: typeof membership.userId === 'string' && membership.userId ? membership.userId : uid,
    uid, email, username: membership.username || email?.split('@')[0] || uid,
    name: membership.name || email || uid,
    role: roles[membership.permissionLevel], permissionLevel: membership.permissionLevel,
    clientId: platform ? null : membership.clientId, campusId: platform ? null : membership.campusId || null,
    allowedModules: strings(membership.allowedModules), permittedCampusIds: strings(membership.delegatedCampusIds),
    delegatedCampusIds: strings(membership.delegatedCampusIds), status: 'active' as const,
  };
}
