<template>
  <div class="container py-4" style="max-width: 900px">
    <!-- Header: title + total + compose toggle -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h2 class="text-primary m-0 d-flex align-items-center gap-2">
        💬 Mood Space
        <span class="badge bg-primary-subtle text-primary" v-if="totalPosts !== null">
          Total: {{ totalPosts }}
        </span>
      </h2>

      <button
        v-if="me"
        class="btn btn-outline-primary d-flex align-items-center gap-2"
        @click="toggleComposer"
      >
        <i class="bi" :class="showComposer ? 'bi-x-lg' : 'bi-plus-lg'"></i>
        <span>{{ showComposer ? 'Close' : 'New post' }}</span>
      </button>
    </div>

    <!-- Composer (collapsible) -->
    <transition name="fade">
      <div v-if="me && showComposer" class="card shadow-sm border-0 mb-4">
        <div class="card-body">
          <div class="d-flex align-items-start gap-3">
            <img
              :src="me.avatar || defaultAvatar"
              class="rounded-circle"
              width="48"
              height="48"
              style="object-fit: cover"
              alt="avatar"
            />

            <div class="flex-grow-1">
              <textarea
                v-model="newPost"
                class="form-control mb-2"
                rows="3"
                placeholder="Share your mood..."
                maxlength="500"
              ></textarea>

              <div class="d-flex align-items-center gap-2 mb-3">
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  multiple
                  @change="onPickImages"
                  class="form-control form-control-sm"
                />
                <small class="text-muted">Up to 4 images (max 5MB each)</small>
              </div>

              <!-- Square preview grid (display only, not cropping) -->
              <div v-if="previews.length" class="square-grid mb-2">
                <div v-for="(p, idx) in previews" :key="idx" class="square-cell">
                  <img :src="p.src" class="square-img rounded" alt="preview"/>
                  <button
                    class="btn btn-sm btn-outline-danger remove-btn"
                    @click="removePreview(idx)"
                    title="Remove"
                  >×</button>

                  <div v-if="uploadProgress[idx] != null" class="progress mt-2">
                    <div
                      class="progress-bar"
                      role="progressbar"
                      :style="{ width: (uploadProgress[idx] || 0) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="text-end">
                <button class="btn btn-primary px-4" @click="submitPost" :disabled="postingDisabled">
                  {{ loading ? "Posting..." : "Post" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Posts -->
    <div v-for="post in posts" :key="post.id" class="card border-0 shadow-sm rounded-4 mb-3">
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

            <!-- Post images: square thumbs, click to view original -->
            <div v-if="(post.images?.length || 0) > 0" class="square-grid mb-2">
              <div
                v-for="(img, i) in post.images"
                :key="img.path + i"
                class="square-cell clickable"
                @click="openLightbox(post.images, i)"
              >
                <img :src="img.url" alt="post image" class="square-img rounded"/>
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
                        <strong class="me-2 clickable text-primary" @click="goToProfile(c.uid)">{{ c.username }}</strong>
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

    <div v-if="posts.length === 0" class="text-center text-muted mt-5">
      No posts yet. Share your mood! 🌱
    </div>

    <!-- Lightbox -->
    <div v-if="lightbox.open" class="lightbox" @click.self="closeLightbox">
      <button class="btn btn-light btn-sm close-lightbox" @click="closeLightbox" title="Close">✕</button>
      <img :src="lightbox.images[lightbox.index]?.url" class="lightbox-img" alt="full"/>
      <div class="lightbox-nav">
        <button class="btn btn-light btn-sm" @click.stop="prevLightbox" :disabled="lightbox.index <= 0">‹</button>
        <button class="btn btn-light btn-sm" @click.stop="nextLightbox" :disabled="lightbox.index >= lightbox.images.length - 1">›</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import { useRouter } from "vue-router"
import { auth, db, storage, functions } from "../firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, getDoc, setDoc, deleteDoc, updateDoc
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { ref as sRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"

/* user & list */
const router = useRouter()
const me = ref(null)
const posts = ref([])
const totalPosts = ref(null)
const newPost = ref("")
const loading = ref(false)
let unsubscribePosts = null

/* composer toggle */
const showComposer = ref(false)
function toggleComposer() { showComposer.value = !showComposer.value }

/* images preview */
const fileInput = ref(null)
const previews = ref([])       // [{ file, src }]
const uploadProgress = ref([]) // [0..100]

function onPickImages(e) {
  const files = Array.from(e.target.files || [])
  const existed = previews.value.length
  const allowed = Math.min(4 - existed, files.length)
  const selected = files.slice(0, allowed)
  selected.forEach((file) => {
    const src = URL.createObjectURL(file)
    previews.value.push({ file, src })
    uploadProgress.value.push(null)
  })
  e.target.value = ""
}
function removePreview(index) {
  const [p] = previews.value.splice(index, 1)
  if (p?.src) URL.revokeObjectURL(p.src)
  uploadProgress.value.splice(index, 1)
}
const postingDisabled = computed(() =>
  loading.value || (!newPost.value.trim() && previews.value.length === 0)
)

/* like state */
const likedSet = ref(new Set())
const likeBusy = ref(new Set())

/* comments */
const expandedPosts = ref(new Set())
const comments = ref({})
const commentInputOpen = ref({})
const commentDraft = ref({})
const commentSubs = {}

/* default avatar */
function svgDataUri(svg) { return "data:image/svg+xml;utf8," + encodeURIComponent(svg) }
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
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString()
}

/* routing to profile */
function goToProfile(uid) {
  if (!uid) return
  if (me.value && uid === me.value.uid) router.push("/profile")
  else router.push(`/profile?uid=${uid}`)
}

/* auth */
onAuthStateChanged(auth, async (u) => {
  if (!u) {
    me.value = null
    likedSet.value = new Set()
    return
  }
  const snap = await getDoc(doc(db, "users", u.uid))
  const data = snap.exists() ? snap.data() : {}
  me.value = { uid: u.uid, username: data.username || "User", avatar: data.avatar || "" }

  // ensure like state on first load
  await refreshLikedPosts()
})

/* submit post */
async function submitPost() {
  if (!me.value) return
  if (!newPost.value.trim() && previews.value.length === 0) return
  loading.value = true

  try {
    const docRef = await addDoc(collection(db, "posts"), {
      uid: me.value.uid,
      username: me.value.username,
      avatar: me.value.avatar || "",
      text: newPost.value.trim(),
      images: [],
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    })
    const pid = docRef.id

    const uploaded = []
    for (let i = 0; i < previews.value.length; i++) {
      const file = previews.value[i].file
      const safeName = `${Date.now()}_${i}_${file.name.replace(/\s+/g,'_')}`
      const path = `posts/${me.value.uid}/${pid}/${safeName}`
      const r = sRef(storage, path)

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(r, file)
        task.on('state_changed', (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          uploadProgress.value[i] = pct
        }, reject, async () => {
          const url = await getDownloadURL(task.snapshot.ref)
          uploaded.push({ url, path })
          resolve()
        })
      })
    }

    if (uploaded.length) {
      await updateDoc(doc(db, "posts", pid), {
        images: uploaded,
        updatedAt: serverTimestamp(),
      })
    }

    newPost.value = ""
    previews.value.forEach(p => p.src && URL.revokeObjectURL(p.src))
    previews.value = []
    uploadProgress.value = []
    showComposer.value = false
    fetchPostCount()
  } catch (e) {
    console.error("[submitPost]", e)
  } finally {
    loading.value = false
  }
}

