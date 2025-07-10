import { useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

// List of rotation members
const members = [
  { userId: "Z2FQNDa3UwRUVDTqWcSEDJA5kvp2", email: "mattdhodges@outlook.com" },
  { userId: "uMKdZGXTnafAQtX4QN80ShBYRhh2", email: "davews1621@gmail.com" },
  { userId: "4ssyOFngYaV6liJMn3qHwtzQzAD2", email: "jfield1968@gmail.com" },
  {
    userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1",
    email: "scottcee01@googlemail.com",
  },
];

// UK bank holidays in 2025
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

// Main generation logic
const generateSchedule = async (startDateStr, daysToAssign = 60) => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("🔒 Not authenticated. Log in to generate schedule.");
    return;
  }

  console.log(`🔐 Authenticated as ${user.email}`);
  console.log("🚀 Starting schedule generation...");

  const holidays = new Set(ukBankHolidays);
  let current = new Date(startDateStr);
  let assignedDays = 0;
  let i = 0;

  while (assignedDays < daysToAssign) {
    const dateStr = current.toISOString().split("T")[0];
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(dateStr);

    if (!isWeekend && !isHoliday) {
      const ref = doc(db, "nominationsSchedule", dateStr);

      if (dayOfWeek === 5) {
        // Friday → New Music Friday
        await setDoc(ref, {
          userEmail: "New Music Friday 🎧",
          links: [
            "https://en.wikipedia.org/wiki/List_of_2025_albums#May",
            "https://www.albumoftheyear.org/releases/this-week/",
          ],
          assignedAt: new Date().toISOString(),
        });
        console.log(`🎧 Assigned ${dateStr} → New Music Friday`);
      } else {
        // Normal weekday
        const member = members[i % members.length];
        await setDoc(ref, {
          userId: member.userId,
          userEmail: member.email,
          assignedAt: new Date().toISOString(),
        });
        console.log(`✅ Assigned ${dateStr} → ${member.email}`);
        i++;
      }

      assignedDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  console.log("🎉 Schedule generation complete.");
};


// React component to trigger generation on login
export default function GenerateSchedule() {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        generateSchedule("2025-07-01", 60); // Start date & number of assignments
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: "1rem", background: "#f0f8ff" }}>
      <h3>📅 Generating Nomination Schedule</h3>
      <p>Login required. Check the console and Firestore.</p>
    </div>
  );
}

