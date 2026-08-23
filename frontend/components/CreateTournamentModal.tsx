"use client";

import { useState } from "react";
import { adminTournamentApi } from "@/lib/api";

interface Props {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const TYPE_OPTIONS = [
  { value: "CUP", label: "杯赛" },
  { value: "LEAGUE", label: "联赛" },
] as const;

const FORMAT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  CUP: [
    { value: "SINGLE_ELIM", label: "单败淘汰" },
    { value: "DOUBLE_ELIM", label: "双败淘汰" },
    { value: "SWISS_ELIM", label: "瑞士轮 + 八强淘汰赛" },
  ],
  LEAGUE: [
    { value: "SINGLE_RR", label: "单循环" },
    { value: "DOUBLE_RR", label: "双循环" },
  ],
};

const MAX_TEAMS_OPTIONS: Record<string, number[]> = {
  "CUP_SINGLE_ELIM": [2, 4, 8, 16],
  "CUP_DOUBLE_ELIM": [4, 8],
  "CUP_SWISS_ELIM": [16],
};

export default function CreateTournamentModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("CUP");
  const [format, setFormat] = useState("SINGLE_ELIM");
  const [maxTeams, setMaxTeams] = useState(2);
  const [knockoutFormat, setKnockoutFormat] = useState("SINGLE_ELIM");
  const [pairingMode, setPairingMode] = useState("RANDOM");
  const [hasPlayoffs, setHasPlayoffs] = useState(false);
  const [playoffFormat, setPlayoffFormat] = useState("SINGLE_ELIM");
  const [playoffSize, setPlayoffSize] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  const isLeague = type === "LEAGUE";
  const availableFormats = FORMAT_OPTIONS[type] || FORMAT_OPTIONS.CUP;
  const teamOptions = isLeague ? null : (MAX_TEAMS_OPTIONS[`${type}_${format}`] || [2]);

  // Reset format when type changes
  const handleTypeChange = (newType: string) => {
    setType(newType);
    const firstFormat = FORMAT_OPTIONS[newType]?.[0]?.value || "SINGLE_ELIM";
    setFormat(firstFormat);
    if (newType === "LEAGUE") {
      setMaxTeams(2);
    } else {
      const opts = MAX_TEAMS_OPTIONS[`${newType}_${firstFormat}`] || [2];
      setMaxTeams(opts[0]);
    }
  };

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    if (!isLeague) {
      const opts = MAX_TEAMS_OPTIONS[`${type}_${newFormat}`] || [2];
      if (!opts.includes(maxTeams)) {
        setMaxTeams(opts[0]);
      }
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body: any = { name, description: description || undefined, type, format, maxTeams };
      if (format === "SWISS_ELIM") {
        body.knockoutFormat = knockoutFormat;
        body.swissPairingMode = pairingMode;
      }
      if (type === "LEAGUE") {
        body.hasPlayoffs = hasPlayoffs;
        if (hasPlayoffs) {
          body.playoffFormat = playoffFormat;
          body.playoffSize = playoffSize;
        }
      }
      await adminTournamentApi.create(body);
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
              placeholder="例如：无畏契约锦标赛" />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">赛事类型</label>
            <div className="flex gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => handleTypeChange(opt.value)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                    type === opt.value
                      ? "border-red-500 bg-red-600/20 text-red-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">赛制</label>
            <div className="flex flex-wrap gap-2">
              {availableFormats.map((opt) => (
                <button key={opt.value} type="button" onClick={() => handleFormatChange(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    format === opt.value
                      ? "border-red-500 bg-red-600/20 text-red-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">参赛队伍数</label>
            <div className="flex gap-3">
              {teamOptions ? (
                teamOptions.map((n) => (
                  <button key={n} type="button" onClick={() => setMaxTeams(n)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                      maxTeams === n
                        ? "border-red-500 bg-red-600/20 text-red-400"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}>
                    {n} 队
                  </button>
                ))
              ) : (
                <input type="number" min={2} max={100} value={maxTeams}
                  onChange={(e) => setMaxTeams(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" />
              )}
            </div>
          </div>

          {format === "SWISS_ELIM" && (
            <>
              <p className="text-xs text-zinc-500">16 队瑞士轮固定 5 轮</p>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">八强赛制</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setKnockoutFormat("SINGLE_ELIM")}
                    className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (knockoutFormat === "SINGLE_ELIM" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>单败淘汰</button>
                  <button type="button" onClick={() => setKnockoutFormat("DOUBLE_ELIM")}
                    className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (knockoutFormat === "DOUBLE_ELIM" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>双败淘汰</button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">瑞士轮配对方式</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPairingMode("RANDOM")}
                    className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (pairingMode === "RANDOM" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>全随机</button>
                  <button type="button" onClick={() => setPairingMode("BUCHHOLZ")}
                    className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (pairingMode === "BUCHHOLZ" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>BU分配对</button>
                </div>
              </div>
            </>
          )}

          {type === "LEAGUE" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">是否打季后赛</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setHasPlayoffs(false)}
                    className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (!hasPlayoffs ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>不打（常规赛第1名夺冠）</button>
                  <button type="button" onClick={() => setHasPlayoffs(true)}
                    className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (hasPlayoffs ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>打季后赛</button>
                </div>
              </div>
              {hasPlayoffs && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">季后赛规模</label>
                    <div className="flex gap-2">
                      {[2, 4, 8].map(n => (
                        <button key={n} type="button" onClick={() => { setPlayoffSize(n); if (n === 2) setPlayoffFormat("SINGLE_ELIM"); }}
                          className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (playoffSize === n ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>{n} 队</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">季后赛赛制</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPlayoffFormat("SINGLE_ELIM")}
                        className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (playoffFormat === "SINGLE_ELIM" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>单败淘汰</button>
                      <button type="button" onClick={() => setPlayoffFormat("DOUBLE_ELIM")} disabled={playoffSize === 2}
                        className={"flex-1 rounded-lg border py-2 text-sm font-medium transition " + (playoffFormat === "DOUBLE_ELIM" ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed")}>双败淘汰</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div>
            <label className="mb-1 block text-xs text-zinc-500">赛事简介（选填）</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500"
              rows={2} placeholder="选填" />
          </div>

          <button onClick={handleSubmit} disabled={submitting || !name.trim()}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {submitting ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
