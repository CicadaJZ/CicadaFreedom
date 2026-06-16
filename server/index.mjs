import { createServer } from "node:http";
import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");
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
      points: 236,
      createdAt: "2026-06-14T10:00:00.000Z",
    },
  ],
  posts: [
    {
      id: 1,
      author: "工位续命员",
      role: "摸鱼熟练工",
      channel: "work",
      content: "今天最大的成就：在老板路过前 0.5 秒切回了表格。人生没有白走的路，只有白做的 PPT。",
      likes: 248,
      comments: 32,
      mood: "带薪惊险",
      time: "09:41",
      isMeme: false,
      status: "published",
      createdAt: "2026-06-14T09:41:00.000Z",
    },
    {
      id: 2,
      author: "期末幸存者",
      role: "初级撞钟师",
      channel: "school",
      content: "复习到凌晨三点突然顿悟：知识没有进入我的脑子，但黑眼圈已经进入了我的人生履历。",
      likes: 196,
      comments: 18,
      mood: "脆皮学习",
      time: "10:08",
      isMeme: false,
      status: "published",
      createdAt: "2026-06-14T10:08:00.000Z",
    },
    {
      id: 3,
      author: "下班倒计时",
      role: "自由灵魂认证",
      channel: "quote",
      content: "别急着说自己废物，很多事情还没轮到你失败。先喝口水，我们慢慢把今天糊弄过去。",
      likes: 415,
      comments: 57,
      mood: "丧系鸡血",
      time: "11:26",
      isMeme: false,
      status: "published",
      createdAt: "2026-06-14T11:26:00.000Z",
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
      status: "published",
      createdAt: "2026-06-14T12:03:00.000Z",
    },
    {
      id: 5,
      author: "赛博茶水间",
      role: "工位幽灵",
      channel: "joke",
      content: "今日笑话：同事说他热爱工作。我问热爱哪部分，他说热爱它结束的那一刻。",
      likes: 289,
      comments: 21,
      mood: "今日笑话",
      time: "13:17",
      isMeme: false,
      status: "published",
      createdAt: "2026-06-14T13:17:00.000Z",
    },
  ],
};

async function readDb() {
  try {
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    return normalizeDb(db);
  } catch {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
    return structuredClone(seed);
  }
}

function normalizeDb(db) {
  db.users = Array.isArray(db.users) ? db.users : [];
  db.posts = Array.isArray(db.posts) ? db.posts : [];
  db.users = db.users.map((user) => {
    if (user.email === "demo@freedom.life" && (!user.passwordHash || !user.passwordHash.includes("$"))) {
      return { ...user, passwordHash: hashPassword("demo1234") };
    }
    return user;
  });
  return db;
}

async function writeDb(db) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
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

function notFound(res) {
  sendJson(res, 404, { message: "接口不存在" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
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
    memePosts: db.posts.filter((post) => post.isMeme).length,
    newestPostAt: db.posts[0]?.createdAt ?? null,
    channels: ["work", "school", "meme", "quote", "joke"].map((channel) => ({
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

const server = createServer(async (req, res) => {
  try {
    applyCors(req, res);
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const db = await readDb();

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, service: "cicada-freedom-api" });
    }

    if (req.method === "GET" && url.pathname === "/api/posts") {
      const status = url.searchParams.get("status") || "published";
      const posts = db.posts.filter((post) => status === "all" || post.status === status);
      return sendJson(res, 200, { posts });
    }

    if (req.method === "POST" && url.pathname === "/api/posts") {
      const payload = await readBody(req);
      const content = String(payload.content || "").trim();
      if (!content) return sendJson(res, 400, { message: "内容不能为空" });

      const now = new Date();
      const post = {
        id: Date.now(),
        author: String(payload.author || "游客 404"),
        role: String(payload.role || "实习牛马"),
        channel: payload.channel || "work",
        content,
        likes: 0,
        comments: 0,
        mood: String(payload.mood || "合法摸鱼"),
        time: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        isMeme: Boolean(payload.isMeme),
        status: "published",
        createdAt: now.toISOString(),
      };

      db.posts.unshift(post);
      await writeDb(db);
      return sendJson(res, 201, { post });
    }

    const likeMatch = url.pathname.match(/^\/api\/posts\/(\d+)\/like$/);
    if (req.method === "POST" && likeMatch) {
      const post = db.posts.find((item) => item.id === Number(likeMatch[1]));
      if (!post) return sendJson(res, 404, { message: "帖子不存在" });
      post.likes += 1;
      await writeDb(db);
      return sendJson(res, 200, { post });
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
          points: 236,
          createdAt: new Date().toISOString(),
        };
        db.users.push(user);
      } else {
        user.points += 18;
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
        points: 236,
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

      user.points += 8;
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

      user.points += 8;
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
          points: 239,
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
      user.points += 5;
      await writeDb(db);
      return sendJson(res, 200, { user: compactUser(user) });
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
      return sendJson(res, 200, { stats: stats(db), posts: db.posts, users: db.users.map(compactUser) });
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
