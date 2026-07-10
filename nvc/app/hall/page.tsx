"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { publicUserApi, UserVO } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export default function HallPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserVO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    publicUserApi
      .list()
      .then((res) => setUsers(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-4xl px-8 py-10">
        <h2 className="mb-8 text-2xl font-bold">用户大厅</h2>

        {loading && <p className="text-zinc-500">加载中...</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users
            .filter((u) => u.status === 1)
            .map((u) => (
              <Link
                key={u.id}
                href={`/profile/${u.id}`}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-red-500/50"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/20 text-lg font-bold text-red-400">
                    {(u.displayGameId || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold group-hover:text-red-400">{u.displayGameId || u.username}</p>
                    <p className="text-xs text-zinc-500">@{u.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded bg-zinc-800 px-2 py-0.5">{u.role}</span>
                  {u.team && (
                    <span className="rounded bg-red-600/10 px-2 py-0.5 text-red-400">
                      {u.team.name} · {u.team.role === "CAPTAIN" ? "队长" : "队员"}
                    </span>
                  )}
                </div>
              </Link>
            ))}
        </div>

        {!loading && users.length === 0 && (
          <p className="text-center text-zinc-500">暂无用户</p>
        )}
      </main>
    </div>
  );
}