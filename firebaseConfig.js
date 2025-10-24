// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ✅ Firebase config จาก Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBfMvkbJbc6IR0PR6ag8Mi7OL_Wk8KtNOY",
  authDomain: "delivery-app-2c408.firebaseapp.com",
  projectId: "delivery-app-2c408",
  storageBucket: "delivery-app-2c408.firebasestorage.app",
  messagingSenderId: "112881175491",
  appId: "1:112881175491:web:730ba4a6aed2fe93eecb76",
  measurementId: "G-JQN00Y8GDV"
};

// ✅ เริ่มต้น Firebase App
const app = initializeApp(firebaseConfig);

// ✅ สร้าง instance ของ Firestore
const db = getFirestore(app);

// ✅ Export db (ต้องทำหลังประกาศตัวแปร)
export { db };
