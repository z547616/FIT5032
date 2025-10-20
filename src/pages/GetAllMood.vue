<template>
  <div class="wrap">
    <h1 class="title">GetAllMood (JSON)</h1>

    <div v-if="!user" class="tip">Please sign in to view your mood entries.</div>

    <div v-else class="panel">
      <div class="bar">
        <button class="btn" @click="reload" :disabled="loading">
          {{ loading ? "Loading..." : "Reload" }}
        </button>
        <label class="chk">
          <input type="checkbox" v-model="realtime" @change="toggleRealtime" />
          Realtime (onSnapshot)
        </label>
        <span class="count">Count: {{ items.length }}</span>
      </div>

      <pre class="json">{{ pretty }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import {
  getFirestore,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore"

const auth = getAuth()
const db = getFirestore()

const user = ref(null)
const items = ref([])
const loading = ref(false)
const realtime = ref(false)
let unsub = null

const pretty = computed(() => JSON.stringify(items.value, null, 2))

async function fetchAll() {
  if (!user.value) return
  loading.value = true
  try {
    const colRef = collection(db, "users", user.value.uid, "moodEntries")
    const q = query(colRef, orderBy("createdAt", "desc"))
    const snap = await getDocs(q)
    items.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } finally {
    loading.value = false
  }
}

function enableRealtime() {
  if (!user.value) return
  const colRef = collection(db, "users", user.value.uid, "moodEntries")
  const q = query(colRef, orderBy("createdAt", "desc"))
  unsub = onSnapshot(q, snap => {
    items.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
}
function disableRealtime() {
  if (unsub) { unsub(); unsub = null }
}

function toggleRealtime() {
  if (realtime.value) enableRealtime()
  else disableRealtime()
}

function reload() {
  if (realtime.value) return // 实时模式下无需手动刷新
  fetchAll()
}

onMounted(() => {
  const stop = onAuthStateChanged(auth, u => {
    user.value = u
    items.value = []
    if (!u) { disableRealtime(); return }
    if (realtime.value) enableRealtime()
    else fetchAll()
  })
  onBeforeUnmount(() => {
    stop()
    disableRealtime()
  })
})
</script>

<style scoped>
.wrap { max-width: 900px; margin: 0 auto; padding: 16px; }
.title { font-weight: 800; margin-bottom: 10px; }
.tip { color: #6b7280; }
.panel {
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 6px 20px rgba(0,0,0,.04);
}
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.btn {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }
.chk { user-select: none; }
.count { margin-left: auto; color: #6b7280; }
.json {
  background: #0b1020;
  color: #c7e1ff;
  border-radius: 10px;
  padding: 12px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.9rem;
  max-height: 70vh;
}
</style>
