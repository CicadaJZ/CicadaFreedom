import {
  AlarmClock,
  BadgeCheck,
  BellRing,
  BookOpenText,
  BriefcaseBusiness,
  Coffee,
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
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  Trophy,
  Upload,
  Users,
  UserX,
  Eye,
  EyeOff,
  UserRound,
  Zap,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  clearAdminSession,
  createPost,
  deleteAccount,
  deletePost,
  enterGuest,
  fetchAdminDashboard,
  fetchPosts,
  likePost,
  loginAdmin,
  loginWithCode,
  loginWithPassword,
  logout,
  register,
  hasAdminSession,
  updatePostStatus,
  updateProfile,
} from "./api";
import { AdminStats, Channel, Level, Post, UserProfile } from "./types";

const levels: Level[] = [
  { min: 0, title: "实习牛马", icon: Coffee, tone: "ash" },
  { min: 80, title: "初级撞钟师", icon: BellRing, tone: "mint" },
  { min: 180, title: "摸鱼熟练工", icon: Moon, tone: "blue" },
  { min: 320, title: "工位幽灵", icon: Sparkles, tone: "pink" },
  { min: 520, title: "带薪发疯大师", icon: Flame, tone: "orange" },
  { min: 760, title: "自由灵魂认证", icon: Trophy, tone: "gold" },
];

const presetAvatars = ["☕", "💼", "🫠", "🧃", "🌙", "🔥", "🦾", "✨"];

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
  return {
    isDone: false,
    label: `${h}:${m}:${s}`,
    doneText: "",
  };
}

const guestUser: UserProfile = {
  email: "",
  nickname: "游客 404",
  avatar: "☕",
  avatarType: "preset",
  isGuest: true,
  points: 236,
};

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem("cicada-freedom-user");
    return raw ? ({ ...guestUser, ...JSON.parse(raw) } as UserProfile) : guestUser;
  } catch {
    return guestUser;
  }
}

function storeUser(user: UserProfile) {
  if (user.isGuest) {
    window.localStorage.removeItem("cicada-freedom-user");
    return;
  }
  window.localStorage.setItem("cicada-freedom-user", JSON.stringify(user));
}

