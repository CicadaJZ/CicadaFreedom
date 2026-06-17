import { AdminStats, DailyLifeRecord, Post, PostComment, Tag, UploadAsset, UserProfile } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
const localAuthKey = "cicada-freedom-local-auth-users";
const adminTokenKey = "cicada-freedom-admin-token";

type LocalUserRecord = UserProfile & { password: string };
export type AdminSession = { token: string; email: string };
export type PostQuery = {
  status?: string;
  sort?: "newest" | "hot" | "balanced";
  tag?: string;
  q?: string;
  postId?: string;
};
export type CommentPayload = {
  userId?: string;
  author: string;
  avatar: string;
  content: string;
};

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
  } catch (error) {
    const fallback = handleLocalAuthFallback<T>(path, init);
    if (fallback) return fallback;
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

function readAdminToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(adminTokenKey) || "";
}

function adminHeaders(): Record<string, string> {
  const token = readAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function hasAdminSession() {
  return Boolean(readAdminToken());
}

export function clearAdminSession() {
  window.localStorage.removeItem(adminTokenKey);
}

function handleLocalAuthFallback<T>(path: string, init?: RequestInit): T | null {
  if (typeof window === "undefined") return null;
  const method = init?.method ?? "GET";
  if (method !== "POST") return null;

  if (path === "/auth/logout") {
    return { ok: true } as T;
  }

  if (path === "/auth/guest") {
    return {
      user: {
        id: Date.now(),
        email: "",
        nickname: `游客 ${Math.floor(Math.random() * 900 + 100)}`,
        avatar: "☕",
        avatarType: "preset",
        isGuest: true,
        points: 0,
      },
    } as T;
  }

  const payload = readRequestBody(init);
  if (!payload) return null;
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const code = String(payload.code || "").trim();

  if (path === "/auth/register") {
    if (!isValidEmail(email)) throw new Error("请输入有效邮箱");
    if (code !== "7777") throw new Error("验证码不正确");
    if (password.length < 6) throw new Error("密码至少 6 位");

    const users = readLocalUsers();
    if (users.some((user) => user.email === email)) throw new Error("这个邮箱已经注册过了");

    const user = createLocalUser(email, password);
    writeLocalUsers([...users, user]);
    return { user: compactLocalUser(user) } as T;
  }

  if (path === "/auth/login/password") {
    const users = readLocalUsers();
    const user = users.find((item) => item.email === email);
    if (!user) throw new Error("账号不存在，请先注册");
    if (user.password !== password) throw new Error("密码不正确");
    writeLocalUsers(users);
    return { user: compactLocalUser(user) } as T;
  }

  if (path === "/auth/login/code") {
    if (!isValidEmail(email)) throw new Error("请输入有效邮箱");
    if (code !== "7777") throw new Error("验证码不正确");
    const users = readLocalUsers();
    const user = users.find((item) => item.email === email);
    if (!user) throw new Error("账号不存在，请先注册");
    writeLocalUsers(users);
    return { user: compactLocalUser(user) } as T;
  }

  return null;
}

function readRequestBody(init?: RequestInit) {
  if (typeof init?.body !== "string") return null;
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readLocalUsers(): LocalUserRecord[] {
  try {
    const raw = window.localStorage.getItem(localAuthKey);
    return raw ? (JSON.parse(raw) as LocalUserRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: LocalUserRecord[]) {
  window.localStorage.setItem(localAuthKey, JSON.stringify(users));
}

function createLocalUser(email: string, password: string): LocalUserRecord {
  const avatars = ["☕", "💼", "🫠", "🧃", "🌙", "🔥", "🦾", "✨"];
  const names = ["带薪呼吸员", "准点撤退侠", "工位漂流瓶", "下课回血包", "人间续航机", "摸鱼观察员"];
  return {
    id: Date.now(),
    email,
    password,
    nickname: names[Math.floor(Math.random() * names.length)],
    avatar: avatars[Math.floor(Math.random() * avatars.length)],
    avatarType: "preset",
    isGuest: false,
    points: 0,
  };
}

function compactLocalUser(user: LocalUserRecord): UserProfile {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatar: user.avatar,
    avatarType: user.avatarType,
    isGuest: user.isGuest,
    points: user.points,
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function queryString(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function fetchPosts(query: PostQuery = { status: "published" }) {
  return request<{ posts: Post[]; tags: Tag[] }>(`/posts${queryString({ status: query.status ?? "published", sort: query.sort, tag: query.tag, q: query.q, postId: query.postId })}`);
}

export function fetchTags() {
  return request<{ tags: Tag[] }>("/tags");
}

export function createPost(
  payload: Pick<Post, "author" | "role" | "channel" | "content"> & { tags: string[]; isMeme: boolean; imageUrl?: string },
) {
  return request<{ post: Post }>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function likePost(postId: number, payload: { userId?: string; clientId?: string }) {
  return request<{ post: Post }>(`/posts/${postId}/like`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function commentPost(postId: number, payload: CommentPayload) {
  return request<{ post: Post; comment: PostComment }>(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function replyToComment(postId: number, commentId: number, payload: CommentPayload) {
  return request<{ post: Post; reply: PostComment }>(`/posts/${postId}/comments/${commentId}/replies`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadMemeImage(dataUrl: string) {
  return request<{ upload: UploadAsset }>("/uploads/memes", {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
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

export function dailyLife(userId: number, payload: { clientId?: string; nickname: string }) {
  return request<{ ok: boolean; record: DailyLifeRecord; user: UserProfile | null }>(`/users/${userId}/daily-life`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAdmin(payload: { email: string; password: string }) {
  const session = await request<AdminSession>("/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  window.localStorage.setItem(adminTokenKey, session.token);
  return session;
}

export function fetchAdminDashboard(query: PostQuery = {}) {
  return request<{
    stats: AdminStats;
    posts: Post[];
    users: UserProfile[];
    tags: Tag[];
    uploads: UploadAsset[];
    dailyLifeRecords: DailyLifeRecord[];
  }>(`/admin/dashboard${queryString({ status: "all", sort: query.sort, tag: query.tag, q: query.q, postId: query.postId })}`, {
    headers: adminHeaders(),
  });
}

export function updatePostStatus(postId: number, status: Post["status"]) {
  return request<{ post: Post }>(`/admin/posts/${postId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ status }),
  });
}

export function deletePost(postId: number) {
  return request<{ post: Post }>(`/admin/posts/${postId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}

export function addAdminTag(label: string) {
  return request<{ tag: Tag }>("/admin/tags", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ label }),
  });
}

export function addUserPoints(userId: number, amount: number) {
  return request<{ user: UserProfile }>(`/admin/users/${userId}/points`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ amount }),
  });
}
