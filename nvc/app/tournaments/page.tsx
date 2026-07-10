"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { tournamentApi, TournamentVO } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, string> = {
  SETUP: "筹备中",
  REGISTRATION: "报名中",
  PROGRESSION: "进行中",
  ENDED: "已结束",
};

const STATUS_COLOR: Record<string, string> = {
  SETUP: "text-zinc-400 bg-zinc-800",
  REGISTRATION: "text-blue-400 bg-blue-500/10",
  PROGRESSION: "text-green-400 bg-green-500/10",
  ENDED: "text-yellow-400 bg-yellow-500/10",
};

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentVO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    tournamentApi
      .list()
      .then((res) => setTournaments(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-4xl px-8 py-10">
        <h2 className="mb-8 text-2xl font-bold">赛事中心</h2>

        {loading && <p className="text-zinc-500">加载中...</p>}

        <div className="space-y-4">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="group block rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold group-hover:text-red-400">{t.name}</h3>
                  {t.description && (
                    <p className="mt-1 text-sm text-zinc-400">{t.description}</p>
                  )}
                </div>
                <span className={`rounded px-3 py-1 text-xs font-medium ${STATUS_COLOR[t.status] || "bg-zinc-800 text-zinc-400"}`}>
                  {STATUS_MAP[t.status] || t.status}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                <span>报名：{t.registeredCount}/{t.maxTeams}</span>
                <span>赛制：单败淘汰赛</span>
                {t.championTeamName && (
                  <span className="text-yellow-400">冠军：{t.championTeamName}</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {!loading && tournaments.length === 0 && (
          <p className="text-center text-zinc-500">暂无赛事</p>
        )}
      </main>
    </div>
  );
}
