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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  // Live load of recommendations
  useEffect(() => {
    // Order newest first
    const qRef = query(
      collection(db, "newMusicRecommends"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
      },
      (err) => {
        console.error("❌ Failed to load recommendations:", err);
        setError(err?.message || String(err));
      }
    );

    return () => unsub();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to add a recommendation.");
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setError("Please type a recommendation first.");
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "newMusicRecommends"), {
        text: trimmed,
        createdAt: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
      });

      setText("");
    } catch (err) {
      console.error("❌ Add recommendation failed:", err);
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>📝 New Music Recommends</h2>
      <p className="smallNote" style={{ marginTop: 6 }}>
        Leave a quick note about an album you recommend. No ratings here — just a
        shared scrapbook.
      </p>

      <form onSubmit={handleAdd} style={{ marginTop: 12 }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
          Recommendation
        </label>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="e.g. New album: Floating Points — Cascade. Stunning production, great late-night listen."
          style={{ width: "100%", resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add recommendation"}
          </button>

          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              setText("");
              setError("");
            }}
            disabled={saving}
          >
            Clear
          </button>
        </div>
      </form>

      {error ? (
        <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 10px 0" }}>Recent recommendations</h3>

        {items.length === 0 ? (
          <p className="smallNote" style={{ margin: 0 }}>
            No recommendations yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((it) => (
              <div
                key={it.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{it.text}</div>

                <div className="smallNote" style={{ margin: 0 }}>
                  {it.userEmail || "Unknown"}{" "}
                  {it.createdAt?.toDate?.()
                    ? `· ${it.createdAt.toDate().toLocaleString()}`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
