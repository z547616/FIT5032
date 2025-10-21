<template>
  <div class="container-fluid p-0">
    <div class="map-toolbar shadow-sm bg-white p-3 d-flex gap-2 align-items-center flex-wrap">
      <button class="btn btn-outline-primary" @click="locateMe"><i class="bi bi-geo"></i> My location</button>
      <select v-model="filter.type" class="form-select w-auto">
        <option value="all">All types</option>
        <option value="counseling">Counseling</option>
        <option value="youth_hub">Youth hub</option>
        <option value="crisis">Crisis center</option>
        <option value="green">Green space</option>
      </select>
      <select v-model.number="filter.radiusKm" class="form-select w-auto">
        <option :value="1">1 km</option>
        <option :value="3">3 km</option>
        <option :value="5">5 km</option>
        <option :value="10">10 km</option>
      </select>
      <div class="form-check ms-2">
        <input class="form-check-input" type="checkbox" v-model="filter.openNow" id="openNow">
        <label class="form-check-label" for="openNow">Open now</label>
      </div>
      <div class="ms-auto d-flex gap-2">
        <button class="btn btn-outline-success" @click="drawIsochrone(15)">15-min reach</button>
        <button class="btn btn-outline-success" @click="drawIsochrone(30)">30-min reach</button>
      </div>
    </div>

    <div class="layout">
      <div class="map" ref="mapEl"></div>
      <div class="list shadow-sm">
        <div class="p-2 border-bottom d-flex align-items-center justify-content-between">
          <strong>Results</strong>
          <span class="badge bg-primary-subtle text-primary">{{ filteredResources.length }}</span>
        </div>
        <div class="p-2" v-if="!filteredResources.length">No places found.</div>
        <div v-for="r in filteredResources" :key="r.id" class="p-3 border-bottom resource-item">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="fw-semibold">{{ r.name }}</div>
              <div class="text-muted small">{{ r.type }} · {{ (r.distanceKm ?? 0).toFixed(1) }} km</div>
              <div class="small">{{ r.address }}</div>
              <div class="small" v-if="r.openNow !== undefined">
                <span :class="r.openNow ? 'text-success' : 'text-danger'">{{ r.openNow ? 'Open' : 'Closed' }}</span>
              </div>
            </div>
            <div class="d-flex flex-column gap-2">
              <button class="btn btn-sm btn-primary" @click="startDirections(r)">Navigate</button>
              <button class="btn btn-sm btn-outline-secondary" @click="panTo(r)">Show on map</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMapbox } from '../composables/useMapbox'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'

const { createMap, addMarker, fitToPoints, getDirections, getIsochrone, mapboxgl } = useMapbox()

const mapEl = ref(null)
let map
const userMarker = ref(null)
let isoLayerId = null
let isoSourceId = null

const myLngLat = ref([144.9631, -37.8136]) // default Melbourne CBD
const resources = ref([])
const markers = []

const filter = ref({ type: 'all', radiusKm: 3, openNow: false })

function haversineKm(a, b){
  const toRad = d => d*Math.PI/180
  const R=6371
  const dLat=toRad(b[1]-a[1]); const dLng=toRad(b[0]-a[0])
  const lat1=toRad(a[1]); const lat2=toRad(b[1])
  const x=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
  return 2*R*Math.asin(Math.sqrt(x))
}

const filteredResources = computed(()=>{
  return resources.value
    .filter(r => filter.value.type==='all' ? true : r.type===filter.value.type)
    .filter(r => (haversineKm(myLngLat.value,[r.location.lng, r.location.lat]) <= filter.value.radiusKm))
    .filter(r => filter.value.openNow ? !!r.openNow : true)
    .map(r => ({...r, distanceKm: haversineKm(myLngLat.value,[r.location.lng, r.location.lat])}))
    .sort((a,b)=> (a.distanceKm)-(b.distanceKm))
})

