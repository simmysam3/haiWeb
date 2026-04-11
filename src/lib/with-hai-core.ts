import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole, Session, UserRole } from "./auth";
import { createHaiwaveClient, HaiwaveClient } from "./haiwave-api";

/**
 * Returns true if `token` looks like a JWT (has a dot separator).
 * Used to distinguish real Keycloak tokens from the dev-mode placeholder cookie.
 */
export function isJwtLike(token: string | null | undefined): token is string {
  return !!token && token.includes(".");
}

interface HandlerCtx<P> {
  client: HaiwaveClient;
  session: Session;
  request: NextRequest;
  params: P;
}

interface WithHaiCoreOptions {
  /**
   * Value returned when the token is missing or the handler throws.
   * Can be a function for lazy/request-aware fallbacks.
   * If omitted, missing-token returns 401 and thrown errors return 500.
   */
  fallback?: unknown | ((request: NextRequest) => unknown | Promise<unknown>);
  /**
   * Required role. If set and the session's role doesn't satisfy it, returns 403.
   */
  role?: UserRole;
}

/**
 * Wraps a Next.js route handler with the shared HAIWAVE BFF scaffold:
 *  1. Load session, 401 if missing.
 *  2. Enforce role, 403 if insufficient.
 *  3. Resolve token; if not JWT-like, return fallback (dev stand-alone mode).
 *  4. Create haiCore client and invoke the handler.
 *  5. On thrown error: in development, return fallback with a fallback header;
 *     in production, surface the error as 500 (no silent mock masking).
 *
 * Handlers can return any JSON-serializable value, or a NextResponse directly
 * if they need to set a custom status code (e.g. 400 for validation errors).
 *
 * Fallback responses carry `x-haiwave-data-source: fallback` so clients can
 * distinguish mock data from real haiCore data.
 *
 * Example:
 *   export const GET = withHaiCore(
 *     ({ client }) => client.getApprovalRules(),
 *     { fallback: MOCK_APPROVAL_RULES },
 *   );
 */
function fallbackResponse(data: unknown): NextResponse {
  const res = NextResponse.json(data);
  res.headers.set("x-haiwave-data-source", "fallback");
  return res;
}

export function withHaiCore<P extends Record<string, string> = Record<string, never>>(
  handler: (ctx: HandlerCtx<P>) => unknown | Promise<unknown>,
  options: WithHaiCoreOptions = {},
): (request: NextRequest, routeCtx: { params: Promise<P> }) => Promise<NextResponse> {
  return async (request, routeCtx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (options.role && !hasRole(session.user.role, options.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = (await routeCtx.params) as P;

    const resolveFallback = async (): Promise<unknown> => {
      if (typeof options.fallback === "function") {
        return await (options.fallback as (req: NextRequest) => unknown | Promise<unknown>)(request);
      }
      return options.fallback;
    };

    try {
      const token = await getToken();
      if (!isJwtLike(token)) {
        // No real token: this is dev stand-alone mode (no Keycloak). Serve
        // the fallback if one is configured so the portal stays usable.
        if (options.fallback !== undefined) {
          return fallbackResponse(await resolveFallback());
        }
        return NextResponse.json({ error: "No token" }, { status: 401 });
      }

      const client = createHaiwaveClient(token, session.participant.id);
      const result = await handler({ client, session, request, params });
      // Handlers may return a NextResponse directly to set custom status codes
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (err) {
      console.error("[withHaiCore] Handler failed:", err);
      // In production, a real haiCore failure must surface — returning mock
      // data would silently mask outages on security-critical routes. Only
      // serve the fallback in development (e.g. haiCore running locally but
      // flaky, or demo environments) so real failures are visible.
      if (options.fallback !== undefined && process.env.NODE_ENV !== "production") {
        return fallbackResponse(await resolveFallback());
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Request failed" },
        { status: 500 },
      );
    }
  };
}
