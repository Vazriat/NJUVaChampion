"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { removeToken, getUser, isIdentityVerified, setUser as persistUser, getRefereeMode, setRefereeMode } from "@/lib/auth";
import { authApi } from "@/lib/api";

export default function NavBar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(getUser());
  const [refereeMode, setRefereeModeState] = useState(getRefereeMode());

  useEffect(() => {
    const handler = (e: Event) => setRefereeModeState((e as CustomEvent).detail === true);
    window.addEventListener("referee-mode-change", handler);
    return () => window.removeEventListener("referee-mode-change", handler);
  }, []);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
    // 挂载时刷新用户信息（认证通过/资料变更后导航栏状态保持最新）
    authApi.getProfile().then(res => {
      setUser(res.data.data);
      persistUser(res.data.data); // 同步 localStorage，供其他页面读取最新 referee 等标记
    }).catch(() => {});
  }, []);

  if (!mounted || !user || pathname.startsWith("/admin") || ["/", "/login", "/register"].includes(pathname)) {
    return null;
  }

  // 管理员豁免身份认证门槛（后端同样豁免，前端保持一致）
  const verified = user.role === "ADMIN" || isIdentityVerified(user);
  const links = verified
    ? [
        { href: "/hall", label: "用户大厅" },
        { href: "/teams", label: "战队管理" },
        { href: "/competitions", label: "活动报名" },
        { href: "/tournaments", label: "赛事中心" },
        { href: "/verify", label: "认证中心" },
        { href: "/career/" + user.id, label: "个人生涯" },
        ...(user.referee && refereeMode ? [{ href: "/referee", label: "申报中心" }] : []),
      ]
    : [{ href: "/verify", label: "认证中心" }];

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      {!verified && (
        <div className="border-b border-red-900/60 bg-red-950/60 px-8 py-2 text-center text-xs text-red-300">
          请先完成身份认证，认证通过后即可使用平台全部功能{" "}
          <Link href="/verify?required=1" className="underline hover:text-red-200">前往认证</Link>
        </div>
      )}
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-2xl font-bold text-red-500 hover:text-red-400 transition">
          VALORANT
        </Link>
        <nav className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition ${
                isActive(link.href)
                  ? "text-red-400"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href={`/profile/${user.id}`}
          className="text-sm text-zinc-400 hover:text-white transition"
        >
          {user.displayName || user.displayGameId || user.username}
        </Link>
        {user.referee && (
          <button onClick={() => setRefereeMode(!refereeMode)}
            className={"rounded-lg border px-4 py-1.5 text-sm transition " + (refereeMode ? "border-orange-500 text-orange-400" : "border-zinc-700 text-zinc-400 hover:border-orange-500 hover:text-orange-400")}>
            ⚖ 裁判模式{refereeMode ? "：开" : "：关"}
          </button>
        )}
        <button
          onClick={() => { removeToken(); window.location.href = "/login"; }}
          className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400"
        >
          退出
        </button>
      </div>
      </header>
    </>
  );
}