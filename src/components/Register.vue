<template>
  <div class="container py-5" style="max-width: 500px">
    <div class="card shadow-sm border-0">
      <div class="card-body p-4">
        <h3 class="mb-4 text-center text-success">Register</h3>

        <form @submit.prevent="handleRegister">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input
              v-model="form.username"
              type="text"
              class="form-control"
              required
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Email</label>
            <input
              v-model="form.email"
              type="email"
              class="form-control"
              required
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Password</label>
            <input
              v-model="form.password"
              type="password"
              class="form-control"
              required
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Confirm Password</label>
            <input
              v-model="form.confirmPassword"
              type="password"
              class="form-control"
              required
            />
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
            <input
              v-model.number="form.age"
              type="number"
              class="form-control"
              min="1"
              required
            />
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
          <div v-if="success" class="text-success small mt-2">
            Registered successfully! Please login.
          </div>
        </form>

        <div class="text-center mt-3">
          <small
            >Already have an account?
            <router-link to="/login">Login here</router-link>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { sanitizeInput } from "../utils/sanitize.js";

// Firebase
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const router = useRouter();
const form = ref({
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  gender: "",
  age: null,
  role: "user",
});
const error = ref("");
const success = ref(false);

async function handleRegister() {
  error.value = "";
  success.value = false;

  // 清理输入
  form.value.username = sanitizeInput(form.value.username, 20);
  form.value.email = sanitizeInput(form.value.email, 50);

  if (form.value.password !== form.value.confirmPassword) {
    error.value = "Passwords do not match";
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    error.value = "Invalid email format";
    return;
  }

  try {
    // Firebase Auth 创建账号
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      form.value.email,
      form.value.password
    );
    const user = userCredential.user;

    // Firestore 存储额外信息
    await setDoc(doc(db, "users", user.uid), {
      username: form.value.username,
      email: form.value.email,
      gender: form.value.gender,
      age: form.value.age,
      role: form.value.role,
      nickname: "",
      avatar: "",
    });

    success.value = true;
    setTimeout(() => router.push("/login"), 1200);
  } catch (err) {
    error.value = err.message;
  }
}
</script>
