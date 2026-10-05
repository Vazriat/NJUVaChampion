"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import RecruitmentPostCard from "@/components/RecruitmentPostCard";
import { publicUserApi, recruitmentPostApi, teamApi, UserVO, RecruitmentPostVO } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 该用户当前 OPEN 的人才市场帖子（队长至多一条招募帖，未入队者至多一条求职帖）
  const [posts, setPosts] = useState<RecruitmentPostVO[]>([]);
  // 我是某队队长时的队伍 id，用于在别人主页上直接发起邀请
  const [myTeamId, setMyTeamId] = useState<number | null>(null);

  const currentUser = getUser();
  const isSelf = currentUser?.id === Number(id);
  // 未入队 → 可发求职帖；是队长 → 可发招募帖；在队但不是队长 → 两者都不行
  const canPublish = !user?.team || user.team.role === "CAPTAIN";

  const loadPosts = useCallback(() => {
    recruitmentPostApi
      .list({ userId: Number(id) })
      .then((res) => setPosts(res.data.data || []))
      .catch(() => {});
  }, [id]);

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

    loadPosts();

    // 只在看别人的主页时才需要"我带哪支队"（自己主页不需要邀请自己）
    if (!isSelf) {
      teamApi
        .myCaptainedTeams()
        .then((res) => {
          const teams = res.data.data || [];
          setMyTeamId(teams.length > 0 ? teams[0].id : null);
        })
        .catch(() => {});
    }
  }, [id, router, isSelf, loadPosts]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 max-md:min-h-dvh">
        <NavBar />
        <p className="text-zinc-500">加载中...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 max-md:min-h-dvh">
        <NavBar />
        <div className="text-center">
          <p className="text-red-400">{error || "用户不存在"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-2xl px-8 py-12 max-md:px-4">
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

        {/* 人才市场：别人在这里能直接看到你在招人/找工作，并当场发起邀请或申请 */}
        {(posts.length > 0 || isSelf) && (
          <>
            <h3 className="mb-4 mt-10 text-sm font-semibold text-zinc-500">
              人才市场
            </h3>
            {posts.length > 0 ? (
              <div className="space-y-3">
                {posts.map((p) => (
                  <RecruitmentPostCard
                    key={p.id}
                    post={p}
                    myTeamId={myTeamId}
                    onChanged={loadPosts}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 px-5 py-6 text-center">
                <p className="text-sm text-zinc-500">
                  {canPublish
                    ? "你还没有发布招募或求职信息"
                    : "你已在战队中且不是队长，无法替队伍发布招募"}
                </p>
                {canPublish && (
                  <Link
                    href="/recruit/new"
                    className="mt-3 inline-block text-sm text-red-500 hover:underline"
                  >
                    去发布一条信息 →
                  </Link>
                )}
              </div>
            )}
            {isSelf && (
              <div className="mt-4 text-center">
                <Link
                  href="/recruit/mine"
                  className="text-sm text-zinc-400 transition hover:text-red-400"
                >
                  我的申请与发布 →
                </Link>
              </div>
            )}
          </>
        )}

        {isSelf && (
          <div className="mt-10 text-center">
            <Link href="/settings"
              className="inline-block rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400 max-md:px-4">
              编辑个人信息
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}