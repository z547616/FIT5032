<template>
  <div class="mb-dashboard">
    <!-- 顶部：标题 + 刷新 -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h5 class="mb-0">Admin Dashboard</h5>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-outline-secondary" @click="loadAll" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- 关键指标卡片 -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Users</div>
                <div class="display-6 fw-bold">{{ kpis.users }}</div>
              </div>
              <i class="bi bi-people fs-2 text-primary"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Posts</div>
                <div class="display-6 fw-bold">{{ kpis.posts }}</div>
              </div>
              <i class="bi bi-chat-square-text fs-2 text-success"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Mood Entries</div>
                <div class="display-6 fw-bold">{{ kpis.moods }}</div>
              </div>
              <i class="bi bi-activity fs-2 text-info"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Walks</div>
                <div class="display-6 fw-bold">{{ kpis.walks }}</div>
              </div>
              <i class="bi bi-geo-alt fs-2 text-warning"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Likes (total)</div>
                <div class="display-6 fw-bold">{{ kpis.likes }}</div>
              </div>
              <i class="bi bi-heart fs-2 text-danger"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Comments (total)</div>
                <div class="display-6 fw-bold">{{ kpis.comments }}</div>
              </div>
              <i class="bi bi-chat-dots fs-2 text-secondary"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Mail Jobs (Running)</div>
                <div class="display-6 fw-bold">{{ kpis.jobsRunning }}</div>
              </div>
              <i class="bi bi-send fs-2 text-primary"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Mail Jobs (Failed)</div>
                <div class="display-6 fw-bold">{{ kpis.jobsFailed }}</div>
              </div>
              <i class="bi bi-exclamation-triangle fs-2 text-danger"></i>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近动态（3 列小表） -->
    <div class="row g-3">
      <div class="col-lg-4">
  <div class="card shadow-sm border-0 h-100 d-flex flex-column">
    <div class="card-header bg-white d-flex align-items-center justify-content-between">
      <strong>Recent Signups</strong>
      <span class="small text-muted">last 5</span>
    </div>

    <div class="card-body pt-2 pb-0 flex-grow-1">
      <div v-if="recent.users.length === 0" class="text-muted small">No new users.</div>
      <ul v-else class="list-group list-group-flush">
        <li v-for="u in recent.users" :key="u.id" class="list-group-item px-0">
          <div class="fw-semibold">{{ u.username || '(no name)' }}</div>
          <div class="small text-muted">{{ u.email || '-' }}</div>
          <div class="small text-muted">{{ fmt(u.createdAt) }}</div>
        </li>
      </ul>
    </div>
  </div>
</div>

      <div class="col-lg-4">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-header bg-white d-flex align-items-center justify-content-between">
            <strong>Recent Posts</strong>
            <span class="small text-muted">last 5</span>
          </div>
          <div class="card-body pt-2 pb-0">
            <div v-if="recent.posts.length === 0" class="text-muted small">No posts yet.</div>
            <ul class="list-group list-group-flush">
              <li v-for="p in recent.posts" :key="p.id" class="list-group-item px-0">
                <div class="fw-semibold text-truncate" :title="p.text || '(image only)'">
                  {{ p.text || '(image only)' }}
                </div>
                <div class="small text-muted">
                  by {{ p.username || 'User' }} · ❤️ {{ p.likeCount || 0 }} · 💬 {{ p.commentCount || 0 }}
                </div>
                <div class="small text-muted">{{ fmt(p.createdAt) }}</div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-header bg-white d-flex align-items-center justify-content-between">
            <strong>Recent Mail Jobs</strong>
            <span class="small text-muted">last 5</span>
          </div>
          <div class="card-body pt-2 pb-0">
            <div v-if="recent.jobs.length === 0" class="text-muted small">No jobs.</div>
            <ul class="list-group list-group-flush">
              <li v-for="j in recent.jobs" :key="j.id" class="list-group-item px-0">
                <div class="fw-semibold text-truncate">{{ j.subject || '(No subject)' }}</div>
                <div class="small">
                  <span class="badge" :class="badgeClass(j.status)">{{ j.status }}</span>
                  <span class="text-muted ms-2">{{ j.recipients?.length || 0 }} recipient(s)</span>
                </div>
                <div class="small text-muted">{{ fmt(j.createdAt) }}</div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div v-if="err" class="text-danger small mt-3">{{ err }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../../firebase'
import {
  collection, collectionGroup, query, orderBy, limit as qLimit, getDocs,
  getCountFromServer, where
} from 'firebase/firestore'

/* -------- state -------- */
const loading = ref(false)
const err = ref('')
const kpis = ref({
  users: 0,
  posts: 0,
  moods: 0,
  walks: 0,
  likes: 0,
  comments: 0,
  jobsRunning: 0,
  jobsFailed: 0
})
const recent = ref({
  users: [],
  posts: [],
  jobs: []
})

/* -------- utils -------- */
function fmt (ts) {
  try {
    if (!ts) return ''
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString()
  } catch { return '' }
}
function badgeClass (status) {
  switch ((status || '').toLowerCase()) {
    case 'success': return 'text-bg-success'
    case 'partial': return 'text-bg-warning'
    case 'running': return 'text-bg-primary'
    case 'queued':  return 'text-bg-secondary'
    case 'failed':  return 'text-bg-danger'
    default:        return 'text-bg-light'
  }
}

/* -------- loaders -------- */
async function loadKPIs () {
  // counts（尽量用 getCountFromServer，避免全量拉取）
  const [
    usersAgg,
    postsAgg,
    moodsAgg,
    walksAgg,
    likesAgg,
    commentsAgg,
    jobsRunAgg,
    jobsFailAgg
  ] = await Promise.all([
    getCountFromServer(collection(db, 'users')),
    getCountFromServer(collection(db, 'posts')),
    getCountFromServer(collectionGroup(db, 'moodEntries')),
    getCountFromServer(collection(db, 'walks')),
    getCountFromServer(collectionGroup(db, 'likes')),
    getCountFromServer(collectionGroup(db, 'comments')),
    getCountFromServer(query(collection(db, 'mail_jobs'), where('status', '==', 'running'))),
    getCountFromServer(query(collection(db, 'mail_jobs'), where('status', '==', 'failed')))
  ])

  kpis.value = {
    users: usersAgg.data().count || 0,
    posts: postsAgg.data().count || 0,
    moods: moodsAgg.data().count || 0,
    walks: walksAgg.data().count || 0,
    likes: likesAgg.data().count || 0,
    comments: commentsAgg.data().count || 0,
    jobsRunning: jobsRunAgg.data().count || 0,
    jobsFailed: jobsFailAgg.data().count || 0
  }
}

async function loadRecent () {
  const [usersSnap, postsSnap, jobsSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), qLimit(5))),
    getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), qLimit(5))),
    getDocs(query(collection(db, 'mail_jobs'), orderBy('createdAt', 'desc'), qLimit(5)))
  ])

  recent.value.users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  recent.value.posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  recent.value.jobs  = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function loadAll () {
  loading.value = true
  err.value = ''
  try {
    await Promise.all([loadKPIs(), loadRecent()])
  } catch (e) {
    console.error('[AdminDashboard] load error', e)
    err.value = 'Failed to load dashboard. Check Firestore rules & indexes.'
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.mb-dashboard .list-group-item { background: transparent; }
</style>
