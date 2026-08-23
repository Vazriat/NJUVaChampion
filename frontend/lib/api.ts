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
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
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
  join: (id: number) => api.post(`/teams/${id}/join`),
  leave: (id: number) => api.post(`/teams/${id}/leave`),
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
}

export interface LeagueStandingVO {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  roundDiff: number;
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

export interface Announcement {
  id: number; title: string; content?: string; priority: string; status: string;
  publishedAt?: string; createdAt: string;
}

export default api;
