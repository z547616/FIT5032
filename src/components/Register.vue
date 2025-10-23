<template>
  <div class="container py-5" style="max-width: 500px">
    <div class="card shadow-sm border-0">
      <div class="card-body p-4">
        <h3 class="mb-4 text-center text-success">Register</h3>

        <form @submit.prevent="handleRegister">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input v-model="form.username" type="text" class="form-control" required />
          </div>

          <div class="mb-3">
            <label class="form-label">Email</label>
            <input v-model="form.email" type="email" class="form-control" required />
          </div>

          <div class="mb-3">
            <label class="form-label">Password</label>
            <input
              v-model="form.password"
              type="password"
              class="form-control"
              required
              minlength="6"
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Confirm Password</label>
            <input
              v-model="form.confirmPassword"
              type="password"
              class="form-control"
              required
              minlength="6"
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Gender</label>
            <select v-model="form.gender" class="form-select" required>
              <option value="" disabled>Select your gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
              <option>Prefer not to say</option>
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label">Age</label>
            <input v-model.number="form.age" type="number" class="form-control" min="1" required />
          </div>

          <button type="submit" class="btn btn-success w-100" :disabled="submitting">
            {{ submitting ? "Registering..." : "Register" }}
          </button>

          <div v-if="error" class="text-danger small mt-2">{{ error }}</div>
          <div v-if="success" class="text-success small mt-2">
            Registered successfully! Redirecting...
          </div>
        </form>

        <div class="text-center mt-3">
          <small>
            Already have an account?
            <router-link to="/login">Login here</router-link>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { sanitizeInput } from "../utils/sanitize.js"

// Firebase
import { auth, db, functions } from "../firebase"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"

const router = useRouter()

const form = ref({
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  gender: "",
  age: null
})

const error = ref("")
const success = ref(false)
const submitting = ref(false)

function clampAge(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return null
  return Math.min(120, Math.max(1, Math.round(x)))
}

async function handleRegister() {
  error.value = ""
  success.value = false
  submitting.value = true

  // 简单清理与校验
  form.value.username = sanitizeInput(form.value.username, 20)
  form.value.email = sanitizeInput(form.value.email, 50)

  if (form.value.password !== form.value.confirmPassword) {
    error.value = "Passwords do not match"
    submitting.value = false
    return
  }
  if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    error.value = "Invalid email format"
    submitting.value = false
    return
  }

  try {
    // 1) 注册 Auth
    const cred = await createUserWithEmailAndPassword(
      auth,
      form.value.email,
      form.value.password
    )
    const user = cred.user

    // 2) 确保 users/{uid} 存在（调用后端 callable，若已存在则直接返回）
    try {
      const ensure = httpsCallable(functions, "ensureUserProfile")
      await ensure({})
    } catch (e) {
      // 不影响主流程（触发器通常会建好，这里只是双保险）
      console.warn("[Register] ensureUserProfile callable failed (ignored):", e?.message || e)
    }

    // 3) 使用 setDoc + merge 创建/更新，避免 "No document to update"
    const patch = {
      username: form.value.username || (form.value.email.split("@")[0]),
      gender: form.value.gender || "Prefer not to say",
      age: clampAge(form.value.age),
      updatedAt: serverTimestamp()
    }
    await setDoc(doc(db, "users", user.uid), patch, { merge: true })

    success.value = true

    // 4) 直接进入已登录首页（路由守卫里也会识别管理员跳 /admin）
    setTimeout(() => router.push("/home"), 600)
  } catch (err) {
    console.error(err)
    error.value = err?.message || "Register failed"
  } finally {
    submitting.value = false
  }
}
</script>
