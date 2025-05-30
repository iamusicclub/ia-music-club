import { useState, useEffect } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import NominateAlbum from "./NominateAlbum";
import AlbumList from "./AlbumListNew";
import ScheduleViewer from "./ScheduleViewer";
// import GenerateSchedule from "./GenerateSchedule"; // Use only if needed

function App() {
  const [user, setUser] = useState(null);
  const [todaysNominator, setTodaysNominator] = useState(null);

  // Track auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Fetch today's nominator
  useEffect(() => {
    const fetchNominator = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const ref = doc(db, "nominationsSchedule", todayStr);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setTodaysNominator(snap.data().userEmail);
      } else {
        setTodaysNominator("No nominator scheduled for today");
      }
    };

    fetchNominator();
  }, []);

  const login = async () => {
    const email = prompt("Enter your email");
    const password = prompt("Enter your password");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <div
      style={{
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        maxWidth: "900px",
        margin: "0 auto",
        padding: "24px",
        lineHeight: "1.6",
        backgroundColor: "#fafafa",
      }}
    >
      <header
        style={{
          padding: "1rem 0",
          borderBottom: "1px solid #ccc",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>🎤 Today's Nominator:</h2>
        <p style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#333" }}>
          {todaysNominator || "Loading..."}
        </p>
      </header>

      {user ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <p style={{ margin: 0 }}>👋 Hello, {user.email}</p>
            <button
              onClick={logout}
              style={{
                backgroundColor: "#1976d2",
                color: "#fff",
                padding: "8px 14px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>

          <NominateAlbum />
          <AlbumList />
          <ScheduleViewer />
        </>
      ) : (
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <button
            onClick={login}
            style={{
              backgroundColor: "#1976d2",
              color: "#fff",
              padding: "12px 20px",
              fontSize: "1rem",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Login
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
