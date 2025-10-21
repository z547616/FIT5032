import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import MoodTracker from '../pages/MoodTracker.vue'
import Profile from '../pages/Profile.vue'
import Login from '../components/Login.vue'
import Register from '../components/Register.vue'
import Admin from '../pages/Admin.vue'
import MoodSpace from '../pages/MoodSpace.vue'
import MapExplore from '../pages/MapExplore.vue'
import MoodWalks from '../pages/MoodWalks.vue'

// Firebase
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getFirestore, doc, getDoc } from "firebase/firestore"

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  { path: '/login', component: Login, meta: { title: 'MindBloom | Login', icon: 'bi bi-box-arrow-in-right' } },
  { path: '/register', component: Register, meta: { title: 'MindBloom | Register', icon: 'bi bi-person-plus' } },
  { path: '/home', component: Home, meta: { requiresAuth: true, title: 'MindBloom | Home', icon: 'bi bi-house-door' } },
  { path: '/mood-tracker', component: MoodTracker, meta: { requiresAuth: true, title: 'MindBloom | Mood Tracker', icon: 'bi bi-emoji-smile' } },
  { path: '/mood-space', component: MoodSpace, meta: { requiresAuth: true, title: 'MindBloom | Mood Space', icon: 'bi bi-chat-heart' } },
  { path: '/profile', component: Profile, meta: { requiresAuth: true, title: 'MindBloom | Profile', icon: 'bi bi-person-circle' } },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, requiresAdmin: true, title: 'MindBloom | Admin', icon: 'bi bi-shield-lock' } },
  { path: '/map-explore', component: MapExplore, meta: { requiresAuth: true, title: 'MindBloom | Find Help Near Me', icon: 'bi bi-geo-alt' } },
  { path: '/mood-walks', component: MoodWalks, meta: { requiresAuth: true, title: 'MindBloom | MoodWalks', icon: 'bi bi-signpost' } },
]

  //{
  //   path: '/get-all-mood',
  //   // 如果你已手动 import 了组件，可改为：component: GetAllMood,
  //   component: () => import('../pages/GetAllMood.vue'),
  //   meta: { requiresAuth: true, title: 'MindBloom | GetAllMood (JSON)', icon: 'bi bi-code' }
  // },

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 登录 + 管理员访问控制
router.beforeEach((to, from, next) => {
  const auth = getAuth()
  const db = getFirestore()

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  onAuthStateChanged(auth, async (user) => {
    if (!user && requiresAuth) {
      // 未登录 → login
      next('/login')
    } else if (user && (to.path === '/login' || to.path === '/register')) {
      // 已登录 → home
      next('/home')
    } else if (user && requiresAdmin) {
      // 需要管理员权限
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists() && userDoc.data().role === "admin") {
          next() // 允许进入
        } else {
          next('/home') // 非管理员 → 回 home
        }
      } catch (err) {
        console.error("Error checking admin role:", err)
        next('/home')
      }
    } else {
      next()
    }
  })
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
