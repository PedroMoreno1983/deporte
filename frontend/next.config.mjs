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
};

export default nextConfig;
