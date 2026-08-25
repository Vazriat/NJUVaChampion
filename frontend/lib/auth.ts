"use client";

export interface User {
  id: number;
  username: string;
  gameId: string | null;
  displayGameId: string | null;
  email: string;
  role: string;
  status: number;
  referee?: boolean;
  contact?: string;
  contactPublic?: boolean;
  verifiedType?: string;
  identityVerified?: boolean;
  verifiedRank?: string;
  rankPublic?: boolean;
  displayPreference?: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function removeToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user: User) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** 裁判模式开关（localStorage，默认关；开启后显示裁判相关入口） */
export function getRefereeMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("refereeMode") === "1";
}

export function setRefereeMode(on: boolean) {
  localStorage.setItem("refereeMode", on ? "1" : "0");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("referee-mode-change", { detail: on }));
  }
}
export function isIdentityVerified(user: User | null): boolean {
  if (!user) return false;
  // 优先使用后端权威标记（查认证表）；旧缓存回退到 verifiedType
  if (user.identityVerified === true) return true;
  return user.verifiedType === "STUDENT" || user.verifiedType === "ALUMNI";
}