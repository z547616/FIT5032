<template>
  <div class="container py-4" style="max-width: 900px">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h2 class="text-primary m-0 d-flex align-items-center gap-2">
        🗂️ My Mood Space
      </h2>

      <!-- View mode toggle -->
      <div class="btn-group" role="group" aria-label="View mode">
        <input
          type="radio"
          class="btn-check"
          name="viewMode"
          id="vm-posts"
          autocomplete="off"
          value="posts"
          v-model="viewMode"
        />
        <label class="btn btn-outline-primary" for="vm-posts">My Posts</label>

        <input
          type="radio"
          class="btn-check"
          name="viewMode"
          id="vm-interactions"
          autocomplete="off"
          value="interactions"
          v-model="viewMode"
        />
        <label class="btn btn-outline-primary" for="vm-interactions">My Interactions</label>
      </div>
    </div>

    <!-- Search -->
    <div class="input-group mb-3">
      <span class="input-group-text"><i class="bi bi-search"></i></span>
      <input
        v-model.trim="search"
        type="text"
        class="form-control"
        placeholder="Search posts by keyword..."
      />
      <button v-if="search" class="btn btn-outline-secondary" @click="search = ''" title="Clear">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <!-- Info / errors -->
    <div v-if="infoMsg" class="alert alert-info py-2">{{ infoMsg }}</div>
    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>

    <!-- Posts list -->
    <div
      v-for="post in filteredPosts"
      :key="post.id"
      class="card border-0 shadow-sm rounded-4 mb-3"
    >
      <div class="card-body">
        <div class="d-flex gap-3">
          <!-- Clickable avatar -->
          <img
            :src="post.avatar || defaultAvatar"
            class="rounded-circle clickable"
            width="50"
            height="50"
            style="object-fit: cover"
            alt="avatar"
            @click="goToProfile(post.uid)"
          />
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <!-- Clickable username -->
              <h6 class="mb-0 fw-semibold text-primary clickable" @click="goToProfile(post.uid)">
                {{ post.username }}
              </h6>
              <small class="text-muted">{{ formatTime(post.createdAt) }}</small>
            </div>

            <p class="mb-2" v-if="post.text">{{ post.text }}</p>

            <!-- Post images -->
            <div v-if="(post.images?.length || 0) > 0" class="square-grid mb-2">
              <div
                v-for="(img, i) in post.images"
                :key="img.path + i"
                class="square-cell clickable"
                @click="openLightbox(post.images, i)"
              >
                <img :src="img.url" alt="post image" class="square-img rounded" />
              </div>
            </div>

            <!-- Actions -->
            <div class="d-flex align-items-center gap-3">
              <button
                class="btn btn-sm"
                :class="likedSet.has(post.id) ? 'btn-danger' : 'btn-outline-danger'"
                @click="toggleLike(post)"
                :disabled="likeBusy.has(post.id) || !me"
              >
                <i class="bi" :class="likedSet.has(post.id) ? 'bi-heart-fill' : 'bi-heart'"></i>
                <span class="ms-1">{{ post.likeCount || 0 }}</span>
              </button>

              <button
                class="btn btn-sm btn-outline-secondary"
                @click="toggleExpand(post.id)"
                :disabled="(comments[post.id]?.length || 0) <= 2 && (post.commentCount || 0) <= 2"
              >
                <i class="bi bi-chat-dots"></i>
                <span class="ms-1">{{ post.commentCount || 0 }}</span>
                <span class="ms-1" v-if="expandedPosts.has(post.id)">Hide comments</span>
                <span class="ms-1" v-else>View all comments</span>
              </button>

              <button
                class="btn btn-sm btn-outline-secondary"
                @click="toggleCommentInput(post.id)"
                :disabled="!me"
              >
                {{ commentInputOpen[post.id] ? "Cancel" : "Comment" }}
              </button>

              <button
                v-if="me && me.uid === post.uid"
                class="btn btn-sm btn-outline-danger ms-auto"
                @click="deletePost(post.id)"
              >
                Delete
              </button>
            </div>

            <!-- Comments -->
            <div class="mt-3">
              <!-- new comment -->
              <div v-if="me && commentInputOpen[post.id]" class="d-flex align-items-start gap-2 mb-2">
                <img
                  :src="me.avatar || defaultAvatar"
                  class="rounded-circle"
                  width="36"
                  height="36"
                  style="object-fit: cover"
                  alt="avatar"
                />
                <input
                  v-model="commentDraft[post.id]"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Write a comment..."
                  maxlength="400"
                  @keyup.enter="submitComment(post.id)"
                />
                <button class="btn btn-sm btn-primary" @click="submitComment(post.id)">Send</button>
              </div>

              <!-- list -->
              <div v-if="(comments[post.id]?.length || 0) > 0">
                <div
                  v-for="c in comments[post.id]"
                  :key="c.id"
                  class="d-flex align-items-start gap-2 py-2 border-top"
                >
                  <img
                    :src="c.avatar || defaultAvatar"
                    class="rounded-circle"
                    width="28"
                    height="28"
                    style="object-fit: cover"
                    alt="avatar"
                  />
                  <div class="flex-grow-1">
                    <div class="d-flex justify-content-between">
                      <div>
                        <strong class="me-2 clickable text-primary" @click="goToProfile(c.uid)">{{
                          c.username
                        }}</strong>
                        <small class="text-muted">{{ formatTime(c.createdAt) }}</small>
                      </div>
                      <button
                        v-if="me && me.uid === c.uid"
                        class="btn btn-sm btn-link text-danger"
                        @click="deleteComment(post.id, c.id)"
                      >
                        Delete
                      </button>
                    </div>
                    <div>{{ c.text }}</div>
                  </div>
                </div>
              </div>

              <div v-else class="text-muted small">No comments yet.</div>
            </div>
            <!-- /Comments -->
          </div>
        </div>
      </div>
    </div>

    <div v-if="filteredPosts.length === 0" class="text-center text-muted mt-5">
      No posts found.
    </div>

    <!-- Lightbox -->
    <div v-if="lightbox.open" class="lightbox" @click.self="closeLightbox">
      <button class="btn btn-light btn-sm close-lightbox" @click="closeLightbox" title="Close">✕</button>
      <img :src="lightbox.images[lightbox.index]?.url" class="lightbox-img" alt="full" />
      <div class="lightbox-nav">
        <button class="btn btn-light btn-sm" @click.stop="prevLightbox" :disabled="lightbox.index <= 0">‹</button>
        <button
          class="btn btn-light btn-sm"
          @click.stop="nextLightbox"
          :disabled="lightbox.index >= lightbox.images.length - 1"
        >
          ›
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue"
import { useRouter } from "vue-router"
import { auth, db } from "../firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  collectionGroup,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  limit,
  orderBy,
} from "firebase/firestore"

