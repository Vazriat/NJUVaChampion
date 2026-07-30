"use client";

import React, { useEffect, useState } from "react";
import { bannerApi } from "@/lib/api";

export default function BannerCard() {
  const [banners, setBanners] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    bannerApi.getActive().then(r => setBanners(r.data.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const b = banners[idx];

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-zinc-500">宣传栏</h3>
      <a href={b.linkUrl || "#"} target={b.linkUrl ? "_blank" : undefined}
        className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-red-500/50">
        {b.type === "IMAGE" && b.imageUrl && (
          <img src={b.imageUrl} alt={b.title || ""} className="w-full object-cover" />
        )}
        {b.type === "TEXT" && (
          <div className="p-4">
            {b.title && <p className="mb-1 text-base font-semibold text-zinc-300">{b.title}</p>}
            {b.content && <p className="text-sm text-zinc-400">{b.content}</p>}
          </div>
        )}
        {b.type === "HTML" && (
          <div className="p-2 text-sm text-zinc-400" dangerouslySetInnerHTML={{ __html: b.content || "" }} />
        )}
      </a>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={"h-1.5 rounded-full transition " + (i === idx ? "w-4 bg-red-500" : "w-1.5 bg-zinc-700")} />
          ))}
        </div>
      )}
    </div>
  );
}
