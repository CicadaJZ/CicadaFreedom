import {
  AlarmClock,
  BellRing,
  BookOpenText,
  BriefcaseBusiness,
  Coffee,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Image,
  KeyRound,
  Laugh,
  LogIn,
  LogOut,
  MailCheck,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  ThumbsUp,
  Trash2,
  Trophy,
  Upload,
  UserRound,
  Users,
  UserX,
  Zap,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  addAdminTag,
  addUserPoints,
  clearAdminSession,
  commentPost,
  createPost,
  dailyLife,
  deleteAccount,
  deletePost,
  enterGuest,
  fetchAdminDashboard,
  fetchPosts,
  fetchTags,
  likePost,
  loginAdmin,
  loginWithCode,
  loginWithPassword,
  logout,
  register,
  replyToComment,
  hasAdminSession,
  updatePostStatus,
  updateProfile,
  uploadMemeImage,
} from "./api";
import { AdminStats, Channel, DailyLifeRecord, Level, Post, PostComment, Tag, UploadAsset, UserProfile } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "/api";

const levels: Level[] = [
  { min: 0, title: "实习牛马", icon: Coffee, tone: "ash" },
  { min: 80, title: "初级撞钟师", icon: BellRing, tone: "mint" },
  { min: 180, title: "摸鱼熟练工", icon: Moon, tone: "blue" },
  { min: 320, title: "工位幽灵", icon: Sparkles, tone: "pink" },
  { min: 520, title: "带薪发疯大师", icon: Flame, tone: "orange" },
  { min: 760, title: "自由灵魂认证", icon: Trophy, tone: "gold" },
];

const presetAvatars = ["☕", "💼", "🫠", "🧃", "🌙", "🔥", "🦾", "✨"];
const clientIdKey = "cicada-freedom-client-id";
const localUserKey = "cicada-freedom-user";
const localResetKey = "cicada-freedom-reset-v2";

const doneLines = [
  "还有呼吸，续命成功，明日再战。",
  "今日工位副本已通关，请立刻把灵魂捡回来。",
  "恭喜活到下班，下一个任务：假装没看见工作群。",
  "下课/下班铃已响，今天的你值得一口热饭。",
];

const dailyQuotes = [
  "再坚持一下，不是为了胜利，是为了等外卖满减。",
  "你不是没有价值，你只是暂时被 Excel 单元格困住了。",
  "今天也许不会变好，但至少可以准点下班这件事值得争取。",
  "生活给你关上一扇门，可能只是提醒你该摸鱼走窗户了。",
];

const jokes = [
  "我和 KPI 最大的默契：都觉得对方不现实。",
  "早会像闹钟，响了不代表我醒了。",
  "人生建议：少听大道理，多吃热乎饭。",
  "老板说团队是一家人，我默默看了一眼工资条，确认自己是远房亲戚。",
];

const channels: Array<{ id: Channel; label: string; icon: typeof Coffee }> = [
  { id: "all", label: "全部续命", icon: Sparkles },
  { id: "work", label: "今日牛马", icon: BriefcaseBusiness },
  { id: "school", label: "学生党崩溃", icon: BookOpenText },
  { id: "meme", label: "表情包仓库", icon: Image },
  { id: "quote", label: "丧系鸡汤", icon: Zap },
  { id: "joke", label: "今日笑话", icon: Laugh },
];

const meritDrops = Array.from({ length: 22 }, (_, index) => ({
  id: index,
  left: `${(index * 41) % 96}%`,
  delay: `${(index % 9) * -0.45}s`,
  duration: `${3.2 + (index % 5) * 0.42}s`,
  tone: index % 5,
}));

const guestUser: UserProfile = {
  email: "",
  nickname: "游客 404",
  avatar: "☕",
  avatarType: "preset",
  isGuest: true,
  points: 0,
};

function getLevel(points: number) {
  return [...levels].reverse().find((level) => points >= level.min) ?? levels[0];
}

function getCountdown(targetTime: string, now: Date) {
  const [hours, minutes] = targetTime.split(":").map(Number);
  const target = new Date(now);
  target.setHours(hours || 18, minutes || 0, 0, 0);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      isDone: true,
      label: "00:00:00",
      doneText: doneLines[now.getDate() % doneLines.length],
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return { isDone: false, label: `${h}:${m}:${s}`, doneText: "" };
}

function getClientId() {
  const existing = window.localStorage.getItem(clientIdKey);
  if (existing) return existing;
  const next = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(clientIdKey, next);
  return next;
}

function readStoredUser() {
  try {
    if (window.localStorage.getItem(localResetKey) !== "done") {
      window.localStorage.removeItem(localUserKey);
      window.localStorage.setItem(localResetKey, "done");
      return guestUser;
    }
    const raw = window.localStorage.getItem(localUserKey);
    return raw ? ({ ...guestUser, ...JSON.parse(raw) } as UserProfile) : guestUser;
  } catch {
    return guestUser;
  }
}

