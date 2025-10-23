<template>
  <div class="container py-5" style="max-width: 780px">
    <div class="card shadow-sm border-0 rounded-4">
      <div class="card-body p-4">
        <div class="d-flex align-items-center justify-content-between mb-4">
          <h3 class="mb-0 text-primary">
            {{ isSelf ? "My Profile" : "User Profile" }}
          </h3>

          <!-- Save (self only) -->
          <button v-if="isSelf" class="btn btn-primary" :disabled="saving || !isDirty" @click="saveProfile"
            title="Save changes">
            {{ saving ? "Saving..." : "Save" }}
          </button>
        </div>

        <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
        <div v-if="success" class="alert alert-success py-2">{{ success }}</div>

        <div class="row g-4">
          <!-- Avatar -->
          <div class="col-md-4">
            <div class="text-center">
              <img :src="avatarPreview || profile.avatar || defaultAvatar" alt="avatar"
                class="rounded-circle shadow-sm clickable" width="140" height="140" style="object-fit: cover"
                @click="openLightbox(profile.avatar || defaultAvatar)" />
              <div class="mt-3 d-grid gap-2" v-if="isSelf">
                <label class="btn btn-outline-secondary mb-0">
                  <input type="file" accept="image/*" class="d-none" @change="onPickAvatar" />
                  Choose Avatar
                </label>
                <button class="btn btn-outline-danger" @click="removeAvatar"
                  :disabled="(!profile.avatar && !avatarPreview) || uploading">
                  Remove
                </button>
              </div>
              <div v-if="uploading" class="small text-muted mt-2">
                Uploading… {{ uploadProgress }}%
              </div>
            </div>
          </div>

          <!-- Editable fields -->
          <div class="col-md-8">
            <div class="row g-3">
              <!-- Username -->
              <div class="col-12">
                <label class="form-label fw-semibold">Username</label>
                <input :value="isSelf ? draft.username : profile.username"
                  @input="isSelf && (draft.username = $event.target.value)" type="text" class="form-control"
                  maxlength="20" placeholder="Your display name" :readonly="!isSelf" />
                <!-- 仅自己时显示提示语 -->
                <div class="form-text" v-if="isSelf">
                  Max 20 chars. Letters, digits, spaces, - _ . only.
                </div>
              </div>

              <!-- Gender -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Gender</label>
                <select class="form-select" :value="isSelf ? draft.gender : profile.gender"
                  @change="isSelf && (draft.gender = $event.target.value)" :disabled="!isSelf">
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                  <option>Prefer not to say</option>
                </select>
              </div>

              <!-- Age -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Age</label>
                <input :value="isSelf ? draft.age : profile.age"
                  @input="isSelf && (draft.age = Number($event.target.value))" type="number" class="form-control"
                  min="1" max="120" placeholder="Age" :readonly="!isSelf" />
              </div>

              <hr class="mt-3 mb-2" />

              <!-- Readonly -->
              <div class="col-md-6">
                <label class="form-label fw-semibold">Email</label>
                <input :value="profile.email" type="email" class="form-control" disabled />
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">Role</label>
                <input :value="profile.role" type="text" class="form-control" disabled />
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">Created At</label>
                <input :value="formatTs(profile.createdAt)" type="text" class="form-control" disabled />
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">Updated At</label>
                <input :value="formatTs(profile.updatedAt)" type="text" class="form-control" disabled />
              </div>
            </div>
          </div>

        </div>

        <!-- Footer buttons (self only) -->
        <div class="d-flex justify-content-end mt-4 gap-2" v-if="isSelf">
          <button class="btn btn-outline-secondary" :disabled="!isDirty || saving" @click="resetDraft">
            Reset
          </button>
          <button class="btn btn-primary" :disabled="saving || !isDirty" @click="saveProfile">
            {{ saving ? "Saving..." : "Save Changes" }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Cropper dialog (vue-advanced-cropper) -->
  <div v-if="isSelf && showCropper" class="vac-backdrop">
    <div class="vac-modal card shadow-lg">
      <div class="card-header d-flex align-items-center justify-content-between">
        <span class="fw-semibold">Crop your avatar (1:1)</span>
        <button class="btn btn-sm btn-outline-secondary" @click="cancelCrop" :disabled="cropping">Cancel</button>
      </div>

      <div class="card-body">
        <Cropper ref="cropperRef" class="vac-cropper" :src="cropperSrc" :stencil-component="RectangleStencil"
          :stencil-props="{ aspectRatio: 1 }" :auto-zoom="false" :transitions="false" :image-restriction="'fit-area'" />
      </div>

      <div class="card-footer d-flex justify-content-end gap-2">
        <button class="btn btn-primary" @click="confirmCrop" :disabled="cropping">
          {{ cropping ? "Processing..." : "Use this image" }}
        </button>
      </div>
    </div>
  </div>

  <!-- Lightbox for avatar preview -->
  <div v-if="lightbox.open" class="lightbox" @click.self="closeLightbox">
    <button class="btn btn-light btn-sm close-lightbox" @click="closeLightbox">✕</button>
    <img :src="lightbox.src" class="lightbox-img" alt="avatar full" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue"
import { useRoute } from "vue-router"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db, storage } from "../firebase"
import { doc, updateDoc, serverTimestamp, onSnapshot, getDoc } from "firebase/firestore"
import { ref as sRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { sanitizeInput } from "../utils/sanitize.js"

// Vue Advanced Cropper
import { Cropper, RectangleStencil } from "vue-advanced-cropper"
import "vue-advanced-cropper/dist/style.css"

/* ---------- state ---------- */
const route = useRoute()

const meUid = ref(null)          // 当前登录用户
const viewingUid = ref(null)     // 正在查看的用户（可为他人）
const isSelf = computed(() => meUid.value && viewingUid.value === meUid.value)

const profile = ref({
  email: "", role: "user", username: "", gender: "Prefer not to say",
  age: null, avatar: "", createdAt: null, updatedAt: null
})
const draft = ref({ username: "", gender: "Prefer not to say", age: null })
const saving = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const error = ref("")
const success = ref("")
const avatarPreview = ref("")
const avatarRemoved = ref(false)

/* cropper state */
const showCropper = ref(false)
const cropperSrc = ref(null)   // object URL
const cropperRef = ref(null)
const cropping = ref(false)

let unsubscribeUserDoc = null

/* ---------- default avatar (ASCII-only to keep btoa safe) ---------- */
const defaultAvatar = `data:image/svg+xml;base64,${btoa(`
<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='#4facfe'/><stop offset='1' stop-color='#00f2fe'/></linearGradient></defs>
  <circle cx='64' cy='64' r='64' fill='url(#g)'/>
  <path fill='#fff' d='M64 72a24 24 0 1 0 0-48 24 24 0 0 0 0 48zm0 12c-20 0-36 12-36 24v8h72v-8c0-12-16-24-36-24z'/>
</svg>
`)}`

/* ---------- helpers ---------- */
function formatTs(ts) {
  try {
    if (!ts) return ""
    if (typeof ts.toDate === "function") return ts.toDate().toLocaleString()
    const d = ts instanceof Date ? ts : new Date(ts)
    return isNaN(d.getTime()) ? "" : d.toLocaleString()
  } catch { return "" }
}
function clampAge(n) {
  const x = Number(n); if (!Number.isFinite(x)) return null
  return Math.min(120, Math.max(1, Math.round(x)))
}
function cleanUsername(s) {
  let t = sanitizeInput(String(s || ""), 20)
  return t.replace(/[^a-zA-Z0-9 _.-]/g, "").trim()
}

/* dirty 判定 */
const avatarChanged = computed(() =>
  (avatarRemoved.value && !!profile.value.avatar) ||
  (!!avatarPreview.value && avatarPreview.value !== profile.value.avatar)
)
const isDirty = computed(() => {
  if (!isSelf.value) return false
  const nameChanged = cleanUsername(draft.value.username) !== (profile.value.username || "")
  const genderChanged = (draft.value.gender || "") !== (profile.value.gender || "Prefer not to say")
  const ageChanged = (clampAge(draft.value.age) ?? null) !== (profile.value.age ?? null)
  return nameChanged || genderChanged || ageChanged || avatarChanged.value
})

/* ---------- Firestore realtime ---------- */
function startUserDocListener(userId) {
  stopUserDocListener()
  const refUser = doc(db, "users", userId)
  unsubscribeUserDoc = onSnapshot(
    refUser,
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) return
      const d = snap.data({ serverTimestamps: "estimate" })
      profile.value = {
        email: d.email || "", role: d.role || "user",
        username: d.username || "", gender: d.gender || "Prefer not to say",
        age: typeof d.age === "number" ? d.age : null,
        avatar: d.avatar || "", createdAt: d.createdAt || null, updatedAt: d.updatedAt || null
      }
      // 仅在自己查看且非保存过程中同步草稿
      if (isSelf.value && !saving.value) {
        draft.value.username = profile.value.username
        draft.value.gender = profile.value.gender
        draft.value.age = profile.value.age
      }
      // 如果刚上传的预览已被后端文档采纳，清空预览
      if (avatarPreview.value && d.avatar === avatarPreview.value) {
        avatarPreview.value = ""
      }
    }
  )
}
function stopUserDocListener() {
  if (typeof unsubscribeUserDoc === "function") {
    unsubscribeUserDoc()
    unsubscribeUserDoc = null
  }
}

