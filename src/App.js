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
import TasteMap from "./TasteMap";
import HallOfFame from "./HallOfFame";

const PARTICIPANTS = {
  "scottcee01@googlemail.com": "Scott",
  "scottcee01@gmail.com": "Scott",
  "mattdhodges@outlook.com": "Matt",
  "matthodges@outlook.com": "Matt",
  "davews1621@gmail.com": "Dave",
  "jfield1968@gmail.com": "John",
  Scott: "Scott",
  Matt: "Matt",
  Dave: "Dave",
  John: "John",
};

function displayName(value) {
  if (!value) return "Unknown";

  const clean = String(value).trim();
  const lower = clean.toLowerCase();

  return PARTICIPANTS[clean] || PARTICIPANTS[lower] || clean;
}

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

  const signedInName = displayName(user?.email);
  const todaysNominatorName = displayName(todaysSchedule?.userEmail);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>IA Music Club</h1>
          <div className="sub">
            Today: <strong>{todayKey}</strong>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              width: "100%",
              maxWidth: 260,
            }}
          >
            <option value="home">Home</option>
            <option value="schedule">Schedule</option>
            <option value="onthisday">On This Day</option>
            <option value="recommends">New Music Recommends</option>
            <option value="tastemap">Taste Map</option>
            <option value="halloffame">Hall of Fame</option>
          </select>
        </div>

        <div className="authRow" style={{ marginTop: 10 }}>
          {user ? (
            <>
              <span className="pill">👋 {signedInName}</span>
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
                  <strong>{todaysNominatorName}</strong>
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
          ) : activeTab === "tastemap" ? (
            <TasteMap />
          ) : activeTab === "halloffame" ? (
            <HallOfFame />
          ) : (
            <NewMusicRecommends />
          )}
        </>
      )}
    </div>
  );
}
