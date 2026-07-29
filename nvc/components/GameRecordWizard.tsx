"use client";

import React, { useState, useRef, useEffect } from "react";
import GameStatsTable, { PlayerStatEntry, StatColumnDef } from "./GameStatsTable";
import { matchApi, teamApi } from "@/lib/api";

// Column definitions for player stats table
// Add/remove keys here to show/hide columns without backend changes
const DEFAULT_STAT_COLUMNS: StatColumnDef[] = [
  { key: "agent", label: "特工", editable: true, type: "select" },
  { key: "acs", label: "ACS", editable: true, type: "number" },
  { key: "kills", label: "击杀", editable: true, type: "number" },
  { key: "deaths", label: "死亡", editable: true, type: "number" },
  { key: "assists", label: "助攻", editable: true, type: "number" },
  { key: "firstBlood", label: "首杀", editable: true, type: "number" },
];

interface GameData {
  gameIndex: number;        // 0-based
  gameId?: number;          // set after init
  screenshotFile?: File;
  screenshotBase64?: string;
  ocrResult?: PlayerStatEntry[];
  editedStats: PlayerStatEntry[];
  team1Score: number | null;
  team2Score: number | null;
  saved: boolean;
  hasImg?: boolean;
}

interface GameRecordWizardProps {
  tournamentId: number;
  matchId: number;
  team1Id: number;
  team2Id: number;
  team1Name: string;
  team2Name: string;
  onClose: () => void;
  onComplete: (msg: string) => void;
}

