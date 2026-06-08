import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * ===========================
 * CONFIG
 * ===========================
 */

const MODE = "generate_range";

const START_DATE = "2026-06-08";
const DAYS_TO_ASSIGN = 260;
const OVERWRITE_EXISTING = false;

const MEMBERS = [
  { userId: "Z2FQNDa3UwRUVDTqWcSEDJA5kvp2", email: "mattdhodges@outlook.com" },
  { userId: "uMKdZGXTnafAQtX4QN80ShBYRhh2", email: "davews1621@gmail.com" },
  { userId: "4ssyOFngYaV6liJMn3qHwtzQzAD2", email: "jfield1968@gmail.com" },
  { userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1", email: "scottcee01@googlemail.com" },
];

const NEW_MUSIC_FRIDAY = {
  label: "New Music Friday 🎧",
  links: [
    "https://en.wikipedia.org/wiki/List_of_2026_albums",
    "https://www.albumoftheyear.org/releases/this-week/",
  ],
};

const UK_BANK_HOLIDAYS = new Set([
  "2026-01-01",
  "2026-04-03",
  "2026-04-06",
  "2026-05-04",
  "2026-05-25",
  "2026-08-31",
  "2026-12-25",
  "2026-12-28",

  "2027-01-01",
  "2027-03-26",
  "2027-03-29",
  "2027-05-03",
  "2027-05-31",
  "2027-08-30",
  "2027-12-27",
  "2027-12-28",
]);

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

function londonDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  }).format(dt);

  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

async function writeScheduleDoc(dateStr, payload) {
  const ref = doc(db, "nominationsSchedule", dateStr);

  if (!OVERWRITE_EXISTING) {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      console.log(`⏭️ Skipping ${dateStr} because it already exists.`);
      return { skipped: true };
    }
  }

  await setDoc(ref, payload);
  return { skipped: false };
}

async function generateRange(startDateStr, daysToAssign) {
  const user = auth.currentUser;

  if (!user) {
    console.warn("Not authenticated. Log in first.");
    return;
  }

  console.log(`Authenticated as ${user.email}`);
  console.log(`Generating ${daysToAssign} assignable schedule days from ${startDateStr}`);

  let current = new Date(`${startDateStr}T12:00:00Z`);
  let assignedDays = 0;
  let memberIndex = 0;

  while (assignedDays < daysToAssign) {
    const dateStr = formatLondonDateKey(current);
    const dow = londonDayOfWeek(dateStr);

    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = UK_BANK_HOLIDAYS.has(dateStr);

    if (!isWeekend && !isHoliday) {
      if (dow === 5) {
        const res = await writeScheduleDoc(dateStr, {
          userEmail: NEW_MUSIC_FRIDAY.label,
          links: NEW_MUSIC_FRIDAY.links,
          assignedAt: new Date().toISOString(),
          type: "NEW_MUSIC_FRIDAY",
        });

        if (!res.skipped) {
          console.log(`🎧 Assigned ${dateStr} → New Music Friday`);
        }
      } else {
        const member = MEMBERS[memberIndex % MEMBERS.length];

        const res = await writeScheduleDoc(dateStr, {
          userId: member.userId,
          userEmail: member.email,
          assignedAt: new Date().toISOString(),
          type: "USER",
        });

        if (!res.skipped) {
          console.log(`✅ Assigned ${dateStr} → ${member.email}`);
          memberIndex++;
        }
      }

      assignedDays++;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  console.log("Schedule generation complete.");
}

export default function GenerateSchedule() {
  const [status, setStatus] = useState("Waiting for login...");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setStatus("Not logged in — please log in first.");
        return;
      }

      try {
        if (MODE === "generate_range") {
          setStatus("Generating schedule range...");
          await generateRange(START_DATE, DAYS_TO_ASSIGN);
          setStatus("✅ Schedule generated.");
        } else {
          setStatus("No action: MODE is not recognised.");
        }
      } catch (e) {
        console.error("Schedule generation failed:", e?.message || e);
        setStatus(`❌ Failed: ${e?.message || String(e)}`);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1rem",
        background: "#f0f8ff",
        borderRadius: 8,
      }}
    >
      <h3 style={{ marginTop: 0 }}>📅 Schedule Tool</h3>
      <p style={{ margin: 0 }}>
        <strong>Mode:</strong> {MODE}
      </p>
      <p style={{ margin: "0.5rem 0 0 0" }}>{status}</p>
      <p style={{ marginTop: "0.75rem", fontSize: "0.9em", color: "#444" }}>
        After this runs successfully, remove the schedule tool from App.js again.
      </p>
    </div>
  );
}
