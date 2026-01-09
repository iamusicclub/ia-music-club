import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ Your config goes here (keep your existing values)
const firebaseConfig = {
  apiKey: "XXX",
  authDomain: "XXX",
  projectId: "XXX",
  storageBucket: "XXX",
  messagingSenderId: "XXX",
  appId: "XXX",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
