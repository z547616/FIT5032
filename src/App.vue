<script setup>
import { useRoute } from 'vue-router'
import Navbar from './components/Navbar.vue'

const route = useRoute()
</script>

<template>
  <div>
    <!-- 登录/注册页显示欢迎语 -->
    <div v-if="['/login','/register'].includes(route.path)" class="text-center mt-4">
      <h1 class="fw-bold text-primary">Welcome to MindBloom 🌱</h1>
    </div>

    <!-- 仅非登录/注册页才显示导航栏 -->
    <Navbar v-if="!['/login','/register'].includes(route.path)" />

    <!-- 页面主体 -->
    <router-view />
  </div>
</template>
