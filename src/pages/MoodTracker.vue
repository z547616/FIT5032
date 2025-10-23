<template>
  <div class="bg-white min-vh-100">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between px-3 py-3 border-bottom bg-white sticky-top" style="z-index: 20;">
      <h2 class="text-primary m-0 d-flex align-items-center gap-2">😊 Mood Tracker</h2>
    </div>

    <div class="container py-4" style="max-width: 1040px;">
      <!-- 上：Mood History -->
      <div class="card border-0 shadow-sm rounded-4 mb-4">
        <div class="card-body p-3 p-md-4">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h4 class="m-0">Mood History</h4>
            <button class="btn btn-outline-secondary btn-sm" @click="toggleList" title="详细信息">
              <i class="bi bi-list-ul"></i>
            </button>
          </div>

          <!-- y 轴标题放到顶部 -->
          <div class="d-flex align-items-center gap-2 mb-2 ms-2">
            <span class="badge bg-light text-secondary">Level (0–10)</span>
          </div>

          <!-- 图表 -->
          <div class="chart-wrapper" ref="chartWrapEl">
            <svg :width="chartW" :height="chartH" class="chart-svg" @click="clearPointPopup">
              <!-- 背景框 -->
              <rect :x="m.l" :y="m.t" :width="innerW" :height="innerH" fill="#fff" stroke="#e5e7eb" />

              <!-- Y 网格 + 刻度 -->
              <g v-for="tick in yTicks" :key="'y'+tick">
                <line
                  :x1="m.l + firstSlotPadding" :x2="m.l + innerW"
                  :y1="yToPx(tick)" :y2="yToPx(tick)"
                  stroke="#f1f5f9" />
                <text :x="m.l - 10" :y="yToPx(tick) + 4" text-anchor="end" font-size="12" fill="#64748b">
                  {{ tick }}
                </text>
              </g>

              <!-- Y 轴（右移，避免首点贴轴） -->
              <line
                :x1="m.l + firstSlotPadding" :x2="m.l + firstSlotPadding"
                :y1="m.t" :y2="m.t + innerH"
                stroke="#94a3b8" />

              <!-- X 刻度（首个刻度线不画，仅显示标签；标签分两行：MM/DD 与 HH:MM） -->
              <g v-for="(pt, i) in chartPoints" :key="'x'+(pt.id||i)">
                <line
                  v-if="i !== 0"
                  :x1="xToSlotPx(i)" :x2="xToSlotPx(i)"
                  :y1="m.t + innerH" :y2="m.t + innerH + 6"
                  stroke="#94a3b8" />
                <text
                  :x="xToSlotPx(i)" :y="m.t + innerH + 14"
                  text-anchor="middle" font-size="11" fill="#64748b">
                  <tspan :x="xToSlotPx(i)" dy="0">{{ formatDateMMDD(pt.createdAt) }}</tspan>
                  <tspan :x="xToSlotPx(i)" dy="14">{{ formatTimeHHMM(pt.createdAt) }}</tspan>
                </text>
              </g>

              <!-- 平滑曲线 -->
              <path v-if="chartPoints.length >= 2" :d="smoothPathD" fill="none" stroke="#0ea5e9" stroke-width="2.5" />

              <!-- 节点 -->
              <g v-for="(pt, i) in chartPoints" :key="'p'+(pt.id||i)">
                <circle
                  :cx="xToSlotPx(i)"
                  :cy="yToPx(pt.mood)"
                  :r="hoverIndex === i ? 6.5 : 5"
                  :fill="hoverIndex === i ? '#22c55e' : '#0ea5e9'"
                  :stroke="hoverIndex === i ? '#14532d' : '#0c4a6e'"
                  stroke-width="1.5"
                  style="cursor: pointer;"
                  @mouseenter="hoverIndex = i"
                  @mouseleave="hoverIndex = -1"
                  @click.stop="openPointPopup(i)" />
                <text
                  v-if="hoverIndex === i"
                  :x="xToSlotPx(i)" :y="yToPx(pt.mood) - 12"
                  text-anchor="middle" font-size="12" fill="#0f172a">
                  {{ pt.mood }}/10
                </text>
              </g>
            </svg>

            <!-- 点详情浮框 -->
            <div v-if="pointPopup.open" class="point-popup card shadow-sm" :style="popupStyle">
              <div class="card-body p-3">
                <div class="d-flex align-items-start justify-content-between">
                  <div class="fw-semibold">Mood: {{ pointPopup.entry?.mood }}/10</div>
                  <button class="btn btn-sm btn-outline-secondary" @click.stop="pointPopup.open = false">Close</button>
                </div>
                <div class="small text-muted mt-1">{{ formatFullDateTime(pointPopup.entry?.createdAt) }}</div>
                <div class="mt-2">
                  <div class="fw-semibold mb-1">Notes</div>
                  <div style="white-space: pre-wrap;">{{ pointPopup.entry?.notes || '—' }}</div>
                </div>
              </div>
            </div>

            <div v-if="chartPoints.length === 0" class="text-muted small text-center mt-2">
              No mood entries yet.
            </div>
          </div>
        </div>
      </div>

      <!-- 下：Log Mood Now（滑块 + 快捷按钮 + Reset） -->
      <div class="card border-0 shadow-sm rounded-4 mb-5">
        <div class="card-body p-3 p-md-4">
          <div class="d-flex align-items-center justify-content-between">
            <h4 class="mb-0">Log Mood Now</h4>
            <button class="btn btn-outline-secondary btn-sm" @click="resetMood" title="Reset">
              <i class="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>

          <!-- 滑块 + 数值 -->
          <div class="mt-3">
            <label class="form-label fw-semibold d-flex align-items-center justify-content-between">
              <span>Mood level (0–10)</span>
              <input
                v-model.number="mood"
                type="number"
                class="form-control form-control-sm w-auto"
                min="0" max="10"
                @input="onNumberInput"
              />
            </label>

            <div class="slider-wrap position-relative">
              <!-- 数值气泡（跟随滑块） -->
              <div class="bubble" :style="{ left: sliderPercent + '%' }">
                {{ moodDisplay }}
              </div>

              <input
                ref="sliderRef"
                type="range"
                class="form-range"
                min="0" max="10" step="1"
                v-model.number="mood"
                @input="onSliderInput"
              />
              <div class="d-flex justify-content-between small text-muted">
                <span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span>
              </div>
            </div>
          </div>

          <!-- 快捷按钮（换为 Bootstrap Icons，完美居中） -->
          <div class="d-flex gap-2 mt-3 flex-wrap">
            <button
              v-for="b in quickButtons"
              :key="b.id"
              type="button"
              class="btn quick-btn"
              :class="isActiveQuick(b.id) ? 'btn-primary active' : 'btn-outline-primary'"
              @click="onQuickClick(b)"
              :title="b.label"
              aria-pressed="isActiveQuick(b.id)"
            >
              <i :class="['bi', b.icon]" class="quick-icon"></i>
            </button>
          </div>

          <!-- Notes + Save -->
          <form @submit.prevent="submitForm" class="row g-3 mt-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Notes</label>
              <textarea
                v-model="notes"
                class="form-control rounded-3"
                rows="3"
                maxlength="200"
                placeholder="How are you feeling now?"></textarea>
            </div>
            <div class="col-12">
              <button type="submit" class="btn btn-primary rounded-3" :disabled="!canSave">Save Entry</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 最近 30 条列表浮层 -->
    <div v-if="listOpen" class="overlay" @click.self="toggleList">
      <div class="list-card card shadow-lg">
        <div class="card-header d-flex align-items-center justify-content-between">
          <strong>Recent 30 mood entries</strong>
          <button class="btn btn-sm btn-outline-secondary" @click="toggleList">Close</button>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style="width: 90px;">Mood</th>
                  <th>Notes</th>
                  <th style="width: 200px;">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in listEntries" :key="e.id" class="table-row-click" @click="selectListEntry(e)">
                  <td class="fw-semibold">{{ e.mood }}/10</td>
                  <td class="text-muted">{{ truncate(e.notes, 80) }}</td>
                  <td>{{ formatFullDateTime(e.createdAt) }}</td>
                </tr>
                <tr v-if="listEntries.length === 0">
                  <td colspan="3" class="text-muted">No mood entries.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="listSelected" class="border-top p-3">
            <div class="d-flex align-items-start justify-content-between">
              <div class="fw-semibold">Mood: {{ listSelected.mood }}/10</div>
              <button class="btn btn-sm btn-outline-secondary" @click="listSelected = null">Hide details</button>
            </div>
            <div class="small text-muted mt-1">{{ formatFullDateTime(listSelected.createdAt) }}</div>
            <div class="mt-2">
              <div class="fw-semibold mb-1">Notes</div>
              <div style="white-space: pre-wrap;">{{ listSelected.notes || '—' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore'

/* ======= 响应式图表尺寸 ======= */
const chartWrapEl = ref(null)
const chartW = ref(920)
const chartH = 300
let ro = null

/**
 * 生命周期：组件挂载后
 * 逻辑说明：
 * - 创建 ResizeObserver 监听图表外层容器宽度变化
 * - 将可视宽度夹在 [360, 980] 范围内，避免过窄/过宽导致布局破坏
 * - 观察 chartWrapEl，触发时更新 chartW，从而联动所有依赖宽度的计算属性
 */
onMounted(() => {
  ro = new ResizeObserver(() => {
    const el = chartWrapEl.value
    if (!el) return
    chartW.value = Math.max(360, Math.min(980, Math.floor(el.clientWidth)))
  })
  if (chartWrapEl.value) ro.observe(chartWrapEl.value)
})

/**
 * 生命周期：组件卸载前
 * 逻辑说明：
 * - 取消 ResizeObserver 的观察，防止内存泄漏
 */
onBeforeUnmount(() => { if (ro && chartWrapEl.value) ro.unobserve(chartWrapEl.value) })

/* ======= 图表布局 ======= */
const m = { l: 64, r: 24, t: 24, b: 40 }
const innerW = computed(() => chartW.value - m.l - m.r) // 可绘制宽度
const innerH = chartH - m.t - m.b                        // 可绘制高度
const firstSlotPadding = computed(() => Math.max(12, innerW.value * 0.02)) // 首个 x 槽位与 y 轴的间隔

/* ======= 数据 ======= */
const mood = ref('')
const notes = ref('')
const entries5 = ref([])
const entries30 = ref([])
const unsubscribe = ref(null)

const listOpen = ref(false)
const listSelected = ref(null)

const hoverIndex = ref(-1)
const pointPopup = ref({ open: false, entry: null, px: { x: 0, y: 0 } })

/* ======= 快捷按钮：改用 Bootstrap Icons（水平+垂直完美居中） ======= */
const sliderRef = ref(null)
const quickButtons = [
  { id: 'dep', label: 'Depressed (2)', icon: 'bi-emoji-frown',     value: 2 },
  { id: 'anx', label: 'Anxious (4)',   icon: 'bi-emoji-dizzy',     value: 4 },
  { id: 'neu', label: 'Neutral (6)',   icon: 'bi-emoji-neutral',   value: 6 },
  { id: 'con', label: 'Content (8)',   icon: 'bi-emoji-smile',     value: 8 },
  { id: 'joy', label: 'Joyful (10)',   icon: 'bi-emoji-laughing',  value: 10 },
]
const activeQuick = ref(null)

/**
 * 判断某个快捷按钮是否处于激活态
 * 逻辑说明：
 * - 将按钮 id 与当前激活分组 activeQuick 对比，用于高亮样式绑定
 */
function isActiveQuick(id){ return activeQuick.value === id }

/**
 * 点击快捷按钮
 * 逻辑说明：
 * - 若重复点击同一按钮：取消激活并清空 mood
 * - 否则：设置激活分组，并把 mood 直接设置为该分组预设数值
 * - 通过更改 mood 驱动输入框、滑块和气泡联动
 */
function onQuickClick(btn){
  if (activeQuick.value === btn.id) {
    activeQuick.value = null
    mood.value = ''
    return
  }
  activeQuick.value = btn.id
  mood.value = btn.value
}

/**
 * 根据 mood 数值映射到分组
 * 逻辑说明：
 * - 将 0–10 的整数分段映射到 dep/anx/neu/con/joy 五个分组
 * - 无效/空值返回 null，用于清空激活态
 */
function groupFromMood(v){
  if (v === '' || v == null || isNaN(v)) return null
  const n = Number(v)
  if (n <= 2) return 'dep'       // 0,1,2
  if (n <= 4) return 'anx'       // 3,4
  if (n <= 6) return 'neu'       // 5,6
  if (n <= 8) return 'con'       // 7,8
  return 'joy'                   // 9,10
}

/**
 * 滑块输入事件
 * 逻辑说明：
 * - 滑块变动后基于当前 mood 推导并同步快捷分组高亮
 */
function onSliderInput(){ syncQuickWithMood() }

/**
 * 数字输入框输入事件
 * 逻辑说明：
 * - 空值：清空快捷分组
 * - 非法值：重置 mood 与分组
 * - 合法值：对输入值取整并夹紧到 0–10 后回写 mood
 * - 最后同步快捷分组选中态
 */
function onNumberInput(){
  if (mood.value === '' || mood.value == null) { activeQuick.value = null; return }
  let n = Math.round(Number(mood.value))
  if (isNaN(n)) { mood.value = ''; activeQuick.value = null; return }
  n = Math.max(0, Math.min(10, n))
  mood.value = n
  syncQuickWithMood()
}

/**
 * 将当前 mood 同步到快捷按钮分组
 * 逻辑说明：
 * - 调用 groupFromMood 派生分组 id，并更新 activeQuick
 */
function syncQuickWithMood(){ activeQuick.value = groupFromMood(mood.value) }

/**
 * 计算属性：滑块气泡的百分比位置（0–100）
 * 逻辑说明：
 * - 先将 mood 规范化到 0–10，再转换为百分比
 * - 空/NaN 时定位到 0%
 */
const sliderPercent = computed(() => {
  const v = (mood.value === '' || mood.value == null || isNaN(mood.value)) ? 0 : Math.max(0, Math.min(10, Number(mood.value)))
  return (v / 10) * 100
})

/**
 * 计算属性：气泡显示的文本
 * 逻辑说明：
 * - 空值显示 '-'，否则显示数值
 */
const moodDisplay = computed(() => (mood.value === '' || mood.value == null) ? '-' : Number(mood.value))

/**
 * 侦听器：mood 变化时同步快捷分组
 * 逻辑说明：
 * - 任何外部对 mood 的修改（如按钮、滑块、表单）都会触发分组刷新
 */
watch(mood, () => syncQuickWithMood())

/* ======= Firestore 订阅 ======= */
/**
 * 订阅当前用户最近 30 条情绪记录
 * 逻辑说明：
 * - 构建按 createdAt 倒序的查询，限制 30 条
 * - onSnapshot 实时监听：更新 entries30 和 entries5（取前 5 条并反转为时间正序用于绘图）
 * - 返回的 unsub 保存到 unsubscribe，便于后续取消订阅
 */
function subscribe(userId) {
  const q30 = query(collection(db, 'users', userId, 'moodEntries'), orderBy('createdAt', 'desc'), limit(30))
  const unsub30 = onSnapshot(q30, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    entries30.value = list
    entries5.value = [...list].slice(0, 5).reverse()
  })
  unsubscribe.value = () => { unsub30 && unsub30() }
}

/**
 * 生命周期：挂载后监听登录状态
 * 逻辑说明：
 * - 用户切换或登出时：先取消旧订阅，清空数据
 * - 登录时：按用户 uid 建立实时订阅
 */
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (unsubscribe.value) { unsubscribe.value(); unsubscribe.value = null }
    entries30.value = []
    entries5.value = []
    if (user) subscribe(user.uid)
  })
})

