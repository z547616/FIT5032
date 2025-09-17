<template>
  <div>
    <!-- 顶部栏：汉堡菜单 -->
    <nav class="navbar bg-primary shadow-sm px-3">
      <button class="btn btn-link text-white fs-3" @click="isOpen = true">
        <i class="bi bi-list"></i>
      </button>
      <span class="navbar-brand text-white ms-2 fw-bold">
        Youth Mental Health
      </span>
    </nav>

    <!-- 侧边抽屉导航栏 -->
    <div class="side-menu" :class="{ open: isOpen }">
  <div class="menu-header">
    <span class="menu-title">Menu</span>
    <button class="close-btn" @click="isOpen = false">
      <i class="bi bi-x-lg"></i>
    </button>
  </div>
  <ul class="nav flex-column mt-3">
    <li v-for="(item, i) in navItems" :key="i" class="nav-item">
      <a
        href="#"
        class="nav-link"
        :class="{ active: activeIndex === i }"
        @click.prevent="setActive(i)"
      >
        <i :class="item.icon" class="fs-5"></i>
        <span>{{ item.label }}</span>
      </a>
    </li>
  </ul>
</div>

    <!-- 遮罩 -->
    <div v-if="isOpen" class="overlay" @click="isOpen = false"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const navItems = [
  { label: 'Home', icon: 'bi bi-house-door' },
  { label: 'Mood Tracker', icon: 'bi bi-emoji-smile' },
  { label: 'Anonymous Stories', icon: 'bi bi-chat-dots' },
  { label: 'Resources', icon: 'bi bi-book' },
  { label: 'Community & Support', icon: 'bi bi-people' },
  { label: 'Get Help', icon: 'bi bi-life-preserver' }
]

const activeIndex = ref(0)
const isOpen = ref(false)

function setActive(i) {
  activeIndex.value = i
  isOpen.value = false
}
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
.side-menu.open {
  left: 0;
}

/* 清除默认列表样式 */
.nav {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

/* 导航链接 */
.nav-link {
  color: #ffffff !important;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 12px;                /* 图标与文字间距 */
  padding: 14px 20px;        /* 上下留白更大 */
  transition: background-color 0.25s, transform 0.15s;
  border-radius: 6px;
  margin: 4px 8px;
  text-align: left;          /* 文本左对齐 */
}
.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.15);
  transform: translateX(4px);
}
.nav-link.active {
  background-color: rgba(255, 255, 255, 0.25);
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 1040;
}

/* 顶部栏标题和关闭按钮行 */
.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.menu-title {
  color: #ffffff;
  font-weight: 500;
  font-size: 1rem; /* 与导航项一致 */
}

/* 关闭按钮 */
.close-btn {
  color: #ffffff;
  background: transparent;
  border: none;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.25s, transform 0.15s;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
  transform: translateX(2px);
}

.close-btn:active {
  background-color: rgba(255, 255, 255, 0.25);
}
</style>

