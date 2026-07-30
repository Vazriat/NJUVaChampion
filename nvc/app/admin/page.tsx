"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BracketTree from "@/components/BracketTree";
import { adminApi, adminTournamentApi, searchApi, TournamentVO, MatchVO } from "@/lib/api";
import { getUser, removeToken, isLoggedIn } from "@/lib/auth";
import CreateTournamentModal from "@/components/CreateTournamentModal";
import GameDetailPanel from "@/components/GameDetailPanel";
import ScreenshotManager from "@/components/AdminScreenshotManager";
import AdminBannerManager from "@/components/AdminBannerManager";
import AdminAnnouncementManager from "@/components/AdminAnnouncementManager";
import CertificationManager from "@/components/AdminCertificationManager";
import GameRecordWizard from "@/components/GameRecordWizard";

type Tab = "overview" | "users" | "teams" | "tournaments" | "screenshots" | "certifications" | "banners" | "announcements";

interface AdminUser {
  id: number; username: string; gameId: string | null; displayGameId: string | null;
  email: string; role: string; status: number; createdAt: string;
}

interface AdminTeam {
  id: number; name: string; description: string | null;
  captainId: number; status: number; memberCount: number; createdAt: string;
}

const STATUS_MAP: Record<string, string> = {
  SETUP: "筹备中", REGISTRATION: "报名中", PROGRESSION: "进行中", ENDED: "已结束",
};

