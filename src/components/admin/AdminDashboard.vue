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
                                    by {{ p.username || 'User' }} · ❤️ {{ p.likeCount || 0 }} · 💬 {{ p.commentCount ||
                                    0 }}
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
/**
 * fmt(ts)
 * 功能：将 Firestore Timestamp/Date/时间值格式化为本地时间字符串。
 * 逻辑说明：
 * 1) 入参为空直接返回空串，避免渲染 “Invalid Date”。
 * 2) 若对象带有 toDate()（Firestore Timestamp），先转成 Date；否则用 new Date(ts)。
 * 3) 使用 toLocaleString() 输出本地化日期时间；任意异常捕获后返回空串，保证 UI 稳定。
 */
function fmt(ts) {
  try {
    if (!ts) return ''
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString()
  } catch { return '' }
}

/**
 * badgeClass(status)
 * 功能：根据任务状态返回对应的 Bootstrap 背景样式类。
 * 逻辑说明：
 * - 将传入的状态字符串小写化；按 success/partial/running/queued/failed 分支返回不同配色；
 * - 未知状态回退为浅色 'text-bg-light'，确保不会出现未定义样式。
 */
function badgeClass(status) {
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
/**
 * loadKPIs()
 * 功能：批量获取仪表盘关键指标（KPI）的计数数据。
 * 逻辑说明：
 * 1) 使用 getCountFromServer 对多个集合/集合组并行计数（Promise.all），避免全量拉取带来的性能开销。
 * 2) 对 mail_jobs 使用 where 过滤分别统计 running/failed 数量。
 * 3) 读取各聚合结果的 count，构建 kpis.value；若某项缺失则回退为 0，保证显示稳定。
 */
async function loadKPIs() {
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
    users:       usersAgg.data().count || 0,
    posts:       postsAgg.data().count || 0,
    moods:       moodsAgg.data().count || 0,
    walks:       walksAgg.data().count || 0,
    likes:       likesAgg.data().count || 0,
    comments:    commentsAgg.data().count || 0,
    jobsRunning: jobsRunAgg.data().count || 0,
    jobsFailed:  jobsFailAgg.data().count || 0
  }
}

/**
 * loadRecent()
 * 功能：并行获取最近 5 条的“注册用户 / 帖子 / 邮件任务”列表，用于右侧明细卡片。
 * 逻辑说明：
 * 1) 对 users/posts/mail_jobs 按 createdAt 倒序查询，并限制 qLimit(5)。
 * 2) 将查询快照映射为普通对象数组（附加 id），分别填充 recent.value 下的 users/posts/jobs。
 * 3) 并发请求减少整体等待时间，提升首次渲染体验。
 */
async function loadRecent() {
  const [usersSnap, postsSnap, jobsSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'),     orderBy('createdAt', 'desc'), qLimit(5))),
    getDocs(query(collection(db, 'posts'),     orderBy('createdAt', 'desc'), qLimit(5))),
    getDocs(query(collection(db, 'mail_jobs'), orderBy('createdAt', 'desc'), qLimit(5)))
  ])

  recent.value.users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  recent.value.posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  recent.value.jobs  = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * loadAll()
 * 功能：统一调度加载 KPI 与最近列表，并处理加载/错误状态。
 * 逻辑说明：
 * 1) 将 loading 置为 true、清空 err，进入“刷新中”状态；
 * 2) 并行调用 loadKPIs 与 loadRecent，任何异常都会被捕获：
 *    - 控制台输出错误日志；
 *    - 设置用户可见的错误消息，提示检查 Firestore 规则/索引；
 * 3) finally 中无论成功失败都将 loading 复位为 false，保证按钮/骨架屏等状态正确。
 */
async function loadAll() {
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

/**
 * onMounted(loadAll)
 * 功能：组件挂载后立即拉取仪表盘数据，完成首屏渲染。
 * 逻辑说明：
 * - 直接调用封装好的聚合入口 loadAll()，以便同时获取 KPI 与最近动态。
 */
onMounted(loadAll)
</script>


<style scoped>
.mb-dashboard .list-group-item {
    background: transparent;
}
</style>
