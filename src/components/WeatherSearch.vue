<template>
  <div class="ws-card">
    <!-- 搜索框 -->
    <form class="ws-form" @submit.prevent="searchCity">
      <input
        v-model.trim="city"
        class="ws-input"
        type="text"
        placeholder='Try: "Clayton, AU"'
        aria-label="Search city weather"
      />
      <button class="ws-btn" type="submit" :disabled="!city || loading">
        {{ loading ? "Searching..." : "Search" }}
      </button>
    </form>

    <!-- 结果区 -->
    <div class="ws-result" v-if="error || data">
      <div v-if="error" class="ws-error">⚠️ {{ error }}</div>

      <div v-else class="ws-item">
        <img
          v-if="data?.icon"
          :src="`https://openweathermap.org/img/wn/${data.icon}@2x.png`"
          alt="icon"
          class="ws-icon"
        />
        <div class="ws-text">
          <div class="ws-title">{{ data?.name }}</div>
          <div class="ws-sub">{{ data?.tempC }}°C • {{ data?.description || "—" }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue"
// 如果你的项目已配置 @ 指向 src，可以用：import { useWeather } from "@/composables/useWeather"
import { useWeather } from "../composables/useWeather" // ← 按需改成你的实际路径

const city = ref("")
const { loading, error, data, fetchByCity } = useWeather()

async function searchCity() {
  if (!city.value) return
  await fetchByCity(city.value)
}
</script>

<style scoped>
.ws-card {
  background: #fff;
  border: 1px solid rgba(0,0,0,.06);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 6px 20px rgba(0,0,0,.04);
  margin-bottom: 16px;
}

.ws-form {
  display: flex;
  gap: 8px;
}

.ws-input {
  flex: 1;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;
}
.ws-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.15);
}

.ws-btn {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 600;
  cursor: pointer;
}
.ws-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.ws-result { margin-top: 12px; }

.ws-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ws-icon { width: 48px; height: 48px; }

.ws-text { display: grid; }
.ws-title { font-weight: 700; }
.ws-sub { color: #6b7280; font-size: 0.95rem; }

.ws-error {
  color: #dc2626;
  font-weight: 600;
}
</style>
