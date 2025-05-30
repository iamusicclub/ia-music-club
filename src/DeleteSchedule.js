// DeleteSchedule.js
import { useEffect } from "react";
import { collection, deleteDoc, getDocs, doc } from "firebase/firestore";
import { db } from "./firebase";

export default function DeleteSchedule() {
  useEffect(() => {
    const deleteAllDocs = async () => {
      const snap = await getDocs(collection(db, "nominationsSchedule"));
      const batchSize = snap.size;

      if (batchSize === 0) {
        console.log("✅ No documents to delete.");
        return;
      }

      const deletions = snap.docs.map((d) =>
        deleteDoc(doc(db, "nominationsSchedule", d.id))
      );
      await Promise.all(deletions);

      console.log(`🧹 Deleted ${batchSize} nomination schedule documents.`);
    };

    deleteAllDocs();
  }, []);

  return (
    <div
      style={{
        padding: 10,
        background: "#ffeeee",
        border: "1px solid #dd8888",
      }}
    >
      <strong>⚠️ Deleting nomination schedule…</strong>
      <p>Check console for progress.</p>
    </div>
  );
}
