import { NextResponse } from "next/server";

/**
 * Streams a stored user-content file response through from haiCore.
 *
 * Security: the upstream content-type is NOT trusted, since it serves stored
 * content from the app's own origin. Only types safe to render inline (the
 * upload allowlist) keep their type and inline disposition; anything else is
 * forced to an octet-stream attachment so it can never execute same-origin.
 * nosniff + a sandbox CSP are always set.
 */
const INLINE_SAFE_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export function streamInlineSafe(upstream: Response): NextResponse {
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
}