/* ---------- resolve viewing uid ---------- */
async function resolveViewingUidAndLoad() {
  // 优先 ?uid=，否则自己的 uid
  const q = typeof route.query.uid === "string" && route.query.uid.trim()
    ? route.query.uid
    : meUid.value
  if (!q) return
  viewingUid.value = q

  // 初始加载一次数据（便于更快显示），随后开启订阅
  try {
    const snap = await getDoc(doc(db, "users", q))
    if (snap.exists()) {
      const d = snap.data()
      profile.value = {
        email: d.email || "", role: d.role || "user",
        username: d.username || "", gender: d.gender || "Prefer not to say",
        age: typeof d.age === "number" ? d.age : null,
        avatar: d.avatar || "", createdAt: d.createdAt || null, updatedAt: d.updatedAt || null
      }
      if (isSelf.value) {
        draft.value.username = profile.value.username
        draft.value.gender = profile.value.gender
        draft.value.age = profile.value.age
      }
    }
  } catch { }
  startUserDocListener(q)
}

/* ---------- avatar select / crop (self only) ---------- */
function onPickAvatar(e) {
  if (!isSelf.value) return
  const file = e.target?.files?.[0]
  if (!file) return
  error.value = ""; success.value = ""

  if (!file.type.startsWith("image/")) { error.value = "Please choose an image file."; return }
  if (file.size > 10 * 1024 * 1024) { error.value = "Image is too large (max 10MB)."; return }
  if (!meUid.value) { error.value = "Not signed in."; return }

  if (cropperSrc.value) URL.revokeObjectURL(cropperSrc.value)
  cropperSrc.value = URL.createObjectURL(file)
  showCropper.value = true

  if (e.target) e.target.value = ""
}

