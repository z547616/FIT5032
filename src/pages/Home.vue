<template>
  <div class="container py-4" style="max-width: 1200px">

    <div class="d-flex align-items-center justify-content-between mb-3">
      <h2 class="text-primary mb-0">Welcome to MindBloom 🌱</h2>

      <div class="small text-muted" v-if="me">
        <!-- <i class="bi bi-person-circle me-1"></i>
        {{ me.username || 'User' }} -->
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="alert alert-info d-flex align-items-center" role="alert">
      <span class="spinner-border spinner-border-sm me-2"></span>
      Loading your dashboard...
    </div>
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <!-- Grid of 6 tiles -->
    <div class="row g-3">
      <!-- Mood entries count -->
      <div class="col-sm-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100 clickable" @click="goTo('tracker')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted">Mood entries</span>
              <i class="bi bi-clipboard2-check fs-4 text-primary"></i>
            </div>
            <div class="display-6 fw-bold">{{ stats.moodEntriesCount }}</div>
            <div class="small text-muted">Click to open Mood Tracker</div>
          </div>
        </div>
      </div>

      <!-- Average of recent 5 mood entries -->
      <div class="col-sm-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100 clickable" @click="goTo('tracker')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted">Avg. of last 5 moods</span>
              <i class="bi bi-emoji-smile fs-4 text-primary"></i>
            </div>
            <div class="display-6 fw-bold">
              <span v-if="stats.avgRecent5 !== null">{{ stats.avgRecent5.toFixed(1) }}</span>
              <span v-else>—</span>
            </div>
            <div class="small text-muted">0–10 scale · last 5</div>
          </div>
        </div>
      </div>

      <!-- Mood walks count -->
      <div class="col-sm-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100 clickable" @click="goTo('walks')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted">Mood walks</span>
              <i class="bi bi-signpost-2 fs-4 text-primary"></i>
            </div>
            <div class="display-6 fw-bold">{{ stats.walksCount }}</div>
            <div class="small text-muted">Click to open Mood Walks</div>
          </div>
        </div>
      </div>

      <!-- My posts count -->
      <div class="col-sm-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100 clickable" @click="goTo('moodspace')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted">My posts</span>
              <i class="bi bi-chat-heart fs-4 text-primary"></i>
            </div>
            <div class="display-6 fw-bold">{{ stats.myPostsCount }}</div>
            <div class="small text-muted">Click to open My Mood Space</div>
          </div>
        </div>
      </div>

      <!-- Total likes received (on my posts) -->
      <div class="col-sm-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100 clickable" @click="goTo('moodspace')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted">Total likes (received)</span>
              <i class="bi bi-hand-thumbs-up fs-4 text-primary"></i>
            </div>
            <div class="display-6 fw-bold">{{ stats.totalLikes }}</div>
            <div class="small text-muted">Sum of likeCount on your posts</div>
          </div>
        </div>
      </div>

      <!-- Total comments received (on my posts) -->
      <div class="col-sm-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100 clickable" @click="goTo('moodspace')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted">Total comments (received)</span>
              <i class="bi bi-chat-dots fs-4 text-primary"></i>
            </div>
            <div class="display-6 fw-bold">{{ stats.totalComments }}</div>
            <div class="small text-muted">Sum of commentCount on your posts</div>
          </div>
        </div>
      </div>
    </div>
    <WellnessChat />
  </div>
</template>

<script setup>
import WellnessChat from '../components/ai/WellnessChat.vue'
import WeatherSearch from "../components/WeatherSearch.vue"
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, collectionGroup, query, where, orderBy, limit, getDocs,
  getCountFromServer
} from 'firebase/firestore'

const router = useRouter()

const me = ref(null)
const loading = ref(true)
const error = ref('')

const stats = ref({
  moodEntriesCount: 0,
  avgRecent5: null,      // number | null
  walksCount: 0,
  myPostsCount: 0,
  totalLikes: 0,
  totalComments: 0,
})

function goTo(which) {
  switch (which) {
    case 'tracker': router.push('/mood-tracker'); break
    case 'walks': router.push('/mood-walks'); break
    case 'moodspace': router.push('/my-mood-space'); break
  }
}

async function loadAll(uid) {
  error.value = ''
  loading.value = true
  try {
    // 1) Mood entries count
    const meCol = collection(db, 'users', uid, 'moodEntries')
    const meCountSnap = await getCountFromServer(meCol)
    const moodEntriesCount = meCountSnap.data().count || 0

    // 2) Avg of last 5 mood entries (order by createdAt desc)
    let avgRecent5 = null
    if (moodEntriesCount > 0) {
      const meRecentQ = query(meCol, orderBy('createdAt', 'desc'), limit(5))
      const meRecentSnap = await getDocs(meRecentQ)
      const vals = meRecentSnap.docs
        .map(d => d.data())
        .map(x => Number(x.mood))
        .filter(n => Number.isFinite(n))
      if (vals.length > 0) {
        avgRecent5 = vals.reduce((a, b) => a + b, 0) / vals.length
      }
    }

    // 3) Walks count (top-level collection, filter by uid)
    const wCountSnap = await getCountFromServer(query(collection(db, 'walks'), where('uid', '==', uid)))
    const walksCount = wCountSnap.data().count || 0

    // 4) My posts count
    const myPostsCountSnap = await getCountFromServer(query(collection(db, 'posts'), where('uid', '==', uid)))
    const myPostsCount = myPostsCountSnap.data().count || 0

    // 5 & 6) Sum likes & comments on my posts
    // 拉取本人所有帖子（尽量小数据集；若后续量变大可改为后台函数聚合）
    const myPostsSnap = await getDocs(query(collection(db, 'posts'), where('uid', '==', uid)))
    let totalLikes = 0
    let totalComments = 0
    myPostsSnap.forEach(docSnap => {
      const d = docSnap.data() || {}
      totalLikes += Number(d.likeCount || 0)
      totalComments += Number(d.commentCount || 0)
    })

    stats.value = {
      moodEntriesCount,
      avgRecent5,
      walksCount,
      myPostsCount,
      totalLikes,
      totalComments,
    }
  } catch (e) {
    console.error('[Home] loadAll error', e)
    error.value = e?.message || 'Failed to load your dashboard.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      me.value = null
      error.value = 'Please sign in.'
      loading.value = false
      return
    }
    // 尝试从 users 拿一点展示信息（非必需）
    me.value = { uid: u.uid, username: u.displayName || '' }
    await loadAll(u.uid)
  })
})
</script>

<style scoped>
.clickable {
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease;
}

.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, .08) !important;
}
</style>
