import { createServer } from "node:http";
import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");
const uploadDir = join(dataDir, "uploads");
const dbPath = join(dataDir, "db.json");
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const verificationCode = process.env.VERIFICATION_CODE || "7777";
const adminEmail = (process.env.ADMIN_EMAIL || "admin@freedom.life").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "admin1234";
const tokenSecret = process.env.JWT_SECRET || "dev-only-change-before-deploy";
const adminTokenTtlMs = Number(process.env.ADMIN_TOKEN_TTL_MS || 24 * 60 * 60 * 1000);
const maxUploadBytes = 2 * 1024 * 1024;

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
const channelIds = ["work", "school", "meme", "quote", "joke"];

const seedTags = [
  { id: "legal-fish", label: "合法摸鱼", createdAt: "2026-06-14T09:00:00.000Z" },
  { id: "sad-soup", label: "丧系鸡汤", createdAt: "2026-06-14T09:00:00.000Z" },
  { id: "paid-danger", label: "带薪惊险", createdAt: "2026-06-14T09:00:00.000Z" },
  { id: "after-class", label: "下课失魂", createdAt: "2026-06-14T09:00:00.000Z" },
];

const seed = {
  users: [
    {
      id: 1,
      email: "demo@freedom.life",
      nickname: "工位续命员",
      avatar: "☕",
      avatarType: "preset",
      isGuest: false,
      passwordHash: hashPassword("demo1234"),
      points: 0,
      createdAt: "2026-06-14T10:00:00.000Z",
    },
  ],
  posts: [
    makeSeedPost(1, "工位续命员", "实习牛马", "work", "今天最大的成就：在老板路过前 0.5 秒切回了表格。人生没有白走的路，只有白做的 PPT。", "带薪惊险", "09:41"),
    makeSeedPost(2, "期末幸存者", "实习牛马", "school", "复习到凌晨三点突然顿悟：知识没有进入我的脑子，但黑眼圈已经进入了我的人生履历。", "下课失魂", "10:08"),
    makeSeedPost(3, "下班倒计时", "实习牛马", "quote", "别急着说自己废物，很多事情还没轮到你失败。先喝口水，我们慢慢把今天糊弄过去。", "丧系鸡汤", "11:26"),
    makeSeedPost(4, "表情包仓管", "实习牛马", "meme", "领导：这个需求很简单。我的内心：那你来。", "合法摸鱼", "12:03", true),
    makeSeedPost(5, "赛博茶水间", "实习牛马", "joke", "今日笑话：同事说他热爱工作。我问热爱哪部分，他说热爱它结束的那一刻。", "合法摸鱼", "13:17"),
  ],
  tags: seedTags,
  dailyLifeRecords: [],
  uploads: [],
};

function makeSeedPost(id, author, role, channel, content, mood, time, isMeme = false) {
  return {
    id,
    author,
    role,
    channel,
    content,
    likes: 0,
    likedBy: [],
    comments: [],
    commentCount: 0,
    tags: [mood],
    mood,
    time,
    isMeme,
    status: "published",
    createdAt: `2026-06-14T${time}:00.000Z`,
  };
}

async function readDb() {
  try {
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    return normalizeDb(db);
  } catch {
    await mkdir(dataDir, { recursive: true });
    await mkdir(uploadDir, { recursive: true });
    await writeDb(seed);
    return structuredClone(seed);
  }
}