function cancelCrop() {
  if (cropperSrc.value) URL.revokeObjectURL(cropperSrc.value)
  cropperSrc.value = null
  showCropper.value = false
}

async function confirmCrop() {
  if (!isSelf.value || !cropperRef.value) return
  cropping.value = true
  try {
    const result = cropperRef.value.getResult()
    const canvas = result && result.canvas
    if (!canvas) throw new Error("Crop failed.")

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92))
    if (!blob) throw new Error("Blob creation failed.")

    const path = `avatars/${meUid.value}/avatar.jpg`
    const storageRef = sRef(storage, path)
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: "image/jpeg",
      cacheControl: "public, max-age=86400",
    })

    uploading.value = true
    uploadProgress.value = 0
    await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => { uploadProgress.value = Math.round((snap.bytesTransferred / snap.totalBytes) * 100) },
        (err) => reject(err),
        () => resolve()
      )
    })

    const url = await getDownloadURL(task.snapshot.ref)

    // ✅ 立即写回 Firestore，让 Navbar / 其它订阅立刻更新
    await updateDoc(doc(db, "users", meUid.value), {
      avatar: url,
      updatedAt: serverTimestamp(),
    })

    // 本地也先用新地址
    profile.value.avatar = url
    avatarPreview.value = ""
    avatarRemoved.value = false
    success.value = "Avatar updated."
  } catch (err) {
    console.error("[crop/upload] error:", err)
    error.value = err?.message || "Upload failed."
  } finally {
    uploading.value = false
    cropping.value = false
    cancelCrop()
  }
}

