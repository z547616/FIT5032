<template>
  <div class="container-fluid p-0">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between px-3 py-3 border-bottom bg-white sticky-top" style="z-index: 20;">
      <h2 class="text-primary m-0 d-flex align-items-center gap-2">
        🥾 Mood Walks
      </h2>

      <!-- Summary -->
      <div v-if="summary" class="d-flex align-items-center gap-2">
        <span class="badge bg-primary-subtle text-primary">
          {{ summary.choice }} · {{ (summary.distance/1000).toFixed(1) }} km · {{ Math.round(summary.duration/60) }} min · Score {{ summary.score }}
        </span>
        <span v-if="summary.veryLong" class="badge bg-danger-subtle text-danger">very long walk</span>

        <button class="btn btn-sm btn-outline-secondary ms-1" @click="toggleHelp" title="What do these numbers mean?">
          <i class="bi bi-question-circle"></i>
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="map-toolbar shadow-sm bg-white p-3 d-flex gap-2 align-items-center flex-wrap">
      <button class="btn btn-outline-primary" @click="locateMe">
        <i class="bi bi-geo"></i> My location
      </button>

      <div class="d-flex align-items-center gap-2">
        <input
          class="form-control"
          style="min-width: 320px"
          v-model="destQuery"
          placeholder="Search destination (park / address)"
          @keyup.enter="searchDest"
        />
        <button class="btn btn-primary" @click="searchDest">Search</button>
      </div>

      <!-- Choice selector -->
      <div class="d-flex align-items-center gap-2">
        <label class="small text-muted">Choice</label>
        <select v-model="selectedChoice" class="form-select form-select-sm w-auto">
          <option value="Calming">Calming</option>
          <option value="Happiness">Happiness</option>
          <option value="Relaxation">Relaxation</option>
          <option value="Focus">Focus</option>
          <option value="Scenic">Scenic</option>
          <option value="Shortest">Shortest</option>
        </select>
      </div>

      <div class="ms-auto d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary" :disabled="!routeReady" @click="clearRoute">Clear route</button>
        <button class="btn btn-outline-info" :disabled="!authReady" @click="openHistory">History</button>
        <button class="btn btn-success" :disabled="!routeReady" @click="openFinishDialog">Finish walk</button>
      </div>
    </div>

    <!-- Map -->
    <div class="map position-relative" ref="mapEl">
      <!-- Search results panel -->
      <div v-if="searchResults.length > 0" class="results-panel card shadow-sm">
        <div class="card-header d-flex align-items-center justify-content-between py-2 px-3">
          <strong>Choose a destination</strong>
          <button class="btn btn-sm btn-outline-secondary" @click="clearResults">Close</button>
        </div>
        <div class="list-group list-group-flush">
          <button
            v-for="r in searchResultsSorted"
            :key="r.id"
            class="list-group-item list-group-item-action py-2"
            @click="chooseDestination(r)"
          >
            <div class="d-flex justify-content-between align-items-start">
              <div class="me-3">
                <div class="fw-semibold">{{ r.name }}</div>
                <div class="small text-muted">{{ r.place_name }}</div>
              </div>
              <span class="badge bg-primary-subtle text-primary">{{ r.distanceKm.toFixed(1) }} km</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Finish dialog -->
    <div v-if="finishDialog.open" class="overlay" @click.self="closeFinishDialog(false)">
      <div class="finish-card card shadow-lg">
        <div class="card-header d-flex align-items-center justify-content-between">
          <strong>How do you feel now?</strong>
          <button class="btn btn-sm btn-outline-secondary" @click="closeFinishDialog(false)">Close</button>
        </div>
        <div class="card-body">
          <div class="mb-2">Please rate your mood level from <strong>0</strong> (very low) to <strong>10</strong> (excellent).</div>
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <input type="number" class="form-control w-auto" v-model.number="finishDialog.mood" min="0" max="10" />
            <input type="range" class="form-range" v-model.number="finishDialog.mood" min="0" max="10" step="1" style="width: 260px;" />
            <span class="badge bg-primary-subtle text-primary fs-6">{{ finishDialog.mood }}</span>
          </div>
        </div>
        <div class="card-footer d-flex justify-content-end gap-2">
          <button class="btn btn-outline-secondary" @click="closeFinishDialog(true)">Close</button>
          <button class="btn btn-primary" @click="saveFinish">Save</button>
        </div>
      </div>
    </div>

    <!-- History overlay -->
    <div v-if="history.open" class="overlay" @click.self="closeHistory">
      <div class="history-card card shadow-lg">
        <div class="card-header d-flex align-items-center justify-content-between">
          <strong>Last 30 days</strong>
          <button class="btn btn-sm btn-outline-secondary" @click="closeHistory">Close</button>
        </div>

        <div v-if="history.error" class="alert alert-danger py-2 px-3 m-3">
          {{ history.error }}
        </div>

        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Choice</th>
                <th>Time</th>
                <th>Start</th>
                <th>End</th>
                <th>Dist (km)</th>
                <th>Dur (min)</th>
                <th>Score</th>
                <th>Mood</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="w in history.items"
                :key="w.id"
                class="table-row-click"
                @click="showHistoryRoute(w)"
                title="Show route on map"
              >
                <td>{{ w.routeSummary?.choice || w.choice || '—' }}</td>
                <td>{{ formatTs(w.createdAt) }}</td>
                <td>{{ w.startName || formatCoord(w.start) }}</td>
                <td>{{ w.endName || formatCoord(w.end) }}</td>
                <td>{{ toKm(w.routeSummary?.distance) }}</td>
                <td>{{ toMin(w.routeSummary?.duration) }}</td>
                <td>{{ w.routeSummary?.score ?? '—' }}</td>
                <td>{{ w.moodLevel ?? '—' }}</td>
              </tr>
              <tr v-if="history.loading">
                <td colspan="8" class="text-muted">Loading…</td>
              </tr>
              <tr v-if="!history.loading && history.items.length === 0">
                <td colspan="8" class="text-muted">No walks.</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>

    <!-- Help overlay -->
    <div v-if="showHelp" class="overlay" @click.self="toggleHelp">
      <div class="help-card card shadow-lg">
        <div class="card-header d-flex align-items-center justify-content-between">
          <strong>What do these numbers mean?</strong>
          <button class="btn btn-sm btn-outline-secondary" @click="toggleHelp">Close</button>
        </div>
        <div class="card-body small">
          <ul class="mb-2">
            <li><strong>Choice</strong>: The selected route type. “Calming” prefers quieter segments over busy primary roads.</li>
            <li><strong>Distance (km)</strong>: Total route length.</li>
            <li><strong>Time (min)</strong>: Estimated walking duration returned by Mapbox Directions.</li>
            <li><strong>Score (0–100)</strong>: A normalized comfort score combining quietness and duration.</li>
          </ul>
          <div>
            <strong>Score formula</strong> (normalized to 0–100):
            <pre class="bg-light p-2 mb-0 rounded-2" style="white-space: pre-wrap;">durationMin = durationSeconds / 60