function normalizeDb(db) {
  db.users = Array.isArray(db.users) ? db.users : [];
  db.posts = Array.isArray(db.posts) ? db.posts : [];
  db.tags = Array.isArray(db.tags) ? db.tags : seedTags;
  db.dailyLifeRecords = Array.isArray(db.dailyLifeRecords) ? db.dailyLifeRecords : [];
  db.uploads = Array.isArray(db.uploads) ? db.uploads : [];

  db.users = db.users.map((user) => {
    const normalized = {
      ...user,
      points: Number.isFinite(Number(user.points)) ? Number(user.points) : 0,
      avatarType: user.avatarType === "upload" ? "upload" : "preset",
      isGuest: Boolean(user.isGuest),
    };
    if (normalized.email === "demo@freedom.life" && (!normalized.passwordHash || !normalized.passwordHash.includes("$"))) {
      return { ...normalized, passwordHash: hashPassword("demo1234") };
    }
    return normalized;
  });

  db.posts = db.posts.map((post) => normalizePost(post));
  db.tags = db.tags
    .map((tag) => normalizeTag(tag))
    .filter(Boolean)
    .filter((tag, index, tags) => tags.findIndex((item) => item.label === tag.label) === index);
  for (const post of db.posts) {
    for (const tagLabel of post.tags) {
      if (!db.tags.some((tag) => tag.label === tagLabel)) {
        db.tags.push({ id: slugifyTag(tagLabel), label: tagLabel, createdAt: new Date().toISOString() });
      }
    }
  }
  return db;
}

function normalizePost(post) {
  const tags = Array.isArray(post.tags) && post.tags.length > 0 ? post.tags.map(String) : [String(post.mood || "合法摸鱼")];
  const comments = Array.isArray(post.comments) ? post.comments.map(normalizeComment).filter(Boolean) : [];
  return {
    id: Number(post.id) || Date.now(),
    author: String(post.author || "游客 404"),
    role: String(post.role || "实习牛马"),
    channel: channelIds.includes(post.channel) ? post.channel : "work",
    content: String(post.content || ""),
    likes: Array.isArray(post.likedBy) ? post.likedBy.length : Number(post.likes) || 0,
    likedBy: Array.isArray(post.likedBy) ? post.likedBy.map(String) : [],
    comments,
    commentCount: countComments(comments),
    tags,
    mood: String(post.mood || tags[0] || "合法摸鱼"),
    time: String(post.time || "00:00"),
    isMeme: Boolean(post.isMeme),
    imageUrl: typeof post.imageUrl === "string" ? post.imageUrl : "",
    status: post.status === "hidden" ? "hidden" : "published",
    createdAt: post.createdAt || new Date().toISOString(),
  };
}

function normalizeComment(comment) {
  if (!comment || !String(comment.content || "").trim()) return null;
  return {
    id: Number(comment.id) || Date.now(),
    userId: comment.userId ? String(comment.userId) : "",
    author: String(comment.author || "游客 404"),
    avatar: String(comment.avatar || "☕"),
    content: String(comment.content || "").trim(),
    createdAt: comment.createdAt || new Date().toISOString(),
    replies: Array.isArray(comment.replies) ? comment.replies.map(normalizeComment).filter(Boolean) : [],
  };
}

function normalizeTag(tag) {
  const label = String(typeof tag === "string" ? tag : tag?.label || "").trim();
  if (!label) return null;
  return {
    id: String(tag?.id || slugifyTag(label)),
    label,
    createdAt: tag?.createdAt || new Date().toISOString(),
  };
}

async function writeDb(db) {
  await mkdir(dataDir, { recursive: true });
  await mkdir(uploadDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(normalizeDb(db), null, 2));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.length === 0 || !origin || allowedOrigins.includes(origin) ? origin || "*" : "";
  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath, contentType) {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(res);
}

function notFound(res) {
  sendJson(res, 404, { message: "接口不存在" });
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        req.destroy();
        reject(new Error("请求体过大"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON 格式不正确"));
      }
    });
  });
}

function compactUser(user) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatar: user.avatar,
    avatarType: user.avatarType,
    isGuest: user.isGuest,
    points: user.points,
    createdAt: user.createdAt,
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(String(password), salt, 120_000, 32, "sha256").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  if (!passwordHash.includes("$")) {
    return createHash("sha256").update(String(password)).digest("hex") === passwordHash;
  }
  const [algorithm, salt, expectedHash] = passwordHash.split("$");
  if (algorithm !== "pbkdf2" || !salt || !expectedHash) return false;
  const hash = pbkdf2Sync(String(password), salt, 120_000, 32, "sha256").toString("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readAuthPayload(payload) {
  return {
    email: String(payload.email || "").trim().toLowerCase(),
    password: String(payload.password || ""),
    code: String(payload.code || "").trim(),
  };
}

