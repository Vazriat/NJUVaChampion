"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import GameDetailPanel from "@/components/GameDetailPanel";
import RecruitmentPostCard from "@/components/RecruitmentPostCard";
import { teamApi, matchApi, teamApplicationApi, recruitmentPostApi, TeamVO, TeamApplicationVO, RecruitmentPostVO } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";
import Link from "next/link";

function appStatusText(status: string) {
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
      return status;
  }
}

function appStatusClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-yellow-600/20 text-yellow-400";
    case "ACCEPTED":
      return "bg-green-600/20 text-green-400";
    case "REJECTED":
      return "bg-red-600/20 text-red-400";
    default:
      return "bg-zinc-800 text-zinc-400";
  }
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<TeamVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [myApplication, setMyApplication] = useState<TeamApplicationVO | null>(null);
  // 该队伍当前 OPEN 的招募帖（至多一条），用于展示"招募中"徽标与直接申请入口
  const [teamPost, setTeamPost] = useState<RecruitmentPostVO | null>(null);
  const [applications, setApplications] = useState<TeamApplicationVO[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [matchDetailCache, setMatchDetailCache] = useState<Record<number, any>>({});

  const currentUser = getUser();
  const isMember = team?.members?.some((m) => m.userId === currentUser?.id);
  const isCaptain = team?.captainId === currentUser?.id;

  const fetchMatches = () => {
    teamApi.getMatches(Number(id))
      .then((res) => setMatches(res.data.data || []))
      .catch(() => {})
      .finally(() => setMatchesLoading(false));
  };

  // 我是否有待处理的入队申请（用于把按钮换成"已申请"提示）
  const fetchMyApplication = () => {
    teamApplicationApi.mine()
      .then((res) => {
        const list: TeamApplicationVO[] = res.data.data || [];
        const found =
          list.find((a) => a.teamId === Number(id) && a.status === "PENDING") || null;
        setMyApplication(found);
      })
      .catch(() => {});
  };

  const fetchTeamPost = () => {
    recruitmentPostApi
      .list({ teamId: Number(id) })
      .then((res) => {
        const list: RecruitmentPostVO[] = res.data.data || [];
        setTeamPost(list.length > 0 ? list[0] : null);
      })
      .catch(() => {});
  };

  const fetchTeam = () => {
    setLoading(true);
    teamApi.detail(Number(id))
      .then((res) => {
        const data = res.data.data;
        setTeam(data);
        // 只有队长能查看本队申请，避免非队长触发无意义的 400
        if (data && data.captainId === currentUser?.id) {
          teamApi.applications(Number(id))
            .then((r) => setApplications(r.data.data || []))
            .catch(() => {});
        } else {
          setApplications([]);
        }
      })
      .catch((err) => setError(err.response?.data?.message || "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    fetchTeam();
    fetchMatches();
    fetchMyApplication();
    fetchTeamPost();
  }, [id, router]);

  const handleJoin = async () => {
    if (!confirm(`确认申请加入「${team?.name}」？\n注意：同一时间只能有一支战队的入队申请待处理。`)) return;
    setActionLoading(true);
    try {
      await teamApi.join(Number(id));
      fetchTeam();
      fetchMyApplication();
    }
    catch (err: any) { alert(err.response?.data?.message || "操作失败"); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    if (!confirm("确认退出该战队？")) return;
    setActionLoading(true);
    try { await teamApi.leave(Number(id)); router.push("/teams"); }
    catch (err: any) { alert(err.response?.data?.message || "操作失败"); }
    finally { setActionLoading(false); }
  };

  const handleApplication = async (appId: number, action: "accept" | "reject") => {
    if (action === "reject" && !confirm("确认拒绝该申请？")) return;
    setProcessingId(appId);
    try {
      if (action === "accept") {
        await teamApplicationApi.accept(appId);
      } else {
        await teamApplicationApi.reject(appId);
      }
      fetchTeam();
    }
    catch (err: any) { alert(err.response?.data?.message || "操作失败"); }
    finally { setProcessingId(null); }
  };

  const handleDismiss = async (userId: number, name: string) => {
    if (!confirm(`确认将「${name}」踢出战队？`)) return;
    setProcessingId(userId);
    try {
      await teamApi.dismissMember(Number(id), userId);
      fetchTeam();
    }
    catch (err: any) { alert(err.response?.data?.message || "操作失败"); }
    finally { setProcessingId(null); }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 max-md:min-h-dvh"><NavBar /><p className="text-zinc-500">加载中...</p></div>;
  }

  if (error || !team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 max-md:min-h-dvh">
        <NavBar />
        <div className="text-center">
          <p className="text-red-400">{error || "战队不存在"}</p>
          <Link href="/teams" className="mt-4 inline-block text-red-500 hover:underline">返回战队列表</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-3xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-600/20 text-3xl font-bold text-red-400">
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold inline-flex items-center gap-3">
                {team.name}
                {team.status === 0 && (
                  <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400">已解散</span>
                )}
                {teamPost && team.status === 1 && (
                  <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-400">招募中</span>
                )}
              </h1>
              <Link href={`/profile/${team.captainId}`} className="mt-1 block text-zinc-400 hover:text-red-400">
                队长：{team.captainName}
              </Link>
              <p className="text-sm text-zinc-500">队员 {team.memberCount} 人</p>
            </div>
          </div>

          <div className="flex gap-3">
            {!isMember && team.status === 1 && (
              myApplication ? (
                <span className="rounded-lg bg-zinc-800 px-6 py-2 text-sm text-zinc-400 max-md:px-4">
                  已申请，等待队长处理
                </span>
              ) : (
                <button onClick={handleJoin} disabled={actionLoading}
                  className="rounded-lg bg-red-600 px-6 py-2 font-semibold transition hover:bg-red-700 disabled:opacity-50 max-md:px-4">
                  {actionLoading ? "处理中..." : "申请加入"}
                </button>
              )
            )}
            {isMember && !isCaptain && (
              <button onClick={handleLeave} disabled={actionLoading}
                className="rounded-lg border border-zinc-700 px-6 py-2 font-semibold text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:px-4">
                {actionLoading ? "处理中..." : "退出战队"}
              </button>
            )}
            {isCaptain && (
              <span className="rounded-lg bg-yellow-600/20 px-6 py-2 text-sm text-yellow-400 max-md:px-4">队长</span>
            )}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">战队简介</h2>
          <p className="text-zinc-300">{team.description || ""}</p>
        </div>

        {/* 该队伍的招募信息：任何人可见，可当场申请加入 */}
        {teamPost && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">招募中</h2>
            <RecruitmentPostCard
              post={teamPost}
              myTeamId={null}
              onChanged={() => {
                fetchTeamPost();
                fetchMyApplication();
              }}
            />
          </div>
        )}

        {/* 队长视角：入队申请与邀请 */}
        {isCaptain && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">入队申请</h2>
            {applications.length === 0 ? (
              <p className="text-sm text-zinc-500">暂无申请或邀请</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 max-md:px-4"
                  >
                    <div className="flex items-start justify-between gap-4 max-md:flex-col">
                      <div className="min-w-0">
                        <p className="text-sm">
                          {app.type === "APPLY" ? (
                            <>
                              <span className="font-medium">{app.initiatorName}</span>
                              <span className="text-zinc-500"> 申请加入战队</span>
                            </>
                          ) : (
                            <>
                              <span className="text-zinc-500">已邀请 </span>
                              <span className="font-medium">{app.targetName}</span>
                            </>
                          )}
                        </p>
                        {app.content && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-400">
                            {app.content}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-zinc-600">
                          {app.createdAt
                            ? new Date(app.createdAt).toLocaleString("zh-CN")
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 max-md:w-full max-md:justify-end">
                        <span
                          className={"rounded px-2 py-0.5 text-xs " + appStatusClass(app.status)}
                        >
                          {appStatusText(app.status)}
                        </span>
                        {app.canHandle && (
                          <>
                            <button
                              type="button"
                              disabled={processingId === app.id}
                              onClick={() => handleApplication(app.id, "accept")}
                              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold transition hover:bg-red-700 disabled:opacity-50 max-md:min-h-11"
                            >
                              同意
                            </button>
                            <button
                              type="button"
                              disabled={processingId === app.id}
                              onClick={() => handleApplication(app.id, "reject")}
                              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:min-h-11"
                            >
                              拒绝
                            </button>
                          </>
                        )}
                        {app.canCancel && (
                          <button
                            type="button"
                            disabled={processingId === app.id}
                            onClick={() => {
                              if (!confirm("确认撤回该邀请？")) return;
                              setProcessingId(app.id);
                              teamApplicationApi
                                .cancel(app.id)
                                .then(() => fetchTeam())
                                .catch((err: any) =>
                                  alert(err.response?.data?.message || "撤回失败")
                                )
                                .finally(() => setProcessingId(null));
                            }}
                            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:min-h-11"
                          >
                            撤回
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <h2 className="mb-4 text-lg font-semibold">队员列表</h2>
          <div className="space-y-3">
            {team.status === 0 && (
              <p className="text-sm text-zinc-500">该战队已解散，历史比赛记录仍可在下方查看。</p>
            )}
            {team.members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-red-500/50"
              >
                <Link
                  href={`/profile/${member.userId}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400">
                    {member.displayName?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {member.displayName}
                      {member.role === "CAPTAIN" && (
                        <span className="ml-2 rounded bg-yellow-600/20 px-1.5 py-0.5 text-xs text-yellow-400">队长</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">@{member.username}</p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-3 max-md:gap-2">
                  <span className="text-xs text-zinc-600">
                    {new Date(member.joinedAt).toLocaleDateString("zh-CN")} 加入
                  </span>
                  {isCaptain && member.role !== "CAPTAIN" && (
                    <button
                      type="button"
                      disabled={processingId === member.userId}
                      onClick={() => handleDismiss(member.userId, member.displayName)}
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50 max-md:min-h-11"
                    >
                      踢出
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 比赛记录 */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">比赛记录</h2>
          {matchesLoading ? (
            <p className="text-zinc-500 text-sm">加载中...</p>
          ) : matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
              <p className="text-sm text-zinc-500">暂无比赛记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((m: any) => {
                const isWin = m.won;
                return (
                  <div key={m.matchId}>
                    <div
                      onClick={() => {
                        if (expandedMatchId === m.matchId) {
                          setExpandedMatchId(null);
                        } else {
                          setExpandedMatchId(m.matchId);
                          if (!matchDetailCache[m.matchId]) {
                            matchApi.detail(m.matchId).then(r => {
                              setMatchDetailCache(prev => ({ ...prev, [m.matchId]: r.data.data }));
                            }).catch(() => {});
                          }
                        }
                      }}
                      className={"rounded-xl border p-4 cursor-pointer transition hover:border-zinc-600 " + (isWin ? "border-green-800/50 bg-green-900/10" : "border-zinc-800 bg-zinc-900")}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-300">{m.tournamentName || "未知赛事"}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {m.stage === "WINNERS" ? "胜者组" : m.stage === "LOSERS" ? "败者组" : m.stage === "GRAND_FINAL" ? "总决赛" : m.stage}
                            {m.round != null ? " R" + m.round : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            <span className={"font-bold " + (isWin ? "text-green-400" : "text-red-400")}>
                              {isWin ? "胜" : "负"}
                            </span>
                            <span className="ml-2 text-zinc-400">vs {m.opponentName || "?"}</span>
                          </p>
                          {m.games && m.games.length > 0 && (
                            <div className="mt-1 flex gap-1 justify-end">
                              {m.games.map((g: any, i: number) => (
                                <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                                  {g.team1Score ?? "?"}-{g.team2Score ?? "?"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {expandedMatchId === m.matchId && matchDetailCache[m.matchId] && (
                      <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                        <GameDetailPanel
                          games={matchDetailCache[m.matchId].games || []}
                          team1Name={matchDetailCache[m.matchId].team1Name}
                          team2Name={matchDetailCache[m.matchId].team2Name}
                          team1Id={matchDetailCache[m.matchId].team1Id}
                          team2Id={matchDetailCache[m.matchId].team2Id}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
