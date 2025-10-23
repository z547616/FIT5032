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
import MyMoodSpace from '../pages/MyMoodSpace.vue'

// Firebase
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getFirestore, doc, getDoc } from "firebase/firestore"

const routes = [
  {
    path: '/',
    redirect: '/home' // 初始仍指向 /home，由守卫在登录后进行角色感知重定向
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
  { path: '/my-mood-space', component: MyMoodSpace, meta: { requiresAuth: true, title: 'MindBloom | My Mood Space', icon: 'bi bi-bookmark-heart' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 登录 + 管理员访问控制 + 登录后默认路由（管理员→/admin）
router.beforeEach((to, from, next) => {
  const auth = getAuth()
  const db = getFirestore()

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  const redirectByRole = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid))
      const role = (userDoc.exists() && userDoc.data().role) || 'user'
      if (role === 'admin') return next('/admin')
      return next('/home')
    } catch (e) {
      console.error("Error checking user role:", e)
      return next('/home')
    }
  }

  onAuthStateChanged(auth, async (user) => {
    // 1) 未登录但目标需要鉴权 → 去登录
    if (!user && requiresAuth) {
      return next('/login')
    }

    // 2) 已登录但去 login/register → 按角色送到 admin 或 home
    if (user && (to.path === '/login' || to.path === '/register')) {
      return redirectByRole(user)
    }

    // 3) 访问需要管理员权限的路由
    if (user && requiresAdmin) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid))
        if (snap.exists() && snap.data().role === "admin") {
          return next()
        } else {
          return next('/home')
        }
      } catch (err) {
        console.error("Error checking admin role:", err)
        return next('/home')
      }
    }

    // 4) 默认登录后 “管理员优先去 /admin” 的体验：
    // 当目标是 /home 且来源是初始入口(/、/login、/register)时，如为管理员则改送 /admin
    if (user && to.path === '/home' && ['/', '/login', '/register', ''].includes(from?.path || '')) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid))
        if (snap.exists() && snap.data().role === "admin") {
          return next('/admin')
        }
      } catch (e) {
        // 忽略错误，按原路继续
      }
    }

    // 5) 其他情况放行
    return next()
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
