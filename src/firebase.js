import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAopvRqdvFLqtN-3UKsuYq1JRIaW8qYgN4",
  authDomain: "ia-album-club.firebaseapp.com",
  projectId: "ia-album-club",
  storageBucket: "ia-album-club.firebasestorage.app",
  messagingSenderId: "489116766362",
  appId: "1:489116766362:web:0945749c39cc715dda0f23",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
