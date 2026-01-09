import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  documentId,
} from "firebase/firestore";

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

export default function ScheduleViewer() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const todayStr = useMemo(() => formatLondonDateKey(new Date()), []);

  useEffect(() => {
    setLoading(true);
    setErrorMsg("");

    // Only upcoming schedule docs, ordered by date (doc id), limited for performance
    const q = query(
      collection(db, "nominationsSchedule"),
      where(documentId(), ">=", todayStr),
      orderBy(documentId()),
      limit(200) // adjust if you want more shown
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const upcoming = snapshot.docs.map((d) => ({
          date: d.id,
          ...d.data(),
        }));
        setSchedule(upcoming);
        setLoading(false);
      },
      (err) => {
        console.error("❌ Failed to load nomination schedule:", err);
        setErrorMsg(err?.message || "Failed to load schedule.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [todayStr]);

  return (
    <div
      style={{
        marginTop: "2rem",
        padding: "1rem",
        borderTop: "1px solid #ccc",
        backgroundColor: "#f9f9f9",
        borderRadius: "8px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>📅 Nomination Schedule</h3>

      {loading ? (
        <p>Loading…</p>
      ) : errorMsg ? (
        <div style={{ color: "#b00020" }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>Schedule failed to load.</p>
          <p style={{ margin: "0.25rem 0 0 0" }}>{errorMsg}</p>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9em" }}>
            If you see <code>Missing or insufficient permissions</code>, you must be logged in
            because your Firestore rules require authentication for reading <code>nominationsSchedule</code>.
          </p>
        </div>
      ) : schedule.length === 0 ? (
        <div>
          <p style={{ margin: 0 }}>No upcoming nominations found.</p>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9em", color: "#555" }}>
            Checks:
            <br />• Confirm Firestore has <code>nominationsSchedule</code> docs dated today or later.
            <br />• If you just generated the schedule, this page should update automatically now.
          </p>
        </div>
      ) : (
        <ul style={{ listStyleType: "none", paddingLeft: 0, margin: 0 }}>
          {schedule.map((item) => {
            const isNewMusicFriday =
              item.type === "NEW_MUSIC_FRIDAY" ||
              item.userEmail === "New Music Friday 🎧";

            return (
              <li
                key={item.date}
                style={{
                  marginBottom: "1rem",
                  backgroundColor: isNewMusicFriday ? "#eef7ff" : "#fff",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{item.date}</strong>
                  <span style={{ color: "#666", fontSize: "0.9em" }}>
                    {isNewMusicFriday ? "Friday" : ""}
                  </span>
                </div>

                {isNewMusicFriday ? (
                  <>
                    <div style={{ marginTop: "0.4rem", fontWeight: "bold", color: "#0077cc" }}>
                      New Music Friday 🎧
                    </div>

                    {Array.isArray(item.links) && item.links.length > 0 && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.95em" }}>
                        {item.links.map((url, idx) => (
                          <div key={idx}>
                            🔗{" "}
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              {url}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ marginTop: "0.4rem" }}>
                    {item.userEmail || "Unknown user"}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