/**
 * 生命周期：卸载前清理订阅
 * 逻辑说明：
 * - 若存在订阅函数，调用后置空，避免内存泄漏与无谓回调
 */
onBeforeUnmount(() => { if (unsubscribe.value) { unsubscribe.value(); unsubscribe.value = null } })

/* ======= 图表数学 ======= */
const yMin = 0, yMax = 10

/**
 * 数值 → 像素（Y 轴）
 * 逻辑说明：
 * - 将 y 值夹紧到 [yMin,yMax]
 * - 归一化到 [0,1] 后按内框高度 innerH 映射到像素坐标（SVG y 轴向下，故 1-t）
 */
function yToPx(y) {
  const clamped = Math.max(yMin, Math.min(yMax, Number(y)))
  const t = (clamped - yMin) / (yMax - yMin)
  return m.t + (1 - t) * innerH
}

/**
 * 计算属性：Y 轴刻度集合
 * 逻辑说明：
 * - 生成 0,2,4,6,8,10 六个刻度，用于网格与标签
 */
const yTicks = computed(() => Array.from({ length: 6 }, (_, i) => i * 2))

const slots = 5
/**
 * 计算属性：用于绘图的点集（最近 5 条）
 * 逻辑说明：
 * - 直接暴露 entries5，用于模板循环
 */
