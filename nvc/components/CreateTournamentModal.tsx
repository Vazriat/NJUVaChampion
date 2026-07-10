"use client";

import { useState } from "react";
import { adminTournamentApi } from "@/lib/api";

interface Props {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function CreateTournamentModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxTeams, setMaxTeams] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await adminTournamentApi.create({ name, description, maxTeams });
      onSuccess("赛事已创建");
      onClose();
    } catch (err: any) {
      onSuccess(err.response?.data?.message || "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">创建赛事</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">赛事名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500"
              placeholder="如：无畏契约锦标赛" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">赛事简介</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500"
              rows={3} placeholder="选填" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">参赛队伍数</label>
            <div className="flex gap-3">
              {[2].map((n) => (
                <button key={n} type="button" onClick={() => setMaxTeams(n)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                    maxTeams === n
                      ? "border-red-500 bg-red-600/20 text-red-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}>
                  {n} 队
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-500">赛制：单场淘汰</p>
          <button onClick={handleSubmit} disabled={submitting || !name.trim()}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {submitting ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}