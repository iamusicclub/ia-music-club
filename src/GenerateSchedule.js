import { useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// ✅ Replace with real userId/email values
const members = [
  { userId: "user_id_1", email: "user1@email.com" },
  { userId: "user_id_2", email: "user2@email.com" },
  { userId: "user_id_3", email: "user3@email.com" },
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
      });
      console.log(`Assigned ${dateStr} to ${member.email}`);
      assignedDays++;
      i++;
    }

    current.setDate(current.getDate() + 1);
  }

  console.log("✅ Schedule complete");
};

export default function GenerateSchedule() {
  useEffect(() => {
    generateSchedule("2025-06-02", 30); // 30 weekdays from June 2
  }, []);

  return (
    <div style={{ padding: "1rem", background: "#f8f8f8" }}>
      <h3>Generating Nomination Schedule...</h3>
      <p>Check console and Firestore to verify output</p>
    </div>
  );
}
