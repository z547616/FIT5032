// src/firebase.js
// --------------------------------------
// Firebase Initialization (MindBloom)
// --------------------------------------

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Firebase config（请保持与你控制台完全一致）
const firebaseConfig = {
  apiKey: "AIzaSyC35u3Zk1GXP5zLVwgMxoO14_-fd4-Xf-g",
  authDomain: "mindbloom-cooh.firebaseapp.com",
  projectId: "mindbloom-cooh",
  storageBucket: "mindbloom-cooh.firebasestorage.app",
  messagingSenderId: "1033018983938",
  appId: "1:1033018983938:web:e42a1a63370a35bab9891b",
  measurementId: "G-M50VV3J2FP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// （可选）Analytics
const analytics = getAnalytics(app);

// Auth
const auth = getAuth(app);

// Firestore Database
const db = getFirestore(app);

// Cloud Functions（确保区域与你后端一致）
const functions = getFunctions(app, "australia-southeast2");

// Cloud Storage（用于头像上传）
const storage = getStorage(app, "gs://mindbloom-cooh.firebasestorage.app");

// 统一导出
export { app, analytics, auth, db, functions, storage };
