"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { teamApi } from "@/lib/api";
import NavBar from "@/components/NavBar";

export default function CreateTeamPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await teamApi.create(form);
      router.push(`/teams/${res.data.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-lg px-8 py-14">
        <h2 className="mb-8 text-2xl font-bold">创建战队</h2>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">战队名 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="2-50个字符"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">战队简介</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="介绍一下你们的战队（选填）"
              rows={4}
              maxLength={500}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 py-2.5 font-semibold transition hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建战队"}
          </button>
        </form>
      </main>
    </div>
  );
}