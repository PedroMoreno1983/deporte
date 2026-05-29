/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone only for Docker/Railway — Vercel handles deployment internally
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  transpilePackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost" },
      { protocol: "https", hostname: "*.railway.app" },
      { protocol: "https", hostname: "*.up.railway.app" },
    ],
  },
  // ─── Bundle hygiene (P27) ─────────────────────────────────────
  // Tree-shake big icon/util libraries that re-export hundreds of symbols.
  // Each name here gets a per-export import transform at compile time.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Split vendor chunks by feature group so a homepage doesn't pull
      // the heavy charting / PDF / 3D modules.
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          recharts:    { name: "recharts",    test: /[\\/]node_modules[\\/](recharts|d3-.+)[\\/]/, priority: 30 },
          framermotion:{ name: "framer",      test: /[\\/]node_modules[\\/]framer-motion[\\/]/,    priority: 25 },
          pdf:         { name: "pdf",         test: /[\\/]node_modules[\\/]@react-pdf[\\/]/,       priority: 25 },
          sentry:      { name: "sentry",      test: /[\\/]node_modules[\\/]@sentry[\\/]/,          priority: 25 },
          radix:       { name: "radix",       test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,        priority: 20 },
          vendor:      { name: "vendor",      test: /[\\/]node_modules[\\/]/,                      priority: 10 },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
