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
import autoTable from 'jspdf-autotable'
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
/**
 * fmt(ts)
 * 功能：格式化 Firestore Timestamp/Date/时间戳为本地可读字符串
 * 逻辑：
 * 1) 若入参为空直接返回空串；
 * 2) 支持 timestamp.toDate() 与 new Date(ts) 两种来源；
 * 3) 使用 toLocaleString() 输出本地化时间文本。
 */
function fmt(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString()
}

/* 查询与分页 */
/**
 * runQuery(firstPage = false)
 * 功能：按过滤与排序条件分页查询用户列表，并更新 rows/hasMore/分页游标。
 * 逻辑：
 * 1) 构建基础集合引用 users；
 * 2) 若设置了角色或日期范围，则叠加 where 条件（日期范围按当日 00:00:00 与 23:59:59 包含端点）；
 * 3) 排序：有日期范围优先按 createdAt 排，再按选中的 sort.field；否则直接按 sort.field；
 * 4) 分页：固定每页 limit(10)；若不是首页且有上一页末尾游标，使用 startAfter 续查；
 * 5) 执行 getDocs，映射为普通对象数组；
 * 6) 根据返回数量设置 hasMore（==10 表示可能有下一页）；记录本页最后一个文档到游标栈；
 * 7) 前端追加“用户名/邮箱前缀”过滤（startsWith），以弥补 Firestore 无前缀多条件联合的限制；
 * 8) 最终写入 rows；若出现错误则记录 err 便于 UI 提示。
 */
