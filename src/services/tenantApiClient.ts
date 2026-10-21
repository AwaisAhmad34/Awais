import { auth } from '../firebase';
export async function tenantApi(path: string, clientId?: string, body?: unknown, method?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`/api/tenants${path}${clientId ? `${separator}clientId=${encodeURIComponent(clientId)}` : ''}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({ message: 'The API returned an invalid response. Check the backend deployment.' }));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed (${response.status}).`);
  return payload.data ?? payload.context;
}
