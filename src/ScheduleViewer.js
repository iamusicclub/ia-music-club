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
          {schedule.map((item) => (
            <li
              key={item.date}
              style={{
                marginBottom: "1rem",
                backgroundColor:
                  item.userEmail === "New Music Friday 🎧" ? "#eef7ff" : "",
                padding: "0.5rem",
                borderRadius: "6px",
              }}
            >
              <strong>{item.date}</strong> —{" "}
              {item.userEmail === "New Music Friday 🎧" ? (
                <>
                  <span style={{ fontWeight: "bold", color: "#0077cc" }}>
                    New Music Friday 🎧
                  </span>
                  <div style={{ marginTop: "0.3rem", fontSize: "0.9em" }}>
                    {item.links?.map((url, index) => (
                      <div key={index}>
                        🔗{" "}
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {url}
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <span>{item.userEmail || "Unknown user"}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
