import { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";

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

async function fetchAlbumInfoFromLastFM(artist, album) {
  const apiKey = "b6ad7c38684dcfba8acbb9b4bb345e86";
  const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
    artist
  )}&album=${encodeURIComponent(album)}&format=json`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const image = data?.album?.image?.find((img) => img.size === "extralarge");
    const coverUrl = image?.["#text"] || "";

    const rawTracks = data?.album?.tracks?.track;
    const arr = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];
    const tracks = arr
      .map((t) => (typeof t?.name === "string" ? t.name.trim() : ""))
      .filter(Boolean);

    return { coverUrl, tracks };
  } catch (e) {
    console.error("Last.fm album.getinfo failed:", e?.message || e);
    return { coverUrl: "", tracks: [] };
  }
}

export default function NominateAlbum() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  const [loading, setLoading] = useState(true);
  const [canNominate, setCanNominate] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");

  const todayKey = useMemo(() => formatLondonDateKey(), []);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const checkPermission = async () => {
      setLoading(true);
      setBlockedReason("");

      try {
        const ref = doc(db, "nominationsSchedule", todayKey);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setCanNominate(false);
          setBlockedReason("No schedule found for today.");
          return;
        }

        const data = snap.data();
        const isNewMusicFriday =
          data?.userEmail === "New Music Friday 🎧" || data?.type === "new_music_friday";

        if (isNewMusicFriday) {
          setCanNominate(false);
          setBlockedReason("Today is New Music Friday — nominations are paused.");
          return;
        }

        if (!currentUser) {
          setCanNominate(false);
          setBlockedReason("You are not logged in.");
          return;
        }

        const ok = currentUser.uid === data.userId;
        setCanNominate(ok);
        if (!ok) setBlockedReason("You are not today's nominator.");
      } catch (e) {
        console.error("Failed to check nominator:", e?.message || e);
        setCanNominate(false);
        setBlockedReason("Failed to verify nominator status.");
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [todayKey, currentUser]);

  const submit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();
    if (!cleanTitle || !cleanArtist) {
      alert("Please enter album title and artist.");
      return;
    }

    try {
      const { coverUrl, tracks } = await fetchAlbumInfoFromLastFM(cleanArtist, cleanTitle);

      await addDoc(collection(db, "albums"), {
        title: cleanTitle,
        artist: cleanArtist,
        coverUrl,
        tracks, // ✅ store once at nomination time
        nominatedBy: currentUser.email || "Unknown",
        nominationDate: serverTimestamp(),
      });

      setTitle("");
      setArtist("");
      alert("Album submitted!");
    } catch (e2) {
      console.error("Album submission failed:", e2?.message || e2);
      alert("Failed to submit album.");
    }
  };

  if (loading) {
    return <div className="card">Loading nomination form…</div>;
  }

  if (!canNominate) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>🎵 Nominate an Album</h3>
        <p className="smallNote" style={{ marginTop: 6 }}>
          {blockedReason || "You cannot nominate today."}
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>🎵 Nominate an Album</h3>

      <form onSubmit={submit}>
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            <div className="smallNote">Album Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label>
            <div className="smallNote">Artist</div>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} required />
          </label>

          <button className="btn" type="submit" style={{ width: "fit-content" }}>
            Submit Nomination
          </button>
        </div>
      </form>
    </div>
  );
}