const chartPoints = computed(() => entries5.value || [])

/**
 * 计算属性：相邻 x 槽位的水平间距
 * 逻辑说明：
 * - 扣除首槽 padding 后，将剩余宽度均分成 slots-1 段
 */
const slotGap = computed(() => {
  const effectiveW = Math.max(0, innerW.value - firstSlotPadding.value)
  return effectiveW / (slots - 1)
})

/**
 * 计算属性：起始偏移槽位
 * 逻辑说明：
 * - 若点数少于槽位数，为使曲线居中，将起点右移 (slots - n)/2（向下取整）
 */
const startOffset = computed(() => {
  const n = chartPoints.value.length
  if (n >= slots) return 0
  return Math.floor((slots - n) / 2)
})

/**
 * 槽位索引 → 像素（X 轴）
 * 逻辑说明：
 * - 先加上起始偏移，再乘以槽距，最后加上 y 轴与首槽的 padding 与左边距 m.l
 */
function xToSlotPx(index) {
  const slotIndex = startOffset.value + index
  return m.l + firstSlotPadding.value + slotIndex * slotGap.value
}

/* 平滑曲线路径（Catmull–Rom → Bézier） */
/**
 * 计算属性：生成平滑曲线的 SVG path d 字符串
 * 逻辑说明：
 * - 将点集映射为像素坐标 P
 * - 使用 Catmull-Rom 样条近似，转换为一系列三次贝塞尔段（C 命令）
 * - tension 控制平滑程度；不足 2 点返回空路径
 */
