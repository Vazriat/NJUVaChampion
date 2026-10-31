"use client";

/**
 * 「开始直播」按钮：拉 preview → 弹出确认框（显示房间号与 B 站实时标题）→ 开播。
 *
 * confirm 不用原生弹窗；确认框里带上 B 站当前标题，裁判能当场看出房间号填错、
 * 或者 B 站那边还没开播。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { liveApi, LivePreviewVO } from "@/lib/api";
import { useConfirm, useNotify } from "@/components/DialogProvider";

interface Props {
  matchId: number;
  onStarted: () => void;
  className?: string;
  label?: string;
}

export default function StartLiveButton({ matchId, onStarted, className, label }: Props) {
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();
  const notify = useNotify();
  const router = useRouter();

  const start = async () => {
    setBusy(true);
    try {
      const res = await liveApi.preview(matchId);
      const p: LivePreviewVO = res.data.data;
      if (!p.canStart) {
        // 没绑直播间是最常见的前置失败，直接给一个能点的入口，
        // 别只弹一句「请先在设置页绑定」让裁判自己找。
        if (p.blockReason?.includes("绑定直播间")) {
          const go = await ask({
            title: "还没有绑定直播间",
            message: "开播前需要先绑定你的直播间地址，现在去设置？",
            okText: "去设置",
            cancelText: "稍后",
          });
          if (go) router.push("/settings");
        } else {
          notify(p.blockReason || "暂时无法开播", "error");
        }
        return;
      }
      const lines: string[] = [];
      if (p.channel?.roomId) lines.push(`房间号：${p.channel.roomId}`);
      lines.push(p.roomTitle ? `B 站当前：${p.roomTitle}` : "未能获取房间信息（不影响开播）");
      if (p.roomLive === false) lines.push("注意：该直播间当前未在开播");
      (p.warnings || []).forEach((w) => lines.push(w));

      const ok = await ask({ title: "开始直播", message: lines.join("\n"), okText: "确认开播" });
      if (!ok) return;

      await liveApi.start(matchId);
      notify("直播已开始", "success");
      onStarted();
    } catch (err: any) {
      notify(err.response?.data?.message || "开播失败", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className={className || "rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50 max-md:min-h-11"}
    >
      {busy ? "处理中..." : label || "开始直播"}
    </button>
  );
}