/* like / unlike */
async function toggleLike(post) {
  if (!me.value) return
  const pid = post.id
  if (likeBusy.value.has(pid)) return
  likeBusy.value.add(pid)
  try {
    const likeRef = doc(db, "posts", pid, "likes", me.value.uid)
    if (likedSet.value.has(pid)) {
      await deleteDoc(likeRef)
      post.likeCount = Math.max(0, (post.likeCount || 0) - 1)
      const set = new Set(likedSet.value); set.delete(pid); likedSet.value = set
    } else {
      await setDoc(likeRef, { createdAt: serverTimestamp() })
      post.likeCount = (post.likeCount || 0) + 1
      const set = new Set(likedSet.value); set.add(pid); likedSet.value = set
    }
  } finally { likeBusy.value.delete(pid) }
}

/* comments */
function ensureCommentSub(pid, mode) {
  if (commentSubs[pid]?.mode === mode) return
  if (commentSubs[pid]?.unsub) { commentSubs[pid].unsub(); delete commentSubs[pid] }

  const base = collection(db, "posts", pid, "comments")
  const q = mode === "full"
    ? query(base, orderBy("createdAt", "desc"))
    : query(base, orderBy("createdAt", "desc"), limit(2))

  const unsub = onSnapshot(q, (snap) => {
    comments.value[pid] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
  commentSubs[pid] = { unsub, mode }
}
function toggleExpand(pid) {
  const expanded = expandedPosts.value.has(pid)
  const set = new Set(expandedPosts.value)
  if (expanded) { set.delete(pid); expandedPosts.value = set; ensureCommentSub(pid, "compact") }
  else { set.add(pid); expandedPosts.value = set; ensureCommentSub(pid, "full") }
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
  const post = posts.value.find(p => p.id === pid)
  if (post) post.commentCount = (post.commentCount || 0) + 1
}
async function deleteComment(pid, cid) {
  await deleteDoc(doc(db, "posts", pid, "comments", cid))
}
async function deletePost(pid) {
  await deleteDoc(doc(db, "posts", pid))
  if (commentSubs[pid]?.unsub) { commentSubs[pid].unsub(); delete commentSubs[pid] }
}

/* counts */
async function fetchPostCount() {
  try {
    const res = await httpsCallable(functions, "getPostCount")()
    totalPosts.value = res.data?.count ?? 0
  } catch { totalPosts.value = 0 }
}

/* subscribe posts */
onMounted(() => {
  const qPosts = query(collection(db, "posts"), orderBy("createdAt", "desc"))
  unsubscribePosts = onSnapshot(qPosts, async (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    posts.value = list

    // like state: refresh whenever posts list changes (and user is ready)
    if (me.value) await refreshLikedPosts()

    // comments subscriptions
    const currentIds = new Set(list.map(p => p.id))
    Object.keys(commentSubs).forEach(pid => {
      if (!currentIds.has(pid)) {
        commentSubs[pid]?.unsub && commentSubs[pid].unsub()
        delete commentSubs[pid]
        delete comments.value[pid]
        delete commentInputOpen.value[pid]
      }
    })
    for (const p of list) {
      if (expandedPosts.value.has(p.id)) ensureCommentSub(p.id, "full")
      else if ((p.commentCount || 0) > 0 || commentInputOpen.value[p.id]) ensureCommentSub(p.id, "compact")
      else {
        if (commentSubs[p.id]?.unsub) { commentSubs[p.id].unsub(); delete commentSubs[p.id] }
        delete comments.value[p.id]
      }
    }

    fetchPostCount()
  })
})
onBeforeUnmount(() => {
  if (unsubscribePosts) unsubscribePosts()
  Object.values(commentSubs).forEach(({unsub}) => unsub && unsub())
})

/* like state refresh */
async function refreshLikedPosts() {
  if (!me.value) return
  const list = posts.value
  const set = new Set()
  await Promise.all(list.map(async (p) => {
    try {
      const likeDoc = await getDoc(doc(db, "posts", p.id, "likes", me.value.uid))
      if (likeDoc.exists()) set.add(p.id)
    } catch {}
  }))
  likedSet.value = set
}

/* lightbox */
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
</script>

<style scoped>
/* fade for composer */
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease }
.fade-enter-from, .fade-leave-to { opacity: 0 }

/* clickable */
.clickable { cursor: pointer; transition: opacity .2s ease }
.clickable:hover { opacity: 0.8 }

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
.square-cell.clickable { cursor: zoom-in; }
.square-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}
.remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 0 8px;
  line-height: 1;
  border-radius: 999px;
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
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
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
