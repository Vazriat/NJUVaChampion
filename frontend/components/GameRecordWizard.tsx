"use client";

import { useState, useRef, useEffect } from "react";
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
  screenshotPath?: string;
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
  /** modal=居中弹窗（默认）；page=独立全屏页面 */
  variant?: "modal" | "page";
  /** admin=直接写比赛（默认）；submission=裁判申报（本地收集后一次性提交）；review=管理员审核（可修正后提交） */
  mode?: "admin" | "submission" | "review";
  /** 申报/审核模式：已有申报的完整 payload（含 games[]） */
  initialPayload?: any;
  /** 提交申报/审核通过：把完整 payload 交给父组件（submission/review 模式） */
  onSubmitPayload?: (payload: any) => Promise<void>;
}

export default function GameRecordWizard({
  tournamentId, matchId, team1Id, team2Id, team1Name, team2Name, onClose, onComplete,
  variant = "modal",
  mode = "admin",
  initialPayload,
  onSubmitPayload,
}: GameRecordWizardProps) {
  const isPage = variant === "page";

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
  const [note, setNote] = useState(initialPayload?.note || "");
  const [matchInfo, setMatchInfo] = useState<any>(null);
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
      if (mode !== "admin") {
        // 新建申报（无 initialPayload）：停在步骤 1 让裁判选 BO
        if (!initialPayload) {
          return;
        }
        // 编辑申报 / 审核：从 initialPayload 恢复草稿
        const payload = initialPayload || {};
        if (payload.boType) setBoType(payload.boType);
        if (payload.note) setNote(payload.note);
        if (payload.team1Wins != null) setFinalScore1(payload.team1Wins);
        if (payload.team2Wins != null) setFinalScore2(payload.team2Wins);
        const plGames: any[] = payload.games || [];
        if (plGames.length > 0) {
          const existingGames: GameData[] = plGames.map((g: any, i: number) => ({
            gameIndex: i,
            editedStats: (g.playerStats || []).map((ps: any) => ({
              userId: ps.userId || 0,
              playerName: ps.playerName || "",
              userName: ps.userName || ps.playerName || "",
              teamId: ps.teamId,
              stats: ps.stats || {},
            })),
            team1Score: g.team1Score ?? null,
            team2Score: g.team2Score ?? null,
            saved: g.team1Score != null && g.team2Score != null,
            screenshotPath: g.screenshotPath,
            screenshotBase64: undefined,
          }));
          setGames(existingGames);
          setInitDone(true);
          setCurrentGameIdx(0);
          setStep(2);
        } else {
          // 无小局（跳过小局申报）
          setGames([]);
          setInitDone(true);
          setStep(3);
        }
        return;
      }
      try {
        const res = await matchApi.detail(matchId);
        const data = res.data.data;
        setMatchInfo({
          matchStatus: data?.status || "PENDING",
          team1Score: data?.team1Score ?? null,
          team2Score: data?.team2Score ?? null,
          gamesPerMatch: data?.gamesPerMatch ?? null,
          pendingSubmission: data?.pendingSubmission || null,
          approvedSubmission: data?.approvedSubmission || null,
        });
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
            // 已完整录入：进步骤 3（总比分已填，可修改或返回小局）
            setFinalScore1(data.team1Score ?? 0);
            setFinalScore2(data.team2Score ?? 0);
            setStep(3);
            setCurrentGameIdx(0);
          } else {
            const firstUnsaved = existingGames.findIndex(g => !g.saved);
            setCurrentGameIdx(firstUnsaved >= 0 ? firstUnsaved : 0);
            setStep(2);
          }
        } else if (data?.status === "COMPLETED") {
          // 已完结但从未建小局：直接进步骤 3（总比分已填，可补录或修改）
          setBoType(data.gamesPerMatch ?? 3);
          setFinalScore1(data.team1Score ?? 0);
          setFinalScore2(data.team2Score ?? 0);
          setGames([]);
          setInitDone(true);
          setStep(3);
        }
        // PENDING 且无 games：留在步骤 1 选 BO
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
    if (mode !== "admin") {
      // 申报/审核模式：本地创建小局占位，不调接口
      const newGames: GameData[] = [];
      for (let i = 0; i < boType; i++) {
        newGames.push({ gameIndex: i, editedStats: [], team1Score: null, team2Score: null, saved: false });
      }
      setGames(newGames);
      setCurrentGameIdx(0);
      setInitDone(true);
      setStep(2);
      return;
    }
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
        g[curIdx] = { ...g[curIdx], screenshotBase64: dataUrl, screenshotPath: undefined };
        return g;
      });

      // Call OCR
      setLoading(true);
      try {
        const ocrRes = await fetch("/ocr", {
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
      setError("请填写双方小局比分");
      return;
    }
    if (mode !== "admin") {
      // 申报/审核模式：仅本地保存，提交时统一上传
      const updated = [...games];
      updated[currentGameIdx] = { ...updated[currentGameIdx], saved: true };
      setGames(updated);
      setError("");
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
  // 构建完整赛果 payload（申报/审核提交用）
  const buildPayload = () => ({
    boType,
    team1Wins: finalScore1,
    team2Wins: finalScore2,
    note: note || "",
    games: games.map((g, i) => ({
      gameNumber: i + 1,
      team1Score: g.team1Score,
      team2Score: g.team2Score,
      screenshotPath: g.screenshotPath,
      screenshotBase64: g.screenshotBase64 || undefined,
      playerStats: (g.editedStats || []).map(s => ({
        userId: s.userId || null,
        playerName: s.playerName,
        teamId: s.teamId,
        stats: s.stats,
      })),
    })),
  });

  const handleFinalize = async () => {
    const needed = Math.floor(boType / 2) + 1;
    if (finalScore1 < 0 || finalScore2 < 0) {
      setError("比分不能为负数");
      return;
    }
    if (Math.max(finalScore1, finalScore2) !== needed || Math.min(finalScore1, finalScore2) >= needed) {
      setError("总比分无效：BO" + boType + " 需一方达到 " + needed + " 胜（例如 " + needed + "-0 或 " + needed + "-" + (needed - 1) + "）");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (mode === "admin") {
        await matchApi.finalize(matchId, finalScore1, finalScore2);
        onComplete("比赛已完结：" + team1Name + " " + finalScore1 + " - " + finalScore2 + " " + team2Name);
      } else {
        await onSubmitPayload?.(buildPayload());
        onComplete(mode === "review" ? "已通过并写入赛果" : "申报已提交，等待管理员审核");
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "提交失败");
    } finally {
      setLoading(false);
    }
  };

  // Check if current game can be saved
  const canSaveCurrent = activeGame && activeGame.editedStats.length > 0;
  const allSaved = games.length > 0 && games.every(g => g.saved);

  return (
    <div className={isPage ? "min-h-screen bg-zinc-950 text-white" : "fixed inset-0 z-50 flex items-center justify-center bg-black/60"}>
      <div className={isPage ? "mx-auto w-full max-w-7xl px-4 py-8 sm:px-8" : "w-full max-w-6xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[90vh] overflow-y-auto"}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {mode === "review" ? "审核赛果申报" : mode === "submission" ? "申报赛果" : "记录比赛结果"}
            </h3>
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
          }} className={isPage ? "rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 hover:border-red-500 hover:text-red-400 transition" : "text-zinc-500 hover:text-white text-xl"}>
            {isPage ? "← 返回管理后台" : "×"}
          </button>
        </div>

        <p className={"mb-4 text-zinc-500 " + (isPage ? "text-base" : "text-sm")}>{team1Name} vs {team2Name}</p>

        {matchInfo && (
          <div className="mb-4 space-y-1 rounded-lg border border-zinc-800 bg-zinc-800/40 p-3 text-xs">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-300">
              <span>比赛状态：<b className={matchInfo.matchStatus === "COMPLETED" ? "text-green-400" : "text-yellow-400"}>{matchInfo.matchStatus === "COMPLETED" ? "已完结" : "待赛"}</b></span>
              <span>总比分：{matchInfo.team1Score != null ? matchInfo.team1Score + " : " + matchInfo.team2Score : "未填"}</span>
              <span>小局进度：{games.filter(g => g.saved).length}/{games.length || (matchInfo.gamesPerMatch ?? 0)}</span>
            </div>
            {matchInfo.pendingSubmission && (
              <p className="text-yellow-400">⚠ 已有裁判申报待审核（{matchInfo.pendingSubmission.refereeName || ("#" + matchInfo.pendingSubmission.refereeId)}）——建议先到赛事详情页「赛果申报审核」处理</p>
            )}
            {matchInfo.approvedSubmission && (
              <p className="text-green-400">✔ 本场结果由裁判申报录入（{matchInfo.approvedSubmission.refereeName || ("#" + matchInfo.approvedSubmission.refereeId)}，审核通过）</p>
            )}
          </div>
        )}

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
            {/* 顶部工具条 */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">已录入 {games.filter(g => g.saved).length}/{games.length} 局</p>
              <button onClick={() => {
                if (confirm("清空重录将删除现有小局数据与比分，确定继续？")) {
                  setGames([]);
                  setInitDone(false);
                  setStep(1);
                }
              }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                清空重录（删除现有数据）
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
                        {(activeGame.screenshotBase64 || activeGame.screenshotPath) && (
                          <img src={activeGame.screenshotBase64 || activeGame.screenshotPath} alt="screenshot"
                            onClick={() => setEnlargedImg(activeGame.screenshotBase64 || activeGame.screenshotPath!)}
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
                              updated[currentGameIdx] = { ...updated[currentGameIdx], screenshotFile: undefined, screenshotBase64: undefined, screenshotPath: undefined, ocrResult: undefined, editedStats: [], hasImg: undefined };
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

            {/* 跳过小局录入，直接录大比分 */}
            <div className="flex justify-center pt-1">
              <button onClick={() => {
                if (games.some(g => !g.saved && (g.screenshotFile || g.screenshotBase64 || g.editedStats.length > 0))) {
                  if (!confirm("有未保存的小局数据，跳过将不记录这些数据，比赛将以总比分完结。确定继续？")) return;
                }
                setStep(3);
              }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                跳过小局录入，直接录大比分 →
              </button>
            </div>
          </div>
        )}
{/* Step 3: Finalize */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              {mode === "submission" ? "确认总比分并提交申报（管理员审核后生效）"
                : mode === "review" ? "审核确认：核对/修正总比分后写入赛果"
                : "所有小局已记录完成，请输入总比分以完结比赛"}
            </p>
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
            {(mode === "submission" || mode === "review") && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">备注（选填）</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="特殊情况说明（如弃权、加时等）"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-red-500" />
              </div>
            )}
            <button onClick={handleFinalize} disabled={loading}
              className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {loading ? "提交中..." : mode === "submission" ? "提交申报" : mode === "review" ? "通过并写入赛果" : (matchInfo?.matchStatus === "COMPLETED" ? "修改总比分，重新提交" : "确认总比分，完结比赛")}
            </button>
            <div className="flex items-center justify-center gap-5">
              {games.length > 0 && (
                <button onClick={() => setStep(2)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition">
                  ← 返回小局修改
                </button>
              )}
              <button onClick={() => {
                if (confirm("清空重录将删除现有小局数据与比分，确定继续？")) {
                  setGames([]);
                  setInitDone(false);
                  setStep(1);
                }
              }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                清空重录
              </button>
            </div>
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
