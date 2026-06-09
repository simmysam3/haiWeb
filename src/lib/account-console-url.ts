/**
 * Build the deep link from the portal into Keycloak's account console
 * "Signing in" page (password / TOTP / passkey management).
 *
 * `referrer` + `referrer_uri` make Keycloak render a "Back to HAIWAVE" link;
 * Keycloak validates `referrer_uri` against the referrer client's redirect URIs,
 * so `<portalBaseUrl>/account/security` must be registered on that client
 * (see apply-portal-authcode.mjs).
 */
export function buildAccountConsoleSecurityUrl(opts: {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  portalBaseUrl: string;
}): string {
  const kc = opts.keycloakUrl.replace(/\/+$/, '');
  const portal = opts.portalBaseUrl.replace(/\/+$/, '');
  const referrerUri = encodeURIComponent(`${portal}/account/security`);
  return (
    `${kc}/realms/${opts.realm}/account/` +
    `?referrer=${opts.clientId}` +
    `&referrer_uri=${referrerUri}` +
    `#/security/signing-in`
  );
}
