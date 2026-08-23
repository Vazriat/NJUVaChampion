import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.33","excluding-appraiser-grandma.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8080/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://127.0.0.1:8080/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;