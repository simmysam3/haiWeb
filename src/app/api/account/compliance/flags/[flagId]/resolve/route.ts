import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/compliance/flags/[flagId]/resolve
 *
 * Marks a noncompliance flag as resolved with reporter-supplied notes.
 * haiCore enforces ownership: only the reporting vendor may resolve.
 */
export const POST = withHaiCore<{ flagId: string }>(
  async ({ client, params, request }) => {
    const body = (await request.json().catch(() => ({}))) as { notes?: string };
    const notes = typeof body.notes === "string" ? body.notes : "";
    return NextResponse.json(
      await client.resolveComplianceFlag(params.flagId, notes),
    );
  },
  { role: "account_admin" },
);
