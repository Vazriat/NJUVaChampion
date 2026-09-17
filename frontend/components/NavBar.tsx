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
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // 路由变化时关闭移动端抽屉，避免返回后残留
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (!mounted || !user || pathname.startsWith("/admin") || ["/", "/login", "/register"].includes(pathname)) {
    return null;
  }

  const logout = () => { removeToken(); window.location.href = "/login"; };

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
        <div className="border-b border-red-900/60 bg-red-950/60 px-8 py-2 text-center text-xs text-red-300 max-md:px-4">
          请先完成身份认证，认证通过后即可使用平台全部功能{" "}
          <Link href="/verify?required=1" className="underline hover:text-red-200">前往认证</Link>
        </div>
      )}
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4 max-md:px-4">
        <div className="flex items-center gap-8 max-md:gap-2">
          {/* 移动端汉堡菜单入口 */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开导航菜单"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-lg text-zinc-300 transition hover:border-red-500 hover:text-red-400 md:hidden"
          >
            ☰
          </button>
          <Link href="/dashboard" className="text-2xl font-bold text-red-500 hover:text-red-400 transition">
            VALORANT
          </Link>
          <nav className="flex items-center gap-6 max-md:hidden">
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
        <div className="flex items-center gap-4 max-md:hidden">
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
            onClick={logout}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400"
          >
            退出
          </button>
        </div>
        {/* 移动端保底退出入口：不依赖抽屉，避免汉堡未展开时无法登出 */}
        <button
          type="button"
          onClick={logout}
          className="flex h-10 items-center rounded-lg border border-zinc-700 px-4 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400 md:hidden"
        >
          退出
        </button>
      </header>

      {/* 移动端导航抽屉（桌面端 md:hidden 不渲染可见内容） */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
          <aside className="safe-top safe-bottom absolute right-0 top-0 h-dvh w-72 max-w-[80vw] overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500">导航</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭导航菜单"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-zinc-500 transition hover:text-white"
              >
                ×
              </button>
            </div>

            <Link
              href={`/profile/${user.id}`}
              onClick={() => setDrawerOpen(false)}
              className="mb-4 block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-300 transition hover:border-red-500"
            >
              <span className="block text-xs text-zinc-500">当前账号</span>
              <span className="mt-0.5 block font-medium">
                {user.displayName || user.displayGameId || user.username}
              </span>
            </Link>

            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className={"flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition " + (isActive(link.href) ? "bg-red-500/10 text-red-400" : "text-zinc-400 hover:bg-zinc-900 hover:text-white")}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {user.referee && (
              <button
                type="button"
                onClick={() => setRefereeMode(!refereeMode)}
                className={"mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border px-3 text-sm transition " + (refereeMode ? "border-orange-500 text-orange-400" : "border-zinc-700 text-zinc-400")}
              >
                ⚖ 裁判模式{refereeMode ? "：开" : "：关"}
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-700 px-3 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400"
            >
              退出登录
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
