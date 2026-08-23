"use client";

export interface User {
  id: number;
  username: string;
  gameId: string | null;
  displayGameId: string | null;
  email: string;
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