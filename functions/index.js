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

// functions/index.js
// 运行环境：firebase-functions v4 / Node 18+

// ---- Admin 初始化（v12 模块化）----
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();

// ---- Functions v2 模块化 API ----
const {onCall} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

// 注意：改成你控制台里一致的区域
const REGION = "australia-southeast2";

/* ---------- 纯函数：规范化 notes ---------- */
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

/* ---------- 9.1: 可调用函数统计条数（原样保留） ---------- */
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

