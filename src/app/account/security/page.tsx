import { loadEnv } from '@/config/env';
import { PageHeader } from '@/components/page-header';
import { buildAccountConsoleSecurityUrl } from '@/lib/account-console-url';

/**
 * Thin launcher into Keycloak's account console (the credential UI). Keycloak
 * owns passwords, TOTP, and the WebAuthn/passkey enrollment ceremony, so the
 * portal links out (same tab) rather than re-implementing them. The deep link
 * carries a referrer so the console shows a "Back to HAIWAVE" link home.
 */
export default function SecurityPage() {
  const env = loadEnv();
  const href = buildAccountConsoleSecurityUrl({
    keycloakUrl: env.KEYCLOAK_URL,
    realm: env.KEYCLOAK_REALM,
    clientId: env.KEYCLOAK_PORTAL_CLIENT_ID,
    portalBaseUrl: env.PORTAL_BASE_URL,
  });
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Sign-in & Security"
        description="Manage your password, two-factor authentication, and passkeys."
      />
      <div className="mt-6 bg-white rounded-lg border border-slate/15 p-6">
        <p className="text-sm text-slate">
          Your sign-in credentials are managed in the HAIWAVE identity console.
          There you can change your password, set up an authenticator app, and
          register a passkey (Touch ID or a security key). When you are done,
          use the <span className="font-medium text-navy">Back to HAIWAVE</span>{' '}
          link to return here.
        </p>
        <a
          href={href}
          className="mt-5 inline-flex items-center rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Manage sign-in &amp; security &rarr;
        </a>
      </div>
    </div>
  );
}
