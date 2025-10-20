<template>
  <div class="bg-light min-vh-100 py-5">
    <div class="container">
      <h1 class="text-center display-5 fw-bold text-primary mb-5">
        Mood Tracker
      </h1>

      <div class="row g-4">
        <!-- Form -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-4">
              <h4 class="mb-4">Log Today's Mood</h4>
              <form @submit.prevent="submitForm">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Mood (0-10)</label>
                  <input
                    v-model.number="mood"
                    type="number"
                    class="form-control rounded-3"
                    min="0" max="10"
                    required
                  />
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Notes</label>
                  <textarea
                    v-model="notes"
                    class="form-control rounded-3"
                    rows="3"
                    maxlength="200"
                    placeholder="How are you feeling today?"
                  ></textarea>
                </div>

                <button type="submit" class="btn btn-primary w-100 rounded-3">
                  {{ editingId ? "Update Entry" : "Save Entry" }}
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- History + Count -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-4">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <h4 class="mb-0">History</h4>
                <span class="badge bg-primary-subtle text-primary">
                  Total: <strong>{{ totalCount }}</strong>
                </span>
              </div>

              <!-- Search -->
              <div class="mb-3">
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control rounded-3"
                  placeholder="Search notes..."
                />
              </div>

              <div v-if="entries.length === 0" class="text-muted">No entries yet.</div>
              <ul class="list-group list-group-flush">
                <li v-for="e in filteredEntries" :key="e.id" class="list-group-item px-0 py-2">
                  <div class="fw-semibold">
                    {{ e.date }} — Mood: {{ e.mood }}/10
                  </div>
                  <div class="small text-muted">{{ e.notes }}</div>

                  <div class="mt-1 d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" @click="editEntry(e)">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" @click="deleteEntry(e.id)">Delete</button>
                  </div>
                </li>
              </ul>

            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { auth, db, functions } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, addDoc, query, orderBy,
  deleteDoc, doc, updateDoc, serverTimestamp,
  onSnapshot
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

/* ---------- state ---------- */
const mood = ref('')
const notes = ref('')
const entries = ref([])       // 用 ref 包裹数组，便于整体替换
const searchQuery = ref('')
const editingId = ref(null)
const totalCount = ref(0)

/* ---------- helpers ---------- */
const uid = () => auth.currentUser?.uid || null

/* ---------- 本地与云端一致的 notes 规范化 ---------- */
function normalizeNotesLocal(input = '') {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const parts = raw.split(/([.!?])\s+/).filter(Boolean)
  const sentences = []
  for (let i = 0; i < parts.length; i += 2) {
    const s = (parts[i] || '').trim()
    const p = (parts[i + 1] || '').trim()
    if (!s) continue
    const cap = s.charAt(0).toUpperCase() + s.slice(1)
    sentences.push(cap + (p || ''))
  }
  if (!sentences.length) return ''
  if (!/[.!?]$/.test(sentences[sentences.length - 1])) {
    sentences[sentences.length - 1] += '.'
  }
  return sentences.join(' ')
}

/* ---------- auth + 实时订阅 ---------- */
let unsubscribeAuth = null
let unsubscribeEntries = null

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (unsubscribeEntries) { unsubscribeEntries(); unsubscribeEntries = null }

    if (user) {
      subscribeEntries(user.uid)
      await fetchCount() // 计数还是调用云函数
    } else {
      entries.value = []
      totalCount.value = 0
    }
  })
})
onBeforeUnmount(() => {
  if (typeof unsubscribeAuth === 'function') unsubscribeAuth()
  if (typeof unsubscribeEntries === 'function') unsubscribeEntries()
})

function subscribeEntries(userId) {
  const q = query(
    collection(db, 'users', userId, 'moodEntries'),
    orderBy('createdAt', 'desc')
  )
  unsubscribeEntries = onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => {
      const data = d.data()
      const dateStr =
        data.date ||
        (data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : '')
      return {
        id: d.id,
        date: dateStr,
        mood: data.mood,
        notes: data.notes ?? ''
      }
    })
    entries.value = list
  })
}

/* ---------- cloud function: count ---------- */
async function fetchCount () {
  if (!uid()) return
  try {
    const call = httpsCallable(functions, 'getMoodCount')
    const res = await call()
    totalCount.value = res?.data?.count ?? entries.value.length
  } catch (e) {
    console.error('[getMoodCount] error', e)
    totalCount.value = entries.value.length
  }
}

/* ---------- create / update（带本地预格式化） ---------- */
async function submitForm () {
  const userId = uid()
  if (!userId) return
  const m = Number(mood.value)
  if (Number.isNaN(m) || m < 0 || m > 10) return

  // 本地先做与云端一致的格式化（乐观）
  const normalized = normalizeNotesLocal(notes.value)

  if (editingId.value) {
    await updateDoc(doc(db, 'users', userId, 'moodEntries', editingId.value), {
      mood: m,
      notes: normalized
      // 不写 formatted 之类的标志；云函数 onDocumentWritten 会比较差异再写
    })
    editingId.value = null
  } else {
    await addDoc(collection(db, 'users', userId, 'moodEntries'), {
      date: new Date().toLocaleDateString(),
      mood: m,
      notes: normalized,            // 新建也用本地规范化；云端会复核
      createdAt: serverTimestamp()
    })
  }

  // 重置表单；列表会通过 onSnapshot 自动更新（包含云函数的二次写回）
  mood.value = ''
  notes.value = ''

  // 刷新计数
  await fetchCount()
}

/* ---------- delete ---------- */
async function deleteEntry (id) {
  const userId = uid()
  if (!userId) return
  await deleteDoc(doc(db, 'users', userId, 'moodEntries', id))
  await fetchCount()
}

/* ---------- edit fill ---------- */
function editEntry (entry) {
  editingId.value = entry.id
  mood.value = entry.mood
  notes.value = entry.notes
}

/* ---------- search filter ---------- */
const filteredEntries = computed(() =>
  entries.value.filter(e =>
    (e.notes || '').toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)
</script>