const router = useRouter()

/* ---------- state ---------- */
const me = ref(null)
const viewMode = ref("posts") // "posts" | "interactions"
const search = ref("")
const infoMsg = ref("")
const errorMsg = ref("")

const posts = ref([]) // 当前模式下展示的帖子列表（实时）
let unsubMain = null // 主订阅（我的帖子）
const postSubs = {} // 多帖子的独立订阅（交互模式）
const commentSubs = {} // 每个帖子的评论订阅

/* like & comments state */
const likedSet = ref(new Set())
const likeBusy = ref(new Set())
const expandedPosts = ref(new Set())
const comments = ref({}) // { [postId]: null(加载中) | [] | [comment,...] }
const commentInputOpen = ref({})
const commentDraft = ref({})

/* default avatar */
function svgDataUri(svg) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg)
}
const defaultAvatar = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#4facfe"/><stop offset="1" stop-color="#00f2fe"/></linearGradient></defs>
  <circle cx="64" cy="64" r="64" fill="url(#g)"/>
  <path fill="#fff" d="M64 72a24 24 0 1 0 0-48 24 24 0 0 0 0 48zm0 12c-20 0-36 12-36 24v8h72v-8c0-12-16-24-36-24z"/>
</svg>
`)

/* utils */
function formatTime(ts) {
  if (!ts) return ""
  const d = ts && ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString()
}
function goToProfile(uid) {
  if (!uid) return
  if (me.value && uid === me.value.uid) router.push("/profile")
  else router.push(`/profile?uid=${uid}`)
}

/* ---------- 防抖工具（用于 likes 刷新） ---------- */
function debounce(fn, ms) {
  let t = null
  return function () {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(), ms)
  }
}
const refreshLikedPostsDebounced = debounce(() => {
  refreshLikedPosts().catch(() => {})
}, 80)

/* ---------- Comments subscription helpers（三态加载） ---------- */
function ensureCommentSub(pid, mode = "compact") {
  if (commentSubs[pid]?.mode === mode) return
  if (commentSubs[pid]?.unsub) {
    commentSubs[pid].unsub()
    delete commentSubs[pid]
  }

  comments.value[pid] = null

  const base = collection(db, "posts", pid, "comments")
  const qRef =
    mode === "full" ? query(base, orderBy("createdAt", "desc")) : query(base, orderBy("createdAt", "desc"), limit(2))

  const unsub = onSnapshot(
    qRef,
    (snap) => {
      comments.value[pid] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    },
    (err) => {
      console.warn("[comments onSnapshot]", pid, err)
      comments.value[pid] = [] // 出错时不要卡在“加载中”
    }
  )

  commentSubs[pid] = { unsub, mode }
}

function toggleExpand(pid) {
  const expanded = expandedPosts.value.has(pid)
  const set = new Set(expandedPosts.value)
  if (expanded) {
    set.delete(pid)
    expandedPosts.value = set
    ensureCommentSub(pid, "compact")
  } else {
    set.add(pid)
    expandedPosts.value = set
    ensureCommentSub(pid, "full")
  }
}

function toggleCommentInput(pid) {
  commentInputOpen.value[pid] = !commentInputOpen.value[pid]
  ensureCommentSub(pid, expandedPosts.value.has(pid) ? "full" : "compact")
}

async function submitComment(pid) {
  if (!me.value) return
  const text = (commentDraft.value[pid] || "").trim()
  if (!text) return
  await addDoc(collection(db, "posts", pid, "comments"), {
    uid: me.value.uid,
    username: me.value.username,
    avatar: me.value.avatar || "",
    text,
    createdAt: serverTimestamp(),
  })
  commentDraft.value[pid] = ""
  commentInputOpen.value[pid] = false
}

async function deleteComment(pid, cid) {
  await deleteDoc(doc(db, "posts", pid, "comments", cid))
}

/* ---------- Likes ---------- */
async function refreshLikedPosts() {
  if (!me.value) return
  const next = new Set(likedSet.value)
  // 遍历当前已展示帖子，检查自己是否点过赞
  await Promise.all(
    posts.value.map(async (p) => {
      try {
        const likeDoc = await getDoc(doc(db, "posts", p.id, "likes", me.value.uid))
        if (likeDoc.exists()) next.add(p.id)
        else next.delete(p.id)
      } catch {
        // ignore
      }
    })
  )
  likedSet.value = next
}

async function toggleLike(post) {
  if (!me.value) return
  const pid = post.id
  if (likeBusy.value.has(pid)) return
  likeBusy.value.add(pid)
  try {
    const likeRef = doc(db, "posts", pid, "likes", me.value.uid)
    if (likedSet.value.has(pid)) {
      // 取消点赞
      await deleteDoc(likeRef)
      post.likeCount = Math.max(0, (post.likeCount || 0) - 1)
      const set2 = new Set(likedSet.value)
      set2.delete(pid)
      likedSet.value = set2
    } else {
      // 点赞（带 uid + createdAt，便于 collectionGroup）
      await setDoc(likeRef, { uid: me.value.uid, createdAt: serverTimestamp() })
      post.likeCount = (post.likeCount || 0) + 1
      const set2 = new Set(likedSet.value)
      set2.add(pid)
      likedSet.value = set2
    }
  } finally {
    likeBusy.value.delete(pid)
  }
}

/* ---------- Loaders ---------- */
function clearAllPostSubs() {
  if (typeof unsubMain === "function") {
    unsubMain()
    unsubMain = null
  }
  Object.values(postSubs).forEach(({ unsub }) => unsub && unsub())
  for (const k of Object.keys(postSubs)) delete postSubs[k]

  Object.values(commentSubs).forEach(({ unsub }) => unsub && unsub())
  for (const k of Object.keys(commentSubs)) delete commentSubs[k]

  comments.value = {}
  expandedPosts.value = new Set()
  commentInputOpen.value = {}
}

function loadMyPosts() {
  clearAllPostSubs()
  infoMsg.value = ""
  errorMsg.value = ""

  try {
    const qRef = query(collection(db, "posts"), where("uid", "==", me.value.uid))
    unsubMain = onSnapshot(
      qRef,
      async (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0))
        posts.value = list

        await refreshLikedPosts()

        posts.value.forEach((p) => {
          if ((p.commentCount || 0) > 0) ensureCommentSub(p.id, "compact")
        })
      },
      (err) => {
        console.error("[MyPosts] onSnapshot error:", err)
        errorMsg.value = "Failed to load your posts."
      }
    )
  } catch (e) {
    console.error("[MyPosts] query error:", e)
    errorMsg.value = "Failed to load your posts."
  }
}

// —— 交互模式（likes + comments）——
async function loadMyInteractions() {
  clearAllPostSubs()
  infoMsg.value = "Loading interactions..."
  errorMsg.value = ""

  // 等待 me.uid
  if (!me.value || !me.value.uid) {
    for (let i = 0; i < 10 && !(me.value && me.value.uid); i++) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (!me.value || !me.value.uid) {
      errorMsg.value = "Please sign in first."
      infoMsg.value = ""
      return
    }
  }
  const uid = me.value.uid

  const buildLivePostSubs = (ids) => {
    const map = {}
    ids.forEach((id) => {
      const ref = doc(db, "posts", id)
      const unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
          delete map[id]
          syncPostsFromMap(map)
          // 帖子减少也刷新一次点赞状态
          refreshLikedPostsDebounced()
          return
        }
        const data = snap.data()
        const model = { id: snap.id, ...data }
        map[id] = model
        syncPostsFromMap(map)

        // 点赞状态：每次有帖子快照到达/更新，都轻量刷新
        refreshLikedPostsDebounced()

        // 评论订阅
        if ((data && data.commentCount ? data.commentCount : 0) > 0) {
          ensureCommentSub(snap.id, "compact")
        }
      })
      postSubs[id] = { unsub }
      map[id] = map[id] || null
    })
    syncPostsFromMap(map)
    // 初始也安排一次防抖刷新（应对首次 ids 填充）
    refreshLikedPostsDebounced()
  }

  async function runCgQueries({ withOrderBy }) {
    let likesSnap, commentsSnap
    if (withOrderBy) {
      likesSnap = await getDocs(
        query(collectionGroup(db, "likes"), where("uid", "==", uid), orderBy("createdAt", "desc"))
      )
      commentsSnap = await getDocs(
        query(collectionGroup(db, "comments"), where("uid", "==", uid), orderBy("createdAt", "desc"))
      )
    } else {
      likesSnap = await getDocs(query(collectionGroup(db, "likes"), where("uid", "==", uid)))
      commentsSnap = await getDocs(query(collectionGroup(db, "comments"), where("uid", "==", uid)))
    }

    const likedDocs = likesSnap.docs
    const commentDocs = commentsSnap.docs

    const seen = new Set()
    const merged = []
    for (const d of likedDocs) {
      const parent = d.ref.parent ? d.ref.parent.parent : null
      const id = parent ? parent.id : null
      if (id && !seen.has(id)) {
        seen.add(id)
        merged.push(id)
      }
    }
    for (const d of commentDocs) {
      const parent = d.ref.parent ? d.ref.parent.parent : null
      const id = parent ? parent.id : null
      if (id && !seen.has(id)) {
        seen.add(id)
        merged.push(id)
      }
    }
    return merged
  }

  try {
    let ids
    try {
      ids = await runCgQueries({ withOrderBy: true })
    } catch (e1) {
      console.warn("[MyInteractions] with orderBy failed:", e1)
      const code = e1 && e1.code ? e1.code : e1 && e1.name ? e1.name : ""
      const linkMatch = String(e1 && e1.message ? e1.message : "").match(/https?:\/\/\S+/)
      const link = linkMatch ? linkMatch[0] : ""

      if (code === "failed-precondition" || /index/i.test(String(e1))) {
        ids = await runCgQueries({ withOrderBy: false })
        errorMsg.value = link
          ? `Interactions loaded without ordering. Create/verify composite index: ${link}`
          : "Interactions loaded without ordering. Please verify composite indexes: likes(uid asc, createdAt desc) & comments(uid asc, createdAt desc)."
      } else {
        throw e1
      }
    }

    if (!ids || ids.length === 0) {
      posts.value = []
      infoMsg.value = ""
      return
    }

    buildLivePostSubs(ids)
    // 不立即 await refreshLikedPosts()，而是交给防抖在快照陆续到达后刷新

    infoMsg.value = ""
  } catch (e) {
    console.error("[MyInteractions] load error:", e)
    const linkMatch = String(e && e.message ? e.message : "").match(/https?:\/\/\S+/)
    const link = linkMatch ? linkMatch[0] : ""
    errorMsg.value = link
      ? `Failed to load interactions. Create the exact composite index here: ${link}`
      : "Failed to load interactions. Check auth readiness, rules, and composite indexes (likes: uid asc + createdAt desc; comments: uid asc + createdAt desc)."
  } finally {
    infoMsg.value = ""
  }
}

function syncPostsFromMap(map) {
  const list = Object.values(map).filter(Boolean)
  list.sort(
    (a, b) =>
      (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) -
      (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0)
  )
  posts.value = list
}

/* ---------- delete post ---------- */
async function deletePost(pid) {
  await deleteDoc(doc(db, "posts", pid))
  if (commentSubs[pid]?.unsub) {
    commentSubs[pid].unsub()
    delete commentSubs[pid]
  }
}

/* ---------- Lightbox ---------- */
const lightbox = ref({ open: false, images: [], index: 0 })
function openLightbox(images, index) {
  lightbox.value = { open: true, images, index }
}
function closeLightbox() {
  lightbox.value.open = false
  lightbox.value.images = []
  lightbox.value.index = 0
}
function prevLightbox() {
  if (lightbox.value.index > 0) lightbox.value.index--
}
function nextLightbox() {
  if (lightbox.value.index < lightbox.value.images.length - 1) lightbox.value.index++
}

/* ---------- Search filter ---------- */
const filteredPosts = computed(() => {
  const q = (search.value || "").toLowerCase()
  if (!q) return posts.value
  return posts.value.filter((p) => {
    const t = (p.text || "").toLowerCase()
    const u = (p.username || "").toLowerCase()
    const cs = (comments.value[p.id] || [])
      .slice(0, 2)
      .map((c) => (c.text || "").toLowerCase())
      .join(" ")
    return t.includes(q) || u.includes(q) || cs.includes(q)
  })
})

/* ---------- auth & lifecycle ---------- */
onMounted(() => {
  onAuthStateChanged(auth, async (u) => {
    clearAllPostSubs()
    likedSet.value = new Set()

    if (!u) {
      me.value = null
      posts.value = []
      infoMsg.value = "Please sign in."
      return
    }
    const snap = await getDoc(doc(db, "users", u.uid))
    const data = snap.exists() ? snap.data() : {}
    me.value = { uid: u.uid, username: data.username || "User", avatar: data.avatar || "" }

    if (viewMode.value === "posts") loadMyPosts()
    else loadMyInteractions()
  })
})
onBeforeUnmount(() => clearAllPostSubs())

watch(viewMode, (m) => {
  if (!me.value) return
  if (m === "posts") loadMyPosts()
  else loadMyInteractions()
})
</script>

<style scoped>
/* clickable */
.clickable {
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.clickable:hover {
  opacity: 0.8;
}

/* square thumbs (display only, keep aspect) */
.square-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.square-cell {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f4f6f8;
  border-radius: 8px;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.square-cell.clickable {
  cursor: zoom-in;
}
.square-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

/* lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(2px);
  z-index: 2050;
  display: grid;
  place-items: center;
}
.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  background: #fff;
}
.close-lightbox {
  position: absolute;
  top: 16px;
  right: 16px;
}
.lightbox-nav {
  position: absolute;
  bottom: 24px;
  display: flex;
  gap: 8px;
}
</style>
