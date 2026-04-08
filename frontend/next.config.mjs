/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost" },
      { protocol: "https", hostname: "*.railway.app" },
      { protocol: "https", hostname: "*.up.railway.app" },
    ],
  },
};

export default nextConfig;
