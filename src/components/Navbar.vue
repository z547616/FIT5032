<template>
  <div>
    <!-- 顶部栏：左(菜单) - 中(品牌居中) - 右(天气+用户) -->
    <nav class="navbar bg-primary shadow-sm px-3 d-grid align-items-center topbar-grid">
      <!-- 左侧：菜单按钮（仅普通用户） -->
      <button
        v-if="role !== 'admin'"
        class="btn btn-link text-white fs-3"
        @click="isOpen = true"
        aria-label="Open menu"
      >
        <i class="bi bi-list"></i>
      </button>

      <!-- 中间：品牌（始终居中且不与右侧重叠） -->
      <div class="text-white fw-bold text-center brand-text cursor-pointer">
        <span v-if="role === 'admin'" @click="goHome">Welcome, Administrator 🌱</span>
        <span v-else @click="goHome">MindBloom 🌱</span>
      </div>

      <!-- 右侧：天气徽章 + 用户信息（自适应不挤占中间区域） -->
      <div class="d-flex align-items-center gap-2 justify-content-end">
        <WeatherBadge />

        <div v-if="userLoaded" class="position-relative">
          <button ref="userBtn" class="user-btn d-flex align-items-center gap-2" @click="toggleUserMenu">
            <img :src="avatarSrc" class="rounded-circle" width="32" height="32" alt="avatar" />
            <span class="text-white fw-semibold">{{ displayName }}</span>
          </button>

          <!-- 用户菜单 -->
          <div v-if="showUserMenu" ref="userMenu" class="dropdown-menu-custom">
            <button class="dropdown-item-custom" @click="goProfile">
              <i class="bi bi-person-circle me-2"></i> Profile
            </button>
            <button class="dropdown-item-custom" @click="logout">
              <i class="bi bi-box-arrow-right me-2"></i> Log out
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- 侧边抽屉导航栏（仅普通用户显示） -->
    <div v-if="role !== 'admin'" class="side-menu" :class="{ open: isOpen }">
      <div class="menu-header">
        <span class="menu-title">Menu</span>
        <button class="close-btn" @click="isOpen = false" aria-label="Close menu">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <ul class="nav flex-column mt-3">
        <li v-for="(item, i) in navItems" :key="i" class="nav-item">
          <router-link
            :to="item.path"
            class="nav-link"
            :class="{ active: $route.path === item.path }"
            @click="isOpen = false"
          >
            <i :class="item.icon" class="fs-5"></i>
            <span>{{ item.label }}</span>
          </router-link>
        </li>
      </ul>
    </div>

    <!-- 遮罩 -->
    <div v-if="role !== 'admin' && isOpen" class="overlay" @click="isOpen = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import { useRouter } from "vue-router"
import WeatherBadge from "./WeatherBadge.vue"

// Firebase
import { auth, db } from "../firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"

const router = useRouter()

const navItems = [
  { label: "Home", icon: "bi bi-house-door", path: "/home" },
  { label: "Mood Tracker", icon: "bi bi-emoji-smile", path: "/mood-tracker" },
  { label: "Mood Space", icon: "bi bi-chat-heart", path: "/mood-space" },
  { label: 'Mood Walks', icon: 'bi bi-signpost', path: '/mood-walks' },
  // { label: 'Find Help', icon: 'bi bi-geo-alt', path: '/map-explore' },
  { label: "Profile", icon: "bi bi-person-circle", path: "/profile" },
]

  // { label: "Resources", icon: "bi bi-book", path: "#" },
  // { label: "Community & Support", icon: "bi bi-people", path: "#" },
  // { label: "Get Help", icon: "bi bi-life-preserver", path: "#" },

const isOpen = ref(false)
const showUserMenu = ref(false)

const userData = ref({})
const role = ref("user")
const userLoaded = ref(false)

// cache-busting 标记：头像 URL 改变时更新，避免浏览器缓存旧图
const avatarBust = ref(0)

let unsubscribeUserDoc = null

onAuthStateChanged(auth, (firebaseUser) => {
  // 清理旧监听
  if (typeof unsubscribeUserDoc === "function") {
    unsubscribeUserDoc()
    unsubscribeUserDoc = null
  }

  if (firebaseUser) {
    const docRef = doc(db, "users", firebaseUser.uid)
    unsubscribeUserDoc = onSnapshot(
      docRef,
      (snap) => {
        const beforeAvatar = userData.value?.avatar || ""
        if (snap.exists()) {
          userData.value = snap.data() || {}
          role.value = userData.value.role || "user"
        } else {
          userData.value = { username: firebaseUser.email, role: "user" }
          role.value = "user"
        }
        const afterAvatar = userData.value?.avatar || ""
        if (afterAvatar !== beforeAvatar) {
          avatarBust.value = Date.now()
        }
        userLoaded.value = true
      },
      () => {
        userLoaded.value = true
      }
    )
  } else {
    userData.value = {}
    role.value = "user"
    userLoaded.value = true
  }
})

