"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { publicUserApi, UserVO } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentUser = getUser();
  const isSelf = currentUser?.id === Number(id);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    publicUserApi
      .detail(Number(id))
      .then((res) => setUser(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "用户不存在"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <NavBar />
        <p className="text-zinc-500">加载中...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <NavBar />
        <div className="text-center">
          <p className="text-red-400">{error || "用户不存在"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-2xl px-8 py-12">
        <div className="mb-10 flex items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-600/20 text-4xl font-bold text-red-400">
            {(user.displayGameId || user.username).charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.displayGameId || user.username}</h1>
            <p className="mt-1 text-zinc-400">@{user.username}</p>
            {user.gameId && (
              <p className="mt-0.5 text-xs text-zinc-600">完整 ID：{user.gameId}</p>
            )}
            {user.contact && user.contactPublic && (
              <p className="mt-0.5 text-xs text-zinc-600">联系方式：{user.contact}</p>
            )}
            <div className="mt-2 flex gap-2">
              <span className="rounded bg-zinc-800 px-3 py-0.5 text-xs text-zinc-400">{user.role}</span>
              {user.identityVerified && (
                <span className={"rounded px-3 py-0.5 text-xs font-medium " + (user.verifiedType === "STUDENT" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400")}>
                  {user.verifiedType === "STUDENT" ? "✔ 校内认证" : "✔ 校友认证"}
                </span>
              )}
              {user.verifiedRank && user.rankPublic && (
                <span className="rounded bg-yellow-500/10 px-3 py-0.5 text-xs font-medium text-yellow-400">
                  ✔ {user.verifiedRank}
                </span>
              )}
              {user.team && (
                <Link href={"/teams/" + user.team.id}
                  className="rounded bg-red-600/10 px-3 py-0.5 text-xs text-red-400 hover:bg-red-600/20">
                  {user.team.name} · {user.team.role === "CAPTAIN" ? "队长" : "队员"}
                </Link>
              )}
              <Link href={"/career/" + user.id}
                className="rounded bg-zinc-800 px-3 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700">
                生涯数据
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="mb-1 text-xs text-zinc-500">用户名</h3>
            <p className="font-medium">{user.username}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="mb-1 text-xs text-zinc-500">游戏 ID</h3>
            <p className="font-medium">{user.displayGameId || "未设置"}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="mb-1 text-xs text-zinc-500">角色</h3>
            <p className="font-medium">{user.role}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="mb-1 text-xs text-zinc-500">注册时间</h3>
            <p className="font-medium">{new Date(user.createdAt).toLocaleDateString("zh-CN")}</p>
          </div>
        </div>

        {user.team && (
          <>
            <h3 className="mb-4 mt-10 text-sm font-semibold text-zinc-500">所属战队</h3>
            <Link href={`/teams/${user.team.id}`}
              className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-red-500/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-600/20 text-2xl font-bold text-red-400">
                {user.team.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold group-hover:text-red-400">{user.team.name}</h4>
                <p className="text-sm text-zinc-500">{user.team.role === "CAPTAIN" ? "队长" : "队员"}</p>
              </div>
              <span className="text-zinc-600 group-hover:text-red-400">→</span>
            </Link>
          </>
        )}

        {isSelf && (
          <div className="mt-10 text-center">
            <Link href="/settings"
              className="inline-block rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400">
              编辑个人信息
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}