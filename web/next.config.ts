import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2"],
  // payment screenshots are up to 5 MB
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
