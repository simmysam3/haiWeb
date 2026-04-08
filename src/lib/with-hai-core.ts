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
  /** Pre-parsed request body (for POST/PUT/PATCH/DELETE). Avoids double-consuming the stream. */
  body: unknown;
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
 *  3. Resolve token; if not JWT-like, return fallback (or 401).
 *  4. Create haiCore client and invoke the handler.
 *  5. On thrown error, return fallback (or 500 with error message).
 *
 * Handlers can return any JSON-serializable value, or a NextResponse directly
 * if they need to set a custom status code (e.g. 400 for validation errors).
 *
 * Example:
 *   export const GET = withHaiCore(
 *     ({ client }) => client.getApprovalRules(),
 *     { fallback: MOCK_APPROVAL_RULES },
 *   );
 */
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

    // Pre-parse the body once for methods that have one, so handlers and
    // fallbacks never double-consume the readable stream.
    const method = request.method.toUpperCase();
    let parsedBody: unknown = undefined;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      try {
        parsedBody = await request.json();
      } catch {
        // No body or invalid JSON -- leave as undefined
      }
    }

    const resolveFallback = async (): Promise<unknown> => {
      if (typeof options.fallback === "function") {
        return await (options.fallback as (req: NextRequest) => unknown | Promise<unknown>)(request);
      }
      return options.fallback;
    };

    try {
      const token = await getToken();
      if (!isJwtLike(token)) {
        if (options.fallback !== undefined) {
          return NextResponse.json(await resolveFallback());
        }
        return NextResponse.json({ error: "No token" }, { status: 401 });
      }

      const client = createHaiwaveClient(token, session.participant.id);
      const result = await handler({ client, session, request, params, body: parsedBody });
      // Handlers may return a NextResponse directly to set custom status codes
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (err) {
      if (options.fallback !== undefined) {
        console.error("[withHaiCore] Handler failed, returning fallback:", err);
        return NextResponse.json(await resolveFallback());
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Request failed" },
        { status: 500 },
      );
    }
  };
}
