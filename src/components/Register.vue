<template>
  <div class="container py-5" style="max-width: 500px;">
    <div class="card shadow-sm border-0">
      <div class="card-body p-4">
        <h3 class="mb-4 text-center text-success">Register</h3>

        <form @submit.prevent="handleRegister">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input v-model="form.username" type="text" class="form-control" required>
          </div>

          <div class="mb-3">
            <label class="form-label">Email</label>
            <input v-model="form.email" type="email" class="form-control" required>
          </div>

          <div class="mb-3">
            <label class="form-label">Password</label>
            <input v-model="form.password" type="password" class="form-control" required>
          </div>

          <div class="mb-3">
            <label class="form-label">Confirm Password</label>
            <input v-model="form.confirmPassword" type="password" class="form-control" required>
          </div>

          <div class="mb-3">
            <label class="form-label">Gender</label>
            <select v-model="form.gender" class="form-select" required>
              <option value="" disabled>Select your gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label">Age</label>
            <input v-model.number="form.age" type="number" class="form-control" min="1" required>
          </div>

          <!-- 新增角色选择 -->
          <div class="mb-3">
            <label class="form-label">Role</label>
            <select v-model="form.role" class="form-select" required>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button type="submit" class="btn btn-success w-100">Register</button>
          <div v-if="error" class="text-danger small mt-2">{{ error }}</div>
          <div v-if="success" class="text-success small mt-2">Registered successfully! Please login.</div>
        </form>

        <div class="text-center mt-3">
          <small>Already have an account?
            <router-link to="/login">Login here</router-link>
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
const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  gender: '',
  age: null,
  role: 'user'      // ← 新增字段
})
const error = ref('')
const success = ref(false)

function handleRegister() {
  error.value = ''
  success.value = false

  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }
  if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    error.value = 'Invalid email format'
    return
  }

  const users = JSON.parse(localStorage.getItem('users') || '[]')
  if (users.find(u => u.username === form.value.username)) {
    error.value = 'Username already exists'
    return
  }

  users.push({
    username: form.value.username,
    password: form.value.password,
    email: form.value.email,
    gender: form.value.gender,
    age: form.value.age,
    nickname: '',
    avatar: '',
    role: form.value.role     // ← 存入角色
  })
  localStorage.setItem('users', JSON.stringify(users))
  success.value = true
  setTimeout(() => router.push('/login'), 1200)
}
</script>
