import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
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
 * profile data), matching the connection-request gate.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const alias = typeof body?.alias === "string" ? body.alias.trim() : "";
    if (!alias) {
      return NextResponse.json({ error: "alias is required" }, { status: 400 });
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      // No real haiCore token (mock/offline) — echo a synthetic row so the UI
      // can render optimistically.
      return NextResponse.json(
        { id: `local-${Date.now()}`, participant_id: session.participant.id, alias, alias_type: body.alias_type ?? "other", source: "user" },
        { status: 201 },
      );
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.addAlias(session.participant.id, alias, body.alias_type);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add alias" },
      { status: 500 },
    );
  }
}