const smoothPathD = computed(() => {
  const pts = chartPoints.value
  if (!pts || pts.length < 2) return ''
  const P = pts.map((p, i) => ({ x: xToSlotPx(i), y: yToPx(p.mood) }))
  const tension = 0.5
  const path = []
  path.push(`M ${P[0].x} ${P[0].y}`)
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension
    path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
  }
  return path.join(' ')
})

/* 点详情浮框 */
/**
 * 清除点浮框
 * 逻辑说明：
 * - 关闭浮层但不改动 entry 数据
 */
function clearPointPopup() { pointPopup.value.open = false }

/**
 * 打开指定索引的点浮框
 * 逻辑说明：
 * - 根据索引 i 取出对应数据点
 * - 计算其在图上的像素位置，设置浮层状态与定位
 * - 若索引无效则直接返回
 */
function openPointPopup(i) {
  const e = chartPoints.value[i]
  if (!e) return
  pointPopup.value = { open: true, entry: e, px: { x: xToSlotPx(i), y: yToPx(e.mood) } }
}

/**
 * 计算属性：浮框的内联样式（像素定位）
 * 逻辑说明：
 * - 基于点的像素坐标居中/上方定位浮层
 * - 同时对 left/top 做边界裁剪，避免溢出容器
 */
const popupStyle = computed(() => {
  if (!pointPopup.value.open) return {}
  const left = Math.max(0, Math.min(chartW.value - 260, pointPopup.value.px.x - 130))
  const top = Math.max(0, pointPopup.value.px.y - 140)
  return { left: `${left}px`, top: `${top}px` }
})

