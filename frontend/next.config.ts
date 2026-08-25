import type { NextConfig } from "next";

// 部署环境通过环境变量覆盖；本地开发默认走 127.0.0.1
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";
const OCR_URL = process.env.OCR_URL ?? "http://127.0.0.1:3200";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.33","excluding-appraiser-grandma.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/ocr",
        destination: `${OCR_URL}/ocr`,
      },
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
