"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

interface TeamRating {
  teamId: number;
  teamName: string;
  memberCount: number;
  topRanks: string[];
  score: number;
}

export default function TeamRatingManager() {
  const [ratings, setRatings] = useState<TeamRating[]>([]);
  const [sort, setSort] = useState<"score" | "lexicographic">("score");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setErr("");
    adminApi
      .listTeamRatings(sort)
      .then((r) => setRatings(r.data.data || []))
      .catch((e: any) => setErr(e.response?.data?.message || "加载失败"))
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-zinc-500">排序方式：</span>
        <button
          onClick={() => setSort("score")}
          className={
            "rounded border px-3 py-1.5 text-xs font-medium transition " +
            (sort === "score"
              ? "border-red-500 bg-red-600/20 text-red-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")
          }
        >
          按评分
        </button>
        <button
          onClick={() => setSort("lexicographic")}
          className={
            "rounded border px-3 py-1.5 text-xs font-medium transition " +
            (sort === "lexicographic"
              ? "border-red-500 bg-red-600/20 text-red-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")
          }
        >
          按段位（字典序）
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{err}</div>
      )}

      {loading ? (
        <p className="py-8 text-center text-zinc-500">加载中...</p>
      ) : ratings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">暂无战队</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">排名</th>
                <th className="px-4 py-3">战队</th>
                <th className="px-4 py-3">人数</th>
                <th className="px-4 py-3">段位前五（降序）</th>
                <th className="px-4 py-3 text-right">评分</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r, i) => (
                <tr key={r.teamId} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/50">
                  <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.teamName}</td>
                  <td className="px-4 py-3 text-zinc-400">{r.memberCount}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    <span className="flex flex-wrap gap-1">
                      {r.topRanks.map((rank, j) => (
                        <span key={j} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                          {rank}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-400">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
