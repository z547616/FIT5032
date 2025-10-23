<template>
    <div class="card border-0 shadow-sm">
        <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
                <h5 class="mb-0">Users</h5>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-outline-secondary btn-sm" @click="exportCSV">
                        <i class="bi bi-filetype-csv me-1"></i> CSV
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" @click="exportPDF">
                        <i class="bi bi-file-earmark-pdf me-1"></i> PDF
                    </button>
                    <button class="btn btn-primary btn-sm" :disabled="selected.length === 0" @click="emitEmail">
                        <i class="bi bi-envelope-paper me-1"></i> Send Email ({{ selected.length }})
                    </button>
                </div>
            </div>

            <!-- 过滤区 -->
            <div class="row g-2 mb-3">
                <div class="col-md-3">
                    <label class="form-label small mb-1">Username (prefix)</label>
                    <input v-model="filters.username" type="text" class="form-control form-control-sm"
                        placeholder="e.g. john" />
                </div>
                <div class="col-md-3">
                    <label class="form-label small mb-1">Email (prefix)</label>
                    <input v-model="filters.email" type="text" class="form-control form-control-sm"
                        placeholder="e.g. alice@" />
                </div>
                <div class="col-md-2">
                    <label class="form-label small mb-1">Role</label>
                    <select v-model="filters.role" class="form-select form-select-sm">
                        <option value="">All</option>
                        <option>user</option>
                        <option>admin</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label small mb-1">CreatedAt (range)</label>
                    <div class="d-flex gap-2">
                        <input v-model="filters.from" type="date" class="form-control form-control-sm" />
                        <input v-model="filters.to" type="date" class="form-control form-control-sm" />
                    </div>
                </div>
            </div>

            <!-- 排序 -->
            <div class="d-flex align-items-center gap-2 mb-2">
                <label class="small text-muted mb-0">Sort by:</label>
                <select v-model="sort.field" class="form-select form-select-sm" style="max-width: 180px">
                    <option value="createdAt">createdAt</option>
                    <option value="updatedAt">updatedAt</option>
                    <option value="username">username</option>
                    <option value="email">email</option>
                </select>
                <select v-model="sort.dir" class="form-select form-select-sm" style="max-width: 120px">
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                </select>
                <button class="btn btn-sm btn-outline-secondary" @click="reload()">Apply</button>
                <button class="btn btn-outline-secondary btn-sm" @click="resetFilters">
                    <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
                </button>
            </div>

            <!-- 表格 -->
            <div class="table-responsive">
                <table class="table table-sm align-middle">
                    <thead>
                        <tr>
                            <th style="width: 36px">
                                <input type="checkbox" class="form-check-input" :checked="allChecked"
                                    @change="toggleAll" />
                            </th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Allow Bulk</th>
                            <th>Created</th>
                            <th>Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="u in rows" :key="u.id">
                            <td>
                                <input type="checkbox" class="form-check-input" :checked="isChecked(u)"
                                    @change="toggleOne(u)" />
                            </td>
                            <td>{{ u.username || '-' }}</td>
                            <td>{{ u.email || '-' }}</td>
                            <td><span class="badge text-bg-light">{{ u.role || 'user' }}</span></td>
                            <td>
                                <span class="badge"
                                    :class="(u.emailPrefs?.allowBulk === false) ? 'text-bg-danger' : 'text-bg-success'">
                                    {{ (u.emailPrefs?.allowBulk === false) ? 'No' : 'Yes' }}
                                </span>
                            </td>
                            <td>{{ fmt(u.createdAt) }}</td>
                            <td>{{ fmt(u.updatedAt) }}</td>
                        </tr>
                        <tr v-if="rows.length === 0">
                            <td colspan="7" class="text-center text-muted py-4">No users.</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 分页 -->
            <div class="d-flex align-items-center justify-content-between">
                <div class="small text-muted">Page {{ page + 1 }}</div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" :disabled="page === 0"
                        @click="prevPage">Prev</button>
                    <button class="btn btn-sm btn-outline-secondary" :disabled="!hasMore"
                        @click="nextPage">Next</button>
                </div>
            </div>

            <div v-if="err" class="text-danger small mt-2">{{ err }}</div>
        </div>
    </div>
</template>

<script setup>
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'   // ✅ 正确引入为函数，而非 side-effect
import { ref, watch, onMounted, computed } from 'vue'
import { db } from '../../firebase'
import {
    collection, query, where, orderBy, limit, getDocs, startAfter
} from 'firebase/firestore'

// 事件：把选中的用户发送给父组件打开邮件编辑器
const emit = defineEmits(['openEmailComposer'])

/* 状态 */
const rows = ref([])
const err = ref('')
const selected = ref([]) // [{id,email,username}]
const page = ref(0)
const hasMore = ref(false)
const lastDocPerPage = [] // 游标栈

/* 过滤与排序 */
const filters = ref({
    username: '',
    email: '',
    role: '',
    from: '',
    to: ''
})
const sort = ref({ field: 'createdAt', dir: 'desc' })

/* 工具 */
function fmt(ts) {
    if (!ts) return ''
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString()
}
function prefixBounds(s) {
    if (!s) return null
    const start = s
    const end = s + '\uf8ff'
    return [start, end]
}

