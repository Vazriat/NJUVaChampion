"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { removeToken, getUser } from "@/lib/auth";

export default function NavBar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  if (!mounted || !user || ["/", "/login", "/register", "/admin"].includes(pathname)) {
    return null;
  }

  const links = [
    { href: "/hall", label: "用户大厅" },
    { href: "/teams", label: "战队管理" },
    { href: "/tournaments", label: "赛事中心" },
  ];

  const isActive = (href: string) => pathname.startsWith(href);

  return (
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
          {user.displayGameId || user.username}
        </Link>
        <button
          onClick={() => { removeToken(); window.location.href = "/login"; }}
          className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400"
        >
          退出
        </button>
      </div>
    </header>
  );
}