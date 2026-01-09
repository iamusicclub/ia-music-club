import { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import NominateAlbum from "./NominateAlbum";
import AlbumListNew from "./AlbumListNew";
import ScheduleViewer from "./ScheduleViewer";
import NewMusicRecommends from "./NewMusicRecommends";

function formatLondonDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [todaysSchedule, setTodaysSchedule] = useState(null);
  const [activeTab, setActiveTab] = useState("home"); // home | recommends

  const todayKey = useMemo(() => formatLondonDateKey(), []);

  // Persist login (so users log in once, not daily)
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("❌ Persistence setup error:", error.message);
    });
  }, []);

  // Auth tracking
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Load today's schedule entry (for header)
  useEffect(() => {
    const loadTodaySchedule = async () => {
      try {
        const ref = doc(db, "nominationsSchedule", todayKey);
        const snap = await getDoc(ref);
        setTodaysSchedule(snap.exists() ? { date: todayKey, ...snap.data() } : null);
      } catch (e) {
        console.error("Failed to load today's schedule:", e?.message || e);
        setTodaysSchedule(null);
      }
    };

    loadTodaySchedule();
  }, [todayKey]);

  const login = async () => {
    const email = prompt("Enter your email");
    const password = prompt("Enter your password");
    if (!email || !password) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err?.message || String(err));
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isNewMusicFriday =
    todaysSchedule?.userEmail === "New Music Friday 🎧" ||
    todaysSchedule?.type === "new_music_friday";

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>IA Music Club</h1>
          <div className="sub">
            Today: <strong>{todayKey}</strong>{" "}
            {isNewMusicFriday ? (
              <span className="badgeFriday" style={{ marginLeft: 8 }}>
                New Music Friday
              </span>
            ) : null}
          </div>
        </div>

        <div className="nav">
          <button
            className={activeTab === "home" ? "active" : ""}
            onClick={() => setActiveTab("home")}
          >
            Home
          </button>
          <button
            className={activeTab === "recommends" ? "active" : ""}
            onClick={() => setActiveTab("recommends")}
          >
            New Music Recommends
          </button>
        </div>

        <div className="authRow">
          {user ? (
            <>
              <span className="pill">👋 {user.email}</span>
              <button className="btn secondary" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button className="btn" onClick={login}>
              Login
            </button>
          )}
        </div>
      </div>

      {!user ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Sign in</h2>
          <p className="smallNote" style={{ marginTop: 6 }}>
            Your Firestore rules currently require authentication for reading/writing club data,
            so users must log in at least once. With persistence enabled, they should stay logged
            in on the same device/browser.
          </p>
          <button className="btn" onClick={login} style={{ marginTop: 10 }}>
            Login
          </button>
        </div>
      ) : activeTab === "home" ? (
        <>
          <div className="card">
            <h2 style={{ margin: 0 }}>🎤 Today’s Nominator</h2>
            <p style={{ margin: "8px 0 0 0" }}>
              {todaysSchedule ? (
                isNewMusicFriday ? (
                  <>
                    <strong>New Music Friday 🎧</strong>
                    <div className="smallNote" style={{ marginTop: 6 }}>
                      Explore:
                      <ul style={{ margin: "6px 0 0 18px" }}>
                        {(todaysSchedule.links || []).map((u, idx) => (
                          <li key={idx}>
                            <a href={u} target="_blank" rel="noopener noreferrer">
                              {u}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <strong>{todaysSchedule.userEmail || "Unknown"}</strong>
                )
              ) : (
                <strong>No nominator scheduled for today</strong>
              )}
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            <NominateAlbum />
          </div>

          <AlbumListNew />

          <ScheduleViewer />
        </>
      ) : (
        <NewMusicRecommends />
      )}
    </div>
  );
}
