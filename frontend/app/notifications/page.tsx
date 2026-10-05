"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { notificationApi, UserNotificationVO } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

function typeLabel(type: string) {
  switch (type) {
    case "APPLICATION_RECEIVED":
      return "入队申请";
    case "INVITE_RECEIVED":
      return "入队邀请";
    case "APPLICATION_ACCEPTED":
      return "已通过";
    case "APPLICATION_REJECTED":
      return "未通过";
    case "APPLICATION_CANCELLED":
      return "已撤回";
    case "TEAM_DISMISSED":
      return "被移出战队";
    case "POST_TAKEN_DOWN":
      return "被下架";
    default:
      return "消息";
  }
}

function typeClass(type: string) {
  switch (type) {
    case "APPLICATION_ACCEPTED":
      return "bg-green-600/20 text-green-400";
    case "APPLICATION_REJECTED":
      return "bg-red-600/20 text-red-400";
    case "TEAM_DISMISSED":
    case "POST_TAKEN_DOWN":
      return "bg-red-600/20 text-red-400";
    default:
      return "bg-zinc-800 text-zinc-400";
  }
}

/** 由 refType 推导跳转目标；后端不感知前端路由 */
function targetHref(n: UserNotificationVO) {
  if (n.refType === "TEAM" && n.refId != null) return `/teams/${n.refId}`;
  if (n.refType === "TEAM_APPLICATION" || n.refType === "RECRUITMENT_POST") {
    return "/recruit/mine";
  }
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<UserNotificationVO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    notificationApi
      .list()
      .then((res) => setItems(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    load();
  }, [router, load]);

  const unread = items.filter((n) => !n.readFlag).length;

  const open = async (n: UserNotificationVO) => {
    const href = targetHref(n);
    if (!n.readFlag) {
      try {
        await notificationApi.markRead(n.id);
      } catch {
        /* 标记失败不阻断跳转 */
      }
    }
    if (href) {
      router.push(href);
    } else {
      load();
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      load();
    } catch {
      alert("操作失败");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-3xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">
            我的消息
            {unread > 0 && (
              <span className="ml-3 rounded bg-red-600 px-2 py-0.5 text-xs font-medium align-middle">
                {unread}
              </span>
            )}
          </h2>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400 max-md:min-h-11"
            >
              全部标为已读
            </button>
          )}
        </div>

        {loading && <p className="text-zinc-500">加载中...</p>}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <p className="text-sm text-zinc-500">暂无消息</p>
          </div>
        )}

        <div className="space-y-3">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className={
                "block w-full rounded-xl border px-5 py-4 text-left transition max-md:px-4 " +
                (n.readFlag
                  ? "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  : "border-red-900/60 bg-zinc-900 hover:border-red-500/60")
              }
            >
              <div className="flex items-start gap-3">
                {!n.readFlag && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={"rounded px-2 py-0.5 text-xs " + typeClass(n.type)}
                    >
                      {typeLabel(n.type)}
                    </span>
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {n.title}
                    </p>
                  </div>
                  {n.content && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-400">
                      {n.content}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-zinc-600">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString("zh-CN") : ""}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
