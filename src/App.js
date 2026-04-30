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
import OnThisDay from "./OnThisDay";

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
  const [activeTab, setActiveTab] = useState("home");

  const todayKey = useMemo(() => formatLondonDateKey(), []);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("❌ Persistence setup error:", error.message);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadTodaySchedule = async () => {
      try {
        const ref = doc(db, "nominationsSchedule", todayKey);
        const snap = await getDoc(ref);
        setTodaysSchedule(
          snap.exists() ? { date: todayKey, ...snap.data() } : null
        );
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
    todaysSchedule?.type === "NEW_MUSIC_FRIDAY";

  const navButtonStyle = (tab) => ({
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: activeTab === tab ? "#e0ecff" : "#ffffff",
    fontWeight: activeTab === tab ? 700 : 500,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <aside
        style={{
          width: 230,
          padding: 20,
          borderRight: "1px solid #e5e7eb",
          background: "#ffffff",
          position: "sticky",
          top: 0,
          height: "100vh",
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ fontSize: 22, margin: "0 0 4px 0" }}>IA Music Club</h1>
        <div className="smallNote" style={{ marginBottom: 20 }}>
          Today: <strong>{todayKey}</strong>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <button style={navButtonStyle("home")} onClick={() => setActiveTab("home")}>
            Home
          </button>

          <button
            style={navButtonStyle("schedule")}
            onClick={() => setActiveTab("schedule")}
          >
            Schedule
          </button>

          <button
            style={navButtonStyle("onthisday")}
            onClick={() => setActiveTab("onthisday")}
          >
            On This Day
          </button>

          <button
            style={navButtonStyle("recommends")}
            onClick={() => setActiveTab("recommends")}
          >
            New Music Recommends
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          {user ? (
            <>
              <div className="pill" style={{ marginBottom: 10 }}>
                👋 {user.email}
              </div>
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
      </aside>

      <main
        className="container"
        style={{
          flex: 1,
          maxWidth: 980,
          margin: "0 auto",
          padding: "24px 28px",
        }}
      >
        {!user ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Sign in</h2>
            <button className="btn" onClick={login} style={{ marginTop: 10 }}>
              Login
            </button>
          </div>
        ) : (
          <>
            <div className="card">
              <h2 style={{ margin: 0 }}>🎤 Today’s Nominator</h2>
              <p style={{ margin: "8px 0 0 0" }}>
                {todaysSchedule ? (
                  isNewMusicFriday ? (
                    <>
                      <strong>New Music Friday 🎧</strong>
                      <div className="smallNote" style={{ marginTop: 6 }}>
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

            {activeTab === "home" ? (
              <>
                <div style={{ marginTop: 14 }}>
                  <NominateAlbum />
                </div>
                <AlbumListNew />
              </>
            ) : activeTab === "schedule" ? (
              <ScheduleViewer />
            ) : activeTab === "onthisday" ? (
              <OnThisDay />
            ) : (
              <NewMusicRecommends />
            )}
          </>
        )}
      </main>
    </div>
  );
}
