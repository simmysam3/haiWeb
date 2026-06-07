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
};

export default nextConfig;
