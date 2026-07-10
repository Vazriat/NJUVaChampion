"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { teamApi, TeamVO } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";
import Link from "next/link";

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<TeamVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const currentUser = getUser();
  const isMember = team?.members?.some((m) => m.userId === currentUser?.id);
  const isCaptain = team?.captainId === currentUser?.id;

  const fetchTeam = () => {
    setLoading(true);
    teamApi.detail(Number(id))
      .then((res) => setTeam(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    fetchTeam();
  }, [id, router]);

  const handleJoin = async () => {
    setActionLoading(true);
    try { await teamApi.join(Number(id)); fetchTeam(); }
    catch (err: any) { alert(err.response?.data?.message || "操作失败"); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    if (!confirm("确认退出该战队？")) return;
    setActionLoading(true);
    try { await teamApi.leave(Number(id)); router.push("/teams"); }
    catch (err: any) { alert(err.response?.data?.message || "操作失败"); }
    finally { setActionLoading(false); }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><NavBar /><p className="text-zinc-500">加载中...</p></div>;
  }

  if (error || !team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <NavBar />
        <div className="text-center">
          <p className="text-red-400">{error || "战队不存在"}</p>
          <Link href="/teams" className="mt-4 inline-block text-red-500 hover:underline">返回战队列表</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-3xl px-8 py-10">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-600/20 text-3xl font-bold text-red-400">
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{team.name}</h1>
              <Link href={`/profile/${team.captainId}`} className="mt-1 block text-zinc-400 hover:text-red-400">
                队长：{team.captainName}
              </Link>
              <p className="text-sm text-zinc-500">队员 {team.memberCount}/5</p>
            </div>
          </div>

          <div className="flex gap-3">
            {!isMember && (
              <button onClick={handleJoin} disabled={actionLoading}
                className="rounded-lg bg-red-600 px-6 py-2 font-semibold transition hover:bg-red-700 disabled:opacity-50">
                {actionLoading ? "处理中..." : "加入战队"}
              </button>
            )}
            {isMember && !isCaptain && (
              <button onClick={handleLeave} disabled={actionLoading}
                className="rounded-lg border border-zinc-700 px-6 py-2 font-semibold text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50">
                {actionLoading ? "处理中..." : "退出战队"}
              </button>
            )}
            {isCaptain && (
              <span className="rounded-lg bg-yellow-600/20 px-6 py-2 text-sm text-yellow-400">队长</span>
            )}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">战队简介</h2>
          <p className="text-zinc-300">{team.description || ""}</p>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold">队员列表</h2>
          <div className="space-y-3">
            {team.members?.map((member) => (
              <Link
                key={member.id}
                href={`/profile/${member.userId}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-red-500/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400">
                    {member.displayName?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.displayName}
                      {member.role === "CAPTAIN" && (
                        <span className="ml-2 rounded bg-yellow-600/20 px-1.5 py-0.5 text-xs text-yellow-400">队长</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">@{member.username}</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-600">
                  {new Date(member.joinedAt).toLocaleDateString("zh-CN")} 加入
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}