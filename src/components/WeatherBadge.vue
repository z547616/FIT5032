<template>
  <div
    class="weather-badge d-inline-flex align-items-center gap-2 px-2 py-1"
    :title="tooltip"
    @click="refresh"
  >
    <img
      v-if="data?.icon"
      :src="`https://openweathermap.org/img/wn/${data.icon}@2x.png`"
      alt="icon"
      class="weather-icon"
    />
    <span v-if="loading" class="weather-text">Loading…</span>
    <span v-else-if="error" class="weather-text">Weather</span>
    <span v-else-if="data" class="weather-text">
      {{ data.name }} {{ data.tempC }}°C
    </span>
    <span v-else class="weather-text">Weather</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { auth, db } from "../firebase"
import { doc, setDoc, increment } from "firebase/firestore"

const loading = ref(false)
const error = ref("")
const data = ref(null)

const API = "https://api.openweathermap.org/data/2.5/weather"
const KEY = import.meta.env.VITE_OPENWEATHER_API_KEY
const FALLBACK_CITY = "Melbourne, AU"

const tooltip = computed(() => {
  if (error.value) return `Weather error: ${error.value}`
  if (data.value?.description) return data.value.description
  return "Weather"
})

async function fetchWeather(url) {
  loading.value = true
  error.value = ""
  try {
    if (!KEY) throw new Error("Missing VITE_OPENWEATHER_API_KEY")
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    data.value = {
      name: json.name || "Current",
      tempC: Math.round(json.main?.temp ?? 0),
      icon: json.weather?.[0]?.icon ?? "01d",
      description: json.weather?.[0]?.description ?? ""
    }
    bumpCounter().catch(console.warn)
  } catch (e) {
    console.error("[Weather] fetch failed:", e)
    error.value = e?.message || "fetch failed"
    data.value = null
  } finally {
    loading.value = false
  }
}

async function fetchByCoords(lat, lon) {
  const url = `${API}?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric`
  await fetchWeather(url)
}

async function fetchByCity(q) {
  const url = `${API}?q=${encodeURIComponent(q)}&appid=${KEY}&units=metric`
  await fetchWeather(url)
}

async function bumpCounter() {
  const u = auth.currentUser
  if (!u) return
  const ref = doc(db, "users", u.uid, "metrics", "api")
  await setDoc(ref, { weatherCalls: increment(1) }, { merge: true })
}

function refresh() {
  getWeather()
}

function getWeather() {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
      () => fetchByCity(FALLBACK_CITY),
      { enableHighAccuracy: false, timeout: 5000 }
    )
  } else {
    fetchByCity(FALLBACK_CITY)
  }
}

onMounted(() => {
  getWeather()
})
</script>

<style scoped>
/* 与导航栏统一：透明背景 + 白色文字 + 大图标 */
.weather-badge {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #fff;
  font-weight: 500;
  font-size: 1rem;
  transition: opacity 0.3s ease;
}
.weather-badge:hover {
  opacity: 0.85;
}

.weather-icon {
  width: 40px;
  height: 40px;
  filter: brightness(1.2) saturate(1.1);
}

.weather-text {
  color: #fff;
  font-weight: 800;
  font-size: 1rem;
  line-height: 1;
}
</style>
