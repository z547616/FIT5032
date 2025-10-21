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
            <input
              v-model.number="form.age"
              type="number"
              class="form-control"
              min="1"
              required
            />
          </div>

          <button type="submit" class="btn btn-success w-100" :disabled="submitting">
            {{ submitting ? "Registering..." : "Register" }}
          </button>

          <div v-if="error" class="text-danger small mt-2">{{ error }}</div>
          <div v-if="success" class="text-success small mt-2">
            Registered successfully! Redirecting to login...
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
import { ref } from "vue";
import { useRouter } from "vue-router";
import { sanitizeInput } from "../utils/sanitize.js";

// Firebase
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const router = useRouter();

const form = ref({
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  gender: "",
  age: null
});

const error = ref("");
const success = ref(false);
const submitting = ref(false);

/**
 * 等待 Cloud Function ensureUserProfileOnSignup 创建 users/{uid}
 * 最多重试 5 次，每次间隔 400ms
 */
async function waitForProfile(uid) {
  const ref = doc(db, "users", uid);
  for (let i = 0; i < 5; i++) {
    const snap = await getDoc(ref);
    if (snap.exists()) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function handleRegister() {
  error.value = "";
  success.value = false;
  submitting.value = true;

  // 简单清理与校验
  form.value.username = sanitizeInput(form.value.username, 20);
  form.value.email = sanitizeInput(form.value.email, 50);

  if (form.value.password !== form.value.confirmPassword) {
    error.value = "Passwords do not match";
    submitting.value = false;
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    error.value = "Invalid email format";
    submitting.value = false;
    return;
  }

  try {
    // 1) Auth 注册
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      form.value.email,
      form.value.password
    );
    const user = userCredential.user;

    // 2) 等待后端（Cloud Function）创建 users/{uid} 并写入 createdAt、默认字段
    const ok = await waitForProfile(user.uid);
    if (!ok) {
      // 即使等不到，也先继续；后面的 update 若因规则失败会抛错
      console.warn("[Register] profile doc not detected after retries; continue to update");
    }

    // 3) 仅更新允许的业务字段 + updatedAt（遵循安全规则）
    //    不修改 email/role/createdAt
    await updateDoc(doc(db, "users", user.uid), {
      username: form.value.username,
      gender: form.value.gender,
      age: Number(form.value.age),
      updatedAt: serverTimestamp()
    });

    success.value = true;

    // 4) 跳转登录
    setTimeout(() => router.push("/login"), 1200);
  } catch (err) {
    console.error(err);
    error.value = err?.message || "Register failed";
  } finally {
    submitting.value = false;
  }
}
</script>