durationPenalty = clamp(durationMin, 0, 120) / 120       // 0 (short) → 1 (very long)
quietScore     = (1 - penalty) * 30                       // penalty from primary-road share (0..1)
durationScore  = (1 - durationPenalty) * 70               // shorter is better
Score          = round( durationScore + quietScore )      // 0..100 overall</pre>
            <small class="text-muted d-block mt-2">
              “Very long walk” appears if the route is unusually long (e.g., &gt; 90 min).
            </small>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useMapbox } from '../composables/useMapbox'
import { auth, db } from '../firebase'
import {
  collection, addDoc, serverTimestamp,
  where, query, onSnapshot
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const { createMap, addMarker, fitToPoints, geocode, getDirections, reverseGeocode, mapboxgl } = useMapbox()

/* ---------------- state ---------------- */
const mapEl = ref(null)
let map

const start = ref([144.9631,-37.8136])         // default: Melbourne CBD
const dest = ref(null)

let startMarker, destMarker
let routeMainId = null, routeAltId = null
let sourceMainId = null, sourceAltId = null

const destQuery = ref('')
const routeReady = ref(false)
const authReady = ref(false)
const summary = ref(null)

const selectedChoice = ref('Calming') // user-selectable choice

/* finish dialog */
const finishDialog = ref({ open:false, mood: 5 })

/* help overlay */
const showHelp = ref(false)
function toggleHelp(){ showHelp.value = !showHelp.value }

/* search results */
const searchResults = ref([]) // [{ id, name, place_name, center:[lng,lat], distanceKm }]
function clearResults(){ searchResults.value = [] }

/* history overlay */
const history = ref({ open:false, items:[], loading:false, error:'' })
let unsubscribeHistory = null
function openHistory(){
  history.value.open = true
  subscribeHistory()
}
function closeHistory(){
  history.value.open = false
  if (typeof unsubscribeHistory === 'function') {
    unsubscribeHistory()
    unsubscribeHistory = null
  }
}

/* ---------------- utils ---------------- */
function haversineKm(a, b){
  const toRad = d => d*Math.PI/180
  const R=6371
  const dLat=toRad(b[1]-a[1]); const dLng=toRad(b[0]-a[0])
  const lat1=toRad(a[1]); const lat2=toRad(b[1])
  const x=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
  return 2*R*Math.asin(Math.sqrt(x))
}
function formatTs(ts){
  try{
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString()
  } catch { return '' }
}
function formatCoord(pt){
  if (!pt) return ''
  const {lng, lat} = pt
  return `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`
}
function toKm(m){ return m ? (m/1000).toFixed(1) : '—' }
function toMin(s){ return s ? Math.round(s/60) : '—' }

/* Always 0..100 */
function computeScore(durationSec, penalty){
  const clamp = (x,min,max)=> Math.max(min, Math.min(max, x))
  const durationMin = durationSec/60
  const durationPenalty = clamp(durationMin, 0, 120) / 120   // 0(short) .. 1(very long)
  const quietScore = (1 - clamp(penalty,0,1)) * 30           // 0..30
  const durationScore = (1 - durationPenalty) * 70           // 0..70
  return Math.round(quietScore + durationScore)              // 0..100
}

const VERY_LONG_MINUTES = 90
const VERY_LONG_DISTANCE_KM = 8

/* ---------------- geolocation ---------------- */
function locateMe(){
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition((pos)=>{
    start.value = [pos.coords.longitude, pos.coords.latitude]
    if (startMarker) startMarker.remove()
    startMarker = new mapboxgl.Marker({ color:'#ef4444' }).setLngLat(start.value).addTo(map)
    map.flyTo({ center: start.value, zoom: 14 })
  }, ()=>{}, { enableHighAccuracy:true, timeout:6000 })
}

/* ---------------- search & pick destination ---------------- */
const searchResultsSorted = computed(()=>{
  return [...searchResults.value].sort((a,b)=> a.distanceKm - b.distanceKm)
})

async function searchDest(){
  if (!destQuery.value) return
  const res = await geocode(destQuery.value)
  const feats = res.features || []
  const prepared = feats.map(f => ({
    id: f.id,
    name: f.text || f.place_name || 'Unnamed',
    place_name: f.place_name || '',
    center: f.center,
    distanceKm: haversineKm(start.value, f.center)
  }))
  searchResults.value = prepared
}

async function chooseDestination(r){
  dest.value = r.center
  if (destMarker) destMarker.remove()
  destMarker = new mapboxgl.Marker({ color:'#0ea5e9' }).setLngLat(dest.value).addTo(map)
  fitToPoints(map, [start.value, dest.value])
  clearResults()
  await drawRoutes()
}

/* 输入清空时关闭结果列表 */
watch(destQuery, (v) => {
  if (!String(v || '').trim()) clearResults()
})

/* 当用户变更 Choice 时：若已有路线，自动重算并覆盖 summary.choice */
watch(selectedChoice, async () => {
  if (start.value && dest.value) {
    await drawRoutes()               // 重新选择路线策略
  }
  if (summary.value) {
    summary.value.choice = selectedChoice.value
  }
})

/* ---------------- route logic ---------------- */
function primaryRoadPenalty(steps){
  let bad=0, total=0
  steps.forEach(s=>{
    const dist = s.distance || 0
    total += dist
    const classes = s?.intersections?.[0]?.classes || []
    if (classes.some(x=>['motorway','trunk','primary'].includes(x))) bad += dist
  })
  return total>0 ? bad/total : 0
}

async function drawRoutes(){
  if (!start.value || !dest.value) return
  const res = await getDirections([start.value, dest.value], 'walking', true)
  const routes = res.routes||[]
  if (!routes.length) return

  const enriched = routes.map((r,i)=>({
    i, r,
    penalty: primaryRoadPenalty((r.legs?.[0]?.steps)||[]),
    duration: r.duration,
    distance: r.distance
  }))

  // 简单策略示例
  if (selectedChoice.value === 'Shortest') {
    enriched.sort((a,b)=> a.duration - b.duration)
  } else {
    enriched.sort((a,b)=> (a.penalty!==b.penalty) ? (a.penalty-b.penalty) : (a.duration-b.duration))
  }

  const best = enriched[0]
  const alt = enriched[1]

  if (sourceMainId){ if (map.getLayer(routeMainId)) map.removeLayer(routeMainId); if (map.getSource(sourceMainId)) map.removeSource(sourceMainId) }
  if (sourceAltId){ if (map.getLayer(routeAltId)) map.removeLayer(routeAltId); if (map.getSource(sourceAltId)) map.removeSource(sourceAltId) }

  sourceMainId='mw-route-main'; routeMainId='mw-route-main'
  map.addSource(sourceMainId, { type:'geojson', data: best.r.geometry })
  map.addLayer({ id: routeMainId, type:'line', source: sourceMainId, paint:{ 'line-color':'#22c55e', 'line-width':5 } })

  if (alt){
    sourceAltId='mw-route-alt'; routeAltId='mw-route-alt'
    map.addSource(sourceAltId, { type:'geojson', data: alt.r.geometry })
    map.addLayer({ id: routeAltId, type:'line', source: sourceAltId, paint:{ 'line-color':'#94a3b8', 'line-width':4, 'line-dasharray':[1.5,1.5] } })
  }

  const all = best.r.geometry.coordinates
  const b = all.reduce((bb,c)=>bb.extend(c), new mapboxgl.LngLatBounds(all[0], all[0]))
  map.fitBounds(b, { padding: 40 })

  const score = computeScore(best.duration, best.penalty)
  const veryLong = (best.duration/60 > VERY_LONG_MINUTES) || (best.distance/1000 > VERY_LONG_DISTANCE_KM)
  summary.value = {
    choice: selectedChoice.value,
    distance: best.distance,
    duration: best.duration,
    score,
    veryLong
  }
  routeReady.value = true
}

function clearRoute(){
  if (sourceMainId){ if (map.getLayer(routeMainId)) map.removeLayer(routeMainId); if (map.getSource(sourceMainId)) map.removeSource(sourceMainId) }
  if (sourceAltId){ if (map.getLayer(routeAltId)) map.removeLayer(routeAltId); if (map.getSource(sourceAltId)) map.removeSource(sourceAltId) }
  routeMainId = routeAltId = sourceMainId = sourceAltId = null
  routeReady.value = false
  summary.value = null
}

/* ---------------- finish dialog & save ---------------- */
function openFinishDialog(){
  if (!routeReady.value) return
  finishDialog.value.open = true
  finishDialog.value.mood = 5
}

function closeFinishDialog(withConfirm){
  if (!withConfirm) { finishDialog.value.open = false; return }
  const ok = window.confirm('Close without mood level? It will still save this walk.')
  if (!ok) return
  saveWalk(null)
}

async function saveFinish(){
  const mood = Number.isFinite(finishDialog.value.mood)
    ? Math.max(0, Math.min(10, Math.round(finishDialog.value.mood)))
    : null
  await saveWalk(mood)
}

async function saveWalk(moodLevel){
  const user = auth.currentUser
  if (!user || !summary.value || !start.value) { finishDialog.value.open = false; return }

  const sname = await safeReverseName(start.value)
  const ename = dest.value ? await safeReverseName(dest.value) : ''

  await addDoc(collection(db,'walks'), {
    uid: user.uid,
    choice: selectedChoice.value,           // ✅ 顶层也写 choice，避免出现 Calming 固定的问题
    start: { lng:start.value[0], lat:start.value[1] },
    end: dest.value ? { lng:dest.value[0], lat:dest.value[1] } : null,
    startName: sname,
    endName: ename,
    routeSummary: { ...summary.value, choice: selectedChoice.value }, // ✅ 同步 choice
    moodLevel,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  finishDialog.value.open = false
}

/* reverse geocode for labels (best effort) */
async function safeReverseName(lngLat){
  try{
    const res = await reverseGeocode(lngLat[0], lngLat[1])
    return res?.features?.[0]?.place_name || ''
  } catch { return '' }
}

/* ---------------- history load (realtime) ---------------- */
function subscribeHistory(){
  const user = auth.currentUser
  if (!user) { history.value.items = []; return }
  history.value.loading = true
  history.value.error = ''
  if (typeof unsubscribeHistory === 'function') {
    unsubscribeHistory()
    unsubscribeHistory = null
  }

  try {
    const q = query(collection(db,'walks'), where('uid','==', user.uid))
    unsubscribeHistory = onSnapshot(q, (snap) => {
      const raw = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      const since = Date.now() - 30*24*60*60*1000
      const items = raw
        .filter(w=>{
          const t = w.createdAt?.toDate ? w.createdAt.toDate().getTime() : (w.createdAt || 0)
          return !t || t >= since   // 没有 createdAt（极少）也显示
        })
        .sort((a,b)=>{
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0)
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0)
          return tb - ta
        })
      history.value.items = items
      history.value.loading = false
    }, (err) => {
      console.error('[history] snapshot error', err)
      history.value.loading = false
      history.value.error = 'Failed to load history. Please check Firestore rules or indexes.'
      history.value.items = []
    })
  } catch (e){
    console.error('[history] subscribe error', e)
    history.value.loading = false
    history.value.error = 'Failed to load history.'
    history.value.items = []
  }
}

async function showHistoryRoute(w){
  if (!w.start || !w.end) return
  start.value = [w.start.lng, w.start.lat]
  dest.value = [w.end.lng, w.end.lat]
  if (startMarker) startMarker.remove()
  startMarker = new mapboxgl.Marker({ color:'#ef4444' }).setLngLat(start.value).addTo(map)
  if (destMarker) destMarker.remove()
  destMarker = new mapboxgl.Marker({ color:'#0ea5e9' }).setLngLat(dest.value).addTo(map)
  await drawRoutes()
  if (w.routeSummary) summary.value = { ...w.routeSummary }
  closeHistory()
}

/* ---------------- lifecycle ---------------- */
onMounted(()=>{
  map = createMap(mapEl.value)
  startMarker = new mapboxgl.Marker({ color:'#ef4444' }).setLngLat(start.value).addTo(map)

  // 登录状态
  onAuthStateChanged(auth, (u)=>{
    authReady.value = !!u
  })
})

onBeforeUnmount(()=>{
  if (map) map.remove()
  if (typeof unsubscribeHistory === 'function') unsubscribeHistory()
})
</script>

<style scoped>
.map { height: calc(100vh - 128px); } /* header + toolbar */
.map-toolbar { position: sticky; top: 64px; z-index: 20; }

/* search results panel */
.results-panel{
  position: absolute;
  top: 12px;
  left: 12px;
  width: min(520px, 90vw);
  max-height: 68vh;
  overflow: auto;
  z-index: 30;
  border-radius: 10px;
}

/* overlay base */
.overlay{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  z-index: 50;
  display: grid;
  place-items: center;
}

/* finish dialog */
.finish-card{
  width: min(640px, 92vw);
  border-radius: 12px;
}

/* history overlay */
.history-card{
  width: min(960px, 95vw);
  border-radius: 12px;
}
.table-row-click{ cursor: pointer; }
.table-row-click:hover{ background: #f8fafc; }

/* help overlay */
.help-card{
  width: min(720px, 92vw);
  border-radius: 12px;
}
</style>
