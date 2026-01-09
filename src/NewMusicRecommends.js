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
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    const qRecs = query(collection(db, "recommendations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qRecs, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(data);
    });

    return () => unsub();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return alert("Please login first.");
    if (!text.trim()) return;

    try {
      await addDoc(collection(db, "recommendations"), {
        text: text.trim(),
        userEmail: user.email || "Unknown",
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e2) {
      console.error(e2);
      alert("Failed to save recommendation (check Firestore rules).");
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>📝 New Music Recommends</h3>
      <p className="muted">
        A simple scrapbook: share a quick line about something new you recommend.
        No ratings, no artwork, no track pulls.
      </p>

      <form onSubmit={submit} className="form" style={{ gridTemplateColumns: "1fr auto" }}>
        <label className="label" style={{ gridColumn: "1 / span 1" }}>
          Recommendation
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. ‘Maruja – Connla’s Well… absolutely wild post-punk.’"
          />
        </label>

        <div style={{ alignSelf: "end" }}>
          <button className="btn btn--primary" type="submit">
            Add
          </button>
        </div>
      </form>

      <div style={{ marginTop: 14 }}>
        {items.length === 0 ? (
          <p>No recommendations yet.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="rec">
              <div className="rec__text">{it.text}</div>
              <div className="rec__meta muted">— {it.userEmail}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