/* 查询与分页 */
async function runQuery(firstPage = false) {
  err.value = ''

  try {
    let qRef = collection(db, 'users')

    // 解析筛选
    const roleEq = (filters.value.role || '').trim()
    const hasDateRange = !!filters.value.from || !!filters.value.to

    // 仅使用「等值」和「单一范围字段」的组合（稳定）
    if (roleEq) {
      qRef = query(qRef, where('role', '==', roleEq))
    }
    if (hasDateRange) {
      if (filters.value.from) {
        const fromDate = new Date(filters.value.from + 'T00:00:00')
        qRef = query(qRef, where('createdAt', '>=', fromDate))
      }
      if (filters.value.to) {
        const toDate = new Date(filters.value.to + 'T23:59:59')
        qRef = query(qRef, where('createdAt', '<=', toDate))
      }
    }

    // 排序规则：若有日期范围，必须先按 createdAt；否则按选择字段
    if (hasDateRange) {
      qRef = query(qRef, orderBy('createdAt', sort.value.dir))
      if (sort.value.field !== 'createdAt') {
        qRef = query(qRef, orderBy(sort.value.field, sort.value.dir)) // 需要复合索引（按报错链接创建）
      }
    } else {
      qRef = query(qRef, orderBy(sort.value.field, sort.value.dir))
    }

    // 分页
    qRef = query(qRef, limit(10))
    if (!firstPage && lastDocPerPage[page.value - 1]) {
      qRef = query(qRef, startAfter(lastDocPerPage[page.value - 1]))
    }

    const snap = await getDocs(qRef)
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    hasMore.value = snap.size === 10
    if (snap.docs.length > 0) lastDocPerPage[page.value] = snap.docs[snap.docs.length - 1]

    // 前端前缀过滤（在本页 10 条上做，体验依然流畅）
    const uPrefix = (filters.value.username || '').trim().toLowerCase()
    const ePrefix = (filters.value.email || '').trim().toLowerCase()
    if (uPrefix) list = list.filter(x => (x.username || '').toLowerCase().startsWith(uPrefix))
    if (ePrefix) list = list.filter(x => (x.email || '').toLowerCase().startsWith(ePrefix))

    rows.value = list
  } catch (e) {
    console.error('[UsersTable] query error', e)
    err.value = 'Failed to load users. Check indexes if filters + sort are combined.'
  }
}

// 任何筛选项变化都重载（包含 role）
watch(() => ({...filters.value, sort: {...sort.value}}), () => {
  page.value = 0
  lastDocPerPage.length = 0
  runQuery(true)
})

function reload() {
    page.value = 0
    lastDocPerPage.length = 0
    runQuery(true)
}
function nextPage() {
    if (!hasMore.value) return
    page.value++
    runQuery()
}
function prevPage() {
    if (page.value === 0) return
    page.value--
    runQuery(page.value === 0)
}

/* 选择行 */
const allChecked = computed(() => rows.value.length > 0 && rows.value.every(r => selected.value.some(s => s.id === r.id)))
function isChecked(u) { return selected.value.some(s => s.id === u.id) }
function toggleAll() {
    if (allChecked.value) {
        // 取消本页所有
        selected.value = selected.value.filter(s => !rows.value.some(r => r.id === s.id))
    } else {
        // 加上本页未选
        const add = rows.value
            .filter(r => !selected.value.some(s => s.id === r.id))
            .map(r => ({ id: r.id, email: r.email, name: r.username, uid: r.id }))
        selected.value = [...selected.value, ...add]
    }
}
function toggleOne(u) {
    const idx = selected.value.findIndex(s => s.id === u.id)
    if (idx >= 0) selected.value.splice(idx, 1)
    else selected.value.push({ id: u.id, email: u.email, name: u.username, uid: u.id })
}
function emitEmail() {
    // 过滤掉未允许群发的（后端仍二次校验）
    const list = selected.value
        .filter(s => !!s.email)
    emit('openEmailComposer', list)
}

/* 导出（小数据前端导出当前页） */
function exportCSV() {
    const header = ['username', 'email', 'role', 'allowBulk', 'createdAt', 'updatedAt']
    const lines = rows.value.map(u => [
        JSON.stringify(u.username || ''),
        JSON.stringify(u.email || ''),
        JSON.stringify(u.role || 'user'),
        JSON.stringify(u.emailPrefs?.allowBulk !== false),
        JSON.stringify(fmt(u.createdAt)),
        JSON.stringify(fmt(u.updatedAt)),
    ].join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `users_page${page.value + 1}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
}

async function exportPDF () {
  try {
    // 用 pt 保证兼容，A4 竖版
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })

    const head = [['Username','Email','Role','Allow Bulk','Created','Updated']]
    const body = rows.value.map(u => [
      u.username || '',
      u.email || '',
      u.role || 'user',
      (u.emailPrefs?.allowBulk !== false) ? 'Yes' : 'No',
      fmt(u.createdAt),
      fmt(u.updatedAt),
    ])

    // ✅ 正确调用方式：autoTable(doc, options)
    autoTable(doc, {
      head,
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 110, 253] }, // Bootstrap primary
      margin: { top: 40, left: 24, right: 24 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 160 },
        2: { cellWidth: 60 },
        3: { cellWidth: 70 },
        // Created / Updated 自适应
      }
    })

    doc.save(`users_page${page.value + 1}.pdf`)
  } catch (e) {
    console.error('[UsersTable] exportPDF error', e)
    err.value = 'Failed to export PDF. Please check console.'
  }
}

/* 自动触发 */
onMounted(() => { reload() })
watch(filters, () => {
    // 简单节流
    clearTimeout(window.__utimer)
    window.__utimer = setTimeout(() => reload(), 300)
}, { deep: true })
watch(sort, () => reload(), { deep: true })

function resetFilters() {
    filters.value = { username: '', email: '', role: '', from: '', to: '' }
    sort.value = { field: 'createdAt', dir: 'desc' }
    reload()
}
</script>
