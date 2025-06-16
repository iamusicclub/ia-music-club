import { useState, useEffect } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

import NominateAlbum from "./NominateAlbum";
import AlbumList from "./AlbumList";
import ScheduleViewer from "./ScheduleViewer";

function App() {
  const [user, setUser] = useState(null);
  const [todaysNominator, setTodaysNominator] = useState(null);

  // Enable persistent login on initial mount
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("🔒 Persistent login enabled");
      })
      .catch((error) => {
        console.error("❌ Persistence error:", error.message);
      });
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Fetch today's nominator
  useEffect(() => {
    const fetchTodaysNominator = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const ref = doc(db, "nominationsSchedule", todayStr);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setTodaysNominator(
          data.userEmail === "New Music Friday 🎧"
            ? "🎧 New Music Friday"
            : data.userEmail
        );
      } else {
        setTodaysNominator("No nomination scheduled today");
      }
    };

    fetchTodaysNominator();
  }, []);

  // Login flow
  const login = async () => {
    const email = prompt("Enter your email");
    const password = prompt("Enter your password");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  // Logout
  const logout = async () => {
    await signOut(auth);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>🎤 Today's Nominator</h2>
      <p>
        <strong>{todaysNominator || "Loading..."}</strong>
      </p>

      {user ? (
        <>
          <p style={{ marginBottom: "1rem" }}>Hello, {user.email}</p>
          <NominateAlbum />
          <AlbumList />
          <ScheduleViewer />
          <button onClick={logout} style={{ marginTop: "1rem" }}>
            Logout
          </button>
        </>
      ) : (
        <button onClick={login}>Login</button>
      )}
    </div>
  );
}

export default App;

