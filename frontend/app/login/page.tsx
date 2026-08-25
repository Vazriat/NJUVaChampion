"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { setToken, setUser, isIdentityVerified } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login(form);
      setToken(res.data.data.token);

      const profile = await authApi.getProfile();
      setUser(profile.data.data);

      const user = profile.data.data;
      // 管理员跳转管理后台；未通过身份认证的用户强制先去认证
      if (user.role === "ADMIN") {
        router.replace("/admin");
      } else if (!isIdentityVerified(user)) {
        router.replace("/verify?required=1");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-3xl font-bold text-red-500">VALORANT</h1>
        <p className="mb-8 text-center text-sm text-zinc-400">赛事平台 · 登录</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">用户名</label>
            <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="请输入用户名" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">密码</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="请输入密码" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          还没有账号？<Link href="/register" className="text-red-400 hover:text-red-300">立即注册</Link>
        </p>
      </div>
    </div>
  );
}