function storeUser(user: UserProfile) {
  if (user.isGuest) {
    window.localStorage.removeItem(localUserKey);
    return;
  }
  window.localStorage.setItem(localUserKey, JSON.stringify(user));
}

function userLikeKey(user: UserProfile, clientId: string) {
  return user.id && !user.isGuest ? `user:${user.id}` : `client:${clientId}`;
}

function assetUrl(url = "") {
  if (!url || !url.startsWith("/api/")) return url;
  if (apiBase.startsWith("http")) return `${apiBase.replace(/\/api\/?$/, "")}${url}`;
  return url;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取失败")));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function CommentThread({
  comments,
  postId,
  replyDrafts,
  onReplyDraft,
  onReply,
}: {
  comments: PostComment[];
  postId: number;
  replyDrafts: Record<string, string>;
  onReplyDraft: (key: string, value: string) => void;
  onReply: (postId: number, commentId: number) => void;
}) {
  return (
    <div className="comment-list">
      {comments.map((comment) => {
        const key = `${postId}:${comment.id}`;
        return (
          <div className="comment-item" key={comment.id}>
            <div className="comment-main">
              <span className="comment-avatar">{comment.avatar}</span>
              <div>
                <strong>{comment.author}</strong>
                <small>{formatDateTime(comment.createdAt)}</small>
                <p>{comment.content}</p>
              </div>
            </div>
            {comment.replies.length > 0 && <CommentThread comments={comment.replies} postId={postId} replyDrafts={replyDrafts} onReplyDraft={onReplyDraft} onReply={onReply} />}
            <div className="reply-box">
              <input value={replyDrafts[key] || ""} onChange={(event) => onReplyDraft(key, event.target.value)} placeholder="回复这条评论" />
              <button type="button" onClick={() => onReply(postId, comment.id)}>
                <Send size={14} />
                回复
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const isAdminSite = window.location.pathname.startsWith("/admin");
  const [clientId] = useState(getClientId);
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [postSort, setPostSort] = useState<"newest" | "hot" | "balanced">("newest");
  const [tagFilter, setTagFilter] = useState("");
  const [user, setUser] = useState<UserProfile>(readStoredUser);
  const [authMode, setAuthMode] = useState<"register" | "code" | "password">("code");
  const [authFieldNonce] = useState(() => Math.random().toString(36).slice(2));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [draftNickname, setDraftNickname] = useState("");
  const [draftAvatar, setDraftAvatar] = useState(presetAvatars[0]);
  const [draftAvatarType, setDraftAvatarType] = useState<"preset" | "upload">("preset");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminPosts, setAdminPosts] = useState<Post[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminTags, setAdminTags] = useState<Tag[]>([]);
  const [adminUploads, setAdminUploads] = useState<UploadAsset[]>([]);
  const [adminDailyRecords, setAdminDailyRecords] = useState<DailyLifeRecord[]>([]);
  const [adminView, setAdminView] = useState<"posts" | "users" | "tags">("posts");
  const [adminQuery, setAdminQuery] = useState("");
  const [adminPostId, setAdminPostId] = useState("");
  const [adminTagFilter, setAdminTagFilter] = useState("");
  const [newTag, setNewTag] = useState("");
  const [pointsDrafts, setPointsDrafts] = useState<Record<string, string>>({});
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => hasAdminSession());
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [targetTime, setTargetTime] = useState("18:00");
  const [now, setNow] = useState(() => new Date());
  const [composer, setComposer] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["合法摸鱼"]);
  const [asMeme, setAsMeme] = useState(false);
  const [memeImageUrl, setMemeImageUrl] = useState("");
  const [isUploadingMeme, setIsUploadingMeme] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [dailyMessage, setDailyMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    storeUser(user);
  }, [user]);

  useEffect(() => {
    if (isAdminSite) {
      if (isAdminAuthed) void loadAdmin();
      setIsLoading(false);
    } else {
      void loadPosts();
      void loadTags();
    }
  }, [isAdminAuthed, isAdminSite]);

  useEffect(() => {
    if (!isAdminSite) void loadPosts();
  }, [postSort, tagFilter]);

  async function loadPosts() {
    try {
      setIsLoading(true);
      const result = await fetchPosts({ status: "published", sort: postSort, tag: tagFilter });
      setPosts(result.posts);
      setTags(result.tags);
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "帖子加载失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTags() {
    try {
      const result = await fetchTags();
      setTags(result.tags);
      if (selectedTags.length === 0 && result.tags[0]) setSelectedTags([result.tags[0].label]);
    } catch {
      // Tags also arrive with posts; keep the page usable if this request misses.
    }
  }

  async function loadAdmin() {
    try {
      setIsLoading(true);
      const result = await fetchAdminDashboard({ sort: "newest", tag: adminTagFilter, q: adminQuery, postId: adminPostId });
      setAdminStats(result.stats);
      setAdminPosts(result.posts);
      setAdminUsers(result.users);
      setAdminTags(result.tags);
      setAdminUploads(result.uploads);
      setAdminDailyRecords(result.dailyLifeRecords);
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "后台数据加载失败");
      if (error instanceof Error && error.message.includes("登录")) {
        clearAdminSession();
        setIsAdminAuthed(false);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const level = getLevel(user.points);
  const nextLevel = levels.find((item) => item.min > user.points);
  const progress = nextLevel ? Math.min(100, Math.round(((user.points - level.min) / (nextLevel.min - level.min)) * 100)) : 100;
  const filteredPosts = useMemo(() => (activeChannel === "all" ? posts : posts.filter((post) => post.channel === activeChannel)), [activeChannel, posts]);
  const todayQuote = dailyQuotes[new Date().getDate() % dailyQuotes.length];
  const todayJoke = jokes[new Date().getDay() % jokes.length];
  const countdown = getCountdown(targetTime, now);
  const viewer = user.nickname;
  const codeInputId = `auth-code-${authMode}`;
  const codeInputName = `verification-${authMode}-${authFieldNonce}`;
  const LevelIcon = level.icon;

  function handleAuthModeChange(nextMode: "register" | "code" | "password") {
    setAuthMode(nextMode);
    setAuthMessage("");
    setCode("");
    if (nextMode !== "register") setPassword("");
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payloadEmail = email.trim() || user.email;
    if (!payloadEmail.includes("@")) return setAuthMessage("先填一个有效邮箱。");
    if ((authMode === "register" || authMode === "password") && password.length < 6) return setAuthMessage("密码至少 6 位。");
    if ((authMode === "register" || authMode === "code") && !code.trim()) return setAuthMessage("请输入验证码。");

    try {
      setIsAuthSubmitting(true);
      setAuthMessage("正在处理账号请求...");
      const result =
        authMode === "register"
          ? await register({ email: payloadEmail, password, code })
          : authMode === "password"
            ? await loginWithPassword({ email: payloadEmail, password })
            : await loginWithCode({ email: payloadEmail, code });
      const profile = result.user;
      setUser(profile);
      setDraftNickname(profile.nickname);
      setDraftAvatar(profile.avatar);
      setDraftAvatarType(profile.avatarType);
      setIsEditingProfile(true);
      setEmail("");
      setPassword("");
      setCode("");
      setApiError("");
      setAuthMessage("已登录，今天的灵魂暂时归档成功。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "账号操作失败";
      setAuthMessage(message);
      setApiError(message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleGuest() {
    try {
      const { user: guest } = await enterGuest();
      setUser(guest);
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "游客模式启动失败");
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Local logout should still complete if the API is unavailable.
    }
    setUser(guestUser);
    setIsEditingProfile(false);
    setDraftNickname("");
    setDraftAvatar(presetAvatars[0]);
    setDraftAvatarType("preset");
    setApiError("");
    setAuthMessage("已退出登录。");
  }

  async function handleDeleteAccount() {
    if (!user.id || user.isGuest) return;
    if (!window.confirm("确定要注销账号吗？账号会被删除，历史发帖会显示为已注销用户。")) return;
    try {
      await deleteAccount(user.id);
      await handleLogout();
      await loadPosts();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "注销账号失败");
    }
  }

  function startProfileEdit() {
    setDraftNickname(user.nickname);
    setDraftAvatar(user.avatar);
    setDraftAvatarType(user.avatarType);
    setIsEditingProfile(true);
  }

  async function saveProfile() {
    const payload = { nickname: draftNickname.trim() || user.nickname, avatar: draftAvatar, avatarType: draftAvatarType };
    try {
      if (user.id && !user.isGuest) {
        const result = await updateProfile(user.id, payload);
        setUser(result.user);
      } else {
        setUser((current) => ({ ...current, ...payload }));
      }
      setIsEditingProfile(false);
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "资料保存失败");
    }
  }

  function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraftAvatar(reader.result);
        setDraftAvatarType("upload");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleMemeUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingMeme(true);
      const dataUrl = await readImageAsDataUrl(file);
      const result = await uploadMemeImage(dataUrl);
      setMemeImageUrl(result.upload.url);
      setAsMeme(true);
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "表情包上传失败");
    } finally {
      setIsUploadingMeme(false);
      event.target.value = "";
    }
  }

  function toggleTag(label: string) {
    setSelectedTags((current) => {
      if (current.includes(label)) return current.filter((tag) => tag !== label);
      return [...current, label];
    });
  }

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = composer.trim();
    if (!trimmed && !memeImageUrl) return;
    const tagsForPost = selectedTags.length > 0 ? selectedTags : [tags[0]?.label || "合法摸鱼"];

    try {
      const result = await createPost({
        author: viewer,
        role: level.title,
        channel: asMeme ? "meme" : tagsForPost.includes("丧系鸡汤") ? "quote" : activeChannel !== "all" ? activeChannel : "work",
        content: trimmed || "新鲜表情包已入库。",
        tags: tagsForPost,
        isMeme: asMeme,
        imageUrl: memeImageUrl,
      });
      setPosts((current) => [result.post, ...current]);
      setComposer("");
      setAsMeme(false);
      setMemeImageUrl("");
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "发布失败");
    }
  }

  async function handleLike(post: Post) {
    try {
      const result = await likePost(post.id, user.id && !user.isGuest ? { userId: String(user.id) } : { clientId });
      setPosts((current) => current.map((item) => (item.id === post.id ? result.post : item)));
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "点赞失败");
    }
  }

  async function handleComment(postId: number) {
    const content = (commentDrafts[String(postId)] || "").trim();
    if (!content) return;
    try {
      const result = await commentPost(postId, { userId: user.id ? String(user.id) : clientId, author: viewer, avatar: user.avatar, content });
      setPosts((current) => current.map((post) => (post.id === postId ? result.post : post)));
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "评论失败");
    }
  }

  async function handleReply(postId: number, commentId: number) {
    const key = `${postId}:${commentId}`;
    const content = (replyDrafts[key] || "").trim();
    if (!content) return;
    try {
      const result = await replyToComment(postId, commentId, { userId: user.id ? String(user.id) : clientId, author: viewer, avatar: user.avatar, content });
      setPosts((current) => current.map((post) => (post.id === postId ? result.post : post)));
      setReplyDrafts((current) => ({ ...current, [key]: "" }));
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "回复失败");
    }
  }

  async function handleDailyLife() {
    const localKey = `cicada-freedom-daily-life-${new Date().toISOString().slice(0, 10)}`;
    if (user.isGuest && window.localStorage.getItem(localKey)) {
      setDailyMessage("今天已经续过命了，明天再来。");
      return;
    }
    try {
      const result = await dailyLife(user.id || 0, { clientId, nickname: viewer });
      if (result.user) setUser(result.user);
      else setUser((current) => ({ ...current, points: current.points + 1 }));
      if (user.isGuest) window.localStorage.setItem(localKey, "done");
      setDailyMessage("续命成功，功德 +1。");
      setApiError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "续命失败";
      setDailyMessage(message);
      setApiError(message);
    }
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsAuthSubmitting(true);
      await loginAdmin({ email: adminEmail, password: adminPassword });
      setIsAdminAuthed(true);
      setAdminPassword("");
      setApiError("");
      await loadAdmin();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "管理员登录失败");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function handleAdminLogout() {
    clearAdminSession();
    setIsAdminAuthed(false);
    setAdminStats(null);
    setAdminPosts([]);
    setAdminUsers([]);
    setAdminTags([]);
    setAdminUploads([]);
    setAdminDailyRecords([]);
    setApiError("");
  }

  async function handlePostStatus(postId: number, status: Post["status"]) {
    try {
      await updatePostStatus(postId, status);
      await Promise.all([loadPosts(), loadAdmin()]);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function handleDeletePost(postId: number) {
    try {
      await deletePost(postId);
      await Promise.all([loadPosts(), loadAdmin()]);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function handleAddTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTag.trim()) return;
    try {
      await addAdminTag(newTag);
      setNewTag("");
      await Promise.all([loadAdmin(), loadTags()]);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "添加标签失败");
    }
  }

  async function handleAddPoints(adminUser: UserProfile) {
    if (!adminUser.id) return;
    const amount = Number(pointsDrafts[String(adminUser.id)] || 0);
    if (!Number.isFinite(amount) || amount === 0) return;
    try {
      const result = await addUserPoints(adminUser.id, amount);
      setAdminUsers((current) => current.map((item) => (item.id === result.user.id ? result.user : item)));
      if (user.id === result.user.id) setUser(result.user);
      setPointsDrafts((current) => ({ ...current, [String(adminUser.id)]: "" }));
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "加积分失败");
    }
  }

  const userView = (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">
            <AlarmClock size={16} />
            下班前别死
          </span>
          <h1>把今天糊弄过去，也算一种自由。</h1>
          <p>给打工人、学生党和所有疲惫人类的摸鱼广场。可以游客发疯，可以邮箱登录攒等级，也可以把生活里那点离谱变成大家的续命笑料。</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => document.getElementById("composer")?.focus()}>
              <Plus size={18} />
              发疯一下
            </button>
            <button className="ghost-action" onClick={handleGuest}>
              <UserRound size={18} />
              游客摸鱼
            </button>
          </div>
        </div>
        <div className="hero-visual" aria-label="工位摸鱼视觉图">
          <div className="screen-card">
            <div className="merit-rain" aria-hidden="true">
              {meritDrops.map((drop) => (
                <span className={`merit-drop tone-${drop.tone}`} key={drop.id} style={{ left: drop.left, animationDelay: drop.delay, animationDuration: drop.duration }}>
                  功德+1
                </span>
              ))}
            </div>
            <div className="screen-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="screen-line wide" />
            <div className="screen-line" />
            <div className="screen-sticker">{countdown.isDone ? countdown.doneText : `距离解放还有 ${countdown.label}`}</div>
            <div className="screen-badge">{countdown.isDone ? "灵魂已下线" : "带薪呼吸中"}</div>
          </div>
        </div>
      </section>

      {apiError && <div className="api-alert">{apiError}，确认后端服务已启动。</div>}

      <section className="workspace">
        <aside className="side-panel profile-panel">
          <div className="profile-top">
            <div className={`avatar ${user.avatarType === "upload" ? "image-avatar" : ""}`}>{user.avatarType === "upload" ? <img src={user.avatar} alt="" /> : <span>{user.avatar}</span>}</div>
            <div>
              <h2>{viewer}</h2>
              <span className={`level-pill ${level.tone}`}>
                <LevelIcon size={14} />
                {level.title}
              </span>
              <small className="profile-mode">{user.isGuest ? "游客模式" : user.email}</small>
            </div>
          </div>

          <div className="countdown-card">
            <div className="card-title">
              <AlarmClock size={18} />
              下班/下课时间
            </div>
            <label htmlFor="targetTime">今天几点解放</label>
            <input id="targetTime" type="time" value={targetTime} onChange={(event) => setTargetTime(event.target.value)} />
            <strong>{countdown.isDone ? "今日已通关" : countdown.label}</strong>
            <p>{countdown.isDone ? countdown.doneText : "每秒都在变短，虽然今天本人也在变短。"}</p>
          </div>

          <div className="progress-block">
            <div className="progress-label">
              <span>活跃值 {user.points}</span>
              <span>{nextLevel ? `下一阶 ${nextLevel.min}` : "已满级"}</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <section className="login-card">
            <div className="card-title">
              <KeyRound size={18} />
              账号中心
            </div>
            {user.isGuest ? (
              <form onSubmit={handleAuth} autoComplete="off">
                <div className="auth-tabs" aria-label="账号操作">
                  <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => handleAuthModeChange("register")}>
                    注册
                  </button>
                  <button className={authMode === "code" ? "active" : ""} type="button" onClick={() => handleAuthModeChange("code")}>
                    验证码登录
                  </button>
                  <button className={authMode === "password" ? "active" : ""} type="button" onClick={() => handleAuthModeChange("password")}>
                    密码登录
                  </button>
                </div>
                <label htmlFor="email">邮箱</label>
                <input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@freedom.life" autoComplete="email" />
                {(authMode === "register" || authMode === "password") && (
                  <>
                    <label htmlFor="password">密码</label>
                    <input id="password" name={authMode === "register" ? "new-password" : "current-password"} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" autoComplete={authMode === "register" ? "new-password" : "current-password"} />
                  </>
                )}
                {(authMode === "register" || authMode === "code") && (
                  <>
                    <label htmlFor={codeInputId}>验证码</label>
                    <input id={codeInputId} name={codeInputName} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入验证码" autoComplete="new-password" />
                  </>
                )}
                <button className="auth-submit" type="submit" disabled={isAuthSubmitting}>
                  {authMode === "register" ? <MailCheck size={17} /> : <LogIn size={17} />}
                  {isAuthSubmitting ? "处理中" : authMode === "register" ? "注册并登录" : "登录"}
                </button>
                {authMessage && <div className="auth-message">{authMessage}</div>}
              </form>
            ) : (
              <div className="auth-session">
                <small>当前账号</small>
                <strong>{user.email}</strong>
                {authMessage && <div className="auth-message">{authMessage}</div>}
                <div className="account-actions">
                  <button type="button" onClick={() => void handleLogout()}>
                    <LogOut size={16} />
                    退出登录
                  </button>
                  <button className="danger-action" type="button" onClick={() => void handleDeleteAccount()}>
                    <UserX size={16} />
                    注销账号
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="profile-editor">
            <button className="editor-toggle" type="button" onClick={startProfileEdit}>
              <Pencil size={16} />
              编辑资料
            </button>
            {isEditingProfile && (
              <div className="editor-body">
                <label htmlFor="nickname">昵称</label>
                <input id="nickname" value={draftNickname} onChange={(event) => setDraftNickname(event.target.value)} placeholder="给今天的自己起个名" />
                <span className="field-label">头像</span>
                <div className="avatar-picker">
                  {presetAvatars.map((avatar) => (
                    <button className={draftAvatar === avatar && draftAvatarType === "preset" ? "selected" : ""} key={avatar} type="button" onClick={() => { setDraftAvatar(avatar); setDraftAvatarType("preset"); }}>
                      {avatar}
                    </button>
                  ))}
                </div>
                <label className="upload-control">
                  <Upload size={16} />
                  本地上传头像
                  <input accept="image/*" type="file" onChange={handleAvatarUpload} />
                </label>
                {draftAvatarType === "upload" && (
                  <div className="upload-preview">
                    <img src={draftAvatar} alt="" />
                    <span>头像已载入</span>
                  </div>
                )}
                <button className="save-profile" type="button" onClick={saveProfile}>
                  <Save size={16} />
                  保存资料
                </button>
              </div>
            )}
          </section>

          <div className="level-list">
            {levels.map((item) => {
              const Icon = item.icon;
              return (
                <div className="level-row" key={item.title}>
                  <span className={`mini-badge ${item.tone}`}>
                    <Icon size={14} />
                  </span>
                  <span>{item.title}</span>
                  <small>{item.min}+</small>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="feed-panel">
          <nav className="channel-tabs" aria-label="内容频道">
            {channels.map((channel) => {
              const Icon = channel.icon;
              return (
                <button className={activeChannel === channel.id ? "active" : ""} key={channel.id} onClick={() => setActiveChannel(channel.id)}>
                  <Icon size={16} />
                  {channel.label}
                </button>
              );
            })}
          </nav>

          <div className="feed-tools">
            <div className="segmented-control">
              {[
                ["newest", "最新"],
                ["hot", "热度"],
                ["balanced", "综合"],
              ].map(([value, label]) => (
                <button className={postSort === value ? "active" : ""} key={value} type="button" onClick={() => setPostSort(value as "newest" | "hot" | "balanced")}>
                  {label}
                </button>
              ))}
            </div>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">全部标签</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.label}>
                  {tag.label}
                </option>
              ))}
            </select>
          </div>

          <form className="composer" onSubmit={handlePost}>
            <div className="composer-head">
              <span>
                <Send size={16} />
                今日精神状态
              </span>
              <label className="upload-control meme-upload-control">
                <Upload size={16} />
                {isUploadingMeme ? "上传中" : "上传表情包"}
                <input accept="image/*" type="file" onChange={handleMemeUpload} />
              </label>
            </div>
            <textarea id="composer" value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="把今天离谱的事放下，大家一起笑一下。" />
            <div className="tag-picker" aria-label="选择帖子标签">
              {tags.map((tag) => (
                <button className={selectedTags.includes(tag.label) ? "selected" : ""} key={tag.id} type="button" onClick={() => toggleTag(tag.label)}>
                  <Tags size={14} />
                  {tag.label}
                </button>
              ))}
            </div>
            {memeImageUrl && (
              <div className="meme-upload-preview">
                <img src={assetUrl(memeImageUrl)} alt="" />
                <button type="button" onClick={() => setMemeImageUrl("")}>
                  移除图片
                </button>
              </div>
            )}
            <div className="composer-actions">
              <label className="toggle">
                <input type="checkbox" checked={asMeme} onChange={(event) => setAsMeme(event.target.checked)} />
                <span>作为表情包发布</span>
              </label>
              <button type="submit">
                <Plus size={17} />
                发布
              </button>
            </div>
          </form>

          <div className="post-list">
            {isLoading && <div className="empty-state">正在从后端捞帖子，稍等一下。</div>}
            {!isLoading && filteredPosts.length === 0 && <div className="empty-state">这个频道暂时安静得像假期前的需求池。</div>}
            {filteredPosts.map((post) => {
              const liked = post.likedBy.includes(userLikeKey(user, clientId));
              return (
                <article className={`post-card ${post.isMeme ? "meme-post" : ""} ${liked ? "liked-post" : ""}`} key={post.id}>
                  <header>
                    <div>
                      <strong>{post.author}</strong>
                      <span>{post.role}</span>
                    </div>
                    <small>#{post.id} · {post.time}</small>
                  </header>
                  {post.isMeme ? (
                    <div className="meme-frame">
                      <span>下班前别死</span>
                      {post.imageUrl && <img src={assetUrl(post.imageUrl)} alt="" />}
                      <p>{post.content}</p>
                    </div>
                  ) : (
                    <p>{post.content}</p>
                  )}
                  <footer>
                    {post.tags.map((tag) => (
                      <span className="mood-tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                    <button className={liked ? "liked" : ""} onClick={() => void handleLike(post)} type="button">
                      <ThumbsUp size={16} />
                      {post.likes}
                    </button>
                    <span className="comment-count">
                      <MessageCircle size={16} />
                      {post.commentCount}
                    </span>
                  </footer>
                  <div className="comment-panel">
                    {post.comments.length > 0 && <CommentThread comments={post.comments} postId={post.id} replyDrafts={replyDrafts} onReplyDraft={(key, value) => setReplyDrafts((current) => ({ ...current, [key]: value }))} onReply={(postId, commentId) => void handleReply(postId, commentId)} />}
                    <div className="comment-box">
                      <input value={commentDrafts[String(post.id)] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="写一条评论" />
                      <button type="button" onClick={() => void handleComment(post.id)}>
                        <Send size={14} />
                        评论
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="side-panel sparks-panel">
          <div className="daily-card quote-card">
            <div className="card-title">
              <Flame size={18} />
              每日很丧很鸡血
            </div>
            <p>{todayQuote}</p>
            <button onClick={() => void handleDailyLife()}>
              <Heart size={16} />
              续命 +1
            </button>
            {dailyMessage && <div className="daily-message">{dailyMessage}</div>}
          </div>
          <div className="daily-card">
            <div className="card-title">
              <Laugh size={18} />
              今日笑话
            </div>
            <p>{todayJoke}</p>
          </div>
          <div className="daily-card">
            <div className="card-title">
              <ShieldCheck size={18} />
              社区守则
            </div>
            <ul>
              <li>可以很丧，不攻击真实个人。</li>
              <li>可以发疯，不泄露隐私信息。</li>
              <li>可以摸鱼，记得给别人留点光。</li>
            </ul>
          </div>
        </aside>
      </section>
    </>
  );

  if (!isAdminSite) {
    return <main className="app-shell">{userView}</main>;
  }

  if (!isAdminAuthed) {
    return (
      <main className="app-shell">
        <section className="admin-panel admin-login-panel">
          <div className="admin-topbar">
            <strong>下班前别死 Admin</strong>
            <a href="/">返回用户端</a>
          </div>
          <form className="auth-card admin-login-card" onSubmit={handleAdminLogin}>
            <span className="eyebrow">
              <ShieldCheck size={16} />
              管理员入口
            </span>
            <h2>登录后管理帖子和用户。</h2>
            <label htmlFor="admin-email">管理员邮箱</label>
            <input id="admin-email" type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="admin@freedom.life" />
            <label htmlFor="admin-password">管理员密码</label>
            <input id="admin-password" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="至少 6 位" />
            <button className="auth-submit" type="submit" disabled={isAuthSubmitting}>
              <KeyRound size={17} />
              {isAuthSubmitting ? "登录中" : "进入后台"}
            </button>
            {apiError && <div className="auth-message">{apiError}</div>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="admin-panel">
        <div className="admin-topbar">
          <strong>下班前别死 Admin</strong>
          <div className="admin-topbar-actions">
            <button type="button" onClick={handleAdminLogout}>
              <LogOut size={16} />
              退出后台
            </button>
            <a href="/">返回用户端</a>
          </div>
        </div>
        {apiError && <div className="api-alert">{apiError}，确认后端服务已启动。</div>}
        <div className="admin-head">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={16} />
              内容后台
            </span>
            <h2>把广场管住，但别把灵魂管没。</h2>
          </div>
          <button className="primary-action" onClick={() => void loadAdmin()}>
            <RefreshCw size={16} />
            刷新后台
          </button>
        </div>

        <div className="metric-grid">
          <button className={`metric-card metric-button ${adminView === "users" ? "active" : ""}`} onClick={() => setAdminView("users")} type="button">
            <Users size={18} />
            <span>注册用户</span>
            <strong>{adminStats?.users ?? 0}</strong>
          </button>
          <button className={`metric-card metric-button ${adminView === "posts" ? "active" : ""}`} onClick={() => setAdminView("posts")} type="button">
            <MessageCircle size={18} />
            <span>全部帖子</span>
            <strong>{adminStats?.posts ?? 0}</strong>
          </button>
          <button className={`metric-card metric-button ${adminView === "tags" ? "active" : ""}`} onClick={() => setAdminView("tags")} type="button">
            <Tags size={18} />
            <span>标签</span>
            <strong>{adminStats?.tags ?? 0}</strong>
          </button>
          <div className="metric-card">
            <ThumbsUp size={18} />
            <span>点赞/评论</span>
            <strong>{adminStats?.totalLikes ?? 0}/{adminStats?.totalComments ?? 0}</strong>
          </div>
        </div>

        <div className="admin-filters">
          <div className="search-field">
            <Search size={16} />
            <input value={adminQuery} onChange={(event) => setAdminQuery(event.target.value)} placeholder="按内容搜索" />
          </div>
          <input value={adminPostId} onChange={(event) => setAdminPostId(event.target.value.replace(/\D/g, ""))} placeholder="帖子 ID" />
          <select value={adminTagFilter} onChange={(event) => setAdminTagFilter(event.target.value)}>
            <option value="">全部标签</option>
            {adminTags.map((tag) => (
              <option key={tag.id} value={tag.label}>
                {tag.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void loadAdmin()}>
            <Search size={16} />
            搜索
          </button>
        </div>

        <div className="admin-layout">
          <section className="admin-table">
            {adminView === "posts" && (
              <>
                <header>
                  <div>
                    <h3>帖子审核</h3>
                    <p>显示帖子 ID、标签、点赞、评论，支持按内容、ID 和标签筛选。</p>
                  </div>
                </header>
                {adminPosts.map((post) => (
                  <article className="admin-row" key={post.id}>
                    <div>
                      <strong>#{post.id} · {post.author}</strong>
                      <span>{post.channel} · {post.tags.join(" / ")} · {post.time} · 点赞 {post.likes} · 评论 {post.commentCount}</span>
                      <p>{post.content}</p>
                    </div>
                    <span className={`status-pill ${post.status}`}>{post.status === "published" ? "展示中" : "已隐藏"}</span>
                    <div className="admin-actions">
                      <button onClick={() => void handlePostStatus(post.id, post.status === "published" ? "hidden" : "published")}>
                        {post.status === "published" ? <EyeOff size={16} /> : <Eye size={16} />}
                        {post.status === "published" ? "隐藏" : "恢复"}
                      </button>
                      <button className="danger-action" onClick={() => void handleDeletePost(post.id)}>
                        <Trash2 size={16} />
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </>
            )}

            {adminView === "users" && (
              <>
                <header>
                  <div>
                    <h3>注册用户列表</h3>
                    <p>后台可以给某个用户加积分，头像保持居中显示。</p>
                  </div>
                </header>
                {adminUsers.length === 0 && <div className="empty-state">还没有注册用户。</div>}
                {adminUsers.map((adminUser) => (
                  <article className="admin-row user-row" key={`${adminUser.email}-${adminUser.id ?? "local"}`}>
                    <div className="user-identity">
                      <span className={`user-avatar ${adminUser.avatarType === "upload" ? "image-avatar" : ""}`}>{adminUser.avatarType === "upload" ? <img src={adminUser.avatar} alt="" /> : adminUser.avatar}</span>
                      <div>
                        <strong>{adminUser.nickname}</strong>
                        <span>{adminUser.email || "游客账号"}</span>
                      </div>
                    </div>
                    <span className="status-pill published">{adminUser.isGuest ? "游客" : "已注册"}</span>
                    <div className="user-meta">
                      <span>积分</span>
                      <strong>{adminUser.points}</strong>
                      <div className="points-editor">
                        <input value={pointsDrafts[String(adminUser.id)] || ""} onChange={(event) => setPointsDrafts((current) => ({ ...current, [String(adminUser.id)]: event.target.value }))} placeholder="+10" />
                        <button type="button" onClick={() => void handleAddPoints(adminUser)}>
                          加分
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </>
            )}

            {adminView === "tags" && (
              <>
                <header>
                  <div>
                    <h3>标签管理</h3>
                    <p>这里添加的标签会出现在发帖输入框下方，并支持前后台筛选。</p>
                  </div>
                </header>
                <form className="admin-inline-form" onSubmit={handleAddTag}>
                  <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="新增标签" />
                  <button type="submit">
                    <Plus size={16} />
                    添加
                  </button>
                </form>
                <div className="admin-tag-list">
                  {adminTags.map((tag) => (
                    <span className="mood-tag" key={tag.id}>
                      {tag.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          <aside className="admin-side">
            <div className="daily-card">
              <div className="card-title">
                <Image size={18} />
                数据概览
              </div>
              <ul>
                <li>展示中：{adminStats?.published ?? 0}</li>
                <li>隐藏内容：{adminStats?.hidden ?? 0}</li>
                <li>表情包文案：{adminStats?.memePosts ?? 0}</li>
                <li>上传图片：{adminStats?.uploads ?? 0}</li>
                <li>续命记录：{adminStats?.dailyLifeRecords ?? 0}</li>
              </ul>
            </div>

            <div className="daily-card">
              <div className="card-title">
                <Image size={18} />
                上传图片
              </div>
              <div className="upload-list">
                {adminUploads.slice(0, 6).map((upload) => (
                  <a href={assetUrl(upload.url)} key={upload.id} target="_blank" rel="noreferrer">
                    <img src={assetUrl(upload.url)} alt="" />
                    <span>{Math.round(upload.size / 1024)}KB</span>
                  </a>
                ))}
                {adminUploads.length === 0 && <small>暂无上传。</small>}
              </div>
            </div>

            <div className="daily-card">
              <div className="card-title">
                <Heart size={18} />
                续命记录
              </div>
              <ul className="compact-list">
                {adminDailyRecords.slice(0, 6).map((record) => (
                  <li key={record.id}>{record.nickname} · {record.date}</li>
                ))}
                {adminDailyRecords.length === 0 && <li>暂无记录</li>}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default App;
