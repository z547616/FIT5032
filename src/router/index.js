import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import MoodTracker from '../pages/MoodTracker.vue'
import Profile from '../pages/Profile.vue'
import Login from '../components/Login.vue'
import Register from '../components/Register.vue'
import Admin from '../pages/Admin.vue'
import AnonymousStories from '../pages/AnonymousStories.vue'

const routes = [
  {
    path: '/',
    redirect: () => {
      const loggedIn = localStorage.getItem('currentUser')
      return loggedIn ? '/home' : '/login'
    }
  },
  { path: '/login', component: Login, meta: { title: 'MindBloom | Login', icon: 'bi bi-box-arrow-in-right' } },
  { path: '/register', component: Register, meta: { title: 'MindBloom | Register', icon: 'bi bi-person-plus' } },
  { path: '/home', component: Home, meta: { title: 'MindBloom | Home', icon: 'bi bi-house-door' } },
  { path: '/mood-tracker', component: MoodTracker, meta: { title: 'MindBloom | Mood Tracker', icon: 'bi bi-emoji-smile' } },
  { path: '/anonymous-stories', component: AnonymousStories, meta: { title: 'MindBloom | Anonymous Stories', icon: 'bi bi-chat-dots' } },
  { path: '/profile', component: Profile, meta: { title: 'MindBloom | Profile', icon: 'bi bi-person-circle' } },
  { path: '/admin', component: Admin, meta: { title: 'MindBloom | Admin', icon: 'bi bi-shield-lock' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 登录访问控制
router.beforeEach((to, from, next) => {
  const loggedIn = localStorage.getItem('currentUser')

  if (!loggedIn && ['/home','/mood-tracker','/profile','/anonymous-stories'].includes(to.path)) {
    next('/login')
  } else if (loggedIn && (to.path === '/login' || to.path === '/register')) {
    next('/home')
  } else {
    next()
  }
})

// 页面标题 + favicon
router.afterEach((to) => {
  if (to.meta?.title) document.title = to.meta.title

  const favicon = document.querySelector("link[rel='icon']") || document.createElement('link')
  favicon.rel = 'icon'
  favicon.type = 'image/svg+xml'

  if (to.path === '/login' || to.path === '/register') {
    favicon.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>"
  } else if (to.meta?.icon) {
    favicon.href = makeFaviconSVG(to.meta.icon)
  }

  document.head.appendChild(favicon)
})

function makeFaviconSVG(iconClass) {
  return `data:image/svg+xml,
    <svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' fill='%230d6efd' class='${iconClass}' viewBox='0 0 16 16'>
      <use href='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/bootstrap-icons.svg#${iconClass.split(' ')[1]}'/>
    </svg>`
}

export default router
