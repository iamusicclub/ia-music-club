import { useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Rotation members
const members = [
 { userId: "Z2FQNDa3UwRUVDTqWcSEDJA5kvp2", email: "mattdhodges@outlook.com" },
 { userId: "uMKdZGXTnafAQtX4QN80ShBYRhh2", email: "davews1621@gmail.com" },
 { userId: "4ssyOFngYaV6liJMn3qHwtzQzAD2", email: "jfield1968@gmail.com" },
 { userId: "UJyzC0IXFAbt4RLsfwbFB6u35kz1", email: "scottcee01@googlemail.com" },
];

// UK Bank Holidays in 2025
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

// Fisher–Yates shuffle
function shuffleArray(array) {
 const arr = [...array];
 for (let i = arr.length - 1; i > 0; i--) {
   const j = Math.floor(Math.random() * (i + 1));
   [arr[i], arr[j]] = [arr[j], arr[i]];
 }
 return arr;
}

const generateSchedule = async (startDateStr, daysToAssign = 60) => {
 const user = auth.currentUser;
 if (!user) {
   console.warn("🔒 Not authenticated. Log in to generate schedule.");
   return;
 }

 console.log(`🔐 Authenticated as ${user.email}`);
 console.log("🚀 Generating schedule from", startDateStr);

 const holidays = new Set(ukBankHolidays);
 const shuffledMembers = shuffleArray(members);
 let current = new Date(startDateStr);
 let assignedDays = 0;
 let memberIndex = 0;

 while (assignedDays < daysToAssign) {
   const dateStr = current.toISOString().split("T")[0];
   const day = current.getDay(); // 0 = Sunday, 5 = Friday
   const isWeekend = day === 0 || day === 6;
   const isHoliday = holidays.has(dateStr);

   if (!isWeekend && !isHoliday) {
     const ref = doc(db, "nominationsSchedule", dateStr);
     const existing = await getDoc(ref);

     if (!existing.exists()) {
       if (day === 5) {
         // Friday → New Music Friday
         await setDoc(ref, {
           userEmail: "New Music Friday 🎧",
           links: [
             "https://nam10.safelinks.protection.outlook.com/?url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FList_of_2025_albums%23May&data=05%7C02%7Cscott.coulter%40qbe.com%7C728ac4026e674dcf82a008ddfaa4a510%7Cce56fae6055d4c9fb6c99d341506a491%7C1%7C0%7C638942307236010800%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=67fQtUcgDTcLusd3orychM7v3kAj3StTFkix1KZjVQc%3D&reserved=0",
             "https://nam10.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.albumoftheyear.org%2Freleases%2Fthis-week%2F&data=05%7C02%7Cscott.coulter%40qbe.com%7C728ac4026e674dcf82a008ddfaa4a510%7Cce56fae6055d4c9fb6c99d341506a491%7C1%7C0%7C638942307236033719%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=vLW%2B2tcTZAt91KoxRKzd9xd6gh0ZstE38BIPIOXoMaA%3D&reserved=0",
           ],
           assignedAt: new Date().toISOString(),
         });
         console.log(`🎧 ${dateStr} → New Music Friday`);
       } else {
         const member = shuffledMembers[memberIndex % shuffledMembers.length];
         await setDoc(ref, {
           userId: member.userId,
           userEmail: member.email,
           assignedAt: new Date().toISOString(),
         });
         console.log(`✅ ${dateStr} → ${member.email}`);
         memberIndex++;
       }

       assignedDays++;
     } else {
       console.log(`⏭️ Skipped existing date: ${dateStr}`);
     }
   }

   current.setDate(current.getDate() + 1);
 }

 console.log("🎉 Schedule generation complete.");
};

export default function GenerateSchedule() {
 useEffect(() => {
   const unsubscribe = auth.onAuthStateChanged((user) => {
     if (user) {
       generateSchedule("2025-09-24", 60); // ✅ Change to desired start date
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



