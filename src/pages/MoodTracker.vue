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
                  <input v-model.number="mood" type="number" class="form-control rounded-3" min="0" max="10" required>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Notes</label>
                  <textarea v-model="notes" class="form-control rounded-3" rows="3" maxlength="100"
                    placeholder="How are you feeling today?"></textarea>
                </div>

                <button type="submit" class="btn btn-primary w-100 rounded-3">
                  Save Entry
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- History -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-4">
              <h4 class="mb-3">History</h4>

              <!-- Search -->
              <div class="mb-3">
                <input v-model="searchQuery" type="text" class="form-control rounded-3" placeholder="Search notes...">
              </div>

              <div v-if="entries.length === 0" class="text-muted">No entries yet.</div>
              <ul class="list-group list-group-flush">
                <li v-for="e in filteredEntries" :key="e.id" class="list-group-item px-0 py-2">
                  <div class="fw-semibold">{{ e.date }} — Mood: {{ e.mood }}/10</div>
                  <div class="small text-muted">{{ e.notes }}</div>

                  <!-- 操作按钮 -->
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
import { ref, reactive, computed, onMounted } from "vue"
import { auth, db } from "../firebase"
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore"

const mood = ref("")
const notes = ref("")
const entries = reactive([])
const searchQuery = ref("")
const editingId = ref(null)

// 当前用户 ID（需保证已登录）
const userId = auth.currentUser?.uid

// 监听挂载时获取数据
onMounted(async () => {
  await fetchEntries()
})

// 🔹 获取用户的心情记录
async function fetchEntries() {
  if (!userId) return
  entries.length = 0
  const q = query(
    collection(db, "users", userId, "moodEntries"),
    orderBy("createdAt", "desc")
  )
  const snap = await getDocs(q)
  snap.forEach((docSnap) => {
    entries.push({ id: docSnap.id, ...docSnap.data() })
  })
}

// 🔹 保存/更新记录
async function submitForm() {
  if (!userId) return
  if (editingId.value) {
    // 更新
    const refDoc = doc(db, "users", userId, "moodEntries", editingId.value)
    await updateDoc(refDoc, {
      mood: mood.value,
      notes: notes.value
    })
    editingId.value = null
  } else {
    // 新增
    await addDoc(collection(db, "users", userId, "moodEntries"), {
      date: new Date().toLocaleDateString(),
      mood: mood.value,
      notes: notes.value,
      createdAt: serverTimestamp()
    })
  }
  mood.value = ""
  notes.value = ""
  await fetchEntries()
}

// 🔹 删除
async function deleteEntry(id) {
  if (!userId) return
  await deleteDoc(doc(db, "users", userId, "moodEntries", id))
  await fetchEntries()
}

// 🔹 编辑
function editEntry(entry) {
  editingId.value = entry.id
  mood.value = entry.mood
  notes.value = entry.notes
}

// 🔹 模糊搜索
const filteredEntries = computed(() =>
  entries.filter((e) =>
    e.notes.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)
</script>
