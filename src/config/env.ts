import { z } from 'zod';

/**
 * haiWeb server-side environment config (v.1.46 Plan 2, Workstream 2).
 *
 * Mirrors haiCore's `config/env.ts` pattern: a single zod-validated entry point
 * so Secret Manager can later source these with zero consumer changes (D-8).
 *
 * SERVER-ONLY. Do NOT import this from client components — it reads secret-
 * bearing vars (Keycloak/Stripe secrets, session secret). Client-exposed config
 * uses `NEXT_PUBLIC_*` vars, which are intentionally out of scope here.
 */
const DEV_SESSION_SECRET = 'dev-session-secret-change-me';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Central API
  HAIWAVE_API_URL: z.string().url().default('http://localhost:3000'),

  // Keycloak (OIDC)
  KEYCLOAK_URL: z.string().url().default('http://localhost:8080'),
  KEYCLOAK_REALM: z.string().default('haiwave-network'),
  KEYCLOAK_CLIENT_ID: z.string().default('haiwave-portal'),
  KEYCLOAK_CLIENT_SECRET: z.string().default(''),
  KEYCLOAK_PORTAL_CLIENT_ID: z.string().default('haiwave-portal'),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().default('haiwave-portal-admin'),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().default(''),
  // Portal origin (server-side). Used to build the OIDC redirect_uri and
  // post-logout redirect. Must match the Keycloak client's registered
  // redirectUris exactly. Prod: https://console.haiwave.ai
  PORTAL_BASE_URL: z.string().url().default('http://localhost:3001'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PLATFORM_PRICE_ID: z.string().default(''),
  STRIPE_CONNECTION_PRICE_ID: z.string().default(''),

  // Session
  SESSION_SECRET: z.string().default(DEV_SESSION_SECRET),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse + validate `process.env` for the haiWeb server. Fails fast on invalid
 * values, and refuses to run in production with the dev-default session secret.
 */
export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid haiWeb env:\n${JSON.stringify(result.error.flatten().fieldErrors, null, 2)}`,
    );
  }
  if (result.data.NODE_ENV === 'production' && result.data.SESSION_SECRET === DEV_SESSION_SECRET) {
    throw new Error(
      'SESSION_SECRET is the dev default but NODE_ENV=production — set it explicitly.',
    );
  }
  return result.data;
}
