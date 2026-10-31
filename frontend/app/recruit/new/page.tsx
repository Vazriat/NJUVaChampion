"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { recruitmentPostApi, teamApi } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useNotify } from "@/components/DialogProvider";

type Mode = "TEAM" | "PLAYER" | "NONE" | null;

export default function RecruitNewPage() {
  const notify = useNotify();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      teamApi.myCaptainedTeams().catch(() => ({ data: { data: [] } })),
      teamApi.myTeam().catch(() => ({ data: { data: null } })),
    ]).then(([captainedRes, myTeamRes]) => {
      const captained = captainedRes.data.data || [];
      const myTeam = myTeamRes.data.data;
      if (captained.length > 0) {
        setMode("TEAM");
        setTeamName(captained[0].name);
      } else if (!myTeam) {
        setMode("PLAYER");
      } else {
        // 已加入战队但不是队长：既不能替队伍招人，也不该再找队伍
        setMode("NONE");
      }
    });
  }, [router]);

  const submit = async () => {
    if (!content.trim()) {
      notify("请填写内容", "error");
      return;
    }
    if (mode !== "TEAM" && mode !== "PLAYER") return;

    setSubmitting(true);
    try {
      await recruitmentPostApi.create({ type: mode, content: content.trim() });
      router.push("/recruit");
    } catch (err: any) {
      notify(err.response?.data?.message || "发布失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-3xl px-8 py-10 max-md:px-4 max-md:py-8">
        <h2 className="mb-6 text-2xl font-bold">发布信息</h2>

        {mode === null && <p className="text-zinc-500">加载中...</p>}

        {mode === "NONE" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-300">
              你已加入战队但不是队长，无法替队伍发布招募；也已经组队，无需发布求职信息。
            </p>
            <Link
              href="/recruit"
              className="mt-4 inline-block text-sm text-red-500 hover:underline"
            >
              返回人才市场 →
            </Link>
          </div>
        )}

        {(mode === "TEAM" || mode === "PLAYER") && (
          <>
            <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4 max-md:p-3">
              <p className="text-sm text-zinc-400">
                {mode === "TEAM" ? (
                  <>
                    以队伍身份发布招募 ·{" "}
                    <span className="font-medium text-red-400">{teamName}</span>
                  </>
                ) : (
                  "以选手身份发布求职信息"
                )}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {mode === "TEAM"
                  ? "同一时间每个队伍只能有一条招募帖。"
                  : "同一时间每人只能有一条求职帖；加入战队后会自动关闭。"}
              </p>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              maxLength={2000}
              placeholder={
                mode === "TEAM"
                  ? "写清楚你的招募要求：缺什么位置、要求段位、训练时间、联系方式等，想写什么写什么"
                  : "写清楚你的情况：擅长位置、段位、常用特工、可训练时间、联系方式等，想写什么写什么"
              }
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
            />

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-600">{content.length} / 2000</span>
            </div>

            <div className="mt-6 flex gap-3 max-md:gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold transition hover:bg-red-700 disabled:opacity-50 max-md:min-h-11 max-md:flex-1"
              >
                {submitting ? "发布中..." : "发布"}
              </button>
              <Link
                href="/recruit"
                className="flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-2 text-sm font-semibold text-zinc-300 transition hover:border-red-500 hover:text-red-400 max-md:min-h-11 max-md:flex-1"
              >
                取消
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
