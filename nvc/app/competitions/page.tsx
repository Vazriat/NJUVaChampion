"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { competitionApi } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, string> = {
  SETUP: "筹备中",
  REGISTRATION: "报名中",
  GROUPED: "已分组",
};

export default function CompetitionsPage() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    competitionApi
      .list()
      .then((r) => setList(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = list.filter((c) => q === "" || c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-5xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">赛事报名</h1>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索活动..."
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
          />
        </div>

        {loading ? (
          <p className="py-8 text-center text-zinc-500">加载中...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <p className="text-sm text-zinc-500">暂无报名活动</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/competitions/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-red-500/50"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{c.registeredCount} 队已报名</p>
                </div>
                <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-zinc-300">
                  {STATUS_MAP[c.status] || c.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