const displayName = computed(() =>
  userData.value.username || userData.value.email || "User"
)

/** 默认头像（渐变背景 + 人形图标） */
function makeDefaultAvatar() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4facfe"/>
          <stop offset="1" stop-color="#00f2fe"/>
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="64" fill="url(#g)"/>
      <path fill="#fff" d="M64 72a24 24 0 1 0 0-48 24 24 0 0 0 0 48zm0 12c-20 0-36 12-36 24v8h72v-8c0-12-16-24-36-24z"/>
    </svg>`
  return "data:image/svg+xml;base64," + btoa(svg)
}

/** 头像地址：实时 + cache-busting */
const avatarSrc = computed(() => {
  const raw =
    userData.value.avatar && userData.value.avatar.length > 0
      ? userData.value.avatar
      : makeDefaultAvatar()

  if (raw.startsWith("data:")) return raw
  const sep = raw.includes("?") ? "&" : "?"
  return `${raw}${sep}v=${avatarBust.value || 0}`
})

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}
function goHome() {
  router.push("/home")
}
function goProfile() {
  router.push("/profile")
  showUserMenu.value = false
}
async function logout() {
  await signOut(auth)
  router.push("/login")
}

/** 点击页面空白处关闭用户菜单 */
const userMenu = ref(null)
const userBtn = ref(null)
function handleClickOutside(e) {
  const menuEl = userMenu.value
  const btnEl = userBtn.value
  if (
    showUserMenu.value &&
    menuEl &&
    btnEl &&
    !menuEl.contains(e.target) &&
    !btnEl.contains(e.target)
  ) {
    showUserMenu.value = false
  }
}
onMounted(() => document.addEventListener("click", handleClickOutside))
onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside)
  if (typeof unsubscribeUserDoc === "function") unsubscribeUserDoc()
})
</script>

<style scoped>
/* 顶部网格：左(内容自宽) 中(自适应) 右(自宽) — 中间始终居中且不与左右重叠 */
.topbar-grid {
  display: grid !important;
  grid-template-columns: auto 1fr auto;
  column-gap: 8px;
  min-height: 56px;
}

/* 品牌文字保持与此前一致的可读性 */
.brand-text {
  font-size: 1.25rem;
  line-height: 1.2;
  user-select: none;
}

@media (max-width: 480px) {
  .brand-text {
    font-size: 1.125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* 侧边菜单 */
.side-menu {
  position: fixed;
  top: 0;
  left: -270px;
  width: 270px;
  height: 100%;
  background: rgba(13, 110, 253, 0.75);
  backdrop-filter: blur(8px);
  color: white;
  transition: left 0.35s ease;
  z-index: 1050;
  box-shadow: 2px 0 15px rgba(0, 0, 0, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.15);
}
.side-menu.open { left: 0; }

.nav { list-style: none; padding-left: 0; margin: 0; }
.nav-link {
  color: #ffffff !important;
  font-weight: 500;
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px;
  transition: background-color 0.25s, transform 0.15s;
  border-radius: 6px; margin: 4px 8px; text-align: left;
}
.nav-link:hover { background-color: rgba(255, 255, 255, 0.15); transform: translateX(4px); }
.nav-link.active { background-color: rgba(255, 255, 255, 0.25); }

.overlay {
  position: fixed; inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 1040;
}

/* 顶栏右侧用户信息 */
.user-btn {
  border: none; background: transparent;
  padding: 6px 10px; border-radius: 6px;
  transition: background-color 0.25s;
}
.user-btn:hover { background-color: rgba(255, 255, 255, 0.15); }

/* 用户下拉菜单 */
.dropdown-menu-custom {
  position: absolute; top: 110%; right: 0;
  background: white; border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 160px; padding: 4px; z-index: 1200;
}
.dropdown-item-custom {
  display: flex; align-items: center; width: 100%;
  background: transparent; border: none;
  padding: 8px 12px; text-align: left;
  border-radius: 4px; transition: background-color 0.25s;
}
.dropdown-item-custom:hover { background-color: rgba(13, 110, 253, 0.1); }

.menu-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}
.menu-title { color: #fff; font-weight: 500; font-size: 1rem; }
.close-btn {
  color: #fff; background: transparent; border: none; padding: 8px;
  border-radius: 6px; cursor: pointer;
  transition: background-color 0.25s, transform 0.15s;
}
.close-btn:hover { background-color: rgba(255, 255, 255, 0.15); transform: translateX(2px); }
.close-btn:active { background-color: rgba(255, 255, 255, 0.25); }

.cursor-pointer { cursor: pointer; }
</style>
