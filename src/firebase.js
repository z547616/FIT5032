// src/firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from 'firebase/functions';

// Your web app's Firebase configuration
// （你在 Firebase 控制台里生成的配置）
const firebaseConfig = {
  apiKey: "AIzaSyC35u3Zk1GXP5zLVwgMxoO14_-fd4-Xf-g",
  authDomain: "mindbloom-cooh.firebaseapp.com",
  projectId: "mindbloom-cooh",
  storageBucket: "mindbloom-cooh.firebasestorage.app",
  messagingSenderId: "1033018983938",
  appId: "1:1033018983938:web:e42a1a63370a35bab9891b",
  measurementId: "G-M50VV3J2FP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics（可选，如果你需要统计的话）
const analytics = getAnalytics(app);

// Firebase Authentication
const auth = getAuth(app);

// Firestore Database
const db = getFirestore(app);

// 导出给其它文件使用
export { app, analytics, auth, db };

// 如果函数部署在默认区域（us-central1），下面这样即可；
// 若你部署在其他区域，改成：getFunctions(app, 'your-region')
// ← 导出 functions
// 指定与你控制台一致的区域；默认 us-central1
export const functions = getFunctions(app, 'australia-southeast2');
