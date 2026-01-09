import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * ===========================
 * CONFIG — CHANGE THESE ONLY
 * ===========================
 */

/**
 * MODE OPTIONS:
 * 1) "override_today_only"
 *    - Writes ONLY today's nominationsSchedule doc (London date),
 *      assigning it to your user (even if Friday).
 *    - Does NOT generate future dates.
 *
 * 2) "generate_range"
 *    - Generates a schedule range starting from START_DATE
 *    - Uses New Music Friday rules for Fridays
 */
const MODE = "override_today_only"; // <-- set to "generate_range" when you actually want to generate schedules

// Used only when MODE === "generate_range"
const START_DATE = "2025-06-02";
const DAYS_TO_ASSIGN = 60;

// Safety: if false, generator will NOT overwrite existing docs
const OVERWRITE_EXISTING = false;

// Your “today override” identity (must match your Firebase Auth user)
const OVERRIDE_USER = {
  userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1",
  email: "scottcee01@googlemail.com",
};

// Rotation members (only used for normal weekday assignment)
const MEMBERS = [
  { userId: "Z2FQNDa3UwRUVDTqWcSEDJA5kvp2", email: "mattdhodges@outlook.com" },
  { userId: "uMKdZGXTnafAQtX4QN80ShBYRhh2", email: "davews1621@gmail.com" },
  { userId: "4ssyOFngYaV6liJMn3qHwtzQzAD2", email: "jfield1968@gmail.com" },
  { userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1", email: "scottcee01@googlemail.com" },
];

// Friday links
const NEW_MUSIC_FRIDAY = {
  label: "New Music Friday 🎧",
  links: [
    "https://en.wikipedia.org/wiki/List_of_2025_albums#May",
    "https://www.albumoftheyear.org/releases/this-week/",
  ],
};

/**
 * ===========================
 * BANK HOLIDAYS
 * ===========================
 * Notes:
 * - These are the common England & Wales style dates you’ve been using.
 * - If you want Scotland-specific holidays, we can extend this list.
 */
const UK_BANK_HOLIDAYS_2025 = [
  "2025-01-01",
  "2025-04-18",
  "2025-04-21",
  "2025-05-05",
  "2025-05-26",
  "2025-08-25",
  "2025-12-25",
  "2025-12-26",
];

const UK_BANK_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-04-03", // Good Friday
  "2026-04-06", // Easter Monday
  "2026-05-04", // Early May
  "2026-05-25", // Spring
  "2026-08-31", // Summer
  "2026-12-25",
  "2026-12-28", // Boxing Day substitute day (since 26th is Saturday)
];

const UK_BANK_HOLIDAYS = new Set([...UK_BANK_HOLIDAYS_2025, ...UK_BANK_HOLIDAYS_2026]);

/**
 * ===========================
 * DATE HELPERS (Europe/London)
 * ===========================
 */
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
  // dateStr is YYYY-MM-DD
  // Construct a Date at noon UTC to avoid DST edge weirdness
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // Get weekday in London via formatting trick
  // 0=Sun..6=Sat
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  }).format(dt);

  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

/**
 * ===========================
 * CORE WRITERS
 * ===========================
 */
async function writeScheduleDoc(dateStr, payload) {
  const ref = doc(db, "nominationsSchedule", dateStr);

  if (!OVERWRITE_EXISTING) {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      console.log(`⏭️ Skipping ${dateStr} (already exists).`);
      return { skipped: true };
    }
  }

  await setDoc(ref, payload);
  return { skipped: false };
}

async function overrideTodayOnly() {
  const user = auth.currentUser;
  if (!user) {
    console.warn("🔒 Not authenticated. Log in first, then refresh.");
    return;
  }

  const todayStr = formatLondonDateKey(new Date());
  const dow = londonDayOfWeek(todayStr);

  const ref = doc(db, "nominationsSchedule", todayStr);
  await setDoc(ref, {
    userId: OVERRIDE_USER.userId,
    userEmail: OVERRIDE_USER.email,
    assignedAt: new Date().toISOString(),
    override: true,
    overrideReason: "Testing track listing / today-only override",
    note: dow === 5 ? "Override applied on Friday (New Music Friday bypassed)" : "Override applied",
  });

  console.log(`✅ TODAY OVERRIDE: ${todayStr} → ${OVERRIDE_USER.email}`);
}

async function generateRange(startDateStr, daysToAssign) {
  const user = auth.currentUser;
  if (!user) {
    console.warn("🔒 Not authenticated. Log in to generate schedule.");
    return;
  }

  console.log(`🔐 Authenticated as ${user.email}`);
  console.log("🚀 Starting schedule generation...");

  let current = new Date(startDateStr);
  let assignedDays = 0;
  let memberIndex = 0;

  while (assignedDays < daysToAssign) {
    const dateStr = formatLondonDateKey(current);
    const dow = londonDayOfWeek(dateStr);

    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = UK_BANK_HOLIDAYS.has(dateStr);

    if (!isWeekend && !isHoliday) {
      // Friday = New Music Friday
      if (dow === 5) {
        const res = await writeScheduleDoc(dateStr, {
          userEmail: NEW_MUSIC_FRIDAY.label,
          links: NEW_MUSIC_FRIDAY.links,
          assignedAt: new Date().toISOString(),
          type: "NEW_MUSIC_FRIDAY",
        });

        if (!res.skipped) console.log(`🎧 Assigned ${dateStr} → New Music Friday`);
      } else {
        // Normal weekday = rotate
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

    current.setDate(current.getDate() + 1);
  }

  console.log("🎉 Schedule generation complete.");
}

/**
 * ===========================
 * REACT COMPONENT
 * ===========================
 */
export default function GenerateSchedule() {
  const [status, setStatus] = useState("Waiting for login...");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setStatus("Not logged in — please log in first.");
        return;
      }

      try {
        if (MODE === "override_today_only") {
          setStatus("Applying today-only override...");
          await overrideTodayOnly();
          setStatus("✅ Today override written. You can now test nomination today.");
        } else if (MODE === "generate_range") {
          setStatus("Generating schedule range...");
          await generateRange(START_DATE, DAYS_TO_ASSIGN);
          setStatus("✅ Schedule generated.");
        } else {
          setStatus("No action: MODE is not recognised.");
        }
      } catch (e) {
        console.error("❌ Schedule operation failed:", e?.message || e);
        setStatus(`❌ Failed: ${e?.message || String(e)}`);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f0f8ff", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>📅 Schedule Tool</h3>
      <p style={{ margin: 0 }}>
        <strong>Mode:</strong> {MODE}
      </p>
      <p style={{ margin: "0.5rem 0 0 0" }}>{status}</p>

      <div style={{ marginTop: "0.75rem", fontSize: "0.9em", color: "#444" }}>
        <div>
          <strong>Tip:</strong> Once your test is complete, remove &lt;GenerateSchedule /&gt; from App.js again.
        </div>
        <div>
          <strong>Note:</strong> OVERWRITE_EXISTING is currently <code>{String(OVERWRITE_EXISTING)}</code>.
        </div>
      </div>
    </div>
  );
}
