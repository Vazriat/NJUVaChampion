"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { announcementApi } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export default function AnnouncementsPage() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    announcementApi.list()
      .then(r => setList(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-2xl px-8 py-10">
        <h2 className="mb-6 text-2xl font-bold">全部通知</h2>

        {loading ? (
          <p className="text-zinc-500">加载中...</p>
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <p className="text-sm text-zinc-500">暂无通知</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((n: any) => (
              <div key={n.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === n.id ? null : n.id)}
                  className="flex w-full items-center justify-between p-4 text-left transition hover:bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    {n.priority === "IMPORTANT" && (
                      <span className="text-lg">⚠</span>
                    )}
                    <div>
                      <p className={"font-medium " + (n.priority === "IMPORTANT" ? "text-yellow-300" : "text-zinc-200")}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-600">
                        {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("zh-CN") : "草稿"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-600">{expanded === n.id ? "收起" : "展开"}</span>
                </button>
                {expanded === n.id && n.content && (
                  <div className="border-t border-zinc-800 px-4 py-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{n.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
