"use client";

import { useState } from "react";
import { teamApplicationApi, RecruitmentPostVO } from "@/lib/api";
import { useConfirm, useNotify } from "@/components/DialogProvider";

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
  const ask = useConfirm();
  const notify = useNotify();

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
      message: `确认申请加入「${post.teamName}」？\n注意：同一时间只能有一支战队的入队申请待处理。`,
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
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-red-500/50 max-md:p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-lg font-bold text-red-400">
          {(post.type === "TEAM" ? post.teamName || "队" : post.displayName || "选")
            .charAt(0)
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">
            {post.type === "TEAM" ? post.teamName : post.displayName}
          </h3>
          <p className="truncate text-xs text-zinc-500">
            {post.type === "TEAM" ? `队长：${post.displayName}` : `@${post.username}`}
          </p>
        </div>
      </div>

      <p className="mb-4 flex-1 whitespace-pre-wrap break-words text-sm text-zinc-400 line-clamp-4">
        {post.content}
      </p>

      <div className="flex items-center justify-between gap-3">
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
