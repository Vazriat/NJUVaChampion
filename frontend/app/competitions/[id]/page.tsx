"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { competitionApi, teamApi } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, string> = {
  SETUP: "筹备中",
  REGISTRATION: "报名中",
  GROUPED: "已分组",
};

export default function CompetitionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [comp, setComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [captainTeams, setCaptainTeams] = useState<any[]>([]);

  const currentUser = getUser();

  const fetch = () => {
    setLoading(true);
    competitionApi
      .detail(Number(id))
      .then((r) => setComp(r.data.data))
      .catch(() => router.replace("/competitions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    fetch();
  }, [id, router]);

  const handleOpenPicker = async () => {
    try {
      const res = await teamApi.myCaptainedTeams();
      setCaptainTeams(res.data.data || []);
      setShowPicker(true);
    } catch {
      setMsg("获取战队失败");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleRegister = async (teamId: number) => {
    try {
      await competitionApi.register(Number(id), teamId);
      setMsg("报名成功");
      setShowPicker(false);
      fetch();
    } catch (e: any) {
      setMsg(e.response?.data?.message || "报名失败");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const handleUnregister = async (teamId: number) => {
    if (!confirm("确定取消报名？")) return;
    try {
      await competitionApi.unregister(Number(id), teamId);
      setMsg("已取消报名");
      fetch();
    } catch (e: any) {
      setMsg(e.response?.data?.message || "取消失败");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <NavBar />
        <p className="text-zinc-500">加载中...</p>
      </div>
    );
  }

  if (!comp) return null;

  const myRegistered = (comp.registeredTeams || []).filter(
    (rt: any) => currentUser && rt.captainId === currentUser.id
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-5xl px-8 py-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{comp.name}</h1>
            {comp.description && <p className="mt-2 text-zinc-400">{comp.description}</p>}
          </div>
          <span className="rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-sm text-zinc-300">
            {STATUS_MAP[comp.status] || comp.status}
          </span>
        </div>

        {msg && (
          <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">{msg}</div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* 报名队伍 */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">报名队伍（{comp.registeredCount}）</h2>
              {comp.status === "REGISTRATION" && (
                <div className="flex gap-2">
                  <button onClick={handleOpenPicker}
                    className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold hover:bg-red-700">
                    报名参赛
                  </button>
                  {myRegistered.length > 0 && (
                    <button onClick={() => handleUnregister(myRegistered[0].teamId)}
                      className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400">
                      取消报名
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {(comp.registeredTeams || []).length === 0 ? (
                <p className="text-sm text-zinc-500">暂无报名队伍</p>
              ) : (
                (comp.registeredTeams || []).map((rt: any) => (
                  <div key={rt.teamId} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div>
                      <Link href={`/teams/${rt.teamId}`} className="font-medium text-sm hover:text-red-400 transition">
                        {rt.teamName}
                      </Link>
                      <p className="text-xs text-zinc-500">队长：{rt.captainName || "无"} · {rt.memberCount} 人</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 分组后的子赛事 */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">分组赛事</h2>
            <div className="space-y-2">
              {(comp.childTournaments || []).length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {comp.status === "GROUPED" ? "暂无分组赛事" : "报名结束后由管理员分组"}
                </p>
              ) : (
                (comp.childTournaments || []).map((t: any) => (
                  <Link key={t.tournamentId} href={`/tournaments/${t.tournamentId}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-red-500/50">
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-zinc-500">{t.groupName} · {t.maxTeams} 队</p>
                    </div>
                    <span className="text-xs text-zinc-500">{t.status}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">选择战队</h3>
              <button onClick={() => setShowPicker(false)} className="text-zinc-500 hover:text-white text-xl transition">&times;</button>
            </div>
            <div className="space-y-3">
              {captainTeams.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-500">你暂无担任队长的战队</p>
              ) : (
                captainTeams.map((team: any) => (
                  <button key={team.id} onClick={() => handleRegister(team.id)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-left transition hover:border-red-500 hover:bg-zinc-700 group">
                    <p className="font-medium group-hover:text-red-400 transition">{team.name}</p>
                    <p className="text-xs text-zinc-500">队员 {team.memberCount} 人</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
