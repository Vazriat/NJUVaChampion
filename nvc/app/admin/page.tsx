"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import { getUser, removeToken, isLoggedIn } from "@/lib/auth";
import Link from "next/link";

type Tab = "overview" | "users" | "teams";

interface AdminUser {
  id: number; username: string; gameId: string | null; displayGameId: string | null;
  email: string; role: string; status: number; createdAt: string;
}

interface AdminTeam {
  id: number; name: string; description: string | null;
  captainId: number; status: number; memberCount: number; createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editTeam, setEditTeam] = useState<AdminTeam | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

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
    } catch { removeToken(); router.replace("/login"); }
    finally { setLoading(false); }
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

  const openEditUser = (u: AdminUser) => {
    setEditUser(u);
    setForm({
      username: u.username ?? "",
      email: u.email ?? "",
      gameId: u.gameId ?? "",
      role: u.role,
      status: u.status,
      resetPassword: false,
    });
  };

  const openEditTeam = (t: AdminTeam) => {
    setEditTeam(t);
    setForm({ name: t.name ?? "", description: t.description ?? "", status: t.status });
  };

  const activeUsers = users.filter((u) => u.status === 1 && u.role !== "ADMIN").length;
  const activeTeams = teams.filter((t) => t.status === 1).length;

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

  const currentUser = getUser();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-red-500">VALORANT</h1>
          <span className="text-sm text-zinc-600">管理后台</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded bg-red-600/20 px-3 py-1 text-sm text-red-400">管理员</span>
          <span className="text-zinc-400">{currentUser?.username}</span>
          <Link href="/login" onClick={() => { removeToken(); }}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400">
            退出
          </Link>
        </div>
      </header>

      {msg && <div className="mx-8 mt-4 rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">{msg}</div>}

      <main className="mx-auto max-w-6xl px-8 py-10">
        {/* 标签导航 */}
        <div className="mb-8 flex gap-6 border-b border-zinc-800">
          <button onClick={() => setTab("overview")}
            className={`pb-3 text-sm font-semibold transition ${tab === "overview" ? "border-b-2 border-red-500 text-red-400" : "text-zinc-500 hover:text-white"}`}>
            概览
          </button>
          <button onClick={() => setTab("users")}
            className={`pb-3 text-sm font-semibold transition ${tab === "users" ? "border-b-2 border-red-500 text-red-400" : "text-zinc-500 hover:text-white"}`}>
            用户管理
          </button>
          <button onClick={() => setTab("teams")}
            className={`pb-3 text-sm font-semibold transition ${tab === "teams" ? "border-b-2 border-red-500 text-red-400" : "text-zinc-500 hover:text-white"}`}>
            战队管理
          </button>
        </div>

        {/* ====== 概览 ====== */}
        {tab === "overview" && !loading && (
          <div>
            <h2 className="mb-6 text-xl font-semibold">系统概览</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">活跃用户</p>
                <p className="mt-2 text-3xl font-bold text-red-400">{activeUsers}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">总用户数</p>
                <p className="mt-2 text-3xl font-bold">{users.length}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">活跃战队</p>
                <p className="mt-2 text-3xl font-bold text-red-400">{activeTeams}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">总战队数</p>
                <p className="mt-2 text-3xl font-bold">{teams.length}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <button onClick={() => setTab("users")}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-left transition hover:border-red-500/50">
                <h3 className="text-lg font-semibold group-hover:text-red-400">用户管理 →</h3>
                <p className="mt-1 text-sm text-zinc-500">查看、编辑、禁用用户账号，重置密码</p>
              </button>
              <button onClick={() => setTab("teams")}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-left transition hover:border-red-500/50">
                <h3 className="text-lg font-semibold group-hover:text-red-400">战队管理 →</h3>
                <p className="mt-1 text-sm text-zinc-500">查看、编辑、解散战队</p>
              </button>
            </div>
          </div>
        )}

        {/* ====== 用户管理 ====== */}
        {tab === "users" && !loading && (
          <div className="overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">用户列表</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="py-3 pr-4">ID</th>
                  <th className="py-3 pr-4">用户名</th>
                  <th className="py-3 pr-4">游戏 ID</th>
                  <th className="py-3 pr-4">邮箱</th>
                  <th className="py-3 pr-4">角色</th>
                  <th className="py-3 pr-4">状态</th>
                  <th className="py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-900">
                    <td className="py-3 pr-4 text-zinc-500">{u.id}</td>
                    <td className="py-3 pr-4 font-medium">{u.username}</td>
                    <td className="py-3 pr-4 text-zinc-400">{u.displayGameId || "-"}</td>
                    <td className="py-3 pr-4 text-zinc-400">{u.email || "-"}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded px-2 py-0.5 text-xs ${u.role === "ADMIN" ? "bg-red-600/20 text-red-400" : "bg-zinc-800 text-zinc-400"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs ${u.status === 1 ? "text-green-400" : "text-red-400"}`}>
                        {u.status === 1 ? "正常" : "禁用"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEditUser(u)}
                          className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:text-white">编辑</button>
                        {u.role !== "ADMIN" && (
                          <button onClick={() => handleDeleteUser(u.id)}
                            className="rounded bg-red-600/10 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">禁用</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ====== 战队管理 ====== */}
        {tab === "teams" && !loading && (
          <div className="overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">战队列表</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="py-3 pr-4">ID</th>
                  <th className="py-3 pr-4">战队名</th>
                  <th className="py-3 pr-4">简介</th>
                  <th className="py-3 pr-4">人数</th>
                  <th className="py-3 pr-4">状态</th>
                  <th className="py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900">
                    <td className="py-3 pr-4 text-zinc-500">{t.id}</td>
                    <td className="py-3 pr-4 font-medium">{t.name}</td>
                    <td className="py-3 pr-4 text-zinc-400 max-w-xs truncate">{t.description || "-"}</td>
                    <td className="py-3 pr-4 text-zinc-400">{t.memberCount}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs ${t.status === 1 ? "text-green-400" : "text-red-400"}`}>
                        {t.status === 1 ? "正常" : "已解散"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEditTeam(t)}
                          className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:text-white">编辑</button>
                        <button onClick={() => handleDeleteTeam(t.id)}
                          className="rounded bg-red-600/10 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">解散</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 编辑用户弹窗 */}
        {editUser && (
          <Modal title="编辑用户" onClose={() => setEditUser(null)}>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">用户名</label>
                <input type="text" value={form.username || ""} onChange={(e) => setForm({...form, username: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">游戏 ID</label>
                <input type="text" value={form.gameId || ""} onChange={(e) => setForm({...form, gameId: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">邮箱</label>
                <input type="text" value={form.email || ""} onChange={(e) => setForm({...form, email: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">角色</label>
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
              <div>
                <label className="mb-1 block text-xs text-zinc-500">状态</label>
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

        {/* 编辑战队弹窗 */}
        {editTeam && (
          <Modal title="编辑战队" onClose={() => setEditTeam(null)}>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">战队名</label>
                <input type="text" value={form.name || ""} onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">简介</label>
                <textarea value={form.description || ""} onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" rows={3} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">状态</label>
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