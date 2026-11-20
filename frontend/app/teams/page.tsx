"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { teamApi, TeamVO } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useNotify } from "@/components/DialogProvider";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamVO[]>([]);
  const [myTeams, setMyTeams] = useState<TeamVO[]>([]);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const notify = useNotify();

  const myTeamIds = new Set(myTeams.map((t) => t.id));

  const [searchQuery, setSearchQuery] = useState("");
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
    teamApi
      .myTeams()
      .then((res) => setMyTeams(res.data.data || []))
      .catch(() => {});
  }, [router]);

  const handleActivate = async (teamId: number) => {
    setActivatingId(teamId);
    try {
      await teamApi.activate(teamId);
      const res = await teamApi.myTeams();
      setMyTeams(res.data.data || []);
      notify("已切换当前活跃战队", "success");
    } catch (err: any) {
      notify(err.response?.data?.message || "切换失败", "error");
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-5xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">全部战队</h2>
          <Link
            href="/teams/create"
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold transition hover:bg-red-700"
          >
            + 创建战队
          </Link>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索战队...输入战队名搜索"
          className="mb-6 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
        />

        {myTeams.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-500">我的战队（{myTeams.length}）</h3>
              <p className="text-xs text-zinc-600">可同时加入多支战队，切换「当前活跃」作为平台内默认身份</p>
            </div>
            <div className="flex flex-wrap gap-2 max-md:flex-col">
              {myTeams.map((team) => (
                <div
                  key={team.id}
                  className={
                    "flex items-center gap-3 rounded-lg border px-3 py-2 max-md:justify-between " +
                    (team.active
                      ? "border-red-500/60 bg-red-950/20"
                      : "border-zinc-800 bg-zinc-900")
                  }
                >
                  <Link
                    href={`/teams/${team.id}`}
                    className="text-sm font-medium text-zinc-200 transition hover:text-red-400"
                  >
                    {team.name}
                  </Link>
                  {team.active ? (
                    <span className="rounded bg-red-600/20 px-2 py-0.5 text-xs text-red-400">当前活跃</span>
                  ) : (
                    <button
                      type="button"
                      disabled={activatingId === team.id}
                      onClick={() => handleActivate(team.id)}
                      className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:min-h-11 max-md:px-3"
                    >
                      {activatingId === team.id ? "切换中..." : "设为当前"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="text-zinc-500">加载中...</p>}
        {error && <p className="text-red-400">{error}</p>}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {teams.filter(team => searchQuery === "" || team.name.toLowerCase().includes(searchQuery.toLowerCase())).map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50 max-md:p-4"
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
                {team.description || ""}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <span>队员 {team.memberCount} 人</span>
                {myTeamIds.has(team.id) && (
                  <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-red-400">
                    {myTeams.find((t) => t.id === team.id)?.active ? "当前活跃" : "我的队伍"}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {!loading && teams.length === 0 && (
          <p className="text-center text-zinc-500">还没有战队，去创建或加入一个吧</p>
        )}
      </main>
    </div>
  );
}
