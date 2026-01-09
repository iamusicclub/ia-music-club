import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  FieldPath,
  limit,
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

function isFriday(dateStr) {
  // dateStr is YYYY-MM-DD; day-of-week is stable using UTC midnight.
  const dt = new Date(`${dateStr}T00:00:00Z`);
  return dt.getUTCDay() === 5;
}

export default function ScheduleViewer() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayKey = useMemo(() => formatLondonDateKey(), []);

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        // Efficient query by document id (date string)
        const q = query(
          collection(db, "nominationsSchedule"),
          where(FieldPath.documentId(), ">=", todayKey),
          orderBy(FieldPath.documentId(), "asc"),
          limit(120)
        );

        const snapshot = await getDocs(q);

        const upcoming = snapshot.docs
          .map((d) => ({ date: d.id, ...d.data() }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setSchedule(upcoming);
      } catch (err) {
        console.error("❌ Failed to load nomination schedule:", err?.message || err);
        setSchedule([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [todayKey]);

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>📅 Nomination Schedule</h3>

      {loading ? (
        <p className="smallNote">Loading…</p>
      ) : schedule.length === 0 ? (
        <p className="smallNote">No upcoming nominations found.</p>
      ) : (
        <ul style={{ listStyleType: "none", paddingLeft: 0, margin: 0 }}>
          {schedule.map((item) => {
            // Force Fridays to show NMF, even if older docs still have a member assigned.
            const friday = isFriday(item.date);
            const isNMF =
              item.userEmail === "New Music Friday 🎧" ||
              item.type === "new_music_friday" ||
              friday;

            const links = item.links || [
              "https://en.wikipedia.org/wiki/List_of_2025_albums#May",
              "https://www.albumoftheyear.org/releases/this-week/",
            ];

            return (
              <li
                key={item.date}
                style={{
                  marginBottom: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "12px",
                  background: isNMF ? "var(--accent-weak)" : "#fff",
                  border: "1px solid var(--border)",
                }}
              >
                <strong>{item.date}</strong> —{" "}
                {isNMF ? (
                  <div style={{ marginTop: 6 }}>
                    <span className="badgeFriday">New Music Friday 🎧</span>
                    <div className="smallNote" style={{ marginTop: 6 }}>
                      {links.map((u, idx) => (
                        <div key={idx}>
                          🔗{" "}
                          <a href={u} target="_blank" rel="noopener noreferrer">
                            {u}
                          </a>
                        </div>
                      ))}
                      {!(
                        item.userEmail === "New Music Friday 🎧" ||
                        item.type === "new_music_friday"
                      ) ? (
                        <div style={{ marginTop: 6 }}>
                          <em>
                            Note: this date was previously assigned to{" "}
                            {item.userEmail || "Unknown"} — regenerate schedule if you want
                            Firestore to match Friday rules.
                          </em>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <span>{item.userEmail || "Unknown user"}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