/* 最近 30 条列表浮层 */
/**
 * 开关“最近 30 条”列表浮层
 * 逻辑说明：
 * - 取反弹层开关；如果关闭则清空当前选择的列表项
 */
function toggleList() { listOpen.value = !listOpen.value; if (!listOpen.value) listSelected.value = null }

/**
 * 计算属性：列表数据
 * 逻辑说明：
 * - 直接暴露 entries30，若空则返回空数组，便于模板渲染
 */
const listEntries = computed(() => entries30.value || [])

/**
 * 选择某一条列表项
 * 逻辑说明：
 * - 将该条记录设置为 listSelected，用于下方详情展示
 */
function selectListEntry(e) { listSelected.value = e }

/* 保存 */
/**
 * 计算属性：是否可保存
 * 逻辑说明：
 * - mood 非空，且在 0–10 范围内才允许提交
 */
const canSave = computed(() => mood.value !== '' && Number(mood.value) >= 0 && Number(mood.value) <= 10)

/**
 * 规范化备注文本（本地处理）
 * 逻辑说明：
 * - 去除首尾空白并按句号/问号/感叹号切分
 * - 每句首字母大写，末尾若无标点则补句号
 * - 返回整洁的单段字符串；空输入返回空串
 */
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
  if (!/[.!?]$/.test(sentences[sentences.length - 1])) sentences[sentences.length - 1] += '.'
  return sentences.join(' ')
}

