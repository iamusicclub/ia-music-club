
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

const START_DATE = "2026-10-20";
const DAYS_TO_ASSIGN = 260;

const MEMBERS = [
  {
    userId: "Z2FQNDa3UwRUVDTqWcSEDJA5kvp2",
    email: "mattdhodges@outlook.com",
  },
  {
    userId: "uMKdZGXTnafAQtX4QN80ShBYRhh2",
    email: "davews1621@gmail.com",
  },
  {
    userId: "4ssyOFngYaV6liJMn3qHwtzQzAD2",
    email: "jfield1968@gmail.com",
  },
  {
    userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1",
    email: "scottcee01@googlemail.com",
  },
];

const UK_BANK_HOLIDAYS = new Set([
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

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function isNewMusicFriday(entry) {
  return (
    entry?.type === "NEW_MUSIC_FRIDAY" ||
    entry?.userEmail === "New Music Friday 🎧"
  );
}

function getMemberIndex(entry) {
  if (!entry || isNewMusicFriday(entry)) return -1;

  return MEMBERS.findIndex(
    (member) =>
      member.userId === entry.userId ||
      member.email.toLowerCase() ===
        String(entry.userEmail || "").toLowerCase()
  );
}

async function generateSchedule(onProgress) {
  const snapshot = await getDocs(
    collection(db, "nominationsSchedule")
  );

  const existing = new Map();

  snapshot.forEach((item) => {
    existing.set(item.id, item.data());
  });

  const previousMembers = [...existing.entries()]
    .filter(([date, entry]) => {
      return date < START_DATE && getMemberIndex(entry) !== -1;
    })
    .sort((a, b) => b[0].localeCompare(a[0]));

  let memberIndex = 0;

  if (previousMembers.length > 0) {
    const lastMemberIndex = getMemberIndex(
      previousMembers[0][1]
    );

    memberIndex =
      (lastMemberIndex + 1) % MEMBERS.length;
  }

  let current = new Date(`${START_DATE}T12:00:00Z`);
  let processedDays = 0;
  let created = 0;
  let skipped = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  while (processedDays < DAYS_TO_ASSIGN) {
    const key = dateKey(current);
    const day = current.getUTCDay();

    const weekend = day === 0 || day === 6;
    const holiday = UK_BANK_HOLIDAYS.has(key);

    if (!weekend && !holiday) {
      processedDays++;

      if (existing.has(key)) {
        skipped++;

        // Existing member nominations must also
        // advance the rotation.
        const existingIndex = getMemberIndex(
          existing.get(key)
        );

        if (existingIndex !== -1) {
          memberIndex =
            (existingIndex + 1) % MEMBERS.length;
        }
      } else {
        let payload;

        if (day === 5) {
          const year = current.getUTCFullYear();

          payload = {
            userEmail: "New Music Friday 🎧",
            links: [
              `https://en.wikipedia.org/wiki/List_of_${year}_albums`,
              "https://www.albumoftheyear.org/releases/this-week/",
            ],
            type: "NEW_MUSIC_FRIDAY",
            assignedAt: new Date().toISOString(),
          };
        } else {
          const member = MEMBERS[memberIndex];

          payload = {
            userId: member.userId,
            userEmail: member.email,
            type: "USER",
            assignedAt: new Date().toISOString(),
          };

          memberIndex =
            (memberIndex + 1) % MEMBERS.length;
        }

        batch.set(
          doc(db, "nominationsSchedule", key),
          payload
        );

        created++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  onProgress({
    created,
    skipped,
    lastDate: dateKey(
      new Date(current.getTime() - 86400000)
    ),
  });
}

export default function GenerateSchedule() {
  const [status, setStatus] = useState(
    "Ready to extend nomination schedule."
  );

  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);

  const runGenerator = async () => {
    if (!auth.currentUser || running || complete) return;

    const confirmed = window.confirm(
      "Extend the IA Music Club nomination schedule? Existing dates will be preserved."
    );

    if (!confirmed) return;

    setRunning(true);
    setStatus("Generating schedule...");

    try {
      await generateSchedule((result) => {
        setStatus(
          `✅ Complete. Created ${result.created} new entries. ` +
          `Preserved ${result.skipped} existing entries. ` +
          `Schedule processed through ${result.lastDate}.`
        );
      });

      setComplete(true);
    } catch (error) {
      console.error(error);
      setStatus(
        `❌ Failed: ${error?.message || String(error)}`
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="card"
      style={{ marginTop: 14 }}
    >
      <h3 style={{ marginTop: 0 }}>
        📅 Schedule Generator
      </h3>

      <p className="smallNote">
        Start date: {START_DATE}
      </p>

      <p className="smallNote">
        Generates {DAYS_TO_ASSIGN} eligible weekdays,
        preserving existing nominations.
      </p>

      <button
        className="btn"
        onClick={runGenerator}
        disabled={running || complete}
      >
        {running
          ? "Generating..."
          : complete
          ? "Schedule generated"
          : "Extend nomination schedule"}
      </button>

      <p style={{ marginTop: 12 }}>
        {status}
      </p>
    </div>
  );
}
