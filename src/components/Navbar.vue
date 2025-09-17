<template>
  <div>
    <!-- 顶部栏：汉堡菜单 + 标题 + 用户信息 -->
    <nav class="navbar bg-primary shadow-sm px-3 d-flex align-items-center">
      <!-- 左侧菜单按钮（仅普通用户） -->
      <button
        v-if="role !== 'admin'"
        class="btn btn-link text-white fs-3 me-3"
        @click="isOpen = true"
      >
        <i class="bi bi-list"></i>
      </button>

      <!-- 中间品牌名 -->
      <div class="navbar-brand text-white fw-bold mx-auto cursor-pointer" @click="goHome">
        <span v-if="role === 'admin'">Welcome, Administrator 🌱</span>
        <span v-else>MindBloom 🌱</span>
      </div>

      <!-- 右侧用户信息 -->
      <div class="position-relative">
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
    </nav>

    <!-- 侧边抽屉导航栏（仅普通用户显示） -->
    <div v-if="role !== 'admin'" class="side-menu" :class="{ open: isOpen }">
      <div class="menu-header">
        <span class="menu-title">Menu</span>
        <button class="close-btn" @click="isOpen = false">
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const navItems = [
  { label: 'Home', icon: 'bi bi-house-door', path: '/home' },
  { label: 'Mood Tracker', icon: 'bi bi-emoji-smile', path: '/mood-tracker' },
  { label: 'Anonymous Stories', icon: 'bi bi-chat-dots', path: '/anonymous-stories' },
  { label: 'Resources', icon: 'bi bi-book', path: '#' },
  { label: 'Community & Support', icon: 'bi bi-people', path: '#' },
  { label: 'Get Help', icon: 'bi bi-life-preserver', path: '#' },
  { label: 'Profile', icon: 'bi bi-person-circle', path: '/profile' },
]

const isOpen = ref(false)
const showUserMenu = ref(false)

/** 实时获取当前用户信息与角色 */
const currentUser = computed(() => localStorage.getItem('currentUser') || '')
const allUsers = computed(() => JSON.parse(localStorage.getItem('users') || '[]'))
const user = computed(() => allUsers.value.find(u => u.username === currentUser.value) || {})
const role = computed(() => user.value.role || 'user')

const displayName = computed(() => user.value.nickname || user.value.username || 'User')

/** 美观默认头像（渐变圆形 + 白色人形） */
function makeDefaultAvatar() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4facfe"/>
          <stop offset="1" stop-color="#00f2fe"/>
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="64" fill="url(#g)"/>
      <path fill="#fff" d="M64 72a24 24 0 1 0 0-48 24 24 0 0 0 0 48zm0 12c-20 0-36 12-36 24v8h72v-8c0-12-16-24-36-24z"/>
    </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

const avatarSrc = computed(() =>
  user.value.avatar && user.value.avatar.length > 0 ? user.value.avatar : makeDefaultAvatar()
)

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}
function goHome() {
  router.push('/home')
}
function goProfile() {
  router.push('/profile')
  showUserMenu.value = false
}
function logout() {
  localStorage.removeItem('currentUser')
  router.push('/login')
}

/** 点击页面空白处关闭用户菜单 */
const userMenu = ref(null)
const userBtn = ref(null)
function handleClickOutside(e) {
  const menuEl = userMenu.value
  const btnEl = userBtn.value
  if (showUserMenu.value && menuEl && btnEl && !menuEl.contains(e.target) && !btnEl.contains(e.target)) {
    showUserMenu.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>


<style scoped>
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
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  transition: background-color 0.25s, transform 0.15s;
  border-radius: 6px;
  margin: 4px 8px;
  text-align: left;
}
.nav-link:hover { background-color: rgba(255,255,255,0.15); transform: translateX(4px); }
.nav-link.active { background-color: rgba(255,255,255,0.25); }

.overlay {
  position: fixed; inset: 0;
  background-color: rgba(0,0,0,0.4);
  backdrop-filter: blur(2px);
  z-index: 1040;
}

/* 顶栏右侧用户信息 */
.user-btn {
  border: none;
  background: transparent;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background-color 0.25s;
}
.user-btn:hover { background-color: rgba(255,255,255,0.15); }

/* 用户下拉菜单 */
.dropdown-menu-custom {
  position: absolute;
  top: 110%;
  right: 0;
  background: white;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  min-width: 160px;
  padding: 4px;
  z-index: 1200;
}
.dropdown-item-custom {
  display: flex; align-items: center;
  width: 100%;
  background: transparent; border: none;
  padding: 8px 12px; text-align: left;
  border-radius: 4px;
  transition: background-color 0.25s;
}
.dropdown-item-custom:hover { background-color: rgba(13,110,253,0.1); }

.menu-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.15);
}
.menu-title { color: #fff; font-weight: 500; font-size: 1rem; }
.close-btn {
  color: #fff; background: transparent; border: none;
  padding: 8px; border-radius: 6px; cursor: pointer;
  transition: background-color 0.25s, transform 0.15s;
}
.close-btn:hover { background-color: rgba(255,255,255,0.15); transform: translateX(2px); }
.close-btn:active { background-color: rgba(255,255,255,0.25); }

.cursor-pointer { cursor: pointer; }
</style>
