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

          <button type="submit" class="btn btn-primary w-100">Login</button>
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
import { auth, db } from "../firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

const router = useRouter()
const email = ref("")
const password = ref("")
const captcha = ref("")
const captchaInput = ref("")
const error = ref("")

function generateCaptcha() {
  captcha.value = Math.random().toString(36).substring(2, 6).toUpperCase()
}
generateCaptcha()

async function handleLogin() {
  error.value = ""

  // 校验验证码
  if (captchaInput.value.toUpperCase() !== captcha.value) {
    error.value = "Invalid captcha"
    generateCaptcha()
    return
  }

  try {
    // Firebase Auth 登录
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    )
    const user = userCredential.user

    // Firestore 获取用户信息
    const docRef = doc(db, "users", user.uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const userData = docSnap.data()
      const role = userData.role || "user"

      // 可选：缓存当前用户信息（供 Navbar 使用）
      localStorage.setItem("currentUser", JSON.stringify({
        uid: user.uid,
        email: user.email,
        username: userData.username,
        role: role
      }))

      // 跳转
      if (role === "admin") {
        router.push("/admin")
      } else {
        router.push("/home")
      }
    } else {
      error.value = "User profile not found in database"
    }
  } catch (err) {
    error.value = err.message
    generateCaptcha()
  }
}
</script>
