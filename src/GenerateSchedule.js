import { useMemo, useState } from "react";
import { auth, db } from "./firebase";
import { doc, writeBatch } from "firebase/firestore";

// Rotation members
const members = [
  { userId: "Z2FQNDa3UwRUVDTqWcSEDJA5kvp2", email: "mattdhodges@outlook.com" },
  { userId: "uMKdZGXTnafAQtX4QN80ShBYRhh2", email: "davews1621@gmail.com" },
  { userId: "4ssyOFngYaV6liJMn3qHwtzQzAD2", email: "jfield1968@gmail.com" },
  { userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1", email: "scottcee01@googlemail.com" },
];

// UK bank holidays (extend as needed)
const ukBankHolidays = [
  "2025-01-01",
  "2025-04-18",
  "2025-04-21",
  "2025-05-05",
  "2025-05-26",
  "2025-08-25",
  "2025-12-25",
  "2025-12-26",
];

// New Music Friday links
const nmfLinks = [
  "https://en.wikipedia.org/wiki/List_of_2025_albums#May",
  "https://www.albumoftheyear.org/releases/this-week/",
];

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

function parseYYYYMMDD(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // noon UTC safe
}

function toYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysUTC(date, n) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function seededRandom(seed) {
  // simple deterministic PRNG
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return function () {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

function hashStringToInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function shuffleWithSeed(arr, seedStr) {
  const rand = seededRandom(hashStringToInt(seedStr));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate schedule for N eligible days (Mon–Thu members, Fri NMF, skip weekends + bank holidays)
async function generateScheduleWindow({ startDateStr, eligibleDays = 180 }) {
  const user = auth.currentUser;
  if (!user) {
    console.warn("🔒 Not authenticated. Log in to generate schedule.");
    return { ok: false, message: "Not authenticated" };
  }

  const holidays = new Set(ukBankHolidays);
  const start = parseYYYYMMDD(startDateStr);

  // We will build docs in chronological order
  const docsToWrite = [];

  // To break the “same weekday” pattern, we assign week-by-week:
  // - For each week, we collect Mon–Thu eligible dates
  // - Shuffle the members deterministically per week
  // - Assign in that shuffled order to Mon–Thu
  let cursor = new Date(start.getTime());
  let assignedEligible = 0;

  while (assignedEligible < eligibleDays) {
    // Find Monday of current week (UTC)
    const day = cursor.getUTCDay(); // 0..6 (Sun..Sat)
    const deltaToMonday = (day + 6) % 7; // Mon => 0, Tue =>1 ... Sun=>6
    const monday = addDaysUTC(cursor, -deltaToMonday);

    // Collect dates Mon..Fri for that week
    const weekDates = [];
    for (let i = 0; i < 7; i++) weekDates.push(addDaysUTC(monday, i));

    // Determine eligible Mon-Thu (skip holidays)
    const monThu = weekDates
      .filter((d) => {
        const dow = d.getUTCDay();
        if (dow === 0 || dow === 6) return false; // weekend
        if (dow === 5) return false; // Friday handled separately
        const key = toYYYYMMDD(d);
        return !holidays.has(key);
      })
      .map((d) => toYYYYMMDD(d));

    // Friday (if not holiday) becomes NMF
    const friday = weekDates.find((d) => d.getUTCDay() === 5);
    if (friday) {
      const friKey = toYYYYMMDD(friday);
      if (!holidays.has(friKey)) {
        docsToWrite.push({
          date: friKey,
          data: {
            userEmail: "New Music Friday 🎧",
            links: nmfLinks,
            assignedAt: new Date().toISOString(),
          },
        });
      }
    }

    // Assign members to Mon-Thu
    if (monThu.length > 0) {
      const seed = `week-${toYYYYMMDD(monday)}-ia-music-club`;
      const shuffled = shuffleWithSeed(members, seed);

      for (let i = 0; i < monThu.length; i++) {
        if (assignedEligible >= eligibleDays) break;
        const member = shuffled[i % shuffled.length];
        const date = monThu[i];

        docsToWrite.push({
          date,
          data: {
            userId: member.userId,
            userEmail: member.email,
            assignedAt: new Date().toISOString(),
          },
        });

        assignedEligible++;
      }
    }

    // move cursor to next week
    cursor = addDaysUTC(monday, 7);
  }

  // Firestore batch writes (max 500 writes per batch)
  const batch = writeBatch(db);
  for (const item of docsToWrite) {
    const ref = doc(db, "nominationsSchedule", item.date);
    batch.set(ref, item.data, { merge: false }); // overwrite that date
  }

  await batch.commit();
  console.log(`✅ Schedule window generated from ${startDateStr} for ~${eligibleDays} eligible days.`);
  return { ok: true, message: "Schedule generated", count: docsToWrite.length };
}

export default function GenerateSchedule() {
  const todayStr = useMemo(() => formatLondonDateKey(), []);
  const [startDate, setStartDate] = useState(todayStr);
  const [days, setDays] = useState(180);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  const run = async () => {
    setRunning(true);
    setStatus("Generating…");
    try {
      const res = await generateScheduleWindow({
        startDateStr: startDate,
        eligibleDays: Number(days) || 180,
      });
      setStatus(res.ok ? `✅ Done. Wrote ${res.count} docs.` : `❌ ${res.message}`);
    } catch (e) {
      console.error(e);
      setStatus(`❌ Failed: ${e?.message || e}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>🛠 Admin: Generate / Refresh Schedule</h3>
      <p className="muted">
        This overwrites schedule docs for the generated date window (no more “append to 2029”).
        Fridays become <strong>New Music Friday</strong>.
      </p>

      <div className="form" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
        <label className="label">
          Start date (Europe/London)
          <input
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        </label>

        <label className="label">
          Eligible days (Mon–Thu only)
          <input
            className="input"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            min={30}
            max={300}
          />
        </label>

        <div style={{ alignSelf: "end" }}>
          <button className="btn btn--primary" onClick={run} disabled={running}>
            {running ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {status && <div style={{ marginTop: 10 }}>{status}</div>}

      <div className="hint" style={{ marginTop: 10 }}>
        If you want to “refresh from today”, keep the start date as today and click Generate.
      </div>
    </div>
  );
}

