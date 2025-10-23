/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/* ===================== Firebase Admin ===================== */
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
initializeApp();
const {getStorage} = require("firebase-admin/storage");
const db = getFirestore();

/* ===================== Firebase Functions v2 ===================== */
const {onDocumentCreated, onDocumentDeleted, onDocumentWritten} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const {onCall} = require("firebase-functions/v2/https");
// const {onUserCreated} = require("firebase-functions/v2/identity");
const logger = require("firebase-functions/logger");
const REGION = "australia-southeast2";
// const {getAuth} = require("firebase-admin/auth"); // 如果后续你想做管理员删用户，会用到

/* ===================== Firebase Functions v1（仅用于 auth 触发器） ===================== */
const functionsV1 = require("firebase-functions/v1"); // ← 关键：从 /v1 引入

/* ---- Default region for all v2 functions ---- */
setGlobalOptions({region: "australia-southeast2"});

/* ===================== Users schema helpers ===================== */
const ALLOWED_USER_KEYS = [
  // eslint-disable-next-line comma-spacing
  "age","avatar","email","gender", "role","username","createdAt","updatedAt",
];

function safeString(v, dflt) {
  return typeof v === "string" ? v : (dflt || "");
}
function safeNumberOrNull(v) {
  return typeof v === "number" && isFinite(v) ? v : null;
}

/* ===================== 1) Create users/{uid} on signup (v1 auth trigger) ===================== */
/* Writes default profile with createdAt only (frontend must write updatedAt on updates). */
/* 说明：
   - 这里用 v1：functions.auth.user().onCreate(...)
   - 你的当前依赖版本肯定支持这一写法，避免 v2 onUserCreated 带来的报错
*/
async function createUserProfileDoc(user) {
  if (!user) return null;
  const uid = user.uid;
  const email = user.email || "";
  const usernameGuess = email ? email.split("@")[0] : uid;

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    logger.info("[ensureUserProfileOnSignup] exists, skip", {uid: uid});
    return null;
  }

  await ref.set({
    age: null,
    avatar: "",
    email: email,
    gender: "Prefer not to say",
    role: "user",
    username: usernameGuess,
    createdAt: FieldValue.serverTimestamp(),
    // updatedAt：由前端在“更新”时写入
  });

  logger.info("[ensureUserProfileOnSignup] created profile", {uid: uid});
  return null;
}

// v1：Auth 用户创建触发器（部署到 us-central1）
exports.ensureUserProfileOnSignup = functionsV1.auth.user().onCreate(async (user) => {
  return createUserProfileDoc(user);
});


/* ===================== 2) Normalize users/{uid} on any write ===================== */
/* - Remove disallowed keys
   - Coerce types / default values
   - Only patch when there are differences (avoid recursion)
   - Do NOT touch updatedAt here (frontend + rules enforce it) */
exports.normalizeUserProfileOnWrite = onDocumentWritten(
    {document: "users/{uid}"},
    async (event) => {
      const ok = event && event.data && event.data.after && event.data.after.exists;
      if (!ok) return null;

      const snap = event.data.after;
      const d = snap.data() || {};
      const patch = {};

      // 移除不允许字段
      Object.keys(d).forEach((k) => {
        if (ALLOWED_USER_KEYS.indexOf(k) === -1) {
          patch[k] = FieldValue.delete();
        }
      });

      // 类型/默认值修正（不改变 role 的值，只确保存在且为 string）
      if (!("age" in d) || (d.age !== null && typeof d.age !== "number")) patch.age = safeNumberOrNull(d.age);
      if (!("avatar" in d) || typeof d.avatar !== "string") patch.avatar = safeString(d.avatar, "");
      if (!("email" in d) || typeof d.email !== "string") patch.email = safeString(d.email, "");
      if (!("gender" in d) || typeof d.gender !== "string") patch.gender = safeString(d.gender, "Prefer not to say");
      if (!("role" in d) || typeof d.role !== "string") patch.role = "user";
      if (!("username" in d) || typeof d.username !== "string") patch.username = safeString(d.username, "");

      // 双保险：缺少 createdAt 时补上
      if (!("createdAt" in d)) patch.createdAt = FieldValue.serverTimestamp();

      if (Object.keys(patch).length === 0) {
        logger.debug("[normalizeUserProfileOnWrite] no change, skip");
        return null;
      }

      await snap.ref.update(patch);
      logger.info("[normalizeUserProfileOnWrite] patched", {uid: snap.id, patch: patch});
      return null;
    },
);