const ROUND_NAMES: Record<number, string> = { 0: "1/4 决赛", 1: "半决赛", 2: "决赛" };
const STAGE_LABEL: Record<string, string> = {
  WINNERS: "胜者组",
  LOSERS: "败者组",
  GRAND_FINAL: "总决赛",
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [tournaments, setTournaments] = useState<TournamentVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editTeam, setEditTeam] = useState<AdminTeam | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<TournamentVO | null>(null);
  const [tournamentMatches, setTournamentMatches] = useState<MatchVO[]>([]);
  const [showCreateEmptyTeam, setShowCreateEmptyTeam] = useState(false);
  const [emptyTeamName, setEmptyTeamName] = useState("");
  const [emptyTeamDesc, setEmptyTeamDesc] = useState("");
  const [showBulkAddTeam, setShowBulkAddTeam] = useState(false);
  const [swissStandings, setSwissStandings] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [allTeamsList, setAllTeamsList] = useState<AdminTeam[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ users: any[]; teams: any[]; tournaments: any[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [wizardMatch, setWizardMatch] = useState<{ tournamentId: number; matchId: number; team1Name: string; team2Name: string; team1Id: number; team2Id: number } | null>(null);

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    const u = getUser();
    if (u?.role !== "ADMIN") { router.replace("/dashboard"); return; }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([adminApi.listUsers(), adminApi.listTeams()]);
      setUsers(uRes.data.data);
      setTeams(tRes.data.data);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/tournaments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 200) setTournaments(json.data);
    } catch { removeToken(); router.replace("/login"); }
    finally { setLoading(false); }
  };

  const fetchTournaments = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/tournaments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 200) setTournaments(json.data);
    } catch {}
  };

  const loadTournamentDetail = async (t: TournamentVO) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/tournaments/${t.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 200) {
        setSelectedTournament(json.data);
        setTournamentMatches(json.data.matches || []);
      }
    } catch {}
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("确定禁用该用户？")) return;
    try { await adminApi.deleteUser(id); showMsg("用户已禁用"); fetchData(); }
    catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
  };

  const handleDeleteTeam = async (id: number) => {
    if (!confirm("确定解散该战队？")) return;
    try { await adminApi.deleteTeam(id); showMsg("战队已解散"); fetchData(); }
    catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    try { await adminApi.updateUser(editUser.id, form); setEditUser(null); showMsg("用户已更新"); fetchData(); }
    catch (err: any) { showMsg(err.response?.data?.message || "更新失败"); }
  };

  const handleSaveTeam = async () => {
    if (!editTeam) return;
    try { await adminApi.updateTeam(editTeam.id, form); setEditTeam(null); showMsg("战队已更新"); fetchData(); }
    catch (err: any) { showMsg(err.response?.data?.message || "更新失败"); }
  };

  const handlePublish = async (id: number) => {
    try { await adminTournamentApi.publish(id); showMsg("赛事已发布"); fetchTournaments(); loadTournamentDetail({ ...selectedTournament!, id } as TournamentVO); }
    catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
  };

  const loadSwissStandings = async (tournamentId: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/tournaments/" + tournamentId + "/swiss/standings", {
        headers: { Authorization: "Bearer " + token },
      });
      const json = await res.json();
      if (json.code === 200) setSwissStandings(json.data);
    } catch {}
  };

  const handleDeleteTournament = async (id: number) => {
    if (!confirm("确定删除该赛事？此操作不可恢复！")) return;
    try { await adminTournamentApi.delete(id); showMsg("赛事已删除"); fetchTournaments(); setSelectedTournament(null); }
    catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
  };

  const handleStart = async (id: number) => {
    try { await adminTournamentApi.start(id); showMsg("赛事已开始"); fetchTournaments(); }
    catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
  };

  const handleSetWinner = async (tournamentId: number, matchId: number) => {
    const t = selectedTournament;
    if (!t) return;
    const m = tournamentMatches.find(x => x.id === matchId);
    if (!m || !m.team1Id || !m.team2Id) return;
    setWizardMatch({
      tournamentId,
      matchId,
      team1Name: m.team1Name || '队伍1',
      team2Name: m.team2Name || '队伍2',
      team1Id: m.team1Id,
      team2Id: m.team2Id,
    });
  };

  const openEditUser = (u: AdminUser) => {
    setEditUser(u);
    setForm({
      username: u.username ?? "", email: u.email ?? "", gameId: u.gameId ?? "",
      role: u.role, status: u.status, resetPassword: false,
    });
  };

  const openEditTeam = (t: AdminTeam) => {
    setEditTeam(t);
    setForm({ name: t.name ?? "", description: t.description ?? "", status: t.status });
  };

  const activeUsers = users.filter((u) => u.status === 1 && u.role !== "ADMIN").length;
  const activeTeams = teams.filter((t) => t.status === 1).length;
  const activeTournaments = tournaments.filter((t) => t.status !== "ENDED").length;
  const currentUser = getUser();

  const handleBulkAddTeams = async () => {
    if (!selectedTournament || selectedTeamIds.length === 0) return;
    try {
      const res = await adminTournamentApi.batchRegister(selectedTournament.id, selectedTeamIds);
      if (res.data.code === 200) {
        showMsg(`成功添加 ${selectedTeamIds.length} 支队伍`);
        setShowBulkAddTeam(false);
        setSelectedTeamIds([]);
        loadTournamentDetail(selectedTournament);
      if (selectedTournament.format === "SWISS_ELIM") loadSwissStandings(selectedTournament.id);
        fetchTournaments();
      } else {
        showMsg(res.data.message || "添加失败");
      }
    } catch (err: any) {
      showMsg(err.response?.data?.message || "添加失败");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await searchApi.search(searchQuery.trim());
      setSearchResults(res.data.data);
    } catch { showMsg("搜索失败"); }
    finally { setSearching(false); }
  };

    const handleRemoveTeam = async (teamId: number) => {
    if (!selectedTournament || !confirm("确定从赛事中移除该队伍？")) return;
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/admin/tournaments/" + selectedTournament.id + "/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ teamId }),
      });
      showMsg("队伍已移除");
      loadTournamentDetail(selectedTournament);
      if (selectedTournament.format === "SWISS_ELIM") loadSwissStandings(selectedTournament.id);
    } catch (err: any) {
      showMsg(err.response?.data?.message || "移除失败");
    }
  };

  const openCreateEmptyTeam = () => {
    setEmptyTeamName("");
    setEmptyTeamDesc("");
    setShowCreateEmptyTeam(true);
  };

  const handleCreateEmptyTeam = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ name: emptyTeamName.trim(), description: emptyTeamDesc.trim() || undefined }),
      });
      const json = await res.json();
      if (json.code === 200) {
        showMsg("战队已创建");
        setShowCreateEmptyTeam(false);
        fetchData();
      } else {
        showMsg(json.message || "创建失败");
      }
    } catch (err: any) {
      showMsg("创建失败");
    }

  };
    const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[80vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><p className="text-zinc-400">加载中...</p></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-red-500">VALORANT</h1>
          <span className="text-sm text-zinc-600">管理后台</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded bg-red-600/20 px-3 py-1 text-sm text-red-400">管理员</span>
          <span className="text-zinc-400">{currentUser?.username}</span>
          <Link href="/login" onClick={() => { removeToken(); }}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400">退出</Link>
        </div>
      </header>

      {msg && (
        <div className="mx-8 mt-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>
      )}

      <main className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-8 flex gap-6 border-b border-zinc-800">
          {([["overview", "概览"], ["users", "用户管理"], ["teams", "战队管理"], ["tournaments", "赛事管理"], ["screenshots", "截图管理"], ["certifications", "认证审核"], ["banners", "宣传栏管理"], ["announcements", "通知管理"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setSelectedTournament(null); }}
              className={`pb-3 text-sm font-medium transition border-b-2 ${tab === key ? "border-red-500 text-red-400" : "border-transparent text-zinc-500 hover:text-white"}`}>{label}</button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="搜索用户、战队、赛事..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
            />
            <button onClick={handleSearch} disabled={searching}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {searching ? "搜索中..." : "搜索"}
            </button>
          </div>

          {searchResults && (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300">搜索结果</span>
                <button onClick={() => setSearchResults(null)} className="text-xs text-zinc-500 hover:text-white">关闭</button>
              </div>

              {(searchResults.users?.length > 0) && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-zinc-500">用户 ({searchResults.users.length})</p>
                  {searchResults.users.map((u: any) => (
                    <Link key={u.id} href={"/profile/" + u.id} className="block rounded-lg bg-zinc-800/50 px-3 py-2 text-sm transition hover:bg-zinc-700">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-zinc-200">{u.username}</span>
                      <span className="text-xs text-zinc-500">{u.role}</span>
                      {u.gameId && <span className="text-xs text-zinc-600">{u.gameId}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {(searchResults.teams?.length > 0) && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-zinc-500">战队 ({searchResults.teams.length})</p>
                  {searchResults.teams.map((t: any) => (
                    <Link key={t.id} href={"/teams/" + t.id} className="block rounded-lg bg-zinc-800/50 px-3 py-2 text-sm transition hover:bg-zinc-700">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-zinc-200">{t.name}</span>
                      <span className="text-xs text-zinc-500">ID:{t.id}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {(searchResults.tournaments?.length > 0) && (
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500">赛事 ({searchResults.tournaments.length})</p>
                  {searchResults.tournaments.map((t: any) => (
                    <Link key={t.id} href={"/tournaments/" + t.id} className="block rounded-lg bg-zinc-800/50 px-3 py-2 text-sm transition hover:bg-zinc-700">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-zinc-200">{t.name}</span>
                        <span className="text-xs text-zinc-500">{t.status} · {t.format}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {!searchResults.users?.length && !searchResults.teams?.length && !searchResults.tournaments?.length && (
                <p className="py-4 text-center text-sm text-zinc-500">未找到相关结果</p>
              )}
            </div>
          )}
        </div>

        {tab === "overview" && (
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { label: "活跃用户", value: activeUsers, color: "text-blue-400" },
              { label: "活跃战队", value: activeTeams, color: "text-green-400" },
              { label: "进行中赛事", value: activeTournaments, color: "text-red-400" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">{item.label}</p>
                <p className={`mt-2 text-4xl font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-3 pr-4">ID</th><th className="pb-3 pr-4">用户名</th><th className="pb-3 pr-4">游戏ID</th>
                <th className="pb-3 pr-4">角色</th><th className="pb-3 pr-4">状态</th><th className="pb-3 pr-4">操作</th>
              </tr></thead>
              <tbody>{users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/50">
                  <td className="py-3 pr-4">{u.id}</td>
                  <td className="py-3 pr-4">{u.username}</td>
                  <td className="py-3 pr-4 text-zinc-400">{u.displayGameId || "-"}</td>
                  <td className="py-3 pr-4">{u.role}</td>
                  <td className="py-3 pr-4"><span className={`rounded px-2 py-0.5 text-xs ${u.status === 1 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{u.status === 1 ? "正常" : "禁用"}</span></td>
                  <td className="py-3 pr-4 flex gap-2">
                    <button onClick={() => openEditUser(u)} className="text-xs text-blue-400 hover:underline">编辑</button>
                    <button onClick={() => handleDeleteUser(u.id)} className="text-xs text-red-400 hover:underline">禁用</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "teams" && (
          <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-3 pr-4">ID</th><th className="pb-3 pr-4">战队名</th><th className="pb-3 pr-4">人数</th>
                <th className="pb-3 pr-4">状态</th><th className="pb-3 pr-4">操作</th>
              </tr></thead>
              <tbody>{teams.map((t) => (
                <tr key={t.id} className="border-b border-zinc-800/50">
                  <td className="py-3 pr-4">{t.id}</td>
                  <td className="py-3 pr-4">{t.name}</td>
                  <td className="py-3 pr-4">{t.memberCount}</td>
                  <td className="py-3 pr-4"><span className={`rounded px-2 py-0.5 text-xs ${t.status === 1 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{t.status === 1 ? "正常" : "已解散"}</span></td>
                  <td className="py-3 pr-4 flex gap-2">
                    <button onClick={() => openEditTeam(t)} className="text-xs text-blue-400 hover:underline">编辑</button>
                    <button onClick={() => handleDeleteTeam(t.id)} className="text-xs text-red-400 hover:underline">解散</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
            <div className="mt-6">
              <button onClick={openCreateEmptyTeam}
                className="rounded-lg border border-dashed border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:border-red-500 hover:text-red-400 transition">
                + 创建无人战队（测试用）
              </button>
            </div>
          </div>
        )}
        {tab === "tournaments" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">全部赛事</h3>
              <button onClick={() => setShowCreateTournament(true)}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold hover:bg-red-700">+ 创建赛事</button>
            </div>

            <div className="space-y-3">
              {tournaments.map((t) => (
                <div key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{t.name}</h4>
                      <p className="mt-1 text-xs text-zinc-500">{STATUS_MAP[t.status]} · {t.registeredCount}/{t.maxTeams} 队 · 单场淘汰</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDeleteTournament(t.id)} className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">删除</button>
                      <Link href={"/tournaments/"+t.id} className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-red-500 hover:text-red-400">查看</Link>
                      <button onClick={() => loadTournamentDetail(t)}
                        className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-red-500 hover:text-red-400">详情</button>
                      {t.status === "SETUP" && (
                        <button onClick={() => handlePublish(t.id)}
                          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">发布</button>
                      )}
                      {t.status === "REGISTRATION" && (
                        <button onClick={() => handleStart(t.id)}
                          className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">开始</button>
                      )}
                    </div>
                  </div>
                  {t.championTeamName && (
                    <p className="mt-2 text-xs text-yellow-400">🏆 冠军：{t.championTeamName}</p>
                  )}
                </div>
              ))}
              {tournaments.length === 0 && <p className="text-center text-zinc-500 py-8">暂无赛事</p>}
            </div>

            {showCreateTournament && (
              <CreateTournamentModal
                onClose={() => setShowCreateTournament(false)}
                onSuccess={(msg) => { showMsg(msg); fetchTournaments(); }}
              />
            )}

            {selectedTournament && (
              <Modal title={selectedTournament.name} onClose={() => setSelectedTournament(null)}>
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400">
                    状态：{STATUS_MAP[selectedTournament.status]} · 报名 {selectedTournament.registeredCount}/{selectedTournament.maxTeams}
                  </p>

                  {selectedTournament.status === "SETUP" && (
                    <button onClick={() => { handlePublish(selectedTournament.id); setSelectedTournament(null); }}
                      className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold hover:bg-blue-700">发布赛事（进入报名阶段）</button>
                  )}
                  {selectedTournament.status === "REGISTRATION" && (
                    <button onClick={() => { handleStart(selectedTournament.id); setSelectedTournament(null); }}
                      className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold hover:bg-green-700">开始比赛（生成对阵表）</button>
                  )}
                  {selectedTournament.status === "PROGRESSION" && tournamentMatches.length > 0 && (
                    <div>
                      <p className="mb-3 text-sm font-semibold">对阵表</p>
                      <div className="overflow-x-auto pb-4">
                        <BracketTree
                          matches={tournamentMatches}
                          format={selectedTournament?.format}
                          onMatchClick={(m: any) => {
                            if (m.team1Id && m.team2Id && (m.status === "PENDING" || m.status === "COMPLETED")) {
                              handleSetWinner(selectedTournament.id, m.id);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {selectedTournament.status === "ENDED" && (
                    <div>
                      {selectedTournament.championTeamName ? (
                        <div className="rounded-lg bg-yellow-500/10 p-6 text-center">
                          <p className="text-sm text-yellow-500">🏆 冠军</p>
                          <p className="mt-2 text-2xl font-bold text-yellow-400">{selectedTournament.championTeamName}</p>
                        </div>
                      ) : <p className="text-zinc-500">赛事已结束</p>}
                    </div>
                  )}

                  {selectedTournament.format === "SWISS_ELIM" && swissStandings.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">瑞士轮排名</p>
                      <div className="mb-3 space-y-1">
                        {swissStandings.map((s: any, i: number) => (
                          <div key={s.id} className="flex items-center gap-3 rounded bg-zinc-800 px-3 py-1.5 text-xs">
                            <span className={"w-5 font-bold " + (i < 8 ? "text-red-400" : "text-zinc-600")}>{i + 1}</span>
                            <span className="flex-1 text-zinc-300">{s.teamId} {s.wins}W-{s.losses}L</span>
                            <span className="text-zinc-500">BU={s.buchholz}</span>
                          </div>
                        ))}
                      </div>
                      {selectedTournament.currentStage === 0 && (selectedTournament.currentSwissRound ?? 0) >= (selectedTournament.swissRounds || 5) && (
                        <button onClick={async () => {
                          const token = localStorage.getItem("token");
                          await fetch("/api/admin/tournaments/" + selectedTournament.id + "/swiss/generate-knockout", {
                            method: "POST", headers: { Authorization: "Bearer " + token },
                          });
                          showMsg("八强对阵已生成");
                          loadTournamentDetail(selectedTournament);
      if (selectedTournament.format === "SWISS_ELIM") loadSwissStandings(selectedTournament.id);
                        }}
                          className="w-full rounded-lg bg-red-600 py-2 text-xs font-semibold hover:bg-red-700">生成八强对阵</button>
                      )}
                    </div>
                  )}
                  {selectedTournament.registeredTeams && selectedTournament.registeredTeams.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">报名队伍</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTournament.registeredTeams.map((rt) => (
                          <div key={rt.id} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-3 py-1">
                            <span className="text-xs text-zinc-300">
                              {rt.teamName} <span className="text-zinc-500">#{rt.seed}</span>
                            </span>
                            {(selectedTournament.status === "SETUP" || selectedTournament.status === "REGISTRATION") && (
                              <button onClick={() => handleRemoveTeam(rt.teamId)}
                                className="ml-1 text-red-500 hover:text-red-400 text-xs leading-none">&times;</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                  {(selectedTournament.status === "SETUP" || selectedTournament.status === "REGISTRATION") && (
                    <button onClick={async () => { setShowBulkAddTeam(true); try { const res = await adminApi.listTeams(); setAllTeamsList(res.data.data || []); } catch {} }}
                      className="mt-3 rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-blue-500 hover:text-blue-400 transition">
                      + 批量添加队伍
                    </button>
                  )}
                  {showBulkAddTeam && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
                      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-semibold">批量添加队伍</h3>
                          <button onClick={() => { setShowBulkAddTeam(false); setSelectedTeamIds([]); }} className="text-zinc-500 hover:text-white text-xl">&times;</button>
                        </div>
                        <div className="max-h-96 space-y-1 overflow-y-auto">
                          {allTeamsList
                            .filter(t => t.status === 1 && !(selectedTournament?.registeredTeams || []).some(rt => rt.teamId === t.id))
                            .map(t => {
                              const checked = selectedTeamIds.includes(t.id);
                              return (
                                <label key={t.id} className={"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition " + (checked ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-800 hover:border-zinc-600")}>
                                  <input type="checkbox" checked={checked} onChange={() => {
                                    setSelectedTeamIds(prev =>
                                      prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                                    );
                                  }} className="rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500" />
                                  <span className="font-medium text-zinc-200">{t.name}</span>
                                  <span className="ml-auto text-xs text-zinc-500">ID:{t.id} · {t.memberCount}人{t.captainId === 0 ? " · 无人战队" : ""}</span>
                                </label>
                              );
                            })}
                          {allTeamsList.filter(t => t.status === 1 && !(selectedTournament?.registeredTeams || []).some(rt => rt.teamId === t.id)).length === 0 && (
                            <p className="py-8 text-center text-xs text-zinc-500">没有可添加的队伍</p>
                          )}
                        </div>
                        {selectedTeamIds.length > 0 && (
                          <div className="mt-4 border-t border-zinc-800 pt-4">
                            <p className="mb-2 text-xs text-zinc-500">已选择 {selectedTeamIds.length} 支队伍</p>
                            <button onClick={handleBulkAddTeams}
                              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold hover:bg-blue-700">确认批量添加</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </Modal>
            )}
          </div>
        )}


        {wizardMatch && (
          <GameRecordWizard
            tournamentId={wizardMatch.tournamentId}
            matchId={wizardMatch.matchId}
            team1Id={wizardMatch.team1Id}
            team2Id={wizardMatch.team2Id}
            team1Name={wizardMatch.team1Name}
            team2Name={wizardMatch.team2Name}
            onClose={() => setWizardMatch(null)}
            onComplete={(msg) => { showMsg(msg); fetchTournaments(); loadTournamentDetail({ ...selectedTournament!, id: wizardMatch.tournamentId } as TournamentVO); }}
          />
        )}

        {tab === "screenshots" && (
          <ScreenshotManager />
        )}

        {tab === "certifications" && (
          <CertificationManager />
        )}

        {tab === "banners" && (
          <AdminBannerManager />
        )}

        {tab === "announcements" && (
          <AdminAnnouncementManager />
        )}

        {editUser && (
          <Modal title="编辑用户" onClose={() => setEditUser(null)}>
            <div className="space-y-4">
              <div><label className="mb-1 block text-xs text-zinc-500">用户名</label>
                <input type="text" value={form.username || ""} onChange={(e) => setForm({...form, username: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">游戏 ID</label>
                <input type="text" value={form.gameId || ""} onChange={(e) => setForm({...form, gameId: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">邮箱</label>
                <input type="text" value={form.email || ""} onChange={(e) => setForm({...form, email: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">角色</label>
                {editUser.role === "ADMIN" ? (
                  <p className="text-sm text-zinc-400">ADMIN（不可修改）</p>
                ) : (
                  <select value={form.role || "PLAYER"} onChange={(e) => setForm({...form, role: e.target.value})}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500">
                    <option value="PLAYER">PLAYER</option>
                    <option value="CAPTAIN">CAPTAIN</option>
                  </select>
                )}
              </div>
              <div><label className="mb-1 block text-xs text-zinc-500">状态</label>
                <select value={form.status ?? 1} onChange={(e) => setForm({...form, status: Number(e.target.value)})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500">
                  <option value={1}>正常</option>
                  <option value={0}>禁用</option>
                </select>
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.resetPassword || false} onChange={(e) => setForm({...form, resetPassword: e.target.checked})}
                    className="rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-red-500" />
                  <span className="text-sm text-zinc-300">重置密码为 <code className="text-red-400">123456</code></span>
                </label>
              </div>
              <button onClick={handleSaveUser}
                className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">保存</button>
            </div>
          </Modal>
        )}


        {showCreateEmptyTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={() => setShowCreateEmptyTeam(false)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
              </div>
              <div className="space-y-4">
                <div><label className="mb-1 block text-xs text-zinc-500">战队名</label>
                  <input type="text" value={emptyTeamName} onChange={(e) => setEmptyTeamName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" placeholder="测试战队" /></div>
                <div><label className="mb-1 block text-xs text-zinc-500">简介（选填）</label>
                  <textarea value={emptyTeamDesc} onChange={(e) => setEmptyTeamDesc(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" rows={2} /></div>
                <button onClick={handleCreateEmptyTeam} disabled={!emptyTeamName.trim()}
                  className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">创建</button>
              </div>
            </div>
          </div>
        )}

        {editTeam && (
          <Modal title="编辑战队" onClose={() => setEditTeam(null)}>
            <div className="space-y-4">
              <div><label className="mb-1 block text-xs text-zinc-500">战队名</label>
                <input type="text" value={form.name || ""} onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">简介</label>
                <textarea value={form.description || ""} onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" rows={3} /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">状态</label>
                <select value={form.status ?? 1} onChange={(e) => setForm({...form, status: Number(e.target.value)})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500">
                  <option value={1}>正常</option>
                  <option value={0}>已解散</option>
                </select>
              </div>
              <button onClick={handleSaveTeam}
                className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">保存</button>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}