function drawResources(){
  // clear old markers
  while (markers.length){ const m=markers.pop(); m.remove() }
  const pts = []
  filteredResources.value.forEach(r=>{
    const m = addMarker(map, [r.location.lng, r.location.lat], {
      color: r.type==='green'?'#16a34a':'#0d6efd',
      popupHtml: `<div style="min-width:180px">
        <strong>${r.name}</strong><br/>
        <span class="text-muted">${r.type}</span><br/>
        <small>${r.address || ''}</small>
      </div>`
    })
    markers.push(m)
    pts.push([r.location.lng, r.location.lat])
  })
  if (pts.length) fitToPoints(map, [myLngLat.value, ...pts])
}

async function locateMe(){
  if (!navigator.geolocation){ return }
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    myLngLat.value = [pos.coords.longitude, pos.coords.latitude]
    if (userMarker.value) userMarker.value.remove()
    userMarker.value = new mapboxgl.Marker({ color:'#ef4444' }).setLngLat(myLngLat.value).addTo(map)
    map.flyTo({ center: myLngLat.value, zoom: 14 })
    drawResources()
  }, ()=>{}, { enableHighAccuracy:true, timeout:6000 })
}

async function fetchResources(){
  // For demo: fetch all resources once (assume small dataset), then client-side filter
  const snap = await getDocs(collection(db, 'resources'))
  resources.value = snap.docs.map(d=>({ id:d.id, ...d.data() }))
  drawResources()
}

async function startDirections(resource){
  const to = [resource.location.lng, resource.location.lat]
  const res = await getDirections([myLngLat.value, to], 'walking', true)
  const routes = res.routes||[]
  if (!routes.length) return
  // remove previous layers
  if (map.getSource('route')){ map.removeLayer('route'); map.removeSource('route') }
  if (map.getSource('route_alt')){ map.removeLayer('route_alt'); map.removeSource('route_alt') }
  // main route
  map.addSource('route', { type:'geojson', data: routes[0].geometry })
  map.addLayer({ id:'route', type:'line', source:'route', paint:{ 'line-color':'#0ea5e9','line-width':5 } })
  // alternative
  if (routes[1]){
    map.addSource('route_alt', { type:'geojson', data: routes[1].geometry })
    map.addLayer({ id:'route_alt', type:'line', source:'route_alt', paint:{ 'line-color':'#94a3b8','line-width':4,'line-dasharray':[1.5,1.5] } })
  }
  const allCoords = routes[0].geometry.coordinates
  const b = allCoords.reduce((bb,c)=>bb.extend(c), new mapboxgl.LngLatBounds(allCoords[0], allCoords[0]))
  map.fitBounds(b, { padding: 40 })
}

async function drawIsochrone(minutes){
  const data = await getIsochrone(myLngLat.value[0], myLngLat.value[1], minutes, 'walking')
  // remove old
  if (isoLayerId){ if (map.getLayer(isoLayerId)) map.removeLayer(isoLayerId); isoLayerId=null }
  if (isoSourceId){ if (map.getSource(isoSourceId)) map.removeSource(isoSourceId); isoSourceId=null }
  isoSourceId = `iso-src-${minutes}`
  isoLayerId = `iso-layer-${minutes}`
  map.addSource(isoSourceId, { type:'geojson', data })
  map.addLayer({ id: isoLayerId, type:'fill', source: isoSourceId,
    paint: { 'fill-color':'#22c55e', 'fill-opacity':0.18, 'fill-outline-color':'#16a34a' } })
}

onMounted(()=>{
  map = createMap(mapEl.value)
  userMarker.value = new mapboxgl.Marker({ color:'#ef4444' }).setLngLat(myLngLat.value).addTo(map)
  fetchResources()
})
onBeforeUnmount(()=>{ if (map) map.remove() })
</script>

<style scoped>
.layout{ display:grid; grid-template-columns: 1fr 340px; height: calc(100vh - 64px) }
.map{ min-height: 60vh }
.list{ background:#fff; overflow:auto }
.map-toolbar{ position: sticky; top:0; z-index: 20 }
.resource-item:hover{ background: #f8fafc }
:global(.mb-marker){ cursor:pointer }
</style>