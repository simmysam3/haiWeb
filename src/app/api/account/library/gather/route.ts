import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/library/gather
 *
 * Kicks off a library gather run against the participant's website. Requires
 * account_admin. Body: { terms_url? } — an absent/invalid JSON body forwards
 * as {}. haiCore replies 202 {status:'started'} on success; 4xx errors
 * (422 NO_WEBSITE_URL, 400) propagate verbatim via the wrapper, and 503
 * (gather pipeline unavailable) is surfaced here so it isn't masked as 500.
 */
export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = await request.json().catch(() => ({}));
    try {
      const result = await client.runLibraryGather(body);
      // haiCore's success status for gather is 202 Accepted — preserve it.
      return NextResponse.json(result, { status: 202 });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 503) {
        const haiCoreBody = (err as { haiCoreBody?: unknown })?.haiCoreBody;
        return NextResponse.json(
          haiCoreBody ?? { error: (err as Error).message },
          { status: 503 },
        );
      }
      throw err; // 4xx propagate verbatim via withHaiCore; the rest → 500
    }
  },
  { role: "account_admin" },
);
