import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

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

async function fetchCoverUrl(artist, album) {
  const apiKey = "b6ad7c38684dcfba8acbb9b4bb345e86";
  const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
    artist
  )}&album=${encodeURIComponent(album)}&format=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const image = data?.album?.image?.find((img) => img.size === "extralarge");
    return image?.["#text"] || "";
  } catch (error) {
    console.error("Failed to fetch album art", error);
    return "";
  }
}

export default function NominateAlbum() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [isTodayNominator, setIsTodayNominator] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkNominator = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const todayStr = formatLondonDateKey(new Date());
      const ref = doc(db, "nominationsSchedule", todayStr);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setIsTodayNominator(false);
        setLoading(false);
        return;
      }

      const data = snap.data();

      // Support both userId and userID (case mismatch happens a lot)
      const scheduledUid = data.userId || data.userID || "";
      setIsTodayNominator(currentUser.uid === scheduledUid);

      setLoading(false);
    };

    // Re-check when auth state changes
    const unsub = auth.onAuthStateChanged(() => checkNominator());
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Please log in first.");
      return;
    }

    if (!title.trim() || !artist.trim()) {
      alert("Please enter album and artist");
      return;
    }

    try {
      const coverUrl = await fetchCoverUrl(artist.trim(), title.trim());

      await addDoc(collection(db, "albums"), {
        title: title.trim(),
        artist: artist.trim(),
        coverUrl,
        nominatedBy: currentUser.email,
        nominationDate: serverTimestamp(),
      });

      setTitle("");
      setArtist("");
      alert("Album submitted!");
    } catch (error) {
      console.error("Submission error:", error?.message || error);
      alert("Failed to submit album.");
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🎵 Nominate an Album</h2>
        <p className="smallNote">Loading nomination form…</p>
      </div>
    );
  }

  if (!isTodayNominator) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🎵 Nominate an Album</h2>
        <p className="smallNote" style={{ marginTop: 8 }}>
          You are not today’s nominator.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>🎵 Nominate an Album</h2>

      <form onSubmit={handleSubmit} className="formGrid">
        <div className="formRow">
          <div className="label">Album Title</div>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., OK Computer"
            required
          />
        </div>

        <div className="formRow">
          <div className="label">Artist</div>
          <input
            className="input"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="e.g., Radiohead"
            required
          />
        </div>

        <div className="formActions">
          <button type="submit" className="btn">
            Submit Nomination
          </button>
        </div>
      </form>

      <div className="smallNote" style={{ marginTop: 10 }}>
        Tip: On iPhone/iPad, the inputs use a larger font to avoid Safari zooming.
      </div>
    </div>
  );
}

