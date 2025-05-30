import { useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const members = [
  { userId: "Z2FQNDa3UwRUVDTqWcSEDJA5kvp2", email: "mattdhodges@outlook.com" },
  { userId: "uMKdZGXTnafAQtX4QN80ShBYRhh2", email: "davews1621@gmail.com" },
  { userId: "4ssyOFngYaV6liJMn3qHwtzQzAD2", email: "jfield1968@gmail.com" },
  {
    userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1",
    email: "scottcee01@googlemail.com",
  },
];

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

const generateSchedule = async (startDateStr, daysToAssign = 30) => {
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
    const isWeekend = [0, 6].includes(current.getDay());
    const isHoliday = holidays.has(dateStr);

    if (!isWeekend && !isHoliday) {
      const member = members[i % members.length];
      const ref = doc(db, "nominationsSchedule", dateStr);
      await setDoc(ref, {
        userId: member.userId,
        userEmail: member.email,
        assignedAt: new Date().toISOString(),
      });
      console.log(`✅ Assigned ${dateStr} → ${member.email}`);
      assignedDays++;
      i++;
    }

    current.setDate(current.getDate() + 1);
  }

  console.log("🎉 Schedule generation complete.");
};

export default function GenerateSchedule() {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        generateSchedule("2025-06-03", 30); // start from new date
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
