<template>
  <div class="container py-4" style="max-width: 1200px">
    <h2 class="text-primary mb-3">Admin Console</h2>

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button class="nav-link" :class="{active: tab==='dashboard'}" @click="tab='dashboard'">
          <i class="bi bi-speedometer2 me-1"></i> Dashboard
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" :class="{active: tab==='users'}" @click="tab='users'">
          <i class="bi bi-people me-1"></i> Users
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" :class="{active: tab==='jobs'}" @click="tab='jobs'">
          <i class="bi bi-envelope-paper me-1"></i> Mail Jobs
        </button>
      </li>
    </ul>

    <!-- Dashboard -->
    <div v-if="tab==='dashboard'" class="card border-0 shadow-sm">
      <div class="card-body">
        <AdminDashboard />
      </div>
    </div>

    <!-- Users 表格 + 邮件抽屉 -->
    <UsersTable v-if="tab==='users'" @openEmailComposer="openEmailComposer" />

    <!-- Mail 作业列表（高级本地表格） -->
    <div v-if="tab==='jobs'" class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h5 class="mb-0">Recent Email Jobs</h5>
          <div class="small text-muted">Live (latest {{ jobs.length }} loaded)</div>
        </div>

        <!-- 过滤区 -->
        <div class="row g-2 mb-3">
          <div class="col-md-4">
            <label class="form-label small mb-1">Subject (contains)</label>
            <input v-model="filters.subject" type="text" class="form-control form-control-sm" placeholder="e.g. newsletter" />
          </div>
          <div class="col-md-3">
            <label class="form-label small mb-1">By (contains)</label>
            <input v-model="filters.by" type="text" class="form-control form-control-sm" placeholder="creator email/name" />
          </div>
          <div class="col-md-2">
            <label class="form-label small mb-1">Status</label>
            <select v-model="filters.status" class="form-select form-select-sm">
              <option value="">All</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="success">success</option>
              <option value="partial">partial</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label small mb-1">CreatedAt (range)</label>
            <div class="d-flex gap-2">
              <input v-model="filters.from" type="date" class="form-control form-control-sm" />
              <input v-model="filters.to" type="date" class="form-control form-control-sm" />
            </div>
          </div>
        </div>

        <!-- 排序 + 重置 -->
        <div class="d-flex align-items-center gap-2 mb-2">
          <label class="small text-muted mb-0">Sort by:</label>
          <select v-model="sort.field" class="form-select form-select-sm" style="max-width: 200px">
            <option value="createdAt">createdAt</option>
            <option value="subject">subject</option>
            <option value="status">status</option>
            <option value="sent">sent</option>
            <option value="total">total</option>
            <option value="by">by</option>
          </select>
          <select v-model="sort.dir" class="form-select form-select-sm" style="max-width: 120px">
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
          <button class="btn btn-sm btn-outline-secondary" @click="resetFilters">
            <i class="bi bi-arrow-counterclockwise me-1"></i> Reset
          </button>
        </div>

        <!-- 表格 -->
        <div v-if="jobs.length===0" class="text-muted">No jobs yet.</div>
        <div v-else class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th style="white-space: nowrap; cursor: pointer" @click="setSort('createdAt')">
                  Created At <i :class="sortIcon('createdAt')"></i>
                </th>
                <th style="min-width: 260px; cursor: pointer" @click="setSort('subject')">
                  Subject <i :class="sortIcon('subject')"></i>
                </th>
                <th style="cursor: pointer" @click="setSort('status')">
                  Status <i :class="sortIcon('status')"></i>
                </th>
                <th style="cursor: pointer" @click="setSort('sent')">
                  Progress (sent/total) <i :class="sortIcon('sent')"></i>
                </th>
                <th style="cursor: pointer" @click="setSort('by')">
                  By <i :class="sortIcon('by')"></i>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in pagedRows" :key="j.id">
                <td>{{ fmt(j.createdAt) }}</td>
                <td class="text-truncate" style="max-width: 420px" :title="j.subject">{{ j.subject || '(no subject)' }}</td>
                <td>
                  <span class="badge" :class="statusClass(j.status)">
                    {{ j.status || '-' }}
                  </span>
                </td>
                <td>
                  <span :title="progressTitle(j)">
                    {{ j.sent }}/{{ j.total }}
                  </span>
                  <div class="progress mt-1" style="height: 6px">
                    <div class="progress-bar" role="progressbar" :style="{ width: j.percent + '%' }"></div>
                  </div>
                </td>
                <td>{{ j.by || '-' }}</td>
              </tr>
              <tr v-if="filteredSorted.length === 0">
                <td colspan="5" class="text-center text-muted py-4">No results for current filters.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div class="d-flex align-items-center justify-content-between" v-if="filteredSorted.length > 0">
          <div class="small text-muted">
            Page {{ page + 1 }} / {{ totalPages }} · {{ filteredSorted.length }} result(s)
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" :disabled="page===0" @click="prevPage">Prev</button>
            <button class="btn btn-sm btn-outline-secondary" :disabled="page>=totalPages-1" @click="nextPage">Next</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 邮件编辑抽屉 -->
    <EmailComposerDrawer
      v-if="composerOpen"
      :recipients="selectedRecipients"
      @close="composerOpen=false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { db } from '../firebase'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import UsersTable from '../components/admin/UsersTable.vue'
import EmailComposerDrawer from '../components/admin/EmailComposerDrawer.vue'
import AdminDashboard from '../components/admin/AdminDashboard.vue'

/** 默认页签：dashboard */
const tab = ref('dashboard')