function validateCode(code) {
  return code === verificationCode;
}

function getRandomProfile(email = "") {
  return {
    email,
    nickname: randomNames[Math.floor(Math.random() * randomNames.length)],
    avatar: presetAvatars[Math.floor(Math.random() * presetAvatars.length)],
    avatarType: "preset",
  };
}

function stats(db) {
  const published = db.posts.filter((post) => post.status === "published");
  return {
    users: db.users.length,
    posts: db.posts.length,
    published: published.length,
    hidden: db.posts.filter((post) => post.status === "hidden").length,
    totalLikes: db.posts.reduce((sum, post) => sum + post.likes, 0),
    totalComments: db.posts.reduce((sum, post) => sum + post.commentCount, 0),
    memePosts: db.posts.filter((post) => post.isMeme).length,
    uploads: db.uploads.length,
    tags: db.tags.length,
    dailyLifeRecords: db.dailyLifeRecords.length,
    newestPostAt: db.posts[0]?.createdAt ?? null,
    channels: channelIds.map((channel) => ({
      channel,
      count: published.filter((post) => post.channel === channel).length,
    })),
  };
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function signTokenPayload(encodedPayload) {
  return createHmac("sha256", tokenSecret).update(encodedPayload).digest("base64url");
}

function createAdminToken(email) {
  const payload = base64Url(JSON.stringify({ email, role: "admin", expiresAt: Date.now() + adminTokenTtlMs }));
  return `${payload}.${signTokenPayload(payload)}`;
}

function verifyAdminToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || signTokenPayload(payload) !== signature) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.role === "admin" && parsed.email === adminEmail && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

function requireAdmin(req, res) {
  if (verifyAdminToken(readBearerToken(req))) return true;
  sendJson(res, 401, { message: "请先登录管理员账号" });
  return false;
}

function countComments(comments) {
  return comments.reduce((sum, comment) => sum + 1 + countComments(comment.replies || []), 0);
}

function commentPayload(payload) {
  const content = String(payload.content || "").trim();
  if (!content) return null;
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    userId: payload.userId ? String(payload.userId) : "",
    author: String(payload.author || "游客 404"),
    avatar: String(payload.avatar || "☕"),
    content,
    createdAt: new Date().toISOString(),
    replies: [],
  };
}

function sortPosts(posts, sort) {
  const now = Date.now();
  const byNewest = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const byHot = (a, b) => b.likes + b.commentCount * 2 - (a.likes + a.commentCount * 2) || byNewest(a, b);
  const byBalanced = (a, b) => {
    const score = (post) => {
      const ageHours = Math.max(1, (now - new Date(post.createdAt).getTime()) / 3_600_000);
      return post.likes * 2 + post.commentCount * 3 + 24 / ageHours;
    };
    return score(b) - score(a) || byNewest(a, b);
  };
  if (sort === "hot") return [...posts].sort(byHot);
  if (sort === "balanced") return [...posts].sort(byBalanced);
  return [...posts].sort(byNewest);
}