async function runQuery(firstPage = false) {
  err.value = ''

  try {
    let qRef = collection(db, 'users')

    const roleEq = (filters.value.role || '').trim()
    const hasDateRange = !!filters.value.from || !!filters.value.to

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

    if (hasDateRange) {
      qRef = query(qRef, orderBy('createdAt', sort.value.dir))
      if (sort.value.field !== 'createdAt') {
        qRef = query(qRef, orderBy(sort.value.field, sort.value.dir))
      }
    } else {
      qRef = query(qRef, orderBy(sort.value.field, sort.value.dir))
    }

    qRef = query(qRef, limit(10))
    if (!firstPage && lastDocPerPage[page.value - 1]) {
      qRef = query(qRef, startAfter(lastDocPerPage[page.value - 1]))
    }

    const snap = await getDocs(qRef)
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    hasMore.value = snap.size === 10
    if (snap.docs.length > 0) lastDocPerPage[page.value] = snap.docs[snap.docs.length - 1]

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

/**
 * 侦听器：watch(()=>({...filters, sort}), ...)
 * 功能：当任意过滤或排序条件变化时，重置分页并重新查询首页数据。
 * 逻辑：
 * - 将 page 归零、清空游标栈，调用 runQuery(true) 拉取第一页；
 * - 使用对象展开确保对深层字段变化也能触发。
 */
watch(() => ({ ...filters.value, sort: { ...sort.value } }), () => {
  page.value = 0
  lastDocPerPage.length = 0
  runQuery(true)
})

/**
 * reload()
 * 功能：手动刷新搜索结果为第一页。
 * 逻辑：重置分页与游标后调用 runQuery(true)。
 */
function reload() {
  page.value = 0
  lastDocPerPage.length = 0
  runQuery(true)
}

/**
 * nextPage()
 * 功能：加载下一页数据。
 * 逻辑：若 hasMore 为真则页码自增并调用 runQuery()（使用上一页游标）。
 */
function nextPage() {
  if (!hasMore.value) return
  page.value++
  runQuery()
}

/**
 * prevPage()
 * 功能：加载上一页数据。
 * 逻辑：若当前不在第 0 页则页码自减；当回到首页时以 runQuery(true) 强制从头查。
 */
function prevPage() {
  if (page.value === 0) return
  page.value--
  runQuery(page.value === 0)
}

/* 选择行 */
/**
 * allChecked（计算属性）
 * 功能：判断当前页“全选”状态。
 * 逻辑：当前页 rows 非空且每一行都能在 selected 中找到对应 id 即视为全选。
 */
const allChecked = computed(
  () => rows.value.length > 0 && rows.value.every(r => selected.value.some(s => s.id === r.id))
)

/**
 * isChecked(u)
 * 功能：判断某一行是否被勾选。
 * 逻辑：在 selected 列表中查找同 id 的项。
 */
function isChecked(u) { return selected.value.some(s => s.id === u.id) }

/**
 * toggleAll()
 * 功能：切换当前页的“全选/全不选”。
 * 逻辑：
 * - 若已全选：从 selected 中移除本页所有行；
 * - 否则：把本页未被选中的行追加进 selected（只保留必要字段以供外部使用）。
 */
function toggleAll() {
  if (allChecked.value) {
    selected.value = selected.value.filter(s => !rows.value.some(r => r.id === s.id))
  } else {
    const add = rows.value
      .filter(r => !selected.value.some(s => s.id === r.id))
      .map(r => ({ id: r.id, email: r.email, name: r.username, uid: r.id }))
    selected.value = [...selected.value, ...add]
  }
}

/**
 * toggleOne(u)
 * 功能：切换单行勾选状态。
 * 逻辑：若已存在则移除；否则将该用户添加到 selected。
 */
function toggleOne(u) {
  const idx = selected.value.findIndex(s => s.id === u.id)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push({ id: u.id, email: u.email, name: u.username, uid: u.id })
}

/**
 * emitEmail()
 * 功能：将已勾选且有邮箱的用户列表通过自定义事件发给父组件，打开邮件编辑器。
 * 逻辑：过滤掉缺少 email 的项后 emit('openEmailComposer', list)。
 */
function emitEmail() {
  const list = selected.value.filter(s => !!s.email)
  emit('openEmailComposer', list)
}

/* 导出（小数据前端导出当前页） */
/**
 * exportCSV()
 * 功能：将当前页 rows 导出为 CSV 文件并触发浏览器下载。
 * 逻辑：
 * 1) 构造表头与每行数据（使用 JSON.stringify 确保转义与空值处理）；
 * 2) 拼接为 CSV 字符串后创建 Blob；
 * 3) 通过临时 <a> + URL.createObjectURL 触发下载；
 * 4) 下载完成后释放 URL 以避免内存泄漏。
 */
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

/**
 * exportPDF()
 * 功能：将当前页 rows 生成 PDF 表格并下载。
 * 逻辑：
 * 1) 使用 jsPDF 创建文档，准备表头/表体数据；
 * 2) 调用 jspdf-autotable 渲染表格（设置字体、表头颜色、边距与列宽）；
 * 3) 以包含页码的文件名保存 PDF；
 * 4) 若异常则在控制台报错并设置 err 供 UI 提示。
 */
async function exportPDF () {
  try {
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

    autoTable(doc, {
      head,
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 110, 253] },
      margin: { top: 40, left: 24, right: 24 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 160 },
        2: { cellWidth: 60 },
        3: { cellWidth: 70 },
      }
    })

    doc.save(`users_page${page.value + 1}.pdf`)
  } catch (e) {
    console.error('[UsersTable] exportPDF error', e)
    err.value = 'Failed to export PDF. Please check console.'
  }
}

/* 自动触发 */
/**
 * onMounted(() => { reload() })
 * 功能：组件挂载后立即加载第一页数据。
 * 逻辑：调用 reload()，内部会重置分页并执行 runQuery(true)。
 */
onMounted(() => { reload() })

/**
 * watch(filters, ..., {deep:true})
 * 功能：对 filters 深度侦听，延迟 300ms 防抖后刷新数据。
 * 逻辑：使用 window.__utimer 做简单防抖，减少频繁输入引发的查询次数。
 */
watch(filters, () => {
  clearTimeout(window.__utimer)
  window.__utimer = setTimeout(() => reload(), 300)
}, { deep: true })

/**
 * watch(sort, ..., {deep:true})
 * 功能：排序条件变更时重新加载数据（不做防抖）。
 * 逻辑：直接调用 reload()，以便用户更改排序即刻生效。
 */
watch(sort, () => reload(), { deep: true })

/**
 * resetFilters()
 * 功能：重置所有过滤与排序为默认值，并刷新列表。
 * 逻辑：将 filters 恢复为空条件、sort 置为按 createdAt desc；随后调用 reload()。
 */
function resetFilters() {
  filters.value = { username: '', email: '', role: '', from: '', to: '' }
  sort.value = { field: 'createdAt', dir: 'desc' }
  reload()
}
</script>

