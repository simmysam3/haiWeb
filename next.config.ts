import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @haiwave/protocol is a `file:` workspace dep symlinked from ../haiCore,
  // so its real path is outside the HaiWeb project root. Turbopack won't
  // bundle a runtime (value) import resolving outside the root, which breaks
  // the one BFF route that imports protocol Zod schemas at runtime
  // (api/sonar/compliance/requests). Whitelisting it for transpilation fixes
  // resolution. Type-only imports are erased and were never affected.
  transpilePackages: ["@haiwave/protocol"],
};

export default nextConfig;
