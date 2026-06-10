import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/library/artifacts/[id]/file
 *
 * Streams a library document artifact's file through from haiCore, forwarding
 * the upstream content headers (type, disposition, cache-control). No role gate
 * — viewing your own documents isn't admin-only; the wrapper still session-gates.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  const upstream = await client.getLibraryArtifactFile(params.id);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? "inline",
      "cache-control": upstream.headers.get("cache-control") ?? "private, no-store",
    },
  });
});
