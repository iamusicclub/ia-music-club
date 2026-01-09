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
import GenerateSchedule from "./GenerateSchedule";
import NewMusicRecommends from "./NewMusicRecommends";

import "./styles.css";

function formatLondonDateKey(date = new Date()) {
  // YYYY-MM-DD in Europe/London (avoids UTC off-by-one)
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
  const [showAdminTools, setShowAdminTools] = useState(false);

  const isAdmin = useMemo(() => {
    const email = user?.email || "";
    // ✅ Add any admin emails here
    return ["scottcee01@googlemail.com"].includes(email);
  }, [user]);

  // Enable persistent login across sessions (once logged in, they should stay logged in)
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log("✅ Persistent login enabled"))
      .catch((error) =>
        console.error("❌ Persistence setup error:", error.message)
      );
  }, []);

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Fetch today's schedule doc
  useEffect(() => {
    const fetchToday = async () => {
      try {
        const todayStr = formatLondonDateKey();
        const ref = doc(db, "nominationsSchedule", todayStr);
        const snap = await getDoc(ref);
        setTodaysSchedule(snap.exists() ? { date: todayStr, ...snap.data() } : null);
      } catch (e) {
        console.error("Failed to fetch today's schedule:", e?.message || e);
        setTodaysSchedule(null);
      }
    };

    fetchToday();
  }, [user]); // refetch after login too

  const login = async () => {
    const email = prompt("Enter your email");
    const password = prompt("Enter your password");
    if (!email || !password) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setShowAdminTools(false);
    setActiveTab("home");
  };

  const renderTodaysNominator = () => {
    // Friday/New Music Friday record can be stored as userEmail = "New Music Friday 🎧" + links
    if (!todaysSchedule) {
      return (
        <div className="today-pill today-pill--muted">
          No nominator scheduled for today (weekend/holiday)
        </div>
      );
    }

    const isNMF = todaysSchedule.userEmail === "New Music Friday 🎧";
    if (!isNMF) {
      return (
        <div className="today-pill">
          <span className="today-pill__label">Today’s nominator</span>
          <span className="today-pill__value">{todaysSchedule.userEmail}</span>
        </div>
      );
    }

    return (
      <div className="today-pill today-pill--nmf">
        <div>
          <span className="today-pill__label">Today</span>
          <span className="today-pill__value">New Music Friday 🎧</span>
        </div>
        <div className="today-pill__links">
          {(todaysSchedule.links || []).map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {u}
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__title">IA Music Club</div>
          <div className="brand__sub">Nominate • Rate • Discuss</div>
        </div>

        <div className="topbar__right">
          {renderTodaysNominator()}

          {user ? (
            <div className="authbox">
              <span className="authbox__user">👋 {user.email}</span>
              <button className="btn btn--primary" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <button className="btn btn--primary" onClick={login}>
              Login
            </button>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === "home" ? "tab--active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          Home
        </button>
        <button
          className={`tab ${activeTab === "schedule" ? "tab--active" : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          Schedule
        </button>
        <button
          className={`tab ${activeTab === "recs" ? "tab--active" : ""}`}
          onClick={() => setActiveTab("recs")}
        >
          New Music Recommends
        </button>

        {user && isAdmin && (
          <button
            className={`tab tab--admin ${showAdminTools ? "tab--active" : ""}`}
            onClick={() => setShowAdminTools((s) => !s)}
            title="Admin tools (schedule generation)"
          >
            Admin
          </button>
        )}
      </nav>

      <main className="main">
        {!user ? (
          <div className="card card--center">
            <h2>Welcome</h2>
            <p>Please login to view nominations, rate albums, and see the schedule.</p>
            <button className="btn btn--primary" onClick={login}>
              Login
            </button>
          </div>
        ) : (
          <>
            {activeTab === "home" && (
              <>
                <NominateAlbum />
                <AlbumListNew />
              </>
            )}

            {activeTab === "schedule" && <ScheduleViewer />}

            {activeTab === "recs" && <NewMusicRecommends />}

            {showAdminTools && isAdmin && (
              <div style={{ marginTop: "16px" }}>
                <GenerateSchedule />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <span>Built with React • Firebase Auth • Firestore • Last.fm</span>
      </footer>
    </div>
  );
}
