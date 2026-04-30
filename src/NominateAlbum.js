import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findDuplicateAlbum(inputTitle, inputArtist) {
  const normalizedInputTitle = normalizeText(inputTitle);
  const normalizedInputArtist = normalizeText(inputArtist);

  const snapshot = await getDocs(collection(db, "albums"));

  let duplicate = null;

  snapshot.forEach((docSnap) => {
    if (duplicate) return;

    const data = docSnap.data();

    const existingTitle = data.title || data.album || "";
    const existingArtist = data.artist || "";

    const normalizedExistingTitle = normalizeText(existingTitle);
    const normalizedExistingArtist = normalizeText(existingArtist);

    if (
      normalizedInputTitle === normalizedExistingTitle &&
      normalizedInputArtist === normalizedExistingArtist
    ) {
      duplicate = {
        id: docSnap.id,
        title: existingTitle,
        artist: existingArtist,
        source: data.source || "website",
      };
    }
  });

  return duplicate;
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
  const [isTodayNominator, setIsTodayNominator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkNominator = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsTodayNominator(false);
        setLoading(false);
        return;
      }

      const todayStr = formatLondonDateKey(new Date());
      const ref = doc(db, "nominationsSchedule", todayStr);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setIsTodayNominator(false);
        setLoading(false);
        return;
      }

      const data = snap.data();
      const scheduledUid = data.userId || data.userID || "";

      setIsTodayNominator(currentUser.uid === scheduledUid);
      setLoading(false);
    };

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

    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();

    if (!cleanTitle || !cleanArtist) {
      alert("Please enter album and artist.");
      return;
    }

    setSubmitting(true);

    try {
      const duplicate = await findDuplicateAlbum(cleanTitle, cleanArtist);

      if (duplicate) {
        const sourceText =
          duplicate.source === "1001_albums"
            ? "the 1001 Albums archive"
            : "the website nominations";

        alert(
          `This album already exists in ${sourceText}:\n\n${duplicate.title} — ${duplicate.artist}`
        );

        setSubmitting(false);
        return;
      }

      const coverUrl = await fetchCoverUrl(cleanArtist, cleanTitle);

      await addDoc(collection(db, "albums"), {
        title: cleanTitle,
        artist: cleanArtist,
        normalizedTitle: normalizeText(cleanTitle),
        normalizedArtist: normalizeText(cleanArtist),
        coverUrl,
        nominatedBy: currentUser.email,
        nominatedByUid: currentUser.uid,
        nominationDate: serverTimestamp(),
        source: "website",
      });

      setTitle("");
      setArtist("");
      alert("Album submitted!");
    } catch (error) {
      console.error("Submission error:", error?.message || error);
      alert("Failed to submit album.");
    } finally {
      setSubmitting(false);
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
            disabled={submitting}
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
            disabled={submitting}
          />
        </div>

        <div className="formActions">
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Checking archive…" : "Submit Nomination"}
          </button>
        </div>
      </form>

      <div className="smallNote" style={{ marginTop: 10 }}>
        Tip: The app now checks existing website nominations and the 1001 Albums
        archive before submitting.
      </div>
    </div>
  );
}