/**
 * 提交表单（保存一条心情记录）
 * 逻辑说明：
 * - 读取当前登录用户 uid；未登录直接返回
 * - 校验 mood 数值合法（0–10）
 * - 规范化 notes 文本
 * - 向 Firestore 添加文档：日期、四舍五入的 mood、notes、serverTimestamp
 * - 成功后调用 resetMood 重置输入状态
 */
async function submitForm () {
  const user = auth.currentUser?.uid
  if (!user) return
  const mval = Number(mood.value)
  if (Number.isNaN(mval) || mval < 0 || mval > 10) return
  const normalized = normalizeNotesLocal(notes.value)
  await addDoc(collection(db, 'users', user, 'moodEntries'), {
    date: new Date().toLocaleDateString(),
    mood: Math.round(mval),
    notes: normalized,
    createdAt: serverTimestamp()
  })
  resetMood()
}

/* Reset（按钮） */
/**
 * 重置输入状态
 * 逻辑说明：
 * - 清空 mood 与 notes
 * - 取消快捷分组高亮
 */
function resetMood(){
  mood.value = ''
  notes.value = ''
  activeQuick.value = null
}

/* 工具：时间格式（MM/DD 与 HH:MM 24h） */
/**
 * 数字补零到 2 位
 */
function pad2(n){ return String(n).padStart(2,'0') }

/**
 * 统一将 Firestore Timestamp 或时间值转换为 Date
 * 逻辑说明：
 * - 支持 timestamp.toDate() 与原生 Date 构造；异常时回退到当前时间
 */
function toDate(ts){
  try { return ts?.toDate ? ts.toDate() : new Date(ts) } catch { return new Date() }
}

/**
 * 将时间格式化为 MM/DD
 */
function formatDateMMDD(ts){
  const d = toDate(ts)
  return `${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`
}

/**
 * 将时间格式化为 24 小时制 HH:MM
 */
function formatTimeHHMM(ts){
  const d = toDate(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * 文本截断
 * 逻辑说明：
 * - 超过 n 长度则截断并追加省略号
 */
function truncate(s, n = 80) {
  const t = String(s || '')
  return t.length > n ? (t.slice(0, n) + '…') : t
}

/**
 * 将时间格式化为本地字符串
 * 逻辑说明：
 * - 支持 Timestamp 与 Date；异常时返回空串
 */
function formatFullDateTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString()
  } catch { return '' }
}
</script>


<style scoped>
.container { max-width: 1040px; }

/* 图表容器 */
.chart-wrapper{
  position: relative;
  width: 100%;
  display: grid;
  place-items: center;
}
.chart-svg{ display: block; max-width: 100%; }

/* 节点浮出框 */
.point-popup{
  position: absolute; width: 260px; border-radius: 10px;
}

/* 列表浮层 */
.overlay{
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  z-index: 50; display: grid; place-items: center;
}
.list-card{ width: min(920px, 95vw); border-radius: 12px; }
.table-row-click{ cursor: pointer; }
.table-row-click:hover{ background: #f8fafc; }

/* 滑块 + 气泡 */
.slider-wrap { margin-top: .25rem; }
.slider-wrap .form-range { margin-top: 22px; }
.bubble{
  position: absolute; top: 0; transform: translateX(-50%);
  background: #0ea5e9; color: #fff; font-weight: 600;
  padding: 2px 8px; border-radius: 999px; font-size: 12px; line-height: 1.4;
  pointer-events: none;
}

/* 快捷按钮：使用 flex 完美居中（替换掉 emoji 导致的视觉偏移） */
.quick-btn{
  width: 52px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  padding: 0;
}
.quick-btn.active{
  box-shadow: 0 0 0 3px rgba(13,110,253,.15) inset;
}
.quick-icon{
  font-size: 1.5rem;
  line-height: 1;
}
</style>
