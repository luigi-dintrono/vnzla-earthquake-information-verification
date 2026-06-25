import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile in $HOME otherwise confuses Turbopack).
  turbopack: { root: __dirname },
  // Remote media (post thumbnails, source avatars) can come from anywhere a
  // source links to. We render them with plain <img>, but if you switch to
  // next/image later, widen this list.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
