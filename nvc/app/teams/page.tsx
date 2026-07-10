"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { teamApi, TeamVO } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    teamApi
      .list()
      .then((res) => setTeams(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "加载失败"))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-5xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">全部战队</h2>
          <Link
            href="/teams/create"
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold transition hover:bg-red-700"
          >
            + 创建战队
          </Link>
        </div>

        {loading && <p className="text-zinc-500">加载中...</p>}
        {error && <p className="text-red-400">{error}</p>}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-lg font-bold text-red-400">
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold group-hover:text-red-400">{team.name}</h3>
                  <p className="text-xs text-zinc-500">队长：{team.captainName}</p>
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-zinc-400">
                {team.description || "暂无简介"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <span>队员 {team.memberCount}/5</span>
              </div>
            </Link>
          ))}
        </div>

        {!loading && teams.length === 0 && (
          <p className="text-center text-zinc-500">暂无战队，快来创建第一个吧！</p>
        )}
      </main>
    </div>
  );
}