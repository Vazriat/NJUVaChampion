"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  recruitmentPostApi,
  teamApplicationApi,
  RecruitmentPostVO,
  TeamApplicationVO,
} from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useConfirm, useNotify } from "@/components/DialogProvider";

function statusText(status: string) {
  switch (status) {
    case "PENDING":
      return "待处理";
    case "ACCEPTED":
      return "已同意";
    case "REJECTED":
      return "已拒绝";
    case "CANCELLED":
      return "已撤回";
    case "OPEN":
      return "招募中";
    case "CLOSED":
      return "已关闭";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-yellow-600/20 text-yellow-400";
    case "ACCEPTED":
    case "OPEN":
      return "bg-green-600/20 text-green-400";
    case "REJECTED":
      return "bg-red-600/20 text-red-400";
    default:
      return "bg-zinc-800 text-zinc-400";
  }
}

export default function RecruitMinePage() {
  const router = useRouter();
  const [inbox, setInbox] = useState<TeamApplicationVO[]>([]);
  const [outgoing, setOutgoing] = useState<TeamApplicationVO[]>([]);
  const [posts, setPosts] = useState<RecruitmentPostVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      teamApplicationApi.inbox().catch(() => ({ data: { data: [] } })),
      teamApplicationApi.mine().catch(() => ({ data: { data: [] } })),
      recruitmentPostApi.mine().catch(() => ({ data: { data: [] } })),
    ])
      .then(([inboxRes, mineRes, postsRes]) => {
        setInbox(inboxRes.data.data || []);
        setOutgoing(mineRes.data.data || []);
        setPosts(postsRes.data.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    load();
  }, [router, load]);

  const ask = useConfirm();
  const notify = useNotify();

  const run = async (id: number, fn: () => Promise<any>, failMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (err: any) {
      notify(err.response?.data?.message || failMsg, "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: number) => {
    const ok = await ask({ title: "拒绝申请", message: "确认拒绝该申请？", okText: "确认拒绝", danger: true });
    if (!ok) return;
    run(id, () => teamApplicationApi.reject(id), "操作失败");
  };

  const handleCancel = async (id: number) => {
    const ok = await ask({ title: "撤回申请", message: "撤回后可以申请其它战队。", okText: "确认撤回" });
    if (!ok) return;
    run(id, () => teamApplicationApi.cancel(id), "撤回失败");
  };

  const handleClosePost = async (id: number) => {
    const ok = await ask({ title: "关闭招募信息", message: "关闭后不再出现在人才市场。", okText: "确认关闭" });
    if (!ok) return;
    run(id, () => recruitmentPostApi.close(id), "关闭失败");
  };

  const pendingApplyCount = inbox.filter(
    (a) => a.status === "PENDING" && a.canHandle
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-4xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">我的申请</h2>
          <Link
            href="/recruit"
            className="text-sm text-zinc-400 transition hover:text-red-400"
          >
            返回人才市场 →
          </Link>
        </div>

        {loading && <p className="text-zinc-500">加载中...</p>}

        {!loading && pendingApplyCount > 0 && (
          <div className="mb-6 rounded-xl border border-yellow-700/60 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-300">
            有 {pendingApplyCount} 条入队申请等待你处理
          </div>
        )}

        {/* ===== 我收到的 ===== */}
        <section className="mb-10">
          <h3 className="mb-4 text-lg font-semibold">我收到的</h3>
          {!loading && inbox.length === 0 && (
            <p className="text-sm text-zinc-500">暂无收到的申请或邀请</p>
          )}
          <div className="space-y-3">
            {inbox.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 max-md:px-4"
              >
                <div className="flex items-start justify-between gap-4 max-md:flex-col">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {app.type === "APPLY" ? (
                        <>
                          <span className="font-medium">{app.initiatorName}</span>
                          <span className="text-zinc-500"> 申请加入 </span>
                          <span className="font-medium text-red-400">
                            {app.teamName}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-red-400">{app.teamName}</span>
                          <span className="text-zinc-500"> 邀请 </span>
                          <span className="font-medium">{app.targetName}</span>
                        </>
                      )}
                    </p>
                    {app.content && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-400">
                        {app.content}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-zinc-600">
                      {app.createdAt
                        ? new Date(app.createdAt).toLocaleString("zh-CN")
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 max-md:w-full max-md:justify-end">
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs " + statusClass(app.status)
                      }
                    >
                      {statusText(app.status)}
                    </span>
                    {app.canHandle && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() =>
                            run(app.id, () => teamApplicationApi.accept(app.id), "操作失败")
                          }
                          className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold transition hover:bg-red-700 disabled:opacity-50 max-md:min-h-11"
                        >
                          同意
                        </button>
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => handleReject(app.id)}
                          className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:min-h-11"
                        >
                          拒绝
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 我发起的 ===== */}
        <section className="mb-10">
          <h3 className="mb-4 text-lg font-semibold">我发起的</h3>
          {!loading && outgoing.length === 0 && (
            <p className="text-sm text-zinc-500">暂无发出的申请或邀请</p>
          )}
          <div className="space-y-3">
            {outgoing.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 max-md:px-4"
              >
                <div className="flex items-start justify-between gap-4 max-md:flex-col">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {app.type === "APPLY" ? (
                        <>
                          <span className="text-zinc-500">我申请加入 </span>
                          <span className="font-medium text-red-400">{app.teamName}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-zinc-500">我邀请 </span>
                          <span className="font-medium">{app.targetName}</span>
                          <span className="text-zinc-500"> 加入 </span>
                          <span className="font-medium text-red-400">{app.teamName}</span>
                        </>
                      )}
                    </p>
                    {app.content && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-400">
                        {app.content}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-zinc-600">
                      {app.createdAt
                        ? new Date(app.createdAt).toLocaleString("zh-CN")
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 max-md:w-full max-md:justify-end">
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs " + statusClass(app.status)
                      }
                    >
                      {statusText(app.status)}
                    </span>
                    {app.canCancel && (
                      <button
                        type="button"
                        disabled={busyId === app.id}
                        onClick={() => handleCancel(app.id)}
                        className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:min-h-11"
                      >
                        撤回
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 我发布的帖子 ===== */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">我发布的信息</h3>
            <Link
              href="/recruit/new"
              className="text-sm text-red-500 hover:underline"
            >
              + 发布新信息
            </Link>
          </div>
          {!loading && posts.length === 0 && (
            <p className="text-sm text-zinc-500">还没有发布过信息</p>
          )}
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 max-md:px-4"
              >
                <div className="flex items-start justify-between gap-4 max-md:flex-col">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">
                      {post.type === "TEAM"
                        ? `队伍招募 · ${post.teamName}`
                        : "选手求职"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-300 line-clamp-4">
                      {post.content}
                    </p>
                    <p className="mt-2 text-xs text-zinc-600">
                      {post.createdAt
                        ? new Date(post.createdAt).toLocaleString("zh-CN")
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 max-md:w-full max-md:justify-end">
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs " + statusClass(post.status)
                      }
                    >
                      {statusText(post.status)}
                    </span>
                    {post.status === "OPEN" && (
                      <button
                        type="button"
                        disabled={busyId === post.id}
                        onClick={() => handleClosePost(post.id)}
                        className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:min-h-11"
                      >
                        关闭
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
