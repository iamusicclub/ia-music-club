import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

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
    const response = await fetch(url);
    const data = await response.json();

    const cover = data?.album?.image?.find((img) => img.size === "extralarge")?.["#text"] || "";

    // Track list can be array or single object depending on API payload
    const rawTracks = data?.album?.tracks?.track;
    const tracksArr = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];

    const tracks = tracksArr
      .map((t) => (typeof t?.name === "string" ? t.name.trim() : ""))
      .filter(Boolean);

    return { coverUrl: cover, tracks };
  } catch (error) {
    console.error("Failed to fetch album info from Last.fm", error);
    return { coverUrl: "", tracks: [] };
  }
}

export default function NominateAlbum() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(true);

  // schedule checks
  const [scheduleState, setScheduleState] = useState({
    canNominate: false,
    reason: "",
    isNewMusicFriday: false,
    links: [],
  });

  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        setScheduleState({
          canNominate: false,
          reason: "Please login to nominate.",
          isNewMusicFriday: false,
          links: [],
        });
        return;
      }

      const todayStr = formatLondonDateKey();
      const ref = doc(db, "nominationsSchedule", todayStr);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setLoading(false);
        setScheduleState({
          canNominate: false,
          reason: "No nominator scheduled for today (weekend/holiday).",
          isNewMusicFriday: false,
          links: [],
        });
        return;
      }

      const data = snap.data();

      if (data.userEmail === "New Music Friday 🎧") {
        setLoading(false);
        setScheduleState({
          canNominate: false,
          reason: "Today is New Music Friday 🎧 (no album nomination).",
          isNewMusicFriday: true,
          links: data.links || [],
        });
        return;
      }

      const canNominate = user.uid === data.userId;
      setLoading(false);
      setScheduleState({
        canNominate,
        reason: canNominate ? "" : "You are not today's nominator.",
        isNewMusicFriday: false,
        links: [],
      });
    };

    run();
  }, [auth.currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (!title.trim() || !artist.trim()) {
      alert("Please enter album title and artist.");
      return;
    }

    try {
      const { coverUrl, tracks } = await fetchAlbumInfoFromLastFM(artist.trim(), title.trim());

      await addDoc(collection(db, "albums"), {
        title: title.trim(),
        artist: artist.trim(),
        coverUrl,
        tracks, // ✅ store track listing so Home can display immediately
        nominatedBy: user.email,
        nominationDate: serverTimestamp(),
      });

      setTitle("");
      setArtist("");
      alert("Album submitted!");
    } catch (error) {
      console.error("Submission error:", error.message);
      alert("Failed to submit album.");
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h3>🎵 Nominate an Album</h3>
        <p>Loading nomination permissions…</p>
      </div>
    );
  }

  if (!scheduleState.canNominate) {
    return (
      <div className="card">
        <h3>🎵 Nominate an Album</h3>
        <p className="muted">{scheduleState.reason}</p>

        {scheduleState.isNewMusicFriday && scheduleState.links?.length > 0 && (
          <div className="nmf-box">
            <div className="nmf-title">New Music Friday links</div>
            {scheduleState.links.map((u) => (
              <div key={u}>
                🔗{" "}
                <a href={u} target="_blank" rel="noreferrer">
                  {u}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>🎵 Nominate an Album</h3>

      <form onSubmit={handleSubmit} className="form">
        <label className="label">
          Album Title
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. OK Computer"
            required
          />
        </label>

        <label className="label">
          Artist
          <input
            className="input"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="e.g. Radiohead"
            required
          />
        </label>

        <button className="btn btn--primary" type="submit">
          Submit Nomination
        </button>

        <div className="hint">
          Artwork + track list are pulled automatically from Last.fm.
        </div>
      </form>
    </div>
  );
}
