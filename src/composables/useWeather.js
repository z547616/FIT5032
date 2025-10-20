import { ref } from "vue"
import { auth, db } from "../firebase"
import { doc, setDoc, increment } from "firebase/firestore"

export function useWeather() {
  const loading = ref(false)
  const error = ref("")
  const data = ref(null)

  const API = "https://api.openweathermap.org/data/2.5/weather"
  const KEY = import.meta.env.VITE_OPENWEATHER_API_KEY
  const FALLBACK_CITY = "Melbourne, AU"

  /** 通用请求函数 */
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

  /** 坐标查询 */
  async function fetchByCoords(lat, lon) {
    const url = `${API}?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric`
    await fetchWeather(url)
  }

  /** 城市名查询 */
  async function fetchByCity(q) {
    const url = `${API}?q=${encodeURIComponent(q)}&appid=${KEY}&units=metric`
    await fetchWeather(url)
  }

  /** 调用次数计数（写入 Firestore，可选） */
  async function bumpCounter() {
    const u = auth.currentUser
    if (!u) return
    const ref = doc(db, "users", u.uid, "metrics", "api")
    await setDoc(ref, { weatherSearchCalls: increment(1) }, { merge: true })
  }

  return { loading, error, data, fetchByCity, fetchByCoords }
}
