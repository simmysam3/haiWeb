import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/aliases
 *
 * Lists the signed-in participant's company-name aliases. Falls back to an
 * empty list when haiCore is unreachable.
 */
export const GET = withHaiCore(
  async ({ client, session }) => {
    const result = await client.listAliases(session.participant.id);
    return result.aliases ?? [];
  },
  { fallback: () => [] },
);

/**
 * POST /api/account/aliases
 *
 * Adds an alias to the signed-in participant. Requires account_admin (company
 * profile data), matching the connection-request gate. No fallback: a
 * non-JWT token (dev shim, or a poisoned/misconfigured cookie in prod) must
 * 401 rather than fabricate a synthetic alias row.
 */
export const POST = withHaiCore(
  async ({ client, session, request }) => {
    const body = await request.json();
    const alias = typeof body?.alias === "string" ? body.alias.trim() : "";
    if (!alias) {
      return NextResponse.json({ error: "alias is required" }, { status: 400 });
    }
    const result = await client.addAlias(session.participant.id, alias, body.alias_type);
    return NextResponse.json(result, { status: 201 });
  },
  { role: "account_admin" },
);
