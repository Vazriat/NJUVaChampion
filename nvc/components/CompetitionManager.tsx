"use client";

import { useEffect, useState } from "react";
import { adminApi, adminCompetitionApi, competitionApi } from "@/lib/api";

const FORMAT_OPTIONS = [
  { value: "SINGLE_ELIM", label: "单败淘汰" },
  { value: "DOUBLE_ELIM", label: "双败淘汰" },
  { value: "SWISS_ELIM", label: "瑞士轮" },
  { value: "SINGLE_RR", label: "单循环" },
  { value: "DOUBLE_RR", label: "双循环" },
];

const STATUS_MAP: Record<string, string> = {
  SETUP: "筹备中",
  REGISTRATION: "报名中",
  GROUPED: "已分组",
};

export default function CompetitionManager() {
  const [comps, setComps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [groups, setGroups] = useState<{ name: string; format: string }[]>([]);
  const [assignment, setAssignment] = useState<Record<number, number>>({});
  const [showAddTeams, setShowAddTeams] = useState(false);
  const [allTeamsList, setAllTeamsList] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const load = () => {
    setLoading(true);
    competitionApi
      .list()
      .then((r) => setComps(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadDetail = async (id: number) => {
    try {
      const r = await competitionApi.detail(id);
      setSelected(r.data.data);
      const teams = r.data.data.registeredTeams || [];
      setGroups([{ name: "", format: "SINGLE_ELIM" }]);
      const a: Record<number, number> = {};
      teams.forEach((t: any) => { a[t.teamId] = 0; });
      setAssignment(a);
    } catch (e: any) {
      showMsg(e.response?.data?.message || "加载失败");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { showMsg("请输入活动名称"); return; }
    try {
      await adminCompetitionApi.create({ name, description: description || undefined });
      showMsg("活动已创建");
      setShowCreate(false);
      setName("");
      setDescription("");
      load();
    } catch (e: any) { showMsg(e.response?.data?.message || "创建失败"); }
  };

  const handlePublish = async (id: number) => {
    try { await adminCompetitionApi.publish(id); showMsg("已发布"); load(); }
    catch (e: any) { showMsg(e.response?.data?.message || "发布失败"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该活动？仅删除报名记录，已分组的子赛事保留。")) return;
    try { await adminCompetitionApi.delete(id); showMsg("已删除"); setSelected(null); load(); }
    catch (e: any) { showMsg(e.response?.data?.message || "删除失败"); }
  };

  const handleGroup = async () => {
    if (!selected) return;
    const teamIdsPerGroup = groups.map(() => [] as number[]);
    for (const [teamIdStr, gi] of Object.entries(assignment)) {
      const tid = Number(teamIdStr);
      if (gi >= 0 && gi < teamIdsPerGroup.length) teamIdsPerGroup[gi].push(tid);
    }
    const payload = groups.map((g, i) => ({
      name: g.name.trim() || `第${i + 1}组`,
      format: g.format,
      teamIds: teamIdsPerGroup[i],
    }));
    try {
      await adminCompetitionApi.group(selected.id, payload);
      showMsg("分组完成");
      await loadDetail(selected.id);
    } catch (e: any) { showMsg(e.response?.data?.message || "分组失败"); }
  };

  const handleRemoveTeam = async (teamId: number) => {
    if (!selected) return;
    if (!confirm("确定移除该队伍？")) return;
    try {
      await adminCompetitionApi.unregister(selected.id, teamId);
      showMsg("已移除");
      await loadDetail(selected.id);
    } catch (e: any) { showMsg(e.response?.data?.message || "移除失败"); }
  };

  const handleOpenAddTeams = async () => {
    try {
      const res = await adminApi.listTeams();
      setAllTeamsList(res.data.data || []);
      setSelectedTeamIds([]);
      setShowAddTeams(true);
    } catch { showMsg("获取战队列表失败"); }
  };

  const handleAddTeams = async () => {
    if (!selected || selectedTeamIds.length === 0) return;
    try {
      await adminCompetitionApi.batchRegister(selected.id, selectedTeamIds);
      showMsg("已添加");
      setShowAddTeams(false);
      await loadDetail(selected.id);
    } catch (e: any) { showMsg(e.response?.data?.message || "添加失败"); }
  };

  const canManageTeams = selected && (selected.status === "SETUP" || selected.status === "REGISTRATION");

  return (
    <div>
      {msg && <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>}

      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold">报名活动</h3>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold hover:bg-red-700">+ 创建活动</button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-zinc-500">加载中...</p>
      ) : comps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">暂无报名活动</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comps.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{c.name}</h4>
                  <p className="mt-1 text-xs text-zinc-500">
                    {STATUS_MAP[c.status] || c.status} · {c.registeredCount} 队已报名
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(c.id)}
                    className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">删除</button>
                  {c.status === "SETUP" && (
                    <button onClick={() => handlePublish(c.id)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">发布</button>
                  )}
                  <button onClick={() => loadDetail(c.id)}
                    className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-red-500 hover:text-red-400">
                    {c.status === "REGISTRATION" ? "分组" : "管理"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建活动弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">创建报名活动</h3>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="活动名称"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简介（选填）" rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" />
              <button onClick={handleCreate}
                className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 管理弹窗 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[85vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">管理 · {selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
            </div>

            {/* 报名队伍管理 */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">报名队伍（{selected.registeredCount}）</span>
                {canManageTeams && (
                  <button onClick={handleOpenAddTeams}
                    className="text-xs text-blue-400 hover:underline">+ 批量添加队伍</button>
                )}
              </div>
              <div className="space-y-2">
                {(selected.registeredTeams || []).length === 0 ? (
                  <p className="text-sm text-zinc-500">暂无报名队伍</p>
                ) : (
                  (selected.registeredTeams || []).map((rt: any) => (
                    <div key={rt.teamId} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-2">
                      <span className="text-sm">{rt.teamName}</span>
                      {canManageTeams && (
                        <button onClick={() => handleRemoveTeam(rt.teamId)}
                          className="text-xs text-red-400 hover:underline">移除</button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 分组区 / 子赛事展示 */}
            {selected.status === "GROUPED" ? (
              <div className="space-y-2">
                {(selected.childTournaments || []).map((t: any) => (
                  <div key={t.tournamentId} className="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-3">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-zinc-500">{t.groupName} · {t.format} · {t.maxTeams} 队</span>
                  </div>
                ))}
              </div>
            ) : selected.status === "REGISTRATION" ? (
              <>
                <div className="mb-5 space-y-3 border-t border-zinc-800 pt-4">
                  <p className="text-sm font-medium">分组设置</p>
                  {groups.map((g, gi) => (
                    <div key={gi} className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-3">
                      <input value={g.name} onChange={(e) => {
                        setGroups(prev => prev.map((x, i) => i === gi ? { ...x, name: e.target.value } : x));
                      }} placeholder={`第${gi + 1}组名称`}
                        className="flex-1 rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-white outline-none focus:border-red-500" />
                      <select value={g.format} onChange={(e) => {
                        setGroups(prev => prev.map((x, i) => i === gi ? { ...x, format: e.target.value } : x));
                      }} className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none">
                        {FORMAT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <button onClick={() => {
                        if (groups.length <= 1) { showMsg("至少保留一组"); return; }
                        setGroups(prev => prev.filter((_, i) => i !== gi));
                        setAssignment(prev => {
                          const next = { ...prev };
                          for (const k of Object.keys(next)) {
                            const v = next[Number(k)];
                            if (v === gi) next[Number(k)] = 0;
                            else if (v > gi) next[Number(k)] = v - 1;
                          }
                          return next;
                        });
                      }} className="text-red-400 hover:text-red-300 text-xs">删除</button>
                    </div>
                  ))}
                  <button onClick={() => setGroups(prev => [...prev, { name: "", format: "SINGLE_ELIM" }])}
                    className="rounded-lg border border-dashed border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:border-blue-500 hover:text-blue-400">+ 添加组</button>
                </div>

                <div className="mb-5 space-y-2">
                  <p className="text-sm font-medium">队伍分配</p>
                  {(selected.registeredTeams || []).map((rt: any) => (
                    <div key={rt.teamId} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-2">
                      <span className="text-sm">{rt.teamName}</span>
                      <select value={assignment[rt.teamId] ?? 0}
                        onChange={(e) => setAssignment(prev => ({ ...prev, [rt.teamId]: Number(e.target.value) }))}
                        className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-white outline-none">
                        {groups.map((g, i) => (
                          <option key={i} value={i}>{g.name.trim() || `第${i + 1}组`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <button onClick={handleGroup}
                  className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">确认分组</button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 批量添加队伍弹窗 */}
      {showAddTeams && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">批量添加队伍</h3>
              <button onClick={() => setShowAddTeams(false)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {allTeamsList
                .filter((t) => t.status === 1 && !(selected?.registeredTeams || []).some((rt: any) => rt.teamId === t.id))
                .map((t) => {
                  const checked = selectedTeamIds.includes(t.id);
                  return (
                    <label key={t.id} className={"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition " + (checked ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-800 hover:border-zinc-600")}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        setSelectedTeamIds(prev =>
                          prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }} className="rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500" />
                      <span className="font-medium text-zinc-200">{t.name}</span>
                      <span className="ml-auto text-xs text-zinc-500">ID:{t.id}</span>
                    </label>
                  );
                })}
              {allTeamsList.filter((t) => t.status === 1 && !(selected?.registeredTeams || []).some((rt: any) => rt.teamId === t.id)).length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-500">没有可添加的队伍</p>
              )}
            </div>
            {selectedTeamIds.length > 0 && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <p className="mb-2 text-xs text-zinc-500">已选择 {selectedTeamIds.length} 支队伍</p>
                <button onClick={handleAddTeams}
                  className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold hover:bg-blue-700">确认添加</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