export default function GameRecordWizard({
  tournamentId, matchId, team1Id, team2Id, team1Name, team2Name, onClose, onComplete,
}: GameRecordWizardProps) {

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [boType, setBoType] = useState(3);
  const [games, setGames] = useState<GameData[]>([]);
  const [currentGameIdx, setCurrentGameIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finalScore1, setFinalScore1] = useState(0);
  const [finalScore2, setFinalScore2] = useState(0);
  const [initDone, setInitDone] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [team1Members, setTeam1Members] = useState<{userId:number;username:string;displayName:string}[]>([]);
  const [team2Members, setTeam2Members] = useState<{userId:number;username:string;displayName:string}[]>([]);
  const currentGameIdxRef = useRef(currentGameIdx);
  useEffect(() => { currentGameIdxRef.current = currentGameIdx; }, [currentGameIdx]);

  // Load existing game records when wizard opens
  useEffect(() => {
    // Load team members for IGN matching
    Promise.all([
      teamApi.detail(team1Id).then(r => r.data.data?.members || []).catch(() => []),
      teamApi.detail(team2Id).then(r => r.data.data?.members || []).catch(() => []),
    ]).then(([m1, m2]) => {
      setTeam1Members(m1);
      setTeam2Members(m2);
    });
    const loadExisting = async () => {
      try {
        const res = await matchApi.detail(matchId);
        const data = res.data.data;
        if (data && data.games && data.games.length > 0) {
          const existingGames: GameData[] = data.games.map((g: any, i: number) => ({
            gameIndex: i,
            gameId: g.id,
            editedStats: (g.playerStats || []).map((ps: any) => ({
              userId: ps.userId || 0,
              playerName: ps.playerName || "",
              userName: ps.userName || ps.playerName || "",
              teamId: ps.teamId,
              stats: ps.stats || {},
            })),
            team1Score: g.team1Score,
            team2Score: g.team2Score,
            saved: g.status === "RECORDED",
            screenshotBase64: undefined,
          }));
          setGames(existingGames);
          setBoType(existingGames.length);
          setInitDone(true);
          const allSaved = existingGames.every(g => g.saved);
          if (allSaved) {
            setStep(3);
            setCurrentGameIdx(0);
          } else {
            const firstUnsaved = existingGames.findIndex(g => !g.saved);
            setCurrentGameIdx(firstUnsaved >= 0 ? firstUnsaved : 0);
            setStep(2);
          }
        }
      } catch (err: any) {
        // API error - stay on BO selection, allow re-init
        console.error("Failed to load existing games:", err);
      }
    };
    loadExisting();
  }, []);

  // Auto-match IGN to team members
  const autoAssignTeams = (players: PlayerStatEntry[]): PlayerStatEntry[] => {
    const allMembers = [
      ...team1Members.map(m => ({ id: team1Id, name: m.username, display: m.displayName })),
      ...team2Members.map(m => ({ id: team2Id, name: m.username, display: m.displayName })),
    ];
    return players.map(p => {
      if (p.teamId && p.teamId !== 0) return p; // already assigned
      const name = (p.playerName || p.userName || "").toLowerCase();
      if (!name) return { ...p, teamId: 0 };
      // Try exact match
      for (const m of allMembers) {
        if (m.name.toLowerCase() === name || m.display?.toLowerCase() === name) {
          return { ...p, teamId: m.id };
        }
      }
      // Try partial match (name contains member or member contains name)
      const matched = allMembers.filter(m => name.includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(name));
      if (matched.length === 1) return { ...p, teamId: matched[0].id };
      return { ...p, teamId: 0 }; // ambiguous or no match
    });
  };

  const activeGame = games[currentGameIdx];

  // ====== Step 1: Initialize BO games ======
  const handleInitGames = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await matchApi.initGames(matchId, boType);
      const gameIds: number[] = res.data.data;
      const newGames: GameData[] = gameIds.map((id, i) => ({
        gameIndex: i,
        gameId: id,
        editedStats: [],
        team1Score: null,
        team2Score: null,
        saved: false,
      }));
      setGames(newGames);
      setCurrentGameIdx(0);
      setInitDone(true);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to init games");
    } finally {
      setLoading(false);
    }
  };

  // ====== Step 2: Upload screenshot & OCR ======
  const handleFileSelect = (file: File) => {
    const idx = currentGameIdxRef.current;
    setError("");
    // Set hasImg immediately so upload area switches to preview
    setGames(prev => {
      const g = [...prev];
      g[idx] = { ...g[idx], screenshotFile: file, hasImg: true };
      return g;
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const curIdx = currentGameIdxRef.current;

      // Set screenshotBase64 in state
      setGames(prev => {
        const g = [...prev];
        g[curIdx] = { ...g[curIdx], screenshotBase64: dataUrl };
        return g;
      });

      // Call OCR
      setLoading(true);
      try {
        const ocrRes = await fetch("http://127.0.0.1:3200/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: base64Data }),
        });
        if (!ocrRes.ok) throw new Error("OCR request failed: " + ocrRes.status);
        const ocrData = await ocrRes.json();

        if (ocrData.success && ocrData.players) {
          let mapped: PlayerStatEntry[] = ocrData.players.map((p: any) => ({
            userId: 0,
            playerName: p.name || "",
            userName: "",
            teamId: 0,
            stats: {
              agent: p.agent || "",
              acs: p.acs ?? null,
              kills: p.kda?.kills ?? null,
              deaths: p.kda?.deaths ?? null,
              assists: p.kda?.assists ?? null,
              firstBlood: p.firstKill ?? null,
            },
          }));

          const assigned = autoAssignTeams(mapped);
          setGames(prev => {
            const g = [...prev];
            g[curIdx] = { ...g[curIdx], ocrResult: assigned, editedStats: assigned };
            return g;
          });
        } else {
          setError("OCR returned no player data");
        }
      } catch (err: any) {
        setError("OCR识别失败: " + (err.message || "") + "。可以手动输入");
        const half = 5;
        const emptyPlayers: PlayerStatEntry[] = [];
        for (let i = 0; i < 10; i++) {
          emptyPlayers.push({
            userId: 0, playerName: "", userName: "",
            teamId: 0,
            stats: { agent: "", acs: null, kills: null, deaths: null, assists: null, firstBlood: null },
          });
        }
        setGames(prev => {
          const g = [...prev];
          g[curIdx] = { ...g[curIdx], ocrResult: emptyPlayers, editedStats: emptyPlayers };
          return g;
        });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateStats = (stats: PlayerStatEntry[]) => {
    const updated = [...games];
    updated[currentGameIdx] = { ...updated[currentGameIdx], editedStats: stats };
    setGames(updated);
  };

  const handleSaveGame = async () => {
    if (!activeGame) return;
    if (activeGame.team1Score == null || activeGame.team2Score == null) {
      setError("Please enter both team scores for this game");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await matchApi.recordGame(matchId, activeGame.gameId!, {
        screenshotBase64: activeGame.screenshotBase64,
        team1Score: activeGame.team1Score,
        team2Score: activeGame.team2Score,
        playerStats: activeGame.editedStats.map(s => ({
          userId: s.userId || null,
          playerName: s.playerName,
          teamId: s.teamId,
          stats: s.stats,
        })),
      });

      const updated = [...games];
      updated[currentGameIdx] = { ...updated[currentGameIdx], saved: true };
      setGames(updated);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save game");
    } finally {
      setLoading(false);
    }
  };

  // ====== Step 3: Finalize ======
  const handleFinalize = async () => {
    if (finalScore1 === finalScore2) {
      setError("Total score cannot be a tie");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await matchApi.finalize(matchId, finalScore1, finalScore2);
      onComplete("Match completed! " + team1Name + " " + finalScore1 + " - " + finalScore2 + " " + team2Name);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to finalize match");
    } finally {
      setLoading(false);
    }
  };

  // Check if current game can be saved
  const canSaveCurrent = activeGame && activeGame.editedStats.length > 0;
  const allSaved = games.length > 0 && games.every(g => g.saved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-4xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">记录比赛结果</h3>
            <div className="flex gap-1.5">
              <span className={"rounded px-2 py-0.5 text-[10px] font-medium " + (step >= 1 ? "bg-red-600/20 text-red-400" : "bg-zinc-800 text-zinc-600")}>BO</span>
              <span className={"rounded px-2 py-0.5 text-[10px] font-medium " + (step >= 2 ? "bg-red-600/20 text-red-400" : "bg-zinc-800 text-zinc-600")}>小局</span>
              <span className={"rounded px-2 py-0.5 text-[10px] font-medium " + (step >= 3 ? "bg-red-600/20 text-red-400" : "bg-zinc-800 text-zinc-600")}>完结</span>
            </div>
          </div>
          <button onClick={() => {
            const hasUnsaved = games.some(g => !g.saved && (g.screenshotFile || g.editedStats.length > 0));
            if (hasUnsaved) setShowCloseConfirm(true);
            else onClose();
          }} className="text-zinc-500 hover:text-white text-xl">&times;</button>
        </div>

        <p className="mb-4 text-sm text-zinc-500">{team1Name} vs {team2Name}</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        {/* Step 1: BO Selection */}
        {step === 1 && !initDone && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">选择这场比赛采用几局制（BO几）</p>
            <div className="flex gap-3">
              {[1, 3, 5].map(n => (
                <button key={n} onClick={() => setBoType(n)}
                  className={"flex-1 rounded-lg border py-4 text-lg font-semibold transition " + (boType === n ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>
                  BO{n}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600">创建后将生成 {boType} 个小局记录</p>
            <button onClick={handleInitGames} disabled={loading}
              className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {loading ? "创建中..." : "创建小局，开始录入"}
            </button>
          </div>
        )}

        {/* Step 2: Record each game */}
        {step === 2 && games.length > 0 && (
          <div className="space-y-4">
            {/* Re-select BO */}
            <div className="flex justify-end">
              <button onClick={() => {
                if (confirm("重新记录本场比赛\u5c06\u6e05\u9664\u5df2\u6709\u6570\u636e\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f")) {
                  setGames([]);
                  setInitDone(false);
                  setStep(1);
                }
              }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                重新记录本场比赛
              </button>
            </div>
            {/* Game tabs */}
            <div className="flex gap-2 border-b border-zinc-800 pb-2">
              {games.map((g, i) => (
                <button key={i} onClick={() => { if (!g.saved || g.gameIndex === currentGameIdx) setCurrentGameIdx(i); setError(""); }}
                  className={"rounded-t px-4 py-1.5 text-xs font-medium transition " + (i === currentGameIdx ? "bg-zinc-800 text-white" : g.saved ? "bg-green-900/20 text-green-400" : "text-zinc-500 hover:text-white")}>
                  第{i + 1}局 {g.saved ? "✓" : ""}
                </button>
              ))}
            </div>

            {activeGame && !activeGame.saved && (
              <div className="space-y-4">
                {/* Screenshot upload */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">上传战绩截图</label>
                  {(!activeGame.screenshotFile && !activeGame.hasImg && activeGame.editedStats.length === 0) ? (
                    <div>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-700 py-8 text-sm text-zinc-500 hover:border-red-500 hover:text-red-400 transition"
                      >
                        点击上传截图（将自动OCR识别选手数据）
                      </div>
                      <div className="mt-2 text-center">
                        <button onClick={() => {
                          const half = 5;
                          const emptyPlayers: PlayerStatEntry[] = [];
                          for (let i = 0; i < 10; i++) {
                            emptyPlayers.push({
                              userId: 0,
                              playerName: "",
                              userName: "",
                              teamId: i < half ? team1Id : team2Id,
                              stats: { agent: "", acs: null, kills: null, deaths: null, assists: null, firstBlood: null },
                            });
                          }
                          const updated = [...games];
                          updated[currentGameIdx] = { ...updated[currentGameIdx], ocrResult: emptyPlayers, editedStats: emptyPlayers };
                          setGames(updated);
                        }}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                          跳过截图，手动输入选手数据
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                      <div className="mb-2">
                        {activeGame.screenshotBase64 && (
                          <img src={activeGame.screenshotBase64} alt="screenshot"
                            onClick={() => setEnlargedImg(activeGame.screenshotBase64!)}
                            className="mb-2 max-h-48 w-full rounded object-contain bg-zinc-950 cursor-pointer hover:opacity-80 transition"
                          />
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">{activeGame.screenshotFile?.name ?? "截图"}</span>
                          <div className="flex gap-2">
                            <button onClick={() => { fileInputRef.current?.click(); }}
                              className="text-xs text-blue-400 hover:underline">重新上传</button>
                            <button onClick={() => {
                              const updated = [...games];
                              updated[currentGameIdx] = { ...updated[currentGameIdx], screenshotFile: undefined, screenshotBase64: undefined, ocrResult: undefined, editedStats: [], hasImg: undefined };
                              setGames(updated);
                            }} className="text-xs text-red-400 hover:underline">删除</button>
                          </div>
                        </div>
                      </div>
                      {loading ? (
                        <p className="py-4 text-center text-xs text-zinc-500">OCR 识别中...</p>
                      ) : activeGame.editedStats.length > 0 ? (
                        <p className="text-xs text-green-400">✓ OCR 识别完成，{activeGame.editedStats.length} 位选手</p>
                      ) : null}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                </div>

                {/* OCR results table */}
                {activeGame.editedStats.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">选手数据（可编辑修改）</label>
                    <GameStatsTable
                      players={activeGame.editedStats}
                      columns={DEFAULT_STAT_COLUMNS}
                      team1Id={team1Id}
                      team2Id={team2Id}
                      team1Name={team1Name}
                      team2Name={team2Name}
                      team1Members={team1Members}
                      team2Members={team2Members}
                      onChange={updateStats}
                    />
                  </div>
                )}

                {/* Team scores */}
                {activeGame.editedStats.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">小局比分</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="mb-1 text-xs text-zinc-500">{team1Name}</p>
                        <input type="number" min={0} max={99}
                          value={activeGame.team1Score ?? ""}
                          onChange={e => {
                            const updated = [...games];
                            updated[currentGameIdx].team1Score = e.target.value === "" ? null : Number(e.target.value);
                            setGames(updated);
                          }}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-center text-lg font-bold text-white outline-none focus:border-red-500"
                        />
                      </div>
                      <span className="text-lg font-bold text-zinc-500">:</span>
                      <div className="flex-1">
                        <p className="mb-1 text-xs text-zinc-500">{team2Name}</p>
                        <input type="number" min={0} max={99}
                          value={activeGame.team2Score ?? ""}
                          onChange={e => {
                            const updated = [...games];
                            updated[currentGameIdx].team2Score = e.target.value === "" ? null : Number(e.target.value);
                            setGames(updated);
                          }}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-center text-lg font-bold text-white outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={handleSaveGame} disabled={loading || !canSaveCurrent}
                  className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {loading ? "保存中..." : (activeGame.saved ? "保存修改" : "保存本局数据")}
                </button>
              </div>
            )}

            {activeGame?.saved && (
              <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-4 text-center">
                <p className="text-green-400 font-medium">✓ 第{currentGameIdx + 1}局已保存</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {activeGame.team1Score} - {activeGame.team2Score}
                </p>
                <button onClick={() => {
                  setGames(prev => {
                    const g = [...prev];
                    g[currentGameIdx] = { ...g[currentGameIdx], saved: false };
                    return g;
                  });
                }}
                  className="mt-3 rounded border border-zinc-600 px-4 py-1 text-xs text-zinc-400 hover:border-amber-500 hover:text-amber-400 transition">
                  编辑本局
                </button>
              </div>
            )}

            
                        {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {currentGameIdx > 0 && (
                <button onClick={() => { setCurrentGameIdx(i => i - 1); setError(""); }}
                  className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:border-zinc-500">
                  上一局
                </button>
              )}
              {currentGameIdx < games.length - 1 && activeGame?.saved && (
                <button onClick={() => { setCurrentGameIdx(i => i + 1); setError(""); }}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  下一局
                </button>
              )}
              {allSaved && (
                <button onClick={() => setStep(3)}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  确认总比分 →
                </button>
              )}
            </div>
          </div>
        )}
{/* Step 3: Finalize */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">所有小局已记录完成，请输入总比分以完结比赛</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <p className="mb-2 text-sm font-medium text-zinc-300">{team1Name}</p>
                <input type="number" min={0} max={boType}
                  value={finalScore1}
                  onChange={e => setFinalScore1(Number(e.target.value))}
                  className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-3 text-center text-2xl font-bold text-white outline-none focus:border-red-500"
                />
              </div>
              <span className="text-2xl font-bold text-zinc-500">:</span>
              <div className="flex-1 text-center">
                <p className="mb-2 text-sm font-medium text-zinc-300">{team2Name}</p>
                <input type="number" min={0} max={boType}
                  value={finalScore2}
                  onChange={e => setFinalScore2(Number(e.target.value))}
                  className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-3 text-center text-2xl font-bold text-white outline-none focus:border-red-500"
                />
              </div>
            </div>
            <button onClick={handleFinalize} disabled={loading}
              className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {loading ? "提交中..." : "确认总比分，完结比赛"}
            </button>
          </div>
        )}

        {/* Image viewer */}
        {enlargedImg && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80" onClick={() => setEnlargedImg(null)}>
            <img src={enlargedImg} className="max-h-[90vh] max-w-[90vw] rounded-lg" alt="enlarged screenshot" />
          </div>
        )}

        {/* Close confirmation */}
        {showCloseConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
            <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold">确认关闭？</h3>
              <p className="mt-2 text-sm text-zinc-400">当前有未保存的数据，关闭后将丢失。</p>
              <div className="mt-4 flex gap-3">
                <button onClick={() => setShowCloseConfirm(false)}
                  className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:border-zinc-500">继续编辑</button>
                <button onClick={() => { setShowCloseConfirm(false); onClose(); }}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700">确认关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
