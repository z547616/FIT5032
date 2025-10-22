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
onMounted(() => {
  ro = new ResizeObserver(() => {
    const el = chartWrapEl.value
    if (!el) return
    chartW.value = Math.max(360, Math.min(980, Math.floor(el.clientWidth)))
  })
  if (chartWrapEl.value) ro.observe(chartWrapEl.value)
})
onBeforeUnmount(() => { if (ro && chartWrapEl.value) ro.unobserve(chartWrapEl.value) })

/* ======= 图表布局 ======= */
const m = { l: 64, r: 24, t: 24, b: 40 }
const innerW = computed(() => chartW.value - m.l - m.r)
const innerH = chartH - m.t - m.b
const firstSlotPadding = computed(() => Math.max(12, innerW.value * 0.02)) // 与 y 轴分隔

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

function isActiveQuick(id){ return activeQuick.value === id }
function onQuickClick(btn){
  if (activeQuick.value === btn.id) {
    activeQuick.value = null
    mood.value = ''
    return
  }
  activeQuick.value = btn.id
  mood.value = btn.value
}
function groupFromMood(v){
  if (v === '' || v == null || isNaN(v)) return null
  const n = Number(v)
  if (n <= 2) return 'dep'       // 0,1,2
  if (n <= 4) return 'anx'       // 3,4
  if (n <= 6) return 'neu'       // 5,6
  if (n <= 8) return 'con'       // 7,8
  return 'joy'                   // 9,10
}
function onSliderInput(){ syncQuickWithMood() }
function onNumberInput(){
  if (mood.value === '' || mood.value == null) { activeQuick.value = null; return }
  let n = Math.round(Number(mood.value))
  if (isNaN(n)) { mood.value = ''; activeQuick.value = null; return }
  n = Math.max(0, Math.min(10, n))
  mood.value = n
  syncQuickWithMood()
}
function syncQuickWithMood(){ activeQuick.value = groupFromMood(mood.value) }
const sliderPercent = computed(() => {
  const v = (mood.value === '' || mood.value == null || isNaN(mood.value)) ? 0 : Math.max(0, Math.min(10, Number(mood.value)))
  return (v / 10) * 100
})
const moodDisplay = computed(() => (mood.value === '' || mood.value == null) ? '-' : Number(mood.value))
watch(mood, () => syncQuickWithMood())

/* ======= Firestore 订阅 ======= */
function subscribe(userId) {
  const q30 = query(collection(db, 'users', userId, 'moodEntries'), orderBy('createdAt', 'desc'), limit(30))
  const unsub30 = onSnapshot(q30, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    entries30.value = list
    entries5.value = [...list].slice(0, 5).reverse()
  })
  unsubscribe.value = () => { unsub30 && unsub30() }
}
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (unsubscribe.value) { unsubscribe.value(); unsubscribe.value = null }
    entries30.value = []
    entries5.value = []
    if (user) subscribe(user.uid)
  })
})
onBeforeUnmount(() => { if (unsubscribe.value) { unsubscribe.value(); unsubscribe.value = null } })

/* ======= 图表数学 ======= */
const yMin = 0, yMax = 10
function yToPx(y) {
  const clamped = Math.max(yMin, Math.min(yMax, Number(y)))
  const t = (clamped - yMin) / (yMax - yMin)
  return m.t + (1 - t) * innerH
}
const yTicks = computed(() => Array.from({ length: 6 }, (_, i) => i * 2))

const slots = 5
const chartPoints = computed(() => entries5.value || [])
const slotGap = computed(() => {
  const effectiveW = Math.max(0, innerW.value - firstSlotPadding.value)
  return effectiveW / (slots - 1)
})
const startOffset = computed(() => {
  const n = chartPoints.value.length
  if (n >= slots) return 0
  return Math.floor((slots - n) / 2)
})
function xToSlotPx(index) {
  const slotIndex = startOffset.value + index
  return m.l + firstSlotPadding.value + slotIndex * slotGap.value
}

/* 平滑曲线路径（Catmull–Rom → Bézier） */
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
function clearPointPopup() { pointPopup.value.open = false }
function openPointPopup(i) {
  const e = chartPoints.value[i]
  if (!e) return
  pointPopup.value = { open: true, entry: e, px: { x: xToSlotPx(i), y: yToPx(e.mood) } }
}
const popupStyle = computed(() => {
  if (!pointPopup.value.open) return {}
  const left = Math.max(0, Math.min(chartW.value - 260, pointPopup.value.px.x - 130))
  const top = Math.max(0, pointPopup.value.px.y - 140)
  return { left: `${left}px`, top: `${top}px` }
})

/* 最近 30 条列表浮层 */
function toggleList() { listOpen.value = !listOpen.value; if (!listOpen.value) listSelected.value = null }
const listEntries = computed(() => entries30.value || [])
function selectListEntry(e) { listSelected.value = e }

/* 保存 */
const canSave = computed(() => mood.value !== '' && Number(mood.value) >= 0 && Number(mood.value) <= 10)
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
function resetMood(){
  mood.value = ''
  notes.value = ''
  activeQuick.value = null
}

/* 工具：时间格式（MM/DD 与 HH:MM 24h） */
function pad2(n){ return String(n).padStart(2,'0') }
function toDate(ts){
  try { return ts?.toDate ? ts.toDate() : new Date(ts) } catch { return new Date() }
}
function formatDateMMDD(ts){
  const d = toDate(ts)
  return `${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`
}
function formatTimeHHMM(ts){
  const d = toDate(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
function truncate(s, n = 80) {
  const t = String(s || '')
  return t.length > n ? (t.slice(0, n) + '…') : t
}
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
