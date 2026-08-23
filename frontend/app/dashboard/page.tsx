"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, teamApi, TeamVO } from "@/lib/api";
import { User, getUser, setUser, removeToken, isLoggedIn } from "@/lib/auth";
import BannerCard from "@/components/BannerCard";
import NotificationPanel from "@/components/NotificationPanel";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [myTeam, setMyTeam] = useState<TeamVO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    const cached = getUser();
    if (cached?.role === "ADMIN") {
      router.replace("/admin");
      return;
    }

    if (cached) setUserState(cached);

    Promise.all([
      authApi.getProfile().then((res) => {
        if (res.data.data.role === "ADMIN") {
          removeToken();
          router.replace("/login");
          return;
        }
        setUserState(res.data.data);
        setUser(res.data.data);
      }),
      teamApi.myTeam().then((res) => setMyTeam(res.data.data)).catch(() => {}),
    ]).catch(() => {
      removeToken();
      router.replace("/login");
    }).finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">加载中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">用户信息加载失败</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <h1 className="text-2xl font-bold text-red-500">VALORANT 赛事平台</h1>
        <div className="flex items-center gap-4">
          <span className="text-zinc-400">{user.displayName || user.displayGameId || user.username}</span>
          <button onClick={handleLogout}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400">
            退出登录
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-12 relative">
        {/* 左侧宣传栏 */}
        <div className="hidden lg:block fixed" style={{left:"calc(50% - 760px)",top:"185px",width:"288px",zIndex:10}}>
          <BannerCard />
        </div>

        {/* 右侧通知栏 */}
        <div className="hidden lg:block fixed" style={{right:"calc(50% - 760px)",top:"185px",width:"288px",zIndex:10}}>
          <NotificationPanel />
        </div>

        {/* 主内容 — 完全保持原始 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold">欢迎回来，{user.displayName || user.displayGameId || user.username}</h2>
          <p className="mt-1 text-zinc-500">选择你要进入的模块</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/hall"
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-xl text-red-400">🏠</div>
            <h3 className="text-lg font-semibold group-hover:text-red-400">用户大厅</h3>
            <p className="mt-1 text-sm text-zinc-500">浏览所有用户，查看个人主页</p>
          </Link>

          <Link href="/teams"
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-xl text-red-400">🏆</div>
            <h3 className="text-lg font-semibold group-hover:text-red-400">战队管理</h3>
            <p className="mt-1 text-sm text-zinc-500">创建战队、查看队员、加入或退出</p>
          </Link>

          <Link href={`/profile/${user.id}?from=dashboard`}
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-xl text-red-400">👤</div>
            <h3 className="text-lg font-semibold group-hover:text-red-400">我的主页</h3>
            <p className="mt-1 text-sm text-zinc-500">查看个人资料和公开信息</p>
          </Link>

          <Link href="/competitions" className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-xl text-red-400">📋</div>
            <h3 className="text-lg font-semibold group-hover:text-red-400">赛事报名</h3>
            <p className="mt-1 text-sm text-zinc-500">报名活动，由管理员分组后开赛</p>
          </Link>

          <Link href="/tournaments" className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-xl text-red-400">🎮</div>
            <h3 className="text-lg font-semibold group-hover:text-red-400">赛事中心</h3>
            <p className="mt-1 text-sm text-zinc-500">浏览赛事、报名参赛、查看对阵</p>
          </Link>

          <Link href={"/career/" + user.id} className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-xl text-red-400">📊</div>
            <h3 className="text-lg font-semibold group-hover:text-red-400">个人生涯</h3>
            <p className="mt-1 text-sm text-zinc-500">查看比赛记录、统计数据、历史战绩</p>
          </Link>

          <Link href="/verify" className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 text-xl text-red-400">🪪</div>
            <h3 className="text-lg font-semibold group-hover:text-red-400">选手认证</h3>
            <p className="mt-1 text-sm text-zinc-500">认证学生身份，获取认证标识</p>
          </Link>
        </div>

        {myTeam && (
          <>
            <h3 className="mb-4 mt-12 text-sm font-semibold text-zinc-500">所属战队</h3>
            <Link href={`/teams/${myTeam.id}?from=dashboard`}
              className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-red-500/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-600/20 text-2xl font-bold text-red-400">
                {myTeam.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold group-hover:text-red-400">{myTeam.name}</h4>
                <p className="text-sm text-zinc-500">队长：{myTeam.captainName} · 队员 {myTeam.memberCount} 人</p>
              </div>
              <span className="text-zinc-600 group-hover:text-red-400">→</span>
            </Link>
          </>
        )}

        <h3 className="mb-4 mt-12 text-sm font-semibold text-zinc-500">账号</h3>
        <Link href="/settings"
          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-4 transition hover:border-red-500/50">
          <div>
            <p className="font-medium">账号设置</p>
            <p className="text-sm text-zinc-500">修改用户名、游戏 ID、邮箱、密码</p>
          </div>
          <span className="rounded-lg bg-red-600 px-5 py-1.5 text-sm font-semibold">修改</span>
        </Link>

        <h3 className="mb-4 mt-12 text-sm font-semibold text-zinc-500">账号信息</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h4 className="mb-1 text-xs text-zinc-500">用户名</h4>
            <p className="font-medium">{user.username}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h4 className="mb-1 text-xs text-zinc-500">游戏 ID</h4>
            <p className="font-medium">{user.displayGameId || "未设置"}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h4 className="mb-1 text-xs text-zinc-500">角色</h4>
            <p className="font-medium">{user.role}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h4 className="mb-1 text-xs text-zinc-500">注册时间</h4>
            <p className="font-medium">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "-"}
            </p>
          </div>
        </div>

          {/* 右侧通知栏 */}
      </main>
    </div>
  );
}
