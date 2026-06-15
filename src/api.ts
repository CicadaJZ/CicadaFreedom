import { AdminStats, Post, UserProfile } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      ...init,
    });
  } catch {
    throw new Error("后端服务没有连接上，请先启动 API 服务");
  }

  const text = await response.text();
  let payload = {} as T & { message?: string };
  try {
    payload = text ? (JSON.parse(text) as T & { message?: string }) : payload;
  } catch {
    throw new Error("后端返回异常，请确认 API 服务已启动");
  }
  if (!response.ok) {
    throw new Error(payload.message || "接口请求失败");
  }
  return payload;
}

export function fetchPosts(status = "published") {
  return request<{ posts: Post[] }>(`/posts?status=${status}`);
}

export function createPost(payload: Pick<Post, "author" | "role" | "channel" | "content" | "mood"> & { isMeme: boolean }) {
  return request<{ post: Post }>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function likePost(postId: number) {
  return request<{ post: Post }>(`/posts/${postId}/like`, { method: "POST" });
}

export function legacyLogin(email: string) {
  return request<{ user: UserProfile }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function register(payload: { email: string; password: string; code: string }) {
  return request<{ user: UserProfile }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithPassword(payload: { email: string; password: string }) {
  return request<{ user: UserProfile }>("/auth/login/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithCode(payload: { email: string; code: string }) {
  return request<{ user: UserProfile }>("/auth/login/code", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function enterGuest() {
  return request<{ user: UserProfile }>("/auth/guest", { method: "POST" });
}

export function updateProfile(userId: number, payload: Pick<UserProfile, "nickname" | "avatar" | "avatarType">) {
  return request<{ user: UserProfile }>(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAccount(userId: number) {
  return request<{ ok: boolean }>(`/users/${userId}`, { method: "DELETE" });
}

export function fetchAdminDashboard() {
  return request<{ stats: AdminStats; posts: Post[]; users: UserProfile[] }>("/admin/dashboard");
}

export function updatePostStatus(postId: number, status: Post["status"]) {
  return request<{ post: Post }>(`/admin/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deletePost(postId: number) {
  return request<{ post: Post }>(`/admin/posts/${postId}`, { method: "DELETE" });
}
