"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import RecruitmentPostCard from "@/components/RecruitmentPostCard";
import { recruitmentPostApi, teamApi, RecruitmentPostVO } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const TABS: { key: "TEAM" | "PLAYER"; label: string }[] = [
  { key: "TEAM", label: "队伍招募" },
  { key: "PLAYER", label: "选手求职" },
];

export default function RecruitPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"TEAM" | "PLAYER">("TEAM");
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [posts, setPosts] = useState<RecruitmentPostVO[]>([]);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    teamApi
      .myCaptainedTeams()
      .then((res) => {
        const teams = res.data.data || [];
        setMyTeamId(teams.length > 0 ? teams[0].id : null);
      })
      .catch(() => {});
  }, [router]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    recruitmentPostApi
      .list({ type: tab, keyword: keyword || undefined })
      .then((res) => setPosts(res.data.data || []))
      .catch((err) => setError(err.response?.data?.message || "加载失败"))
      .finally(() => setLoading(false));
  }, [tab, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-5xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-6 flex items-center justify-between gap-4 max-md:flex-col max-md:items-stretch">
          <h2 className="text-2xl font-bold">人才市场</h2>
          <div className="flex gap-3 max-md:gap-2">
            <Link
              href="/recruit/mine"
              className="flex items-center justify-center rounded-lg border border-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-300 transition hover:border-red-500 hover:text-red-400 max-md:min-h-11 max-md:flex-1"
            >
              我的申请
            </Link>
            <Link
              href="/recruit/new"
              className="flex items-center justify-center rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold transition hover:bg-red-700 max-md:min-h-11 max-md:flex-1"
            >
              + 发布信息
            </Link>
          </div>
        </div>

        <div className="mb-5 flex gap-2 max-md:gap-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={
                "rounded-lg px-5 py-2 text-sm font-semibold transition max-md:min-h-11 max-md:flex-1 " +
                (tab === item.key ? "bg-red-600/20 text-red-400" : "text-zinc-500 hover:text-white")
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={tab === "TEAM" ? "搜索队伍招募...输入关键词" : "搜索选手求职...输入关键词"}
          className="mb-6 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
        />

        {loading && <p className="text-zinc-500">加载中...</p>}
        {error && <p className="text-red-400">{error}</p>}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {!loading &&
            posts.map((post) => (
              <RecruitmentPostCard
                key={post.id}
                post={post}
                myTeamId={myTeamId}
                onChanged={load}
              />
            ))}
        </div>

        {!loading && posts.length === 0 && (
          <p className="text-center text-zinc-500">
            {tab === "TEAM" ? "暂无队伍招募信息" : "暂无选手求职信息"}
          </p>
        )}
      </main>
    </div>
  );
}
