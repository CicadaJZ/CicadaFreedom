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
  Laugh,
  LogIn,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  Upload,
  UserRound,
  Zap,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Channel = "all" | "work" | "school" | "meme" | "quote" | "joke";

type Post = {
  id: number;
  author: string;
  role: string;
  channel: Exclude<Channel, "all">;
  content: string;
  likes: number;
  comments: number;
  mood: string;
  time: string;
  isMeme?: boolean;
};

type Level = {
  min: number;
  title: string;
  icon: typeof Coffee;
  tone: string;
};

type UserProfile = {
  email: string;
  nickname: string;
  avatar: string;
  avatarType: "preset" | "upload";
  isGuest: boolean;
};

const levels: Level[] = [
  { min: 0, title: "实习牛马", icon: Coffee, tone: "ash" },
  { min: 80, title: "初级撞钟师", icon: BellRing, tone: "mint" },
  { min: 180, title: "摸鱼熟练工", icon: Moon, tone: "blue" },
  { min: 320, title: "工位幽灵", icon: Sparkles, tone: "pink" },
  { min: 520, title: "带薪发疯大师", icon: Flame, tone: "orange" },
  { min: 760, title: "自由灵魂认证", icon: Trophy, tone: "gold" },
];

const presetAvatars = ["☕", "💼", "🫠", "🧃", "🌙", "🔥", "🦾", "✨"];

const randomNames = [
  "带薪呼吸员",
  "准点撤退侠",
  "工位漂流瓶",
  "下课回血包",
  "人间续航机",
  "摸鱼观察员",
  "会议隐身术士",
  "周五预备役",
];

const doneLines = [
  "还有呼吸，续命成功，明日再战。",
  "今日工位副本已通关，请立刻把灵魂捡回来。",
  "恭喜活到下班，下一个任务：假装没看见工作群。",
  "下课/下班铃已响，今天的你值得一口热饭。",
];

