import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
