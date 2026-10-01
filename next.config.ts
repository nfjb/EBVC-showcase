import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The native SQLite driver must stay a plain Node require on the server.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Two CSV uploads per pipeline run; the demo files are well under 1 MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
