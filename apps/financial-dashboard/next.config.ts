import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The image optimizer is deliberately off: it would pull a native sharp
  // dependency into every app for a shell that serves no images yet.
  images: { unoptimized: true },
};

export default nextConfig;