/* ---------- remove & save ---------- */
function removeAvatar() {
  if (!isSelf.value) return
  avatarPreview.value = ""
  avatarRemoved.value = true
}
async function saveProfile() {
  if (!isSelf.value) return
  error.value = ""; success.value = ""
  if (!meUid.value) { error.value = "Not signed in."; return }

  const patch = {}
  const cleanedName = cleanUsername(draft.value.username)
  const cleanedAge = clampAge(draft.value.age)
  const allowedGenders = ["Male", "Female", "Other", "Prefer not to say"]
  const cleanedGender = allowedGenders.includes(draft.value.gender) ? draft.value.gender : "Prefer not to say"

  if (cleanedName !== (profile.value.username || "")) patch.username = cleanedName
  if ((cleanedAge ?? null) !== (profile.value.age ?? null)) patch.age = cleanedAge ?? null
  if (cleanedGender !== (profile.value.gender || "Prefer not to say")) patch.gender = cleanedGender
  if (avatarRemoved.value && profile.value.avatar) {
    patch.avatar = ""
  } else if (avatarPreview.value && avatarPreview.value !== profile.value.avatar) {
    patch.avatar = avatarPreview.value
  }
  if (Object.keys(patch).length === 0) { success.value = "Nothing to save."; return }

  patch.updatedAt = serverTimestamp()
  saving.value = true
  try {
    await updateDoc(doc(db, "users", meUid.value), patch)
    profile.value.updatedAt = new Date() // optimistic
    success.value = "Profile updated."
    // 如果保存时带了 avatarPreview，则清空它
    if (patch.avatar) avatarPreview.value = ""
    avatarRemoved.value = false
  } catch (e) {
    console.error(e)
    error.value = e?.message || "Failed to update profile."
  } finally {
    saving.value = false
  }
}

function resetDraft() {
  if (!isSelf.value) return
  draft.value.username = profile.value.username
  draft.value.gender = profile.value.gender
  draft.value.age = profile.value.age
  avatarPreview.value = ""
  avatarRemoved.value = false
  success.value = ""
  error.value = ""
}

/* ---------- auth & route ---------- */
onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    stopUserDocListener()
    meUid.value = user ? user.uid : null
    await resolveViewingUidAndLoad()
  })
})

// 当 ?uid= 变化时，切换查看对象
watch(() => route.query.uid, async () => {
  await resolveViewingUidAndLoad()
})

onBeforeUnmount(() => {
  stopUserDocListener()
})

/* ---------- Lightbox ---------- */
const lightbox = ref({ open: false, src: "" })
function openLightbox(src) {
  lightbox.value = { open: true, src }
}
function closeLightbox() {
  lightbox.value = { open: false, src: "" }
}
</script>

<style scoped>
.clickable {
  cursor: pointer;
  transition: opacity .2s ease
}

.clickable:hover {
  opacity: 0.85
}

/* 裁剪弹窗：遮罩半透明；内容白底居中 */
.vac-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, .55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.vac-modal {
  width: min(92vw, 860px);
  background: #fff;
  border-radius: 12px;
}

.vac-modal .card,
.vac-modal .card-header,
.vac-modal .card-body,
.vac-modal .card-footer {
  background: #fff !important;
  border: 0;
}

/* 裁剪区域：初始完整显示图片（fit-area），由组件处理缩放 */
.vac-cropper {
  width: 100%;
  height: 60vh;
  border-radius: 8px;
  background: #111;
}

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  display: grid;
  place-items: center;
  z-index: 3500;
  backdrop-filter: blur(2px);
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .4);
}

.close-lightbox {
  position: absolute;
  top: 16px;
  right: 16px;
}
</style>
