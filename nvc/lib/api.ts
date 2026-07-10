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
  listTeams: () => api.get("/admin/teams"),
  getTeam: (id: number) => api.get(`/admin/teams/${id}`),
  updateTeam: (id: number, data: Record<string, any>) => api.put(`/admin/teams/${id}`, data),
  deleteTeam: (id: number) => api.delete(`/admin/teams/${id}`),
};

// ====== 赛事接口 ======
export const tournamentApi = {
  list: () => api.get("/tournaments"),
  detail: (id: number) => api.get(`/tournaments/${id}`),
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
  registeredCount: number;
  championTeamId: number | null;
  championTeamName: string | null;
  createdAt: string;
  registeredTeams?: RegisteredTeamInfo[];
  matches?: MatchVO[];
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

// ====== 管理员赛事接口 ======
export const adminTournamentApi = {
  create: (data: { name: string; description?: string; type?: string; format?: string; maxTeams?: number; gamesPerMatch?: number }) =>
    api.post("/admin/tournaments", data),
  publish: (id: number) => api.post(`/admin/tournaments/${id}/publish`),
  start: (id: number) => api.post(`/admin/tournaments/${id}/start`),
  setMatchWinner: (tournamentId: number, matchId: number, winnerTeamId: number, gamesPerMatch?: number) =>
    api.put(`/admin/tournaments/${tournamentId}/matches/${matchId}`, { winnerTeamId, gamesPerMatch }),
  detail: (id: number) => api.get(`/admin/tournaments/${id}`),
  delete: (id: number) => api.delete(`/admin/tournaments/${id}`),
};

export default api;