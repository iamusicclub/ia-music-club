import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

export default function NewMusicRecommends() {
  const user = auth.currentUser;

  const [text, setText] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    const qRecs = query(collection(db, "recommendations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qRecs, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const clean = text.trim();
    if (!clean) return;

    await addDoc(collection(db, "recommendations"), {
      text: clean,
      userEmail: user.email || "Unknown",
      createdAt: serverTimestamp(),
    });

    setText("");
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>🗒️ New Music Recommends</h2>
      <p className="smallNote" style={{ marginTop: 6 }}>
        Use this like a scrapbook: add a one-liner recommendation. No ratings required.
      </p>

      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <div className="smallNote">Recommendation</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Artist – Album: quick note on why it’s worth a listen…"
        />
        <button className="btn" type="submit" style={{ marginTop: 10 }}>
          Add Recommendation
        </button>
      </form>

      <h3 className="sectionTitle">Recent entries</h3>
      {items.length === 0 ? (
        <p className="smallNote">No recommendations yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((r) => {
            const date =
              r.createdAt?.toDate?.() ? r.createdAt.toDate().toLocaleString() : "";
            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 14 }}>{r.text}</div>
                <div className="smallNote" style={{ marginTop: 6 }}>
                  {r.userEmail || "Unknown"} {date ? `· ${date}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
