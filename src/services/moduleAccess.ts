// UI visibility only. Backend authorization remains mandatory for every operation.
export function allowedModulesForUser(user: any, available: string[]): string[] {
  if (!user || user.status !== 'active') return [];
  if (user.role === 'level_1_platform_super_admin') return available;
  if (!Array.isArray(user.allowedModules)) return [];
  const permitted = user.allowedModules.includes('all') ? available : user.allowedModules;
  return available.filter(id => id !== 'campuses' && permitted.includes(id));
}
