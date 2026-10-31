import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window === "undefined" || !err.response) {
      return Promise.reject(err);
    }

    const status: number = err.response.status;
    const body: any = err.response.data;

    // 身份认证门槛：已登录但未通过在校生/校友认证，拉回认证页
    if (body?.code === 40301) {
      if (!window.location.pathname.startsWith("/verify")) {
        window.location.href = "/verify?required=1";
      }
      return Promise.reject(err);
    }

    // 会话失效。
    // 401 由后端 AuthenticationEntryPoint 返回；再对「403 且响应体为空」做兜底，
    // 那是 Spring 默认入口点 Http403ForbiddenEntryPoint 的特征。
    // 不能把所有 403 都当登出：40301（认证门槛）与 403（权限不足）都带 Result
    // 业务码，属于正常业务响应，登出会造成误踢。
    const emptyBody = body == null || body === "";
    if (status === 401 || (status === 403 && emptyBody)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

// ====== 认证接口 ======
export const authApi = {
  register: (data: { username: string; password: string; gameId?: string; email?: string }) =>
    api.post("/auth/register", data),
  login: (data: { username: string; password: string }) =>
    api.post("/auth/login", data),
  getProfile: () => api.get("/user/profile"),
};

// ====== 账号设置接口 ======
export const userApi = {
  updateUsername: (newUsername: string) => api.put("/user/username", { newUsername }),
  updateEmail: (newEmail: string) => api.put("/user/email", { newEmail }),
  updateGameId: (gameId: string) => api.put("/user/game-id", { gameId }),
  updateContact: (contact: string, contactPublic: boolean) => api.put("/user/contact", { contact, contactPublic }),
  updateDisplayPreference: (pref: string) => api.put("/user/display-preference", { displayPreference: pref }),
  updatePassword: (oldPassword: string, newPassword: string) =>
    api.put("/user/password", { oldPassword, newPassword }),
};

// ====== 公开用户接口 ======
export const publicUserApi = {
  list: () => api.get("/users"),
  detail: (id: number) => api.get(`/users/${id}`),
};

export interface UserVO {
  id: number;
  username: string;
  gameId: string | null;
  displayGameId: string | null;
  role: string;
  status: number;
  contact?: string;
  contactPublic?: boolean;
  verifiedType?: string;
  identityVerified?: boolean;
  verifiedRank?: string;
  rankPublic?: boolean;
  displayPreference?: string;
  displayName?: string;
  createdAt: string;
  team: { id: number; name: string; role: string } | null;
}

// ====== 战队接口 ======
export const teamApi = {
  create: (data: { name: string; logo?: string; description?: string }) =>
    api.post("/teams", data),
  list: () => api.get("/teams"),
  myTeam: () => api.get("/teams/my"),
  myCaptainedTeams: () => api.get("/teams/captain"),
  getMatches: (id: number) => api.get("/teams/" + id + "/matches"),
  detail: (id: number) => api.get(`/teams/${id}`),
  // 入队已改为审批制：join 现在提交一条入队申请，返回申请记录
  join: (id: number) => api.post(`/teams/${id}/join`),
  leave: (id: number) => api.post(`/teams/${id}/leave`),
  applications: (id: number) => api.get(`/teams/${id}/applications`),
  dismissMember: (teamId: number, userId: number) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
};

export interface TeamVO {
  id: number;
  name: string;
  logo: string | null;
  description: string | null;
  captainId: number;
  captainName: string;
  status: number;
  memberCount: number;
  contact?: string;
  contactPublic?: boolean;
  verifiedType?: string;
  verifiedRank?: string;
  rankPublic?: boolean;
  displayPreference?: string;
  displayName?: string;
  createdAt: string;
  members: MemberVO[];
}

export interface MemberVO {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  role: string;
  joinedAt: string;
}

// ====== 人才市场帖子 ======
export const recruitmentPostApi = {
  list: (params?: { type?: string; keyword?: string; userId?: number; teamId?: number }) =>
    api.get("/recruitment-posts", { params }),
  mine: () => api.get("/recruitment-posts/mine"),
  detail: (id: number) => api.get(`/recruitment-posts/${id}`),
  create: (data: { type: string; content: string }) => api.post("/recruitment-posts", data),
  update: (id: number, content: string) => api.put(`/recruitment-posts/${id}`, { content }),
  close: (id: number) => api.delete(`/recruitment-posts/${id}`),
};

export interface RecruitmentPostVO {
  id: number;
  type: "TEAM" | "PLAYER";
  teamId: number | null;
  teamName: string | null;
  userId: number;
  displayName: string;
  username: string | null;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  mine: boolean;
  canApply: boolean;
  applicationStatus: string | null;
  applicationId: number | null;
}

// ====== 入队申请与邀请 ======
export const teamApplicationApi = {
  create: (data: {
    type: string;
    teamId: number;
    targetUserId?: number;
    postId?: number;
    content?: string;
  }) => api.post("/team-applications", data),
  // 我收到的
  inbox: () => api.get("/team-applications/inbox"),
  // 我发起的
  mine: () => api.get("/team-applications/mine"),
  accept: (id: number) => api.post(`/team-applications/${id}/accept`),
  reject: (id: number) => api.post(`/team-applications/${id}/reject`),
  // 撤回：选手撤回自己的入队申请 / 队长撤回自己发出的邀请
  cancel: (id: number) => api.delete(`/team-applications/${id}`),
};

export interface TeamApplicationVO {
  id: number;
  type: "APPLY" | "INVITE";
  teamId: number;
  teamName: string | null;
  teamCaptainId: number | null;
  postId: number | null;
  initiatorUserId: number;
  initiatorName: string;
  initiatorUsername: string | null;
  targetUserId: number;
  targetName: string;
  targetUsername: string | null;
  content: string | null;
  status: string;
  handledAt: string | null;
  createdAt: string;
  canHandle: boolean;
  canCancel: boolean;
}

// ====== 管理员接口 ======
export const adminApi = {
  listUsers: () => api.get("/admin/users"),
  getUser: (id: number) => api.get(`/admin/users/${id}`),
  updateUser: (id: number, data: Record<string, any>) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  purgeUser: (id: number) => api.delete(`/admin/users/${id}/purge`),
  listTeams: () => api.get("/admin/teams"),
  listTeamRatings: (sort?: string) => api.get("/admin/teams/ratings", { params: { sort } }),
  getTeam: (id: number) => api.get(`/admin/teams/${id}`),
  updateTeam: (id: number, data: Record<string, any>) => api.put(`/admin/teams/${id}`, data),
  deleteTeam: (id: number) => api.delete(`/admin/teams/${id}`),
  purgeTeam: (id: number) => api.delete(`/admin/teams/${id}/purge`),
};

// ====== 赛事接口 ======
export const tournamentApi = {
  list: () => api.get("/tournaments"),
  detail: (id: number) => api.get(`/tournaments/${id}`),
  playerStats: (id: number) => api.get(`/tournaments/${id}/player-stats`),
  register: (tournamentId: number, teamId: number) =>
    api.post(`/tournaments/${tournamentId}/register`, { teamId }),
  unregister: (tournamentId: number, teamId: number) =>
    api.post(`/tournaments/${tournamentId}/unregister`, { teamId }),
};

export interface TournamentVO {
  id: number;
  name: string;
  description: string | null;
  status: string;
  maxTeams: number;
  bracketType: string;
  type: string;
  format: string;
  currentStage: number | null;
  swissRounds?: number;
  knockoutFormat?: string;
  swissPairingMode?: string;
  currentSwissRound?: number;
  hasPlayoffs?: boolean;
  playoffFormat?: string;
  playoffSize?: number;
  registeredCount: number;
  championTeamId: number | null;
  championTeamName: string | null;
  groupName?: string | null;
  contact?: string;
  contactPublic?: boolean;
  verifiedType?: string;
  verifiedRank?: string;
  rankPublic?: boolean;
  displayPreference?: string;
  displayName?: string;
  createdAt: string;
  registeredTeams?: RegisteredTeamInfo[];
  matches?: MatchVO[];
  leagueStandings?: LeagueStandingVO[];
}

export interface RegisteredTeamInfo {
  id: number;
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  captainName: string | null;
  description: string | null;
  memberCount: number;
  seed: number;
  registeredAt: string;
}

export interface MatchVO {
  id: number;
  stage: string;
  round: number;
  position: number;
  team1Id: number | null;
  team1Name: string | null;
  team2Id: number | null;
  team2Name: string | null;
  winnerId: number | null;
  status: string;
  gamesPerMatch?: number;
  team1Wins?: number;
  team2Wins?: number;
  team1Score?: number;
  team2Score?: number;
  hasPendingSubmission?: boolean;
  pendingSubmission?: { id: number; refereeId: number; refereeName?: string; createdAt?: string } | null;
  approvedSubmission?: { id: number; refereeId: number; refereeName?: string } | null;
}

export interface LeagueStandingVO {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  roundDiff: number;
}

export interface SwissStandingVO {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  buchholz: number;
  roundDiff: number;
  status?: "ACTIVE" | "QUALIFIED" | "ELIMINATED";
}

// ====== 管理员赛事接口 ======
export const adminTournamentApi = {
  create: (data: { name: string; description?: string; type?: string; format?: string; maxTeams?: number; gamesPerMatch?: number }) =>
    api.post("/admin/tournaments", data),
  publish: (id: number) => api.post(`/admin/tournaments/${id}/publish`),
  start: (id: number) => api.post(`/admin/tournaments/${id}/start`),
  delete: (id: number) => api.delete(`/admin/tournaments/${id}`),
  batchRegister: (id: number, teamIds: number[]) =>
    api.post(`/admin/tournaments/${id}/batch-register`, { teamIds }),
};

// ====== 报名活动接口 ======
export const competitionApi = {
  list: () => api.get("/competitions"),
  detail: (id: number) => api.get(`/competitions/${id}`),
  register: (competitionId: number, teamId: number) =>
    api.post(`/competitions/${competitionId}/register`, { teamId }),
  unregister: (competitionId: number, teamId: number) =>
    api.post(`/competitions/${competitionId}/unregister`, { teamId }),
};

export const adminCompetitionApi = {
  create: (data: { name: string; description?: string }) =>
    api.post("/admin/competitions", data),
  publish: (id: number) => api.post(`/admin/competitions/${id}/publish`),
  group: (id: number, groups: { name: string; format: string; teamIds: number[] }[]) =>
    api.post(`/admin/competitions/${id}/group`, { groups }),
  register: (id: number, teamId: number) =>
    api.post(`/admin/competitions/${id}/register`, { teamId }),
  batchRegister: (id: number, teamIds: number[]) =>
    api.post(`/admin/competitions/${id}/batch-register`, { teamIds }),
  unregister: (id: number, teamId: number) =>
    api.post(`/admin/competitions/${id}/unregister`, { teamId }),
  delete: (id: number) => api.delete(`/admin/competitions/${id}`),
};

export const searchApi = {
  search: (q: string) => api.get("/search", { params: { q } }),
};


// ====== 比赛小局管理接口 ======
export const matchApi = {
  initGames: (matchId: number, boType: number) =>
    api.post("/admin/matches/" + matchId + "/games/init", { boType }),
  recordGame: (matchId: number, gameId: number, data: Record<string, any>) =>
    api.put("/admin/matches/" + matchId + "/games/" + gameId, data),
  finalize: (matchId: number, team1Wins: number, team2Wins: number) =>
    api.post("/admin/matches/" + matchId + "/finalize", { team1Wins, team2Wins }),
  detail: (matchId: number) =>
    api.get("/admin/matches/" + matchId + "/detail"),
};

// ====== 赛果申报接口 ======
export const resultSubmissionApi = {
  create: (data: any) => api.post("/result-submissions", data),
  update: (id: number, data: any) => api.put(`/result-submissions/${id}`, data),
  my: () => api.get("/result-submissions/my"),
  detail: (id: number) => api.get(`/result-submissions/${id}`),
  cancel: (id: number) => api.delete(`/result-submissions/${id}`),
};

export const adminResultSubmissionApi = {
  list: (params?: { status?: string; tournamentId?: number }) =>
    api.get("/admin/result-submissions", { params }),
  detail: (id: number) => api.get(`/admin/result-submissions/${id}`),
  approve: (id: number, data: any) => api.post(`/admin/result-submissions/${id}/approve`, data),
  reject: (id: number, data: { reviewNote: string }) =>
    api.post(`/admin/result-submissions/${id}/reject`, data),
};

// ====== 生涯接口 ======
export const careerApi = {
  get: (userId: number) => api.get("/career/" + userId),
  getMatches: (userId: number, page?: number) => api.get("/career/" + userId + "/matches", { params: { page } }),
  getStats: (userId: number) => api.get("/career/" + userId + "/stats"),
  getAnalysis: (userId: number, ranks: string, tournaments?: string) =>
    api.get("/career/" + userId + "/analysis", {
      params: tournaments ? { ranks, tournaments } : { ranks },
    }),
};


// ====== 截图管理接口 ======
export const screenshotApi = {
  list: (params?: any) => api.get("/admin/screenshots", { params }),
  searchByTournamentName: (q: string) => api.get("/admin/screenshots/search-by-tournament", { params: { q } }),
  stats: () => api.get("/admin/screenshots/stats"),
  batchDelete: (gameIds: number[]) => api.delete("/admin/screenshots/batch", { data: { gameIds } }),
  delete: (gameId: number) => api.delete("/admin/screenshots/" + gameId),
};


// ====== 认证接口 ======
export const certificationApi = {
  apply: (data: any) => api.post("/certification/apply", data),
  my: () => api.get("/certification/my"),
}

export const adminCertificationApi = {
  list: (status?: string) => api.get("/admin/certifications", { params: { status } }),
  detail: (id: number) => api.get("/admin/certifications/" + id),
  approve: (id: number, data?: any) => api.post("/admin/certifications/" + id + "/approve", data),
  revoke: (id: number) => api.post("/admin/certifications/" + id + "/revoke"),
  reject: (id: number, reason: string) => api.post("/admin/certifications/" + id + "/reject", { reason }),
}


// ====== 宣传栏 ======
export const bannerApi = {
  getActive: () => api.get("/banners/active"),
}

export const adminBannerApi = {
  list: () => api.get("/admin/banners"),
  create: (data: any) => api.post("/admin/banners", data),
  update: (id: number, data: any) => api.put("/admin/banners/" + id, data),
  delete: (id: number) => api.delete("/admin/banners/" + id),
}

// ====== 通知 ======
export const announcementApi = {
  getLatest: () => api.get("/announcements/latest"),
  list: () => api.get("/announcements"),
  detail: (id: number) => api.get("/announcements/" + id),
}

export const adminAnnouncementApi = {
  list: () => api.get("/admin/announcements"),
  create: (data: any) => api.post("/admin/announcements", data),
  update: (id: number, data: any) => api.put("/admin/announcements/" + id, data),
  publish: (id: number) => api.post("/admin/announcements/" + id + "/publish"),
  delete: (id: number) => api.delete("/admin/announcements/" + id),
}

// ====== 赛事通知 ======
export const tournamentAnnouncementApi = {
  listByTournament: (tournamentId: number) => api.get(`/tournaments/${tournamentId}/announcements`),
  my: () => api.get("/tournament-notifications/my"),
}

export const adminTournamentAnnouncementApi = {
  list: (tournamentId: number) => api.get(`/admin/tournaments/${tournamentId}/announcements`),
  create: (tournamentId: number, data: any) => api.post(`/admin/tournaments/${tournamentId}/announcements`, data),
  update: (tournamentId: number, id: number, data: any) => api.put(`/admin/tournaments/${tournamentId}/announcements/${id}`, data),
  publish: (tournamentId: number, id: number) => api.post(`/admin/tournaments/${tournamentId}/announcements/${id}/publish`),
  delete: (tournamentId: number, id: number) => api.delete(`/admin/tournaments/${tournamentId}/announcements/${id}`),
}

// ====== 段位审核 ======
export const adminRankReviewApi = {
  tournamentReview: (tournamentId: number) => api.get(`/admin/tournaments/${tournamentId}/rank-review`),
  passTournamentUser: (tournamentId: number, userId: number) => api.post(`/admin/tournaments/${tournamentId}/rank-review/pass`, { userId }),
  unpassTournamentUser: (tournamentId: number, userId: number) => api.delete(`/admin/tournaments/${tournamentId}/rank-review/pass`, { params: { userId } }),
  competitionReview: (competitionId: number) => api.get(`/admin/competitions/${competitionId}/rank-review`),
  passCompetitionUser: (competitionId: number, userId: number) => api.post(`/admin/competitions/${competitionId}/rank-review/pass`, { userId }),
  unpassCompetitionUser: (competitionId: number, userId: number) => api.delete(`/admin/competitions/${competitionId}/rank-review/pass`, { params: { userId } }),
}

// ====== 定向通知（发给本人的消息） ======
export const notificationApi = {
  list: () => api.get("/notifications"),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

export interface UserNotificationVO {
  id: number;
  type: string;
  title: string;
  content: string | null;
  refType: string | null;
  refId: number | null;
  readFlag: boolean;
  createdAt: string;
}

// ====== 管理员人才市场管理 ======
export const adminRecruitmentPostApi = {
  list: (params?: { type?: string; status?: string; keyword?: string }) =>
    api.get("/admin/recruitment-posts", { params }),
  /** 下架：置 CLOSED 并通知作者 */
  takeDown: (id: number) => api.post(`/admin/recruitment-posts/${id}/take-down`),
};

export interface Announcement {
  id: number; title: string; content?: string; priority: string; status: string;
  publishedAt?: string; createdAt: string;
}

// ====== 直播与回放 ======
export const liveApi = {
  /** 正在直播列表（分页） */
  listLive: (page = 1, size = 20) =>
    api.get("/live/streams", { params: { page, size } }),
  /** 某场比赛的直播历史 */
  matchStreams: (matchId: number) =>
    api.get("/live/streams", { params: { matchId } }),
  /** 某场比赛的回放（倒序，最新在前） */
  replays: (matchId: number) =>
    api.get("/live/replays", { params: { matchId } }),
  /** 主播列表 */
  channels: (page = 1, size = 20) =>
    api.get("/live/channels", { params: { page, size } }),

  // ---- 裁判端 ----
  myChannel: () => api.get("/referee/live/channel"),
  bindChannel: (url: string) => api.put("/referee/live/channel", { url }),
  unbindChannel: () => api.delete("/referee/live/channel"),
  /** 开播确认框数据：房间标题、能否开播、软提示 */
  preview: (matchId: number) =>
    api.get("/referee/live/preview", { params: { matchId } }),
  /** 可开播的比赛列表 */
  startable: () => api.get("/referee/live/matches"),
  start: (matchId: number) => api.post("/referee/live/streams", { matchId }),
  end: (id: number) => api.patch(`/referee/live/streams/${id}/end`),
  addReplay: (data: { matchId: number; url: string; title?: string }) =>
    api.post("/referee/live/replays", data),
  deleteReplay: (id: number) => api.delete(`/referee/live/replays/${id}`),

  // ---- 管理端 ----
  adminChannels: (params?: { status?: string; page?: number; size?: number }) =>
    api.get("/admin/live/channels", { params }),
  setChannelStatus: (id: number, status: "ACTIVE" | "HIDDEN") =>
    api.patch(`/admin/live/channels/${id}/status`, { status }),
  adminEnd: (id: number) => api.patch(`/admin/live/streams/${id}/end`),
  adminDeleteReplay: (id: number) => api.delete(`/admin/live/replays/${id}`),
};

export interface LiveStreamVO {
  id: number;
  matchId: number;
  tournamentId: number;
  refereeId: number;
  platform: string;
  roomId: string | null;
  rawUrl?: string | null;
  status: "LIVE" | "ENDED";
  startedAt: string;
  endedAt: string | null;
  team1Name?: string;
  team2Name?: string;
  team1Id?: number | null;
  team2Id?: number | null;
  round?: number;
  stage?: string;
  matchStatus?: string;
  tournamentName?: string;
}

export interface LiveChannelVO {
  channelId: number;
  userId: number;
  username: string | null;
  gameId: string | null;
  platform: string;
  roomId: string | null;
  rawUrl: string;
  status?: string;
  live: boolean;
  liveMatchId: number | null;
  liveStreamId: number | null;
}

export interface MatchReplayVO {
  id: number;
  matchId: number;
  url: string;
  title: string | null;
  uploadedBy: number;
  createdAt: string;
}

export interface LivePreviewVO {
  matchName: string;
  tournamentName: string | null;
  channel: { platform: string; roomId: string | null; rawUrl: string } | null;
  canStart: boolean;
  blockReason: string | null;
  activeStreamId: number | null;
  warnings: string[];
  roomTitle: string | null;
  roomLive: boolean | null;
}

export default api;
