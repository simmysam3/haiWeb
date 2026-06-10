import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/library/artifacts/[id]/file
 *
 * Streams a library document artifact's file through from haiCore. No role gate
 * — viewing your own documents isn't admin-only; the wrapper still session-gates.
 *
 * Security: this serves stored user content from the app's own origin, so the
 * upstream content-type is NOT trusted. Only types that are safe to render
 * inline (PDF, PNG, JPEG — the upload allowlist) keep their type and inline
 * disposition; anything else (e.g. future auto-gathered HTML snapshots) is
 * forced to an octet-stream attachment so it can never execute same-origin.
 * nosniff + a sandbox CSP are always set.
 */
const INLINE_SAFE_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  const upstream = await client.getLibraryArtifactFile(params.id);
  const upstreamType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  const inlineSafe = upstream.ok && INLINE_SAFE_TYPES.includes(upstreamType);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": inlineSafe ? upstreamType : "application/octet-stream",
      "content-disposition": inlineSafe
        ? (upstream.headers.get("content-disposition") ?? "inline")
        : (upstream.headers.get("content-disposition") ?? "").replace(/^inline/, "attachment") || "attachment",
      "cache-control": upstream.headers.get("cache-control") ?? "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'",
    },
  });
});