const initialPosts: Post[] = [
  {
    id: 1,
    author: "工位续命员",
    role: "摸鱼熟练工",
    channel: "work",
    content:
      "今天最大的成就：在老板路过前 0.5 秒切回了表格。人生没有白走的路，只有白做的 PPT。",
    likes: 248,
    comments: 32,
    mood: "带薪惊险",
    time: "09:41",
  },
  {
    id: 2,
    author: "期末幸存者",
    role: "初级撞钟师",
    channel: "school",
    content:
      "复习到凌晨三点突然顿悟：知识没有进入我的脑子，但黑眼圈已经进入了我的人生履历。",
    likes: 196,
    comments: 18,
    mood: "脆皮学习",
    time: "10:08",
  },
  {
    id: 3,
    author: "下班倒计时",
    role: "自由灵魂认证",
    channel: "quote",
    content:
      "别急着说自己废物，很多事情还没轮到你失败。先喝口水，我们慢慢把今天糊弄过去。",
    likes: 415,
    comments: 57,
    mood: "丧系鸡血",
    time: "11:26",
  },
  {
    id: 4,
    author: "表情包仓管",
    role: "带薪发疯大师",
    channel: "meme",
    content: "领导：这个需求很简单。我的内心：那你来。",
    likes: 326,
    comments: 44,
    mood: "工位表演",
    time: "12:03",
    isMeme: true,
  },
  {
    id: 5,
    author: "赛博茶水间",
    role: "工位幽灵",
    channel: "joke",
    content:
      "今日笑话：同事说他热爱工作。我问热爱哪部分，他说热爱它结束的那一刻。",
    likes: 289,
    comments: 21,
    mood: "今日笑话",
    time: "13:17",
  },
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

function getRandomProfile(email: string): UserProfile {
  return {
    email,
    nickname: randomNames[Math.floor(Math.random() * randomNames.length)],
    avatar: presetAvatars[Math.floor(Math.random() * presetAvatars.length)],
    avatarType: "preset",
    isGuest: false,
  };
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

function App() {
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [posts, setPosts] = useState(initialPosts);
  const [points, setPoints] = useState(236);
  const [user, setUser] = useState<UserProfile>({
    email: "",
    nickname: "游客 404",
    avatar: "☕",
    avatarType: "preset",
    isGuest: true,
  });
  const [email, setEmail] = useState("");
  const [draftNickname, setDraftNickname] = useState("");
  const [draftAvatar, setDraftAvatar] = useState(presetAvatars[0]);
  const [draftAvatarType, setDraftAvatarType] = useState<"preset" | "upload">("preset");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [targetTime, setTargetTime] = useState("18:00");
  const [now, setNow] = useState(() => new Date());
  const [composer, setComposer] = useState("");
  const [selectedMood, setSelectedMood] = useState("合法摸鱼");
  const [asMeme, setAsMeme] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const level = getLevel(points);
  const nextLevel = levels.find((item) => item.min > points);
  const progress = nextLevel
    ? Math.min(100, Math.round(((points - level.min) / (nextLevel.min - level.min)) * 100))
    : 100;

  const filteredPosts = useMemo(() => {
    if (activeChannel === "all") return posts;
    return posts.filter((post) => post.channel === activeChannel);
  }, [activeChannel, posts]);

  const todayQuote = dailyQuotes[new Date().getDate() % dailyQuotes.length];
  const todayJoke = jokes[new Date().getDay() % jokes.length];
  const countdown = getCountdown(targetTime, now);
  const viewer = user.nickname;

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = getRandomProfile(email);
    setUser(profile);
    setDraftNickname(profile.nickname);
    setDraftAvatar(profile.avatar);
    setDraftAvatarType(profile.avatarType);
    setIsEditingProfile(true);
    setEmail("");
    setPoints((current) => current + 18);
  }

  function handleGuest() {
    const guest: UserProfile = {
      email: "",
      nickname: `游客 ${Math.floor(Math.random() * 900 + 100)}`,
      avatar: presetAvatars[Math.floor(Math.random() * presetAvatars.length)],
      avatarType: "preset",
      isGuest: true,
    };
    setUser(guest);
    setPoints((current) => current + 3);
  }

  function startProfileEdit() {
    setDraftNickname(user.nickname);
    setDraftAvatar(user.avatar);
    setDraftAvatarType(user.avatarType);
    setIsEditingProfile(true);
  }

  function saveProfile() {
    setUser((current) => ({
      ...current,
      nickname: draftNickname.trim() || current.nickname,
      avatar: draftAvatar,
      avatarType: draftAvatarType,
    }));
    setIsEditingProfile(false);
    setPoints((current) => current + 5);
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

  function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = composer.trim();
    if (!trimmed) return;

    const newPost: Post = {
      id: Date.now(),
      author: viewer,
      role: level.title,
      channel: asMeme ? "meme" : selectedMood === "丧系鸡汤" ? "quote" : "work",
      content: trimmed,
      likes: 0,
      comments: 0,
      mood: selectedMood,
      time: new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isMeme: asMeme,
    };

    setPosts((current) => [newPost, ...current]);
    setComposer("");
    setAsMeme(false);
    setPoints((current) => current + (asMeme ? 15 : 10));
  }

  function handleLike(postId: number) {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)),
    );
    setPoints((current) => current + 1);
  }

  const LevelIcon = level.icon;

  return (
    <main className="app-shell">
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
              <span>活跃值 {points}</span>
              <span>{nextLevel ? `下一阶 ${nextLevel.min}` : "已满级"}</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <form className="login-card" onSubmit={handleLogin}>
            <label htmlFor="email">邮箱注册 / 登录</label>
            <div className="email-row">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@freedom.life"
              />
              <button aria-label="登录" type="submit">
                <LogIn size={18} />
              </button>
            </div>
            {!user.isGuest && <small>已登录后可编辑昵称和头像。</small>}
          </form>

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
            <button onClick={() => setPoints((current) => current + 2)}>
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
    </main>
  );
}

export default App;
