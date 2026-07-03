import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Standalone output: emits a self-contained server (+ traced node_modules) at
  // .next/standalone, so the prod container ships only the runtime, not the full
  // monorepo. outputFileTracingRoot is set to the workspace parent so the cross-
  // repo `@haiwave/protocol` dep (resolved outside the haiWeb root) is traced in.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  // @haiwave/protocol is a `file:` workspace dep symlinked from
  // ../haiCore/packages/protocol — outside the HaiWeb project root. Turbopack
  // refuses to resolve modules outside the project root by default, so
  // `turbopack.root` must point at the common parent dir. transpilePackages
  // alone is insufficient: it governs bundling of *resolved* modules, not
  // whether resolution is allowed to leave the root.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
  turbopack: {
    root: path.join(import.meta.dirname, ".."),
  },
  transpilePackages: ["@haiwave/protocol"],
  async headers() {
    // Baseline hardening for a FedRAMP-High BFF. TLS is terminated at the GCP
    // edge, so HSTS here is belt-and-suspenders. The ENFORCED CSP intentionally
    // omits script-src/style-src: locking those down needs per-request nonces
    // and browser validation, so the strict script policy ships report-only
    // until that rollout lands. What is enforced (frame-ancestors, object-src,
    // base-uri) cannot break script rendering.
    const enforcedCsp =
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";
    const reportOnlyCsp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: enforcedCsp },
          {
            key: "Content-Security-Policy-Report-Only",
            value: reportOnlyCsp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