function App() {
  const isAdminSite = window.location.pathname.startsWith("/admin");
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [posts, setPosts] = useState<Post[]>([]);
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
  const [adminView, setAdminView] = useState<"posts" | "users">("posts");
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => hasAdminSession());
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [targetTime, setTargetTime] = useState("18:00");
  const [now, setNow] = useState(() => new Date());
  const [composer, setComposer] = useState("");
  const [selectedMood, setSelectedMood] = useState("合法摸鱼");
  const [asMeme, setAsMeme] = useState(false);

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
    }
  }, [isAdminAuthed, isAdminSite]);

  async function loadPosts() {
    try {
      setIsLoading(true);
      const result = await fetchPosts();
      setPosts(result.posts);
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "帖子加载失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAdmin() {
    try {
      setIsLoading(true);
      const result = await fetchAdminDashboard();
      setAdminStats(result.stats);
      setAdminPosts(result.posts);
      setAdminUsers(result.users);
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
  const progress = nextLevel
    ? Math.min(100, Math.round(((user.points - level.min) / (nextLevel.min - level.min)) * 100))
    : 100;

  const filteredPosts = useMemo(() => {
    if (activeChannel === "all") return posts;
    return posts.filter((post) => post.channel === activeChannel);
  }, [activeChannel, posts]);

  const todayQuote = dailyQuotes[new Date().getDate() % dailyQuotes.length];
  const todayJoke = jokes[new Date().getDay() % jokes.length];
  const countdown = getCountdown(targetTime, now);
  const viewer = user.nickname;
  const codeInputId = `auth-code-${authMode}`;
  const codeInputName = `verification-${authMode}-${authFieldNonce}`;

  function handleAuthModeChange(nextMode: "register" | "code" | "password") {
    setAuthMode(nextMode);
    setAuthMessage("");
    setCode("");
    if (nextMode !== "register") setPassword("");
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payloadEmail = email.trim() || user.email;
    if (!payloadEmail.includes("@")) {
      setAuthMessage("先填一个有效邮箱。");
      return;
    }
    if ((authMode === "register" || authMode === "password") && password.length < 6) {
      setAuthMessage("密码至少 6 位。");
      return;
    }
    if ((authMode === "register" || authMode === "code") && !code.trim()) {
      setAuthMessage("请输入验证码。");
      return;
    }

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
    const confirmed = window.confirm("确定要注销账号吗？账号会被删除，历史发帖会显示为已注销用户。");
    if (!confirmed) return;

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
    const payload = {
      nickname: draftNickname.trim() || user.nickname,
      avatar: draftAvatar,
      avatarType: draftAvatarType,
    };

    try {
      if (user.id && !user.isGuest) {
        const result = await updateProfile(user.id, payload);
        setUser(result.user);
      } else {
        setUser((current) => ({ ...current, ...payload, points: current.points + 5 }));
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

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = composer.trim();
    if (!trimmed) return;

    try {
      const result = await createPost({
        author: viewer,
        role: level.title,
        channel: asMeme ? "meme" : selectedMood === "丧系鸡汤" ? "quote" : "work",
        content: trimmed,
        mood: selectedMood,
        isMeme: asMeme,
      });
      setPosts((current) => [result.post, ...current]);
      setComposer("");
      setAsMeme(false);
      setUser((current) => ({ ...current, points: current.points + (asMeme ? 15 : 10) }));
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "发布失败");
    }
  }

  async function handleLike(postId: number) {
    try {
      const result = await likePost(postId);
      setPosts((current) => current.map((post) => (post.id === postId ? result.post : post)));
      setUser((current) => ({ ...current, points: current.points + 1 }));
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "点赞失败");
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

  const LevelIcon = level.icon;

  return (
    <main className="app-shell">
      {!isAdminSite ? (
        <>
          <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">
            <AlarmClock size={16} />
            下班前别死
          </span>
          <h1>把今天糊弄过去，也算一种自由。</h1>
          <p>
            给打工人、学生党和所有疲惫人类的摸鱼广场。可以游客发疯，可以邮箱登录攒等级，也可以把生活里那点离谱变成大家的续命笑料。
          </p>
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
            <div className="screen-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="screen-line wide" />
            <div className="screen-line" />
            <div className="screen-sticker">
              {countdown.isDone ? countdown.doneText : `距离解放还有 ${countdown.label}`}
            </div>
            <div className="screen-badge">{countdown.isDone ? "灵魂已下线" : "带薪呼吸中"}</div>
          </div>
        </div>
      </section>

      {apiError && <div className="api-alert">{apiError}，确认后端服务已启动。</div>}

      <section className="workspace">
        <aside className="side-panel profile-panel">
          <div className="profile-top">
            <div className={`avatar ${user.avatarType === "upload" ? "image-avatar" : ""}`}>
              {user.avatarType === "upload" ? <img src={user.avatar} alt="" /> : <span>{user.avatar}</span>}
            </div>
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
            <input
              id="targetTime"
              type="time"
              value={targetTime}
              onChange={(event) => setTargetTime(event.target.value)}
            />
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
                  <button
                    className={authMode === "register" ? "active" : ""}
                    type="button"
                    onClick={() => handleAuthModeChange("register")}
                  >
                    注册
                  </button>
                  <button
                    className={authMode === "code" ? "active" : ""}
                    type="button"
                    onClick={() => handleAuthModeChange("code")}
                  >
                    验证码登录
                  </button>
                  <button
                    className={authMode === "password" ? "active" : ""}
                    type="button"
                    onClick={() => handleAuthModeChange("password")}
                  >
                    密码登录
                  </button>
                </div>

                <label htmlFor="email">邮箱</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@freedom.life"
                  autoComplete="email"
                />

                {(authMode === "register" || authMode === "password") && (
                  <>
                    <label htmlFor="password">密码</label>
                    <input
                      id="password"
                      name={authMode === "register" ? "new-password" : "current-password"}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="至少 6 位"
                      autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    />
                  </>
                )}

                {(authMode === "register" || authMode === "code") && (
                  <>
                    <label htmlFor={codeInputId}>验证码</label>
                    <input
                      id={codeInputId}
                      name={codeInputName}
                      inputMode="numeric"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="输入验证码"
                      autoComplete="new-password"
                    />
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
                <input
                  id="nickname"
                  value={draftNickname}
                  onChange={(event) => setDraftNickname(event.target.value)}
                  placeholder="给今天的自己起个名"
                />

                <span className="field-label">头像</span>
                <div className="avatar-picker">
                  {presetAvatars.map((avatar) => (
                    <button
                      className={draftAvatar === avatar && draftAvatarType === "preset" ? "selected" : ""}
                      key={avatar}
                      type="button"
                      onClick={() => {
                        setDraftAvatar(avatar);
                        setDraftAvatarType("preset");
                      }}
                    >
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
                <button
                  className={activeChannel === channel.id ? "active" : ""}
                  key={channel.id}
                  onClick={() => setActiveChannel(channel.id)}
                >
                  <Icon size={16} />
                  {channel.label}
                </button>
              );
            })}
          </nav>

          <form className="composer" onSubmit={handlePost}>
            <div className="composer-head">
              <span>
                <Send size={16} />
                今日精神状态
              </span>
              <select value={selectedMood} onChange={(event) => setSelectedMood(event.target.value)}>
                <option>合法摸鱼</option>
                <option>丧系鸡汤</option>
                <option>带薪惊险</option>
                <option>下课失魂</option>
              </select>
            </div>
            <textarea
              id="composer"
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="把今天离谱的事放下，大家一起笑一下。"
            />
            <div className="composer-actions">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={asMeme}
                  onChange={(event) => setAsMeme(event.target.checked)}
                />
                <span>作为表情包文案发布</span>
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
            {filteredPosts.map((post) => (
              <article className={`post-card ${post.isMeme ? "meme-post" : ""}`} key={post.id}>
                <header>
                  <div>
                    <strong>{post.author}</strong>
                    <span>{post.role}</span>
                  </div>
                  <small>{post.time}</small>
                </header>
                {post.isMeme ? (
                  <div className="meme-frame">
                    <span>下班前别死</span>
                    <p>{post.content}</p>
                  </div>
                ) : (
                  <p>{post.content}</p>
                )}
                <footer>
                  <span className="mood-tag">{post.mood}</span>
                  <button onClick={() => handleLike(post.id)}>
                    <ThumbsUp size={16} />
                    {post.likes}
                  </button>
                  <button>
                    <MessageCircle size={16} />
                    {post.comments}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>

        <aside className="side-panel sparks-panel">
          <div className="daily-card quote-card">
            <div className="card-title">
              <Flame size={18} />
              每日很丧很鸡血
            </div>
            <p>{todayQuote}</p>
            <button onClick={() => setUser((current) => ({ ...current, points: current.points + 2 }))}>
              <Heart size={16} />
              续命 +2
            </button>
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

          <div className="badge-wall">
            <div className="card-title">
              <BadgeCheck size={18} />
              图标标签预览
            </div>
            <div className="badge-grid">
              {[Coffee, BellRing, Moon, Sparkles, Flame, Trophy, Star, Zap].map((Icon, index) => (
                <span key={index}>
                  <Icon size={18} />
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>
        </>
      ) : !isAdminAuthed ? (
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
            <input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              placeholder="admin@freedom.life"
            />
            <label htmlFor="admin-password">管理员密码</label>
            <input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="至少 6 位"
            />
            <button className="auth-submit" type="submit" disabled={isAuthSubmitting}>
              <KeyRound size={17} />
              {isAuthSubmitting ? "登录中" : "进入后台"}
            </button>
            {apiError && <div className="auth-message">{apiError}</div>}
          </form>
        </section>
      ) : (
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
            <button
              className={`metric-card metric-button ${adminView === "users" ? "active" : ""}`}
              onClick={() => setAdminView("users")}
              type="button"
            >
              <Users size={18} />
              <span>注册用户</span>
              <strong>{adminStats?.users ?? 0}</strong>
            </button>
            <button
              className={`metric-card metric-button ${adminView === "posts" ? "active" : ""}`}
              onClick={() => setAdminView("posts")}
              type="button"
            >
              <MessageCircle size={18} />
              <span>全部帖子</span>
              <strong>{adminStats?.posts ?? 0}</strong>
            </button>
            <div className="metric-card">
              <Eye size={18} />
              <span>展示中</span>
              <strong>{adminStats?.published ?? 0}</strong>
            </div>
            <div className="metric-card">
              <ThumbsUp size={18} />
              <span>累计续命</span>
              <strong>{adminStats?.totalLikes ?? 0}</strong>
            </div>
          </div>

          <div className="admin-layout">
            <section className="admin-table">
              {adminView === "posts" ? (
                <>
                  <header>
                    <div>
                      <h3>帖子审核</h3>
                      <p>隐藏不会删除内容，删除会从本地 JSON 数据中移除。</p>
                    </div>
                  </header>
                  {adminPosts.map((post) => (
                    <article className="admin-row" key={post.id}>
                      <div>
                        <strong>{post.author}</strong>
                        <span>{post.channel} · {post.mood} · {post.time}</span>
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
              ) : (
                <>
                  <header>
                    <div>
                      <h3>注册用户列表</h3>
                      <p>这里展示已注册账号的昵称、邮箱、等级积分和登录身份。</p>
                    </div>
                  </header>
                  {adminUsers.length === 0 && <div className="empty-state">还没有注册用户。</div>}
                  {adminUsers.map((adminUser) => (
                    <article className="admin-row user-row" key={`${adminUser.email}-${adminUser.id ?? "local"}`}>
                      <div className="user-identity">
                        <span className="user-avatar">{adminUser.avatar}</span>
                        <div>
                          <strong>{adminUser.nickname}</strong>
                          <span>{adminUser.email || "游客账号"}</span>
                        </div>
                      </div>
                      <span className="status-pill published">{adminUser.isGuest ? "游客" : "已注册"}</span>
                      <div className="user-meta">
                        <span>积分</span>
                        <strong>{adminUser.points}</strong>
                      </div>
                    </article>
                  ))}
                </>
              )}
            </section>

            <aside className="admin-side">
              <div className="daily-card">
                <div className="card-title">
                  <Image size={18} />
                  频道分布
                </div>
                <div className="channel-bars">
                  {(adminStats?.channels ?? []).map((item) => (
                    <div key={item.channel}>
                      <span>{channels.find((channel) => channel.id === item.channel)?.label ?? item.channel}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="daily-card">
                <div className="card-title">
                  <EyeOff size={18} />
                  风控概览
                </div>
                <ul>
                  <li>隐藏内容：{adminStats?.hidden ?? 0}</li>
                  <li>表情包文案：{adminStats?.memePosts ?? 0}</li>
                  <li>最新发布：{adminStats?.newestPostAt ? new Date(adminStats.newestPostAt).toLocaleString("zh-CN") : "暂无"}</li>
                </ul>
              </div>
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
