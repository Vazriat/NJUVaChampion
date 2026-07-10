"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "", confirmPassword: "", gameId: "", email: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("两次密码输入不一致");
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...data } = form;
      await authApi.register(data);
      router.push("/login?registered=1");
    } catch (err: any) {
      setError(err.response?.data?.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-3xl font-bold text-red-500">VALORANT</h1>
        <p className="mb-8 text-center text-sm text-zinc-400">赛事平台 · 注册</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">用户名 *</label>
            <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="3-50个字符" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">游戏 ID</label>
            <input type="text" value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="主体#标记码，例如：玩家#1234（选填）" />
            <p className="mt-1 text-xs text-zinc-600">1-8位主体 + # + 4-5位数字标记码</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">密码 *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="至少6个字符" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">确认密码 *</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="再次输入密码" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">邮箱</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="选填" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          已有账号？<Link href="/login" className="text-red-400 hover:text-red-300">立即登录</Link>
        </p>
      </div>
    </div>
  );
}