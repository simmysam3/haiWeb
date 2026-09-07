import { NextResponse } from "next/server";
import { z } from "zod";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * Mirrors haiCore's `CounterpartyUpdateDecisionSchema`
 * (`packages/protocol/src/counterparty-updates.ts` — that schema is the
 * source of truth). Validated locally so a malformed decision never reaches
 * haiCore.
 */
const CounterpartyUpdateDecisionSchema = z.union([
  z.object({ keep: z.enum(["mine", "theirs"]) }).strict(),
  z.object({ link: z.number().int() }).strict(),
]);

/**
 * POST /api/account/counterparty-updates/[id]/decide
 *
 * Decides one pending counterparty-update row. Requires account_admin. No
 * fallback: a non-JWT token must 401, never fabricate a decided row. A
 * haiCore 4xx (404 unknown/foreign id, 409 no-longer-pending) propagates
 * verbatim via the wrapper.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, request, params }) => {
    const body = await request.json();
    const parsed = CounterpartyUpdateDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }
    return client.decideCounterpartyUpdate(params.id, parsed.data);
  },
  { role: "account_admin" },
);
