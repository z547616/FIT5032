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
const db = getFirestore();

/* ===================== Firebase Functions v2 ===================== */
const {setGlobalOptions} = require("firebase-functions/v2");
const {onCall} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
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
