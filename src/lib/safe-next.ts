/**
 * Return a safe in-portal redirect path. Rejects anything the URL parser would
 * resolve to a different origin — protocol-relative (`//host`), backslash variants
 * (`/\host`), userinfo tricks (`@host`), and absolute/scheme URLs — to defend
 * against open redirects. Shared by the OIDC login route (write-time, when the
 * `kc_next` cookie is set from the `?next=` query param) and the callback route
 * (read-time, since the cookie is attacker-influenceable independently of the
 * login route — e.g. cookie tossing from a sibling subdomain).
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return '/account';
  try {
    const u = new URL(raw, 'http://localhost');
    if (u.origin !== 'http://localhost') return '/account';
  } catch {
    return '/account';
  }
  return raw.replace(/[\r\n]/g, '');
}
