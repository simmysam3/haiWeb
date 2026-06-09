/**
 * OIDC Authorization-Code + PKCE helpers for the portal BFF.
 *
 * No new dependency: PKCE via Web Crypto (FIPS-approved SHA-256 + CSPRNG),
 * id_token verification via `jose` (already used in lib/auth.ts), token
 * exchange via `fetch` (matching lib/keycloak.ts's raw-grant pattern).
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { loadEnv } from '@/config/env';

const env = loadEnv();
const ISSUER = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}`;
const AUTH_ENDPOINT = `${ISSUER}/protocol/openid-connect/auth`;
const TOKEN_ENDPOINT = `${ISSUER}/protocol/openid-connect/token`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`));

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/** Cryptographically-random base64url token (CSPRNG). */
export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

/** RFC 7636 S256 challenge = base64url(SHA-256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export interface AuthorizeParams {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  scope?: string;
}

export function buildAuthorizeUrl(p: AuthorizeParams): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.KEYCLOAK_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', p.redirectUri);
  url.searchParams.set('scope', p.scope ?? 'openid profile email');
  url.searchParams.set('state', p.state);
  url.searchParams.set('nonce', p.nonce);
  url.searchParams.set('code_challenge', p.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
}

export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.KEYCLOAK_CLIENT_ID,
      client_secret: env.KEYCLOAK_CLIENT_SECRET,
      code: opts.code,
      code_verifier: opts.codeVerifier,
      redirect_uri: opts.redirectUri,
    }),
  });
  if (!res.ok) {
    // Drain the body to release the undici socket (matches lib/keycloak.ts);
    // the body is Keycloak's error JSON (e.g. {"error":"invalid_grant"}), not a secret.
    const body = await res.text();
    throw new Error(`code exchange failed: ${res.status} ${body}`);
  }
  return res.json();
}

/** Verify the id_token signature/iss/aud and bind the nonce. Throws on mismatch. */
export async function verifyIdTokenNonce(idToken: string, expectedNonce: string): Promise<void> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUER,
    audience: env.KEYCLOAK_CLIENT_ID,
    // Pin the asymmetric algorithm allowlist (matches lib/auth.ts) — reject alg:none and weak algs.
    algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
  });
  if (payload.nonce !== expectedNonce) throw new Error('nonce mismatch');
}
