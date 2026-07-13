import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pics.dmm.co.jp",
      },
      {
        protocol: "https",
        hostname: "*.dmm.co.jp",
      },
      {
        protocol: "https",
        hostname: "doujin-assets.dmm.co.jp",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.adult-zukan.jp" }],
        destination: "https://adult-zukan.jp/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
