import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export default function ScheduleViewer() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const snapshot = await getDocs(collection(db, "nominationsSchedule"));

        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        const upcoming = snapshot.docs
          .map((doc) => ({
            date: doc.id,
            ...doc.data(),
          }))
          .filter((entry) => entry.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date));

        setSchedule(upcoming);
      } catch (err) {
        console.error("❌ Failed to load nomination schedule:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, []);

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
      <h3>📅 Nomination Schedule</h3>

      {loading ? (
        <p>Loading…</p>
      ) : schedule.length === 0 ? (
        <p>No upcoming nominations found.</p>
      ) : (
        <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
          {schedule.map((item) => {
            const isFriday = item.userEmail === "New Music Friday 🎧";
            return (
              <li
                key={item.date}
                style={{
                  marginBottom: "1rem",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  backgroundColor: isFriday ? "#eef6ff" : "#fff",
                  border: isFriday ? "1px solid #aad4ff" : "1px solid #ddd",
                }}
              >
                <strong>{item.date}</strong> —{" "}
                {isFriday ? (
                  <div>
                    <span style={{ fontWeight: "bold", color: "#0066cc" }}>
                      🎧 New Music Friday
                    </span>
                    <div style={{ marginTop: "0.4rem", fontSize: "0.9em" }}>
                      {item.links && item.links.length > 0 ? (
                        item.links.map((url, index) => (
                          <div key={index}>
                            🔗{" "}
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {url}
                            </a>
                          </div>
                        ))
                      ) : (
                        <em>No links provided</em>
                      )}
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

