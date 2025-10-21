<template>
  <div class="container py-5" style="max-width: 420px;">
    <div class="card shadow-sm border-0">
      <div class="card-body p-4">
        <h3 class="mb-4 text-center text-primary">Login</h3>

        <form @submit.prevent="handleLogin">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input v-model="email" type="email" class="form-control" required />
          </div>

          <div class="mb-3">
            <label class="form-label">Password</label>
            <input v-model="password" type="password" class="form-control" required />
          </div>

          <div class="mb-3">
            <label class="form-label">Captcha</label>
            <div class="input-group">
              <input v-model="captchaInput" type="text" class="form-control" required />
              <span class="input-group-text">{{ captcha }}</span>
              <button type="button" class="btn btn-outline-secondary" @click="generateCaptcha">↻</button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary w-100" :disabled="loading">
            {{ loading ? "Logging in..." : "Login" }}
          </button>
          <div v-if="error" class="text-danger small mt-2">{{ error }}</div>
        </form>

        <div class="text-center mt-3">
          <small>
            Don't have an account?
            <router-link to="/register">Register now</router-link>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"

// Firebase
import { auth, db, functions } from "../firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"

const router = useRouter()
const email = ref("")
const password = ref("")
const captcha = ref("")
const captchaInput = ref("")
const error = ref("")
const loading = ref(false)

function generateCaptcha() {
  captcha.value = Math.random().toString(36).substring(2, 6).toUpperCase()
}
generateCaptcha()

async function fetchProfile(uid) {
  const ref = doc(db, "users", uid)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

async function handleLogin() {
  error.value = ""
  loading.value = true

  // 校验验证码
  if (captchaInput.value.toUpperCase() !== captcha.value) {
    error.value = "Invalid captcha"
    generateCaptcha()
    loading.value = false
    return
  }

  try {
    // 1) Auth 登录
    const { user } = await signInWithEmailAndPassword(auth, email.value, password.value)

    // 2) 读 profile
    let userData = await fetchProfile(user.uid)

    // 3) 如果缺失，调用云端 ensureUserProfile 补建，然后再读一次
    if (!userData) {
      const ensure = httpsCallable(functions, "ensureUserProfile")
      await ensure() // 无参数；基于 request.auth 识别
      userData = await fetchProfile(user.uid)
    }

    // 4) 仍然拿不到（极少数延迟/网络波动），也允许进入首页，UI 会根据 onAuthStateChanged 拉取
    const role = userData?.role || "user"

    if (role === "admin") router.push("/admin")
    else router.push("/home")
  } catch (err) {
    console.error(err)
    error.value = err?.message || "Login failed"
    generateCaptcha()
  } finally {
    loading.value = false
  }
}
</script>