function filterPosts(posts, params) {
  const status = params.get("status") || "published";
  const tag = params.get("tag") || "";
  const q = (params.get("q") || "").trim().toLowerCase();
  const postId = Number(params.get("postId") || "");
  return posts.filter((post) => {
    if (status !== "all" && post.status !== status) return false;
    if (tag && !post.tags.includes(tag)) return false;
    if (postId && post.id !== postId) return false;
    if (q && !`${post.content} ${post.author} ${post.tags.join(" ")} ${post.id}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function likeUserKey(payload) {
  if (payload.userId) return `user:${payload.userId}`;
  if (payload.clientId) return `client:${payload.clientId}`;
  return "";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dailyLifeKey(payload, userId) {
  if (userId) return `user:${userId}`;
  return `guest:${String(payload.clientId || "").trim()}`;
}

function slugifyTag(label) {
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || randomBytes(6).toString("hex");
}

function contentTypeFor(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function handleUpload(req, res, db) {
  const payload = await readBody(req, maxUploadBytes + 80_000);
  const dataUrl = String(payload.dataUrl || "");
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|gif|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return sendJson(res, 400, { message: "请上传 PNG、JPG、GIF 或 WebP 图片" });

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > maxUploadBytes) return sendJson(res, 413, { message: "图片不能超过 2MB" });

  const extMap = { "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/gif": ".gif", "image/webp": ".webp" };
  const fileName = `${Date.now()}-${randomBytes(5).toString("hex")}${extMap[match[1]]}`;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, fileName), bytes);

  const upload = {
    id: Date.now(),
    fileName,
    url: `/api/uploads/${fileName}`,
    mimeType: match[1],
    size: bytes.length,
    createdAt: new Date().toISOString(),
  };
  db.uploads.unshift(upload);
  await writeDb(db);
  return sendJson(res, 201, { upload });
}

const server = createServer(async (req, res) => {
  try {
    applyCors(req, res);
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const db = await readDb();

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, service: "cicada-freedom-api" });
    }

    const uploadMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)$/);
    if (req.method === "GET" && uploadMatch) {
      const safeName = normalize(uploadMatch[1]).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = join(uploadDir, safeName);
      return sendFile(res, filePath, contentTypeFor(filePath));
    }

    if (req.method === "GET" && url.pathname === "/api/tags") {
      return sendJson(res, 200, { tags: db.tags });
    }

    if (req.method === "GET" && url.pathname === "/api/posts") {
      const posts = sortPosts(filterPosts(db.posts, url.searchParams), url.searchParams.get("sort") || "newest");
      return sendJson(res, 200, { posts, tags: db.tags });
    }

    if (req.method === "POST" && url.pathname === "/api/posts") {
      const payload = await readBody(req);
      const content = String(payload.content || "").trim();
      if (!content) return sendJson(res, 400, { message: "内容不能为空" });

      const tags = Array.isArray(payload.tags) ? payload.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : [];
      const now = new Date();
      const post = normalizePost({
        id: Date.now(),
        author: String(payload.author || "游客 404"),
        role: String(payload.role || "实习牛马"),
        channel: channelIds.includes(payload.channel) ? payload.channel : "work",
        content,
        likes: 0,
        likedBy: [],
        comments: [],
        tags: tags.length ? tags : ["合法摸鱼"],
        mood: String(tags[0] || payload.mood || "合法摸鱼"),
        time: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        isMeme: Boolean(payload.isMeme),
        imageUrl: String(payload.imageUrl || ""),
        status: "published",
        createdAt: now.toISOString(),
      });

      db.posts.unshift(post);
      await writeDb(db);
      return sendJson(res, 201, { post });
    }

    const likeMatch = url.pathname.match(/^\/api\/posts\/(\d+)\/like$/);
    if (req.method === "POST" && likeMatch) {
      const payload = await readBody(req);
      const post = db.posts.find((item) => item.id === Number(likeMatch[1]));
      if (!post) return sendJson(res, 404, { message: "帖子不存在" });
      const key = likeUserKey(payload);
      if (!key) return sendJson(res, 400, { message: "缺少点赞身份" });
      if (!post.likedBy.includes(key)) {
        post.likedBy.push(key);
        post.likes = post.likedBy.length;
      }
      await writeDb(db);
      return sendJson(res, 200, { post });
    }

    const commentMatch = url.pathname.match(/^\/api\/posts\/(\d+)\/comments$/);
    if (req.method === "POST" && commentMatch) {
      const payload = await readBody(req);
      const post = db.posts.find((item) => item.id === Number(commentMatch[1]));
      if (!post) return sendJson(res, 404, { message: "帖子不存在" });
      const comment = commentPayload(payload);
      if (!comment) return sendJson(res, 400, { message: "评论不能为空" });
      post.comments.push(comment);
      post.commentCount = countComments(post.comments);
      await writeDb(db);
      return sendJson(res, 201, { post, comment });
    }

    const replyMatch = url.pathname.match(/^\/api\/posts\/(\d+)\/comments\/(\d+)\/replies$/);
    if (req.method === "POST" && replyMatch) {
      const payload = await readBody(req);
      const post = db.posts.find((item) => item.id === Number(replyMatch[1]));
      if (!post) return sendJson(res, 404, { message: "帖子不存在" });
      const parent = post.comments.find((comment) => comment.id === Number(replyMatch[2]));
      if (!parent) return sendJson(res, 404, { message: "评论不存在" });
      const reply = commentPayload(payload);
      if (!reply) return sendJson(res, 400, { message: "回复不能为空" });
      parent.replies.push(reply);
      post.commentCount = countComments(post.comments);
      await writeDb(db);
      return sendJson(res, 201, { post, reply });
    }

    if (req.method === "POST" && url.pathname === "/api/uploads/memes") {
      return handleUpload(req, res, db);
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const payload = await readBody(req);
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return sendJson(res, 400, { message: "请输入有效邮箱" });

      let user = db.users.find((item) => item.email === email);
      if (!user) {
        user = {
          id: Date.now(),
          ...getRandomProfile(email),
          isGuest: false,
          points: 0,
          createdAt: new Date().toISOString(),
        };
        db.users.push(user);
      }

      await writeDb(db);
      return sendJson(res, 200, { user: compactUser(user) });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const payload = await readBody(req);
      const { email, password, code } = readAuthPayload(payload);
      if (!isValidEmail(email)) return sendJson(res, 400, { message: "请输入有效邮箱" });
      if (!validateCode(code)) return sendJson(res, 400, { message: "验证码不正确" });
      if (password.length < 6) return sendJson(res, 400, { message: "密码至少 6 位" });
      if (db.users.some((item) => item.email === email)) return sendJson(res, 409, { message: "这个邮箱已经注册过了" });

      const user = {
        id: Date.now(),
        ...getRandomProfile(email),
        isGuest: false,
        passwordHash: hashPassword(password),
        points: 0,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      await writeDb(db);
      return sendJson(res, 201, { user: compactUser(user) });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login/password") {
      const payload = await readBody(req);
      const { email, password } = readAuthPayload(payload);
      const user = db.users.find((item) => item.email === email);
      if (!user) return sendJson(res, 404, { message: "账号不存在，请先注册" });
      if (!user.passwordHash) return sendJson(res, 400, { message: "这个账号还没有设置密码，请用验证码登录后补注册" });
      if (!verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { message: "密码不正确" });

      await writeDb(db);
      return sendJson(res, 200, { user: compactUser(user) });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login/code") {
      const payload = await readBody(req);
      const { email, code } = readAuthPayload(payload);
      if (!isValidEmail(email)) return sendJson(res, 400, { message: "请输入有效邮箱" });
      if (!validateCode(code)) return sendJson(res, 400, { message: "验证码不正确" });

      const user = db.users.find((item) => item.email === email);
      if (!user) return sendJson(res, 404, { message: "账号不存在，请先注册" });

      await writeDb(db);
      return sendJson(res, 200, { user: compactUser(user) });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/guest") {
      return sendJson(res, 200, {
        user: {
          id: Date.now(),
          email: "",
          nickname: `游客 ${Math.floor(Math.random() * 900 + 100)}`,
          avatar: presetAvatars[Math.floor(Math.random() * presetAvatars.length)],
          avatarType: "preset",
          isGuest: true,
          points: 0,
        },
      });
    }

    const userMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
    if (req.method === "PUT" && userMatch) {
      const payload = await readBody(req);
      const user = db.users.find((item) => item.id === Number(userMatch[1]));
      if (!user) return sendJson(res, 404, { message: "用户不存在" });

      user.nickname = String(payload.nickname || user.nickname).trim() || user.nickname;
      user.avatar = String(payload.avatar || user.avatar);
      user.avatarType = payload.avatarType === "upload" ? "upload" : "preset";
      await writeDb(db);
      return sendJson(res, 200, { user: compactUser(user) });
    }

    const dailyLifeMatch = url.pathname.match(/^\/api\/users\/(\d+)\/daily-life$/);
    if (req.method === "POST" && dailyLifeMatch) {
      const payload = await readBody(req);
      const userId = Number(dailyLifeMatch[1]);
      const user = db.users.find((item) => item.id === userId);
      const key = dailyLifeKey(payload, userId);
      const date = todayKey();
      if (!key) return sendJson(res, 400, { message: "缺少续命身份" });
      if (db.dailyLifeRecords.some((record) => record.key === key && record.date === date)) {
        return sendJson(res, 409, { message: "今天已经续过命了，明天再来" });
      }
      if (user) user.points += 1;
      const record = {
        id: Date.now(),
        key,
        userId: user?.id ?? 0,
        nickname: user?.nickname || String(payload.nickname || "游客 404"),
        date,
        points: 1,
        createdAt: new Date().toISOString(),
      };
      db.dailyLifeRecords.unshift(record);
      await writeDb(db);
      return sendJson(res, 200, { ok: true, record, user: user ? compactUser(user) : null });
    }

    if (req.method === "DELETE" && userMatch) {
      const userIndex = db.users.findIndex((item) => item.id === Number(userMatch[1]));
      if (userIndex === -1) return sendJson(res, 404, { message: "用户不存在" });

      const [deletedUser] = db.users.splice(userIndex, 1);
      db.posts = db.posts.map((post) =>
        post.author === deletedUser.nickname
          ? { ...post, author: "已注销用户", role: "自由灵魂已离线" }
          : post,
      );
      await writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const payload = await readBody(req);
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (email !== adminEmail || password !== adminPassword) {
        return sendJson(res, 401, { message: "管理员账号或密码不正确" });
      }
      return sendJson(res, 200, { token: createAdminToken(email), email });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/dashboard") {
      if (!requireAdmin(req, res)) return;
      const posts = sortPosts(filterPosts(db.posts, url.searchParams), url.searchParams.get("sort") || "newest");
      return sendJson(res, 200, {
        stats: stats(db),
        posts,
        users: db.users.map(compactUser),
        tags: db.tags,
        uploads: db.uploads,
        dailyLifeRecords: db.dailyLifeRecords,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/tags") {
      if (!requireAdmin(req, res)) return;
      const payload = await readBody(req);
      const label = String(payload.label || "").trim();
      if (!label) return sendJson(res, 400, { message: "标签不能为空" });
      const existing = db.tags.find((tag) => tag.label === label);
      if (existing) return sendJson(res, 200, { tag: existing });
      const tag = { id: `${slugifyTag(label)}-${Date.now().toString(36)}`, label, createdAt: new Date().toISOString() };
      db.tags.push(tag);
      await writeDb(db);
      return sendJson(res, 201, { tag });
    }

    const adminUserPointsMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/points$/);
    if (req.method === "POST" && adminUserPointsMatch) {
      if (!requireAdmin(req, res)) return;
      const payload = await readBody(req);
      const user = db.users.find((item) => item.id === Number(adminUserPointsMatch[1]));
      if (!user) return sendJson(res, 404, { message: "用户不存在" });
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount === 0) return sendJson(res, 400, { message: "请输入有效积分" });
      user.points = Math.max(0, user.points + Math.trunc(amount));
      await writeDb(db);
      return sendJson(res, 200, { user: compactUser(user) });
    }

    const adminPostMatch = url.pathname.match(/^\/api\/admin\/posts\/(\d+)$/);
    if (adminPostMatch) {
      if (!requireAdmin(req, res)) return;
      const postIndex = db.posts.findIndex((post) => post.id === Number(adminPostMatch[1]));
      if (postIndex === -1) return sendJson(res, 404, { message: "帖子不存在" });

      if (req.method === "PATCH") {
        const payload = await readBody(req);
        db.posts[postIndex].status = payload.status === "hidden" ? "hidden" : "published";
        await writeDb(db);
        return sendJson(res, 200, { post: db.posts[postIndex] });
      }

      if (req.method === "DELETE") {
        const [post] = db.posts.splice(postIndex, 1);
        await writeDb(db);
        return sendJson(res, 200, { post });
      }
    }

    return notFound(res);
  } catch (error) {
    return sendJson(res, 500, { message: error instanceof Error ? error.message : "服务开小差了" });
  }
});

server.on("error", (error) => {
  console.error(`API 启动失败：${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`CicadaFreedom API running at http://${host}:${port}`);
});
