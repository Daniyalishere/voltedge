import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server.js, so the Docker image
  // doesn't need node_modules at runtime. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