const composerOpen = ref(false)
const selectedRecipients = ref([])
function openEmailComposer(payload) {
  selectedRecipients.value = payload || []
  composerOpen.value = true
}

/* 工具 */
function tsToDate(ts) {
  if (!ts) return null
  return ts?.toDate ? ts.toDate() : new Date(ts)
}
function fmt(ts) {
  const d = tsToDate(ts)
  if (!d || isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

/* 实时订阅最近 mail_jobs（一次最多取 200 条，全部在前端本地筛选/排序/分页） */
const jobsRaw = ref([])
const jobs = ref([]) // 预处理后的扁平字段
let unsub = null
onMounted(() => {
  const qRef = query(collection(db, 'mail_jobs'), orderBy('createdAt', 'desc'), limit(200))
  unsub = onSnapshot(qRef, (snap) => {
    jobsRaw.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    jobs.value = jobsRaw.value.map(j => {
      const total = Number(j.stats?.total ?? (Array.isArray(j.recipients) ? j.recipients.length : 0)) || 0
      const sent = Number(j.stats?.sent ?? 0) || 0
      const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((sent / total) * 100))) : 0
      // 后台已写 createdBy（管理员邮箱/标识）；兼容老数据 by/email/name
      const by = (j.createdBy || j.by?.email || j.by?.name || j.by || '').toString()
      return {
        ...j,
        total,
        sent,
        percent,
        by,
      }
    })
  })
})
onBeforeUnmount(() => { if (typeof unsub === 'function') unsub() })

/* 过滤与排序（全部本地） */
const filters = ref({
  subject: '',
  by: '',
  status: '',
  from: '', // 'YYYY-MM-DD'
  to: '',   // 'YYYY-MM-DD'
})
const sort = ref({ field: 'createdAt', dir: 'desc' })

const filteredSorted = computed(() => {
  const subj = filters.value.subject.trim().toLowerCase()
  const byq  = filters.value.by.trim().toLowerCase()
  const status = filters.value.status
  const from = filters.value.from ? new Date(filters.value.from + 'T00:00:00') : null
  const to   = filters.value.to   ? new Date(filters.value.to   + 'T23:59:59') : null

  let arr = jobs.value.slice()

  // 过滤
  if (subj) arr = arr.filter(j => (j.subject || '').toLowerCase().includes(subj))
  if (byq)  arr = arr.filter(j => (j.by || '').toLowerCase().includes(byq))
  if (status) arr = arr.filter(j => (j.status || '') === status)
  if (from) arr = arr.filter(j => {
    const d = tsToDate(j.createdAt)
    return d && d >= from
  })
  if (to) arr = arr.filter(j => {
    const d = tsToDate(j.createdAt)
    return d && d <= to
  })

  // 排序（字段映射）
  const dir = sort.value.dir === 'asc' ? 1 : -1
  const field = sort.value.field
  arr.sort((a, b) => {
    let va, vb
    switch (field) {
      case 'createdAt':
        va = tsToDate(a.createdAt)?.getTime() || 0
        vb = tsToDate(b.createdAt)?.getTime() || 0
        break
      case 'subject':
        va = (a.subject || '').toLowerCase()
        vb = (b.subject || '').toLowerCase()
        break
      case 'status':
        va = (a.status || '')
        vb = (b.status || '')
        break
      case 'sent':
        va = Number(a.sent) || 0
        vb = Number(b.sent) || 0
        break
      case 'total':
        va = Number(a.total) || 0
        vb = Number(b.total) || 0
        break
      case 'by':
        va = (a.by || '').toLowerCase()
        vb = (b.by || '').toLowerCase()
        break
      default:
        va = 0; vb = 0
    }
    if (va < vb) return -1 * dir
    if (va > vb) return  1 * dir
    return 0
  })

  return arr
})

/* 分页（每页 10 条） */
const page = ref(0)
const pageSize = 10
const totalPages = computed(() => Math.max(1, Math.ceil(filteredSorted.value.length / pageSize)))
const pagedRows = computed(() => {
  const start = page.value * pageSize
  return filteredSorted.value.slice(start, start + pageSize)
})
watch([filters, sort], () => { page.value = 0 }, { deep: true })

function nextPage() { if (page.value < totalPages.value - 1) page.value++ }
function prevPage() { if (page.value > 0) page.value-- }

function resetFilters() {
  filters.value = { subject: '', by: '', status: '', from: '', to: '' }
  sort.value = { field: 'createdAt', dir: 'desc' }
  page.value = 0
}

/* 排序点击切换 */
function setSort(f) {
  if (sort.value.field === f) {
    sort.value.dir = (sort.value.dir === 'asc' ? 'desc' : 'asc')
  } else {
    sort.value.field = f
    sort.value.dir = 'desc'
  }
}
function sortIcon(f) {
  if (sort.value.field !== f) return 'bi bi-arrow-down-up text-muted'
  return sort.value.dir === 'asc' ? 'bi bi-sort-down text-primary' : 'bi bi-sort-up text-primary'
}

/* 进度标题与状态样式 */
function progressTitle(j) {
  const pct = typeof j.percent === 'number' ? j.percent : 0
  return `${pct}%`
}
function statusClass(s) {
  switch (s) {
    case 'success': return 'text-bg-success'
    case 'partial': return 'text-bg-warning'
    case 'failed':  return 'text-bg-danger'
    case 'running': return 'text-bg-primary'
    case 'queued':  return 'text-bg-secondary'
    default:        return 'text-bg-light'
  }
}
</script>
