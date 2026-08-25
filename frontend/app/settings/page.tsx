"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, userApi } from "@/lib/api";
import { User, getUser, setUser, removeToken, isLoggedIn } from "@/lib/auth";
import NavBar from "@/components/NavBar";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [usernameVal, setUsernameVal] = useState("");
  const [gameIdVal, setGameIdVal] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [contactVal, setContactVal] = useState("");
  const [contactPublicVal, setContactPublicVal] = useState(false);
  const [displayPref, setDisplayPref] = useState("GAME_ID");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 3500);
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const cached = getUser();
    if (cached) setUserState(cached);
    authApi.getProfile()
      .then((res) => { setUserState(res.data.data); setUser(res.data.data);
    setContactVal(res.data.data.contact || "");
    setContactPublicVal(res.data.data.contactPublic || false);
    setDisplayPref(res.data.data.displayPreference || "GAME_ID"); })
      .catch(() => { removeToken(); router.replace("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  const refreshUser = async () => {
    const res = await authApi.getProfile();
    setUserState(res.data.data);
    setUser(res.data.data);
  };

  const handleUpdateUsername = async () => {
    setSubmitting("username");
    try { await userApi.updateUsername(usernameVal); await refreshUser(); setUsernameVal(""); showMsg("用户名更新成功", "success"); }
    catch (err: any) { showMsg(err.response?.data?.message || "更新失败", "error"); }
    finally { setSubmitting(null); }
  };

  const handleUpdateGameId = async () => {
    setSubmitting("gameId");
    try { await userApi.updateGameId(gameIdVal); await refreshUser(); setGameIdVal(""); showMsg("游戏ID更新成功", "success"); }
    catch (err: any) { showMsg(err.response?.data?.message || "更新失败", "error"); }
    finally { setSubmitting(null); }
  };

  const handleUpdateEmail = async () => {
    setSubmitting("email");
    try { await userApi.updateEmail(emailVal); await refreshUser(); setEmailVal(""); showMsg("邮箱更新成功", "success"); }
    catch (err: any) { showMsg(err.response?.data?.message || "更新失败", "error"); }
    finally { setSubmitting(null); }
  };

  const handleUpdatePassword = async () => {
    setSubmitting("password");
    try { await userApi.updatePassword(oldPwd, newPwd); setOldPwd(""); setNewPwd(""); showMsg("密码修改成功", "success"); }
    catch (err: any) { showMsg(err.response?.data?.message || "密码修改失败", "error"); }
    finally { setSubmitting(null); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-xl px-8 py-10">
        <h2 className="mb-8 text-2xl font-bold">账号设置</h2>

        {msg && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            msgType === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}>{msg}</div>
        )}

        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="mb-1 text-xs text-zinc-500">当前用户名</label>
          <p className="mb-3 text-lg font-medium">{user?.username}</p>
          <div className="flex gap-3">
            <input type="text" value={usernameVal} onChange={(e) => setUsernameVal(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-red-500" placeholder="输入新用户名" />
            <button onClick={handleUpdateUsername} disabled={submitting === "username" || !usernameVal}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-red-700">
              {submitting === "username" ? "..." : "修改"}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="mb-1 text-xs text-zinc-500">当前游戏 ID</label>
          <p className="text-lg font-medium">{user?.displayGameId || "未设置"}</p>
          <button onClick={async () => {
            if (!confirm("清空游戏ID后将使用用户名显示，确定继续？")) return;
            setSubmitting("clearGameId");
            try { await userApi.updateGameId(""); await refreshUser(); showMsg("游戏ID已清空", "success"); }
            catch (err: any) { showMsg(err.response?.data?.message || "操作失败", "error"); }
            finally { setSubmitting(null); }
          }}
            className="mt-2 text-xs text-red-400 hover:underline">清空游戏ID</button>
          {user?.gameId && <p className="mb-2 text-xs text-zinc-600">完整 ID：{user.gameId}</p>}
          <p className="mb-3 text-xs text-zinc-500">格式：主体（1-8字符） + # + 4-5位数字标记码，例如：玩家#1234</p>
          <div className="flex gap-3">
            <input type="text" value={gameIdVal} onChange={(e) => setGameIdVal(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-red-500" placeholder="例如：无畏契约#5678" />
            <button onClick={handleUpdateGameId} disabled={submitting === "gameId"}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-red-700">
              {submitting === "gameId" ? "..." : "修改"}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="mb-1 text-xs text-zinc-500">显示名称</label>
          <p className="mb-3 text-sm text-zinc-400">当前：{user?.displayName || user?.username || "未设置"}</p>
          <div className="flex gap-3">
            <button onClick={async () => {
              setSubmitting("displayPref");
              try { await userApi.updateDisplayPreference("GAME_ID"); await refreshUser(); setDisplayPref("GAME_ID"); showMsg("已切换到游戏ID", "success"); }
              catch (err: any) { showMsg(err.response?.data?.message || "更新失败", "error"); }
              finally { setSubmitting(null); }
            }}
              className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + ((user?.displayPreference || displayPref) === "GAME_ID" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>游戏ID</button>
            <button onClick={async () => {
              setSubmitting("displayPref");
              try { await userApi.updateDisplayPreference("USERNAME"); await refreshUser(); setDisplayPref("USERNAME"); showMsg("已切换到用户名", "success"); }
              catch (err: any) { showMsg(err.response?.data?.message || "更新失败", "error"); }
              finally { setSubmitting(null); }
            }}
              className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + ((user?.displayPreference || displayPref) === "USERNAME" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>用户名</button>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="mb-1 text-xs text-zinc-500">当前邮箱</label>
          <p className="mb-3 text-lg font-medium">{user?.email || "未设置"}</p>
          <div className="flex gap-3">
            <input type="email" value={emailVal} onChange={(e) => setEmailVal(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-red-500" placeholder="新邮箱" />
            <button onClick={handleUpdateEmail} disabled={submitting === "email" || !emailVal}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-red-700">
              {submitting === "email" ? "..." : "修改"}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="mb-1 text-xs text-zinc-500">联系方式</label>
          <p className="mb-3 text-sm text-zinc-400">{user?.contact || "未设置"}</p>
          <div className="flex gap-3 mb-3">
            <input type="text" value={contactVal} onChange={(e) => setContactVal(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-red-500" placeholder="邮箱 / QQ号 / 微信号" />
            <button onClick={async () => {
              setSubmitting("contact");
              try { await userApi.updateContact(contactVal, contactPublicVal); await refreshUser(); setContactVal(""); showMsg("联系方式更新成功", "success"); }
              catch (err: any) { showMsg(err.response?.data?.message || "更新失败", "error"); }
              finally { setSubmitting(null); }
            }} disabled={submitting === "contact"}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-red-700">
              {submitting === "contact" ? "..." : "保存"}
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={contactPublicVal} onChange={(e) => setContactPublicVal(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-red-600" />
            <span className="text-xs text-zinc-400">在个人主页展示联系方式</span>
          </label>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="mb-1 text-xs text-zinc-500">修改密码</label>
          <p className="mb-3 text-lg font-medium">********</p>
          <div className="space-y-3">
            <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-red-500" placeholder="旧密码" />
            <div className="flex gap-3">
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-red-500" placeholder="新密码（至少6位）" />
              <button onClick={handleUpdatePassword} disabled={submitting === "password" || !oldPwd || !newPwd}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-red-700">
                {submitting === "password" ? "..." : "修改"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}