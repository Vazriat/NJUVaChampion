"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { announcementApi, tournamentAnnouncementApi } from "@/lib/api";

export default function NotificationPanel() {
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      announcementApi.getLatest().then((r) => r.data.data || []).catch(() => []),
      tournamentAnnouncementApi.my().then((r) => r.data.data || []).catch(() => []),
    ]).then(([globalNotices, tournamentNotices]) => {
      const all = [...globalNotices, ...tournamentNotices].sort((a: any, b: any) => {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return tb - ta;
      });
      setNotices(all.slice(0, 5));
    });
  }, []);

  if (notices.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-zinc-400">最新通知</h3>
      <div className="space-y-3">
        {notices.map((n: any, i: number) => {
          const href = n.tournamentId ? `/tournaments/${n.tournamentId}` : `/announcements#${n.id}`;
          return (
            <Link key={(n.tournamentId ? "t" : "a") + n.id} href={href}
              className="block rounded-lg border border-zinc-800 bg-zinc-900 transition hover:border-zinc-700 overflow-hidden">
              {i === 0 ? (
                <div className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    {n.priority === "IMPORTANT" && <span className="flex-shrink-0 text-sm">⚠</span>}
                    <p className="text-base font-semibold text-zinc-200 leading-snug">{n.title}</p>
                  </div>
                  {n.tournamentName && (
                    <p className="mb-1 text-[11px] text-red-400">{n.tournamentName}</p>
                  )}
                  {n.content && (
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">{n.content}</p>
                  )}
                  <p className="mt-2 text-[11px] text-zinc-600">
                    {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("zh-CN") : "草稿"}
                  </p>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {n.priority === "IMPORTANT" && <span className="flex-shrink-0 text-xs">⚠</span>}
                    <p className="truncate text-sm font-medium text-zinc-300">{n.title}</p>
                  </div>
                  {n.tournamentName && (
                    <p className="mt-0.5 text-[11px] text-red-400">{n.tournamentName}</p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("zh-CN") : ""}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
      <Link href="/announcements"
        className="mt-4 block text-center text-sm text-zinc-500 hover:text-zinc-300 transition">
        查看全部通知 →
      </Link>
    </div>
  );
}
