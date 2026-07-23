// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// TODO: Replace with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAd5oFdkW4-kkYqAeUDWhQ39RVC9xTgjyM",
  authDomain: "the-royal-nutritionist.firebaseapp.com",
  projectId: "the-royal-nutritionist",
  storageBucket: "the-royal-nutritionist.firebasestorage.app",
  messagingSenderId: "615165950068",
  appId: "1:615165950068:web:daccdc3c1d545b5f98b921",
  measurementId: "G-LGRMS2P5EN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 글로벌 변수로 노출 (app.js에서 사용하기 위함)
window.firebaseDB = db;
window.firebaseAuth = auth;

export { db, auth, collection, addDoc, updateDoc, doc, onSnapshot, signInAnonymously, setDoc };
