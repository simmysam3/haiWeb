import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/entity-approvals/evidence/[ownerId]/[artifactId]/file
 *
 * Streams a counterparty's evidence document through from haiCore so a reviewer
 * can open it from the scorecard. Ownership + tier disclosure are enforced
 * core-side (D-49); this route only relays the bytes.
 *
 * Security: cross-participant content served from the app's own origin, so the
 * upstream content-type is NOT trusted. Only inline-safe types (the upload
 * allowlist) keep their type + inline disposition; anything else is forced to
 * an octet-stream attachment so it can never execute same-origin. nosniff + a
 * sandbox CSP are always set.
 */
const INLINE_SAFE_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export const GET = withHaiCore<{ ownerId: string; artifactId: string }>(async ({ client, params }) => {
  const upstream = await client.counterpartyEvidenceFile(params.ownerId, params.artifactId);
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
