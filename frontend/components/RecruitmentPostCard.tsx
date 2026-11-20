"use client";

import { useState } from "react";
import Link from "next/link";
import { teamApplicationApi, RecruitmentPostVO } from "@/lib/api";
import { useConfirm, useNotify } from "@/components/DialogProvider";

/**
 * 卡片折叠时显示 4 行。三列布局下每行约 18–20 个汉字，4 行约 80 字，
 * 阈值取 80 并额外看行数——只按字符数判断会漏掉「短但分很多段」的内容。
 */
const CLAMP_THRESHOLD = 80;
const CLAMP_LINES = 4;

/**
 * 人才市场帖子卡片。自包含：内部处理"申请加入 / 邀请入队"的确认与请求，
 * 完成后回调 onChanged 让父页面刷新。人才市场列表页、个人主页、队伍页共用同一份逻辑。
 */
export default function RecruitmentPostCard({
  post,
  myTeamId,
  onChanged,
}: {
  post: RecruitmentPostVO;
  myTeamId: number | null;
  onChanged: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ask = useConfirm();
  const notify = useNotify();

  const isLong =
    (post.content?.length ?? 0) > CLAMP_THRESHOLD ||
    (post.content?.split("\n").length ?? 0) > CLAMP_LINES;

  const statusLabel = (status: string | null) => {
    switch (status) {
      case "PENDING":
        return "待处理";
      case "ACCEPTED":
        return "已同意";
      case "REJECTED":
        return "已拒绝";
      case "CANCELLED":
        return "已撤回";
      default:
        return "";
    }
  };

  const handleApply = async () => {
    if (!post.teamId) return;
    const ok = await ask({
      title: "申请加入战队",
      message: `确认申请加入「${post.teamName}」？\n你可以同时加入多支战队，加入后可在「我的战队」切换当前活跃队伍。`,
      okText: "确认申请",
    });
    if (!ok) return;
    setActing(true);
    try {
      await teamApplicationApi.create({ type: "APPLY", teamId: post.teamId, postId: post.id });
      onChanged();
    } catch (err: any) {
      notify(err.response?.data?.message || "操作失败", "error");
    } finally {
      setActing(false);
    }
  };

  const handleInvite = async () => {
    if (myTeamId == null) {
      notify("你需要先带领一支战队才能发起邀请", "error");
      return;
    }
    const ok = await ask({
      title: "邀请入队",
      message: `确认邀请「${post.displayName}」加入你的战队？`,
      okText: "发送邀请",
    });
    if (!ok) return;
    setActing(true);
    try {
      await teamApplicationApi.create({
        type: "INVITE",
        teamId: myTeamId,
        targetUserId: post.userId,
        postId: post.id,
      });
      onChanged();
    } catch (err: any) {
      notify(err.response?.data?.message || "操作失败", "error");
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      className={
        "flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50 max-md:p-4 " +
        // 展开时独占一行：否则 grid 的 stretch 会把同列其它卡片一起拉高，中间留一大片空白
        (expanded ? "sm:col-span-2 lg:col-span-3" : "")
      }
    >
      <div className="mb-3 flex items-center gap-3">
        {post.type === "TEAM" && post.teamId ? (
          <Link
            href={`/teams/${post.teamId}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-lg font-bold text-red-400 transition hover:bg-red-600/30"
            title="查看战队"
          >
            {(post.teamName || "队").charAt(0).toUpperCase()}
          </Link>
        ) : (
          <Link
            href={`/profile/${post.userId}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-lg font-bold text-red-400 transition hover:bg-red-600/30"
            title="查看主页"
          >
            {(post.type === "TEAM" ? post.teamName || "队" : post.displayName || "选").charAt(0).toUpperCase()}
          </Link>
        )}
        <div className="min-w-0">
          {post.type === "TEAM" && post.teamId ? (
            <Link
              href={`/teams/${post.teamId}`}
              className="block truncate font-semibold transition hover:text-red-400"
            >
              {post.teamName}
            </Link>
          ) : (
            <Link
              href={`/profile/${post.userId}`}
              className="block truncate font-semibold transition hover:text-red-400"
            >
              {post.type === "TEAM" ? post.teamName : post.displayName}
            </Link>
          )}
          {post.type === "TEAM" ? (
            <Link
              href={`/profile/${post.userId}`}
              className="block truncate text-xs text-zinc-500 transition hover:text-red-400"
            >
              队长：{post.displayName}
            </Link>
          ) : (
            <Link
              href={`/profile/${post.userId}`}
              className="block truncate text-xs text-zinc-500 transition hover:text-red-400"
            >
              @{post.username}
            </Link>
          )}
        </div>
      </div>

      <p
        className={
          "whitespace-pre-wrap break-words text-sm text-zinc-400 " +
          (expanded
            ? // 展开后限高滚动：超长内容不至于把整页顶飞，「收起」按钮也始终可见
              "mb-2 max-h-[60vh] overflow-y-auto pr-1 max-md:max-h-[50vh]"
            : "mb-1 line-clamp-4")
        }
      >
        {post.content}
      </p>

      {/* 内容被折叠时给出展开入口，否则长文只能看到前 4 行且无从得知 */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mb-2 self-start text-xs text-red-400 transition hover:text-red-300 max-md:min-h-11"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <span className="text-xs text-zinc-600">
          {post.createdAt ? new Date(post.createdAt).toLocaleDateString("zh-CN") : ""}
        </span>

        {post.mine ? (
          <span className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-500">我发布的</span>
        ) : post.applicationStatus ? (
          <span className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
            {post.applicationStatus === "PENDING"
              ? post.type === "TEAM"
                ? "已申请，待处理"
                : "已邀请，待处理"
              : statusLabel(post.applicationStatus)}
          </span>
        ) : post.canApply ? (
          <button
            type="button"
            disabled={acting}
            onClick={() => (post.type === "TEAM" ? handleApply() : handleInvite())}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold transition hover:bg-red-700 disabled:opacity-50 max-md:min-h-11"
          >
            {acting ? "处理中..." : post.type === "TEAM" ? "申请加入" : "邀请入队"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
