import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VALORANT 赛事平台",
  description: "无畏契约赛事平台 — NJU Champion",
};

// 移动端视口声明。width/initialScale 与 Next 默认值一致，显式声明不改变输出；
// viewportFit 仅 iOS 生效（刘海/灵动岛安全区），themeColor 仅移动浏览器地址栏生效。
// 注意：不要设置 maximumScale 或 userScalable，那会违反无障碍规范且被 iOS 忽略。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}