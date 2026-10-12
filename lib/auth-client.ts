export interface AuthUser {
  id: string;
  email: string;
  businessName: string;
}

export function saveSession(token: string, user: AuthUser, rememberMe: boolean = true) {
  if (typeof window === "undefined") return;

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem("bizmate_token", token);
  storage.setItem("bizmate_user", JSON.stringify(user));

  // Set lightweight cookie for middleware / SSR detection
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days vs 1 day
  document.cookie = `bizmate_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getSession(): { token: string; user: AuthUser } | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("bizmate_token") || sessionStorage.getItem("bizmate_token");
  const userJson = localStorage.getItem("bizmate_user") || sessionStorage.getItem("bizmate_user");

  if (!token || !userJson) return null;

  try {
    const user = JSON.parse(userJson) as AuthUser;
    return { token, user };
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("bizmate_token");
  localStorage.removeItem("bizmate_user");
  sessionStorage.removeItem("bizmate_token");
  sessionStorage.removeItem("bizmate_user");
  document.cookie = "bizmate_token=; path=/; max-age=0";
}
