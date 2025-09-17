<template>
  <div class="container py-5" style="max-width: 420px;">
    <div class="card shadow-sm border-0">
      <div class="card-body p-4">
        <h3 class="mb-4 text-center text-primary">Login</h3>

        <form @submit.prevent="handleLogin">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input v-model="username" type="text" class="form-control" required>
          </div>

          <div class="mb-3">
            <label class="form-label">Password</label>
            <input v-model="password" type="password" class="form-control" required>
          </div>

          <div class="mb-3">
            <label class="form-label">Captcha</label>
            <div class="input-group">
              <input v-model="captchaInput" type="text" class="form-control" required>
              <span class="input-group-text">{{ captcha }}</span>
              <button type="button" class="btn btn-outline-secondary" @click="generateCaptcha">↻</button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary w-100">Login</button>
          <div v-if="error" class="text-danger small mt-2">{{ error }}</div>
        </form>

        <div class="text-center mt-3">
          <small>Don't have an account?
            <router-link to="/register">Register now</router-link>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const captcha = ref('')
const captchaInput = ref('')
const error = ref('')

function generateCaptcha() {
  captcha.value = Math.random().toString(36).substring(2, 6).toUpperCase()
}
generateCaptcha()

function handleLogin() {
  error.value = ''

  const users = JSON.parse(localStorage.getItem('users') || '[]')
  const user = users.find(
    u => u.username === username.value && u.password === password.value
  )

  if (!user) {
    error.value = 'Invalid username or password'
    return
  }

  // 登录成功
  localStorage.setItem('currentUser', user.username)

  const role = user.role || 'user'  // 容错处理
  if (role === 'admin') {
    router.push('/admin')
  } else {
    router.push('/home')
  }
}
</script>