/* ===================== 3) Normalize notes on moodEntries write ===================== */
function normalizeNotes(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  // 拆句并保留终止符
  const parts = raw.split(/([.!?])\s+/).filter(Boolean);
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) {
    const s = (parts[i] || "").trim();
    const p = (parts[i + 1] || "").trim(); // ".", "!", "?" 或空
    if (!s) continue;
    const cap = s.charAt(0).toUpperCase() + s.slice(1);
    sentences.push(cap + (p || ""));
  }
  if (!sentences.length) return "";
  if (!/[.!?]$/.test(sentences[sentences.length - 1])) {
    sentences[sentences.length - 1] += ".";
  }
  return sentences.join(" ");
}

/* ---------- 修复点：create + update 都会规范化；仅有差异时写回 ---------- */
exports.formatMoodEntry = onDocumentWritten(
    {
      region: REGION,
      document: "users/{uid}/moodEntries/{entryId}",
    },
    async (event) => {
    // 兼容无可选链环境
      // eslint-disable-next-line max-len
      const afterExists = event && event.data && event.data.after && event.data.after.exists;
      if (!afterExists) return null;

      const afterSnap = event.data.after;
      const data = afterSnap.data() || {};
      const original = data.notes || "";
      const formatted = normalizeNotes(original);

      if (formatted === original) {
        logger.debug("[formatMoodEntry] no change, skip");
        return null;
      }

      await afterSnap.ref.update({
        notes: formatted,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("[formatMoodEntry] updated (normalized)");
      return null;
    },
);

/* ===================== 4) Callable: getMoodCount ===================== */
exports.getMoodCount = onCall({region: REGION}, async (request) => {
  const auth = request && request.auth;
  if (!auth) throw new Error("unauthenticated");

  const uid = auth.uid;
  const col = db.collection("users").doc(uid).collection("moodEntries");

  try {
    const agg = await col.count().get();
    const count = (agg && agg.data() && agg.data().count) || 0;
    logger.info("[getMoodCount] count()", count);
    return {count: count};
  } catch (e) {
    logger.warn("[getMoodCount] count() failed, fallback to get()", e);
    const snap = await col.get();
    return {count: snap.size};
  }
});

/* ===================== 5) callable: ensureUserProfile ===================== */
exports.ensureUserProfile = onCall(async (request) => {
  // 只能登录后调用
  if (!request || !request.auth) {
    throw new Error("unauthenticated");
  }

  const uid = request.auth.uid;
  const email = (request.auth.token && request.auth.token.email) || "";
  const usernameGuess = email ? email.split("@")[0] : uid;

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    return {ok: true, existed: true};
  }

  // 直接以管理员权限补建（不受 Firestore 规则限制）
  await ref.set({
    age: null,
    avatar: "",
    email: email,
    gender: "Prefer not to say",
    role: "user",
    username: usernameGuess,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {ok: true, existed: false};
});

exports.syncPostUpdatedAt = onDocumentWritten(
    {
      region: REGION,
      document: "posts/{postId}",
    },
    async (event) => {
      const after = event && event.data && event.data.after;
      if (!after || !after.exists) return null;

      const data = after.data();
      const ref = after.ref;

      // 如果没有 updatedAt，则添加
      if (!data.updatedAt) {
        await ref.update({updatedAt: FieldValue.serverTimestamp()});
      }
      return null;
    },
);

// 统计全站 posts 数量（允许未登录调用）
exports.getPostCount = onCall({region: REGION}, async (request) => {
  const col = db.collection("posts");
  try {
    // 优先使用 Firestore 聚合计数（计费更低、速度更快）
    const agg = await col.count().get();
    const count = agg.data().count || 0;
    logger.info("[getPostCount] count()", count);
    return {count};
  } catch (e) {
    logger.warn("[getPostCount] count() failed, fallback to get()", e);
    // 兜底：直接拉取（大数据量时会更慢、更贵，但保证可用）
    const snap = await col.get();
    return {count: snap.size};
  }
});

/* posts 初次写入后若缺失计数字段，填上默认值（稳健性） */
exports.ensurePostCounters = onDocumentWritten(
    {region: REGION, document: "posts/{postId}"},
    async (event) => {
      const after = event && event.data && event.data.after;
      if (!after || !after.exists) return null;
      const data = after.data();
      const patch = {};
      if (typeof data.likeCount !== "number") patch.likeCount = 0;
      if (typeof data.commentCount !== "number") patch.commentCount = 0;
      if (!data.updatedAt) patch.updatedAt = FieldValue.serverTimestamp();
      if (Object.keys(patch).length) {
        await after.ref.update(patch);
      }
      return null;
    },
);

/* 点赞 +1 */
exports.onLikeCreated = onDocumentCreated(
    {region: REGION, document: "posts/{postId}/likes/{uid}"},
    async (event) => {
      const postId = event.params.postId;
      await getFirestore().collection("posts").doc(postId).update({
        likeCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return null;
    },
);

/* 取消点赞 -1 */
exports.onLikeDeleted = onDocumentDeleted(
    {region: REGION, document: "posts/{postId}/likes/{uid}"},
    async (event) => {
      const postId = event.params.postId;
      await getFirestore().collection("posts").doc(postId).update({
        likeCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return null;
    },
);

/* 评论 +1 */
exports.onCommentCreated = onDocumentCreated(
    {region: REGION, document: "posts/{postId}/comments/{commentId}"},
    async (event) => {
      const postId = event.params.postId;
      await getFirestore().collection("posts").doc(postId).update({
        commentCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return null;
    },
);

/* 删除评论 -1 */
exports.onCommentDeleted = onDocumentDeleted(
    {region: REGION, document: "posts/{postId}/comments/{commentId}"},
    async (event) => {
      const postId = event.params.postId;
      await getFirestore().collection("posts").doc(postId).update({
        commentCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return null;
    },
);

// 删除帖子时，清理 Storage 里 posts/{uid}/{postId}/ 前缀下的所有文件
exports.cleanupPostImages = onDocumentDeleted(
    {region: REGION, document: "posts/{postId}"},
    async (event) => {
      const data = event.data && event.data.data();
      if (!data) return null;
      const uid = data.uid;
      const postId = event.params.postId;
      if (!uid || !postId) return null;

      const bucket = getStorage().bucket();
      const prefix = `posts/${uid}/${postId}/`;
      await bucket.deleteFiles({prefix}); // 递归删除此前缀下所有文件
      return null;
    },
);

/**
 * ===================== Mail Jobs (bulk email via SendGrid) =====================
 * 前置：
 *   firebase functions:secrets:set SENDGRID_API_KEY
 *   // 并在 SendGrid 完成 Single Sender 或域名认证；from.email 必须可用
 */
const {onDocumentCreated: onDocCreated} = require("firebase-functions/v2/firestore");
const {onCall: onHttpsCall} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const sgMail = require("@sendgrid/mail");

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// eslint-disable-next-line valid-jsdoc
/** 将 SendGrid 错误打印为可读日志 */
function logSendgridError(tag, err) {
  try {
    const status = (err && err.code) || (err && err.response && err.response.statusCode);
    const headers = err && err.response && err.response.headers;
    const body = err && err.response && err.response.body;
    const errors = (body && body.errors) || body || (err && err.message) || String(err);
    logger.error(`[${tag}] sendgrid error`, {status, headers, errors});
  } catch (e) {
    logger.error(`[${tag}] sendgrid error (fallback)`, {message: (err && err.message) || String(err)});
  }
}

/** 单封发送（含附件） */
async function sendOne({from, to, subject, html, text, attachments}) {
  const msg = {
    from,
    to,
    subject,
    html,
    text,
    attachments: (attachments || []).map((a) => ({
      content: a.contentBase64,
      filename: a.name,
      type: a.mimeType || "application/octet-stream",
      disposition: "attachment",
    })),
  };
  // 这里不要 try/catch，让上层统一处理并打印详细日志
  return sgMail.send(msg);
}

/** 触发新建的 mail_jobs */
exports.onMailJobCreated = onDocCreated(
    {
      region: REGION,
      document: "mail_jobs/{jobId}",
      secrets: [SENDGRID_API_KEY],
    },
    async (event) => {
      const snap = event.data;
      if (!snap || !snap.exists) return null;

      const ref = snap.ref;
      const job = snap.data() || {};
      if (job.status !== "queued") return null;

      // ---- 读取 Secret 并初始化 SendGrid ----
      const apiKey = SENDGRID_API_KEY.value();
      if (!apiKey) {
        logger.error("[mail job] no SENDGRID_API_KEY from secrets");
        await ref.update({
          status: "failed",
          error: "SENDGRID_API_KEY missing",
          finishedAt: FieldValue.serverTimestamp(),
        });
        return null;
      }
      // 同时写到 env，兼容某些库行为
      process.env.SENDGRID_API_KEY = apiKey;
      sgMail.setApiKey(apiKey);

      // ---- 基础校验 ----
      const recipients = Array.isArray(job.recipients) ? job.recipients : [];
      const subject = (job.subject || "").trim();
      const text = (job.text || "").trim();
      const html = (job.html || "").trim();
      const attachments = Array.isArray(job.attachments) ? job.attachments : [];

      if (recipients.length === 0) {
        await ref.update({
          status: "failed",
          error: "no recipients",
          finishedAt: FieldValue.serverTimestamp(),
        });
        return null;
      }
      if (!subject || (!text && !html)) {
        await ref.update({
          status: "failed",
          error: "missing subject or body",
          finishedAt: FieldValue.serverTimestamp(),
        });
        return null;
      }

      // 改成你在 SendGrid 验证过的发件邮箱（Single Sender 或域名认证）
      const from = {email: "zhaojunxiang6@gmail.com", name: "-COOH6"};

      try {
        await ref.update({
          "status": "running",
          "startedAt": FieldValue.serverTimestamp(),
          "stats.sent": 0,
          "stats.failed": 0,
        });

        let sent = 0;
        let failed = 0;

        // 基本速率限制：每批 100，每组并发 10，组间 sleep 250ms
        const batchSize = 100;
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);

          for (let j = 0; j < batch.length; j += 10) {
            const group = batch.slice(j, j + 10);
            await Promise.all(
                group.map(async (r) => {
                  try {
                    if (!r || !r.email) {
                      failed++;
                      return;
                    }
                    await sendOne({
                      from,
                      to: {email: r.email, name: r.name || ""},
                      subject,
                      html: html ? html.replace(/{{\s*username\s*}}/g, r.name || "there") : undefined,
                      text,
                      attachments,
                    });
                    sent++;
                  } catch (err) {
                    failed++;
                    logSendgridError("mail", err);
                  }
                }),
            );
            await new Promise((r) => setTimeout(r, 250));
          }

          await ref.update({"stats.sent": sent, "stats.failed": failed});
        }

        const finalStatus = failed === 0 ? "success" : sent > 0 ? "partial" : "failed";
        await ref.update({
          status: finalStatus,
          finishedAt: FieldValue.serverTimestamp(),
        });
        logger.info("[mail job] finished", {jobId: ref.id, sent, failed});
      } catch (err) {
        logSendgridError("mail job fatal", err);
        await ref.update({
          status: "failed",
          finishedAt: FieldValue.serverTimestamp(),
          error: (err && err.message) || String(err),
        });
      }

      return null;
    },
);

/** 可选：手动触发 */
exports.startMailJob = onHttpsCall(
    {region: REGION, secrets: [SENDGRID_API_KEY]},
    async (request) => {
      if (!request || !request.auth) throw new Error("unauthenticated");
      const {jobId} = request.data || {};
      if (!jobId) throw new Error("missing jobId");

      const ref = db.collection("mail_jobs").doc(jobId);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("job not found");
      const job = snap.data();

      if (job.status !== "queued") return {ok: true, status: job.status};
      // 让前端看到“排队中”并触发 onCreate/或手动扫描器
      await ref.update({status: "queued"});
      return {ok: true, status: "queued"};
    },
);

/**
 * ===================== AI Support Chat (OpenAI proxy) =====================
 * Callable function: aiSupportChat
 * - Auth required
 * - Uses Secret OPENAI_API_KEY
 * - Minimal per-user rate limit and input validation
 */

// 从 Secret 读取 API Key（先用 CLI 设置：firebase functions:secrets:set GEMINI_API_KEY）
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const {GoogleGenAI} = require("@google/genai");

// 将前端 history + prompt 组装为 SDK 所需 contents
function makeContents(prompt, history) {
  const arr = [];
  const h = Array.isArray(history) ? history : [];

  for (let i = 0; i < h.length; i++) {
    const m = h[i] || {};
    const role = (m.role === "user") ? "user" : "model"; // 只识别 user / model
    const text = String(m.text || "");
    arr.push({
      role: role,
      parts: [{text: text}],
    });
  }

  arr.push({
    role: "user",
    parts: [{text: String(prompt || "")}],
  });

  return arr;
}

// 调用一个模型
async function callModel(ai, modelName, contents) {
  // 等价于：await ai.models.generateContent({ model, contents })
  const resp = await ai.models.generateContent({
    model: modelName,
    contents: contents,
  });

  // SDK 提供 resp.text 取回拼接文本
  // 注意这里不使用可选链，做显式判断
  let out = "";
  try {
    if (resp && typeof resp.text === "function") {
      out = resp.text();
    } else if (resp && typeof resp.text === "string") {
      out = resp.text;
    }
  } catch (e) {
    // 如果上面抛异常，再尝试从 candidates 取
    out = "";
  }

  if (!out) {
    // 兜底：从 candidates 解析
    try {
      const cands = (resp && resp.response && resp.response.candidates) ? resp.response.candidates : [];
      if (cands && cands.length > 0) {
        const parts = cands[0].content && cands[0].content.parts ? cands[0].content.parts : [];
        const segs = [];
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p && typeof p.text === "string") segs.push(p.text);
        }
        out = segs.join("\n");
      }
    } catch (e2) {
      out = "";
    }
  }

  return String(out || "").trim();
}

// 云函数：httpsCallable('aiSupportChat')({ prompt, history })
exports.aiSupportChat = onCall(
    {region: REGION, secrets: [GEMINI_API_KEY]},
    async (request) => {
      try {
      // 取 key
        const apiKey = GEMINI_API_KEY.value();
        if (!apiKey) return {ok: false, error: "GEMINI_API_KEY missing"};

        // 取参数
        const data = request && request.data ? request.data : {};
        const prompt = data && data.prompt ? String(data.prompt) : "";
        const history = Array.isArray(data.history) ? data.history : [];
        if (!prompt || !prompt.trim()) return {ok: false, error: "missing prompt"};

        // 构造 contents
        const contents = makeContents(prompt, history);

        // 创建 SDK 客户端
        const ai = new GoogleGenAI({apiKey: apiKey});

        // 按顺序尝试模型（以官方示例为准）
        const models = ["gemini-2.0-flash", "gemini-2.5-flash"];
        let reply = "";
        const errs = [];

        for (let i = 0; i < models.length; i++) {
          const m = models[i];
          try {
            reply = await callModel(ai, m, contents);
            if (reply) {
              logger.info("[aiSupportChat] success with", m);
              break;
            }
          } catch (e) {
            const msg = e && e.message ? e.message : String(e);
            errs.push(m + ": " + msg);
            logger.warn("[aiSupportChat] model failed", m, msg);
          }
        }

        if (!reply) {
        // 所有模型都失败
          logger.error("[aiSupportChat] all models failed", errs);
          return {ok: false, error: "AI service unavailable", debug: errs};
        }

        // 简单清洗
        const safe = reply.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").trim();
        return {ok: true, reply: safe};
      } catch (e) {
        const msg = e && e.message ? e.message : "AI error";
        logger.error("[aiSupportChat] error", msg);
        return {ok: false, error: msg};
      }
    },
);


