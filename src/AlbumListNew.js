import { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

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

function dateKeyFromTimestamp(ts) {
  if (!ts?.toDate) return "";
  return formatLondonDateKey(ts.toDate());
}

async function fetchTracksFromLastFM(artist, album) {
  const apiKey = "b6ad7c38684dcfba8acbb9b4bb345e86";
  const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
    artist
  )}&album=${encodeURIComponent(album)}&format=json`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const rawTracks = data?.album?.tracks?.track;
    const arr = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];
    return arr
      .map((t) => (typeof t?.name === "string" ? t.name.trim() : ""))
      .filter(Boolean);
  } catch (e) {
    console.error("Failed to fetch tracks from Last.fm:", e?.message || e);
    return [];
  }
}

export default function AlbumListNew() {
  const user = auth.currentUser;

  const [albums, setAlbums] = useState([]);
  const [nominators, setNominators] = useState([]);
  const [selectedNominator, setSelectedNominator] = useState("All");

  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [allRatings, setAllRatings] = useState([]);

  const [minRating, setMinRating] = useState(0);
  const [sortOrder, setSortOrder] = useState("newest"); // newest | rating
  const [expanded, setExpanded] = useState({}); // albumId -> boolean

  // Drafts keyed by albumId
  const [draftScore, setDraftScore] = useState({});
  const [draftComment, setDraftComment] = useState({});
  const [draftStars, setDraftStars] = useState({}); // albumId -> Set-like array
  const [feedback, setFeedback] = useState({});

  const todayKey = useMemo(() => formatLondonDateKey(), []);

  // Load albums live (newest first)
  useEffect(() => {
    const qAlbums = query(collection(db, "albums"), orderBy("nominationDate", "desc"));
    const unsub = onSnapshot(qAlbums, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const uniqueNominators = Array.from(new Set(data.map((a) => a.nominatedBy))).filter(Boolean);
      setNominators(uniqueNominators);
      setAlbums(data);
    });

    return () => unsub();
  }, []);

  // Load ratings live
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const all = [];
      const byAlbum = {};

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        all.push({ id: docSnap.id, ...data });

        const albumId = data.albumId;
        const score = Number(data.score);
        if (!albumId || Number.isNaN(score)) return;

        if (!byAlbum[albumId]) byAlbum[albumId] = [];
        byAlbum[albumId].push(score);
      });

      const avgMap = {};
      Object.keys(byAlbum).forEach((albumId) => {
        const scores = byAlbum[albumId];
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        avgMap[albumId] = avg.toFixed(1);
      });

      setAllRatings(all);
      setRatingsByAlbum(avgMap);

      // Preload my drafts from my existing rating docs
      if (user?.uid) {
        const mine = all.filter((r) => r.userId === user.uid);
        const scoreDraft = {};
        const commentDraft = {};
        const starsDraft = {};

        for (const r of mine) {
          if (!r.albumId) continue;
          scoreDraft[r.albumId] = r.score ?? "";
          commentDraft[r.albumId] = r.comment ?? "";
          starsDraft[r.albumId] = Array.isArray(r.starredTracks) ? r.starredTracks : [];
        }

        setDraftScore((prev) => ({ ...prev, ...scoreDraft }));
        setDraftComment((prev) => ({ ...prev, ...commentDraft }));
        setDraftStars((prev) => ({ ...prev, ...starsDraft }));
      }
    });

    return () => unsub();
  }, [user?.uid]);

  // Identify today's album (most recent album whose nominationDate matches todayKey)
  const todaysAlbum = useMemo(() => {
    for (const a of albums) {
      const k = dateKeyFromTimestamp(a.nominationDate);
      if (k === todayKey) return a;
    }
    return null;
  }, [albums, todayKey]);

  // Ensure track list exists for today’s album (fetch + cache to Firestore once)
  useEffect(() => {
    const ensureTracks = async () => {
      if (!todaysAlbum?.id) return;

      const hasTracks = Array.isArray(todaysAlbum.tracks) && todaysAlbum.tracks.length > 0;
      if (hasTracks) return;

      const artist = String(todaysAlbum.artist || "").trim();
      const title = String(todaysAlbum.title || "").trim();
      if (!artist || !title) return;

      const tracks = await fetchTracksFromLastFM(artist, title);
      if (tracks.length === 0) return;

      try {
        await updateDoc(doc(db, "albums", todaysAlbum.id), { tracks });
      } catch (e) {
        console.error("Failed to cache tracks to Firestore:", e?.message || e);
      }
    };

    ensureTracks();
  }, [todaysAlbum?.id, todaysAlbum?.artist, todaysAlbum?.title, todaysAlbum?.tracks]);

  const toggleExpand = (albumId) => {
    setExpanded((prev) => ({ ...prev, [albumId]: !prev[albumId] }));
  };

  const toggleStar = (albumId, trackName) => {
    setDraftStars((prev) => {
      const current = Array.isArray(prev[albumId]) ? prev[albumId] : [];
      const set = new Set(current);
      if (set.has(trackName)) set.delete(trackName);
      else set.add(trackName);
      return { ...prev, [albumId]: Array.from(set) };
    });
  };

  const saveRating = async (albumId) => {
    if (!user) {
      alert("Please log in.");
      return;
    }

    const score = Number(draftScore[albumId]);
    const comment = String(draftComment[albumId] || "");
    const starredTracks = Array.isArray(draftStars[albumId]) ? draftStars[albumId] : [];

    if (!score || Number.isNaN(score) || score < 1 || score > 10) {
      alert("Please select a rating between 1 and 10.");
      return;
    }

    try {
      const ratingId = `${user.uid}_${albumId}`;
      const ref = doc(db, "ratings", ratingId);

      await setDoc(ref, {
        albumId,
        userId: user.uid,
        userEmail: user.email || "Unknown",
        score,
        comment,
        starredTracks,
        timestamp: serverTimestamp(),
      });

      setFeedback((prev) => ({ ...prev, [albumId]: "Saved ✓" }));
      setTimeout(() => setFeedback((prev) => ({ ...prev, [albumId]: "" })), 2000);
    } catch (e) {
      console.error("Failed to save rating:", e?.message || e);
      alert("Failed to save rating.");
    }
  };

  // Apply filters & sorting to “historic list”
  const filteredAndSorted = useMemo(() => {
    const base = albums
      .filter((a) => (todaysAlbum?.id ? a.id !== todaysAlbum.id : true))
      .filter((a) => {
        const avg = ratingsByAlbum[a.id];
        return avg === undefined || Number(avg) >= minRating;
      })
      .filter((a) => (selectedNominator === "All" ? true : a.nominatedBy === selectedNominator));

    base.sort((a, b) => {
      if (sortOrder === "rating") {
        const avgA = parseFloat(ratingsByAlbum[a.id] || 0);
        const avgB = parseFloat(ratingsByAlbum[b.id] || 0);
        if (avgB !== avgA) return avgB - avgA;

        const dateA = a.nominationDate?.toDate?.() || new Date(0);
        const dateB = b.nominationDate?.toDate?.() || new Date(0);
        return dateB - dateA;
      }

      const dateA = a.nominationDate?.toDate?.() || new Date(0);
      const dateB = b.nominationDate?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    return base;
  }, [albums, todaysAlbum?.id, ratingsByAlbum, minRating, selectedNominator, sortOrder]);

  const renderTracks = (album) => {
    const tracks = Array.isArray(album.tracks) ? album.tracks : [];
    if (tracks.length === 0) {
      return <p className="smallNote">No track listing available yet.</p>;
    }

    const starred = new Set(Array.isArray(draftStars[album.id]) ? draftStars[album.id] : []);

    return (
      <div style={{ marginTop: 10 }}>
        <div className="smallNote">Tracks (star your favourites):</div>
        <ol className="trackList">
          {tracks.map((t) => (
            <li key={t}>
              <div className="trackRow">
                <button
                  type="button"
                  className={`starBtn ${starred.has(t) ? "on" : ""}`}
                  onClick={() => toggleStar(album.id, t)}
                  title="Star track"
                >
                  {starred.has(t) ? "★" : "☆"}
                </button>
                <span>{t}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  };

  const renderRatingEditor = (album) => {
    return (
      <div className="ratingsBox">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label className="smallNote">
            Your rating (1–10):{" "}
            <select
              value={draftScore[album.id] ?? ""}
              onChange={(e) => setDraftScore((p) => ({ ...p, [album.id]: e.target.value }))}
            >
              <option value="">--</option>
              {Array.from({ length: 10 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>

          <button className="btn" type="button" onClick={() => saveRating(album.id)}>
            Save
          </button>

          {feedback[album.id] ? <span className="smallNote">{feedback[album.id]}</span> : null}
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallNote">Your notes:</div>
          <textarea
            value={draftComment[album.id] ?? ""}
            onChange={(e) => setDraftComment((p) => ({ ...p, [album.id]: e.target.value }))}
            placeholder="Write your thoughts here…"
          />
        </div>
      </div>
    );
  };

  const renderAllRatings = (albumId) => {
    const rows = allRatings
      .filter((r) => r.albumId === albumId)
      .sort((a, b) => {
        const ta = a.timestamp?.seconds || 0;
        const tb = b.timestamp?.seconds || 0;
        return tb - ta;
      });

    if (rows.length === 0) return <p className="smallNote">No ratings yet.</p>;

    return (
      <div style={{ marginTop: 10 }}>
        <div className="smallNote">Ratings & notes:</div>
        {rows.map((r) => (
          <div key={r.id} className="ratingLine">
            <strong>{r.username || r.userEmail || "Unknown"}</strong>: {r.score}/10{" "}
            {r.comment ? (
              <>
                <br />
                <em>“{r.comment}”</em>
              </>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 14 }}>
      {/* TODAY HERO */}
      <div className="card">
        <h2 style={{ margin: 0 }}>Today’s Album</h2>

        {!todaysAlbum ? (
          <p className="smallNote" style={{ marginTop: 8 }}>
            No album has been nominated today yet.
          </p>
        ) : (
          <div className="hero" style={{ marginTop: 14 }}>
            <img
              className="coverLarge"
              src={todaysAlbum.coverUrl || ""}
              alt={`${todaysAlbum.title || "Album"} cover`}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            <div>
              <h3 className="bigTitle">{todaysAlbum.title}</h3>
              <div className="bigArtist">by {todaysAlbum.artist}</div>
              <div className="metaLine">
                Nominated by: <strong>{todaysAlbum.nominatedBy || "Unknown"}</strong>
              </div>

              <div className="kpis">
                <div className="kpi">
                  <strong>Average rating</strong>
                  {ratingsByAlbum[todaysAlbum.id] ? `${ratingsByAlbum[todaysAlbum.id]} / 10` : "—"}
                </div>
                <div className="kpi">
                  <strong>Total ratings</strong>
                  {allRatings.filter((r) => r.albumId === todaysAlbum.id).length}
                </div>
              </div>

              {renderTracks(todaysAlbum)}
              {renderRatingEditor(todaysAlbum)}
              {renderAllRatings(todaysAlbum.id)}
            </div>
          </div>
        )}
      </div>

      {/* CONTROLS */}
      <h3 className="sectionTitle">Historic Nominations</h3>

      <div className="controlsRow">
        <label>
          Min Avg Rating{" "}
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            {[0, 5, 6, 7, 8, 9].map((r) => (
              <option key={r} value={r}>
                {r}+
              </option>
            ))}
          </select>
        </label>

        <label>
          Nominator{" "}
          <select value={selectedNominator} onChange={(e) => setSelectedNominator(e.target.value)}>
            <option value="All">All</option>
            {nominators.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort{" "}
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="rating">Highest Rated</option>
          </select>
        </label>
      </div>

      {/* COLLAPSED LIST */}
      {filteredAndSorted.length === 0 ? (
        <div className="card">
          <p className="smallNote">No albums match your current filter.</p>
        </div>
      ) : (
        filteredAndSorted.map((album) => {
          const isOpen = !!expanded[album.id];
          const avg = ratingsByAlbum[album.id];

          return (
            <div key={album.id} className="listItem">
              <img
                className="coverThumb"
                src={album.coverUrl || ""}
                alt={`${album.title || "Album"} cover`}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              <div className="listMain">
                <h3>
                  {album.title}{" "}
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                    — {album.artist}
                  </span>
                </h3>
                <p>
                  Nominated by <strong>{album.nominatedBy || "Unknown"}</strong>
                  {" · "}
                  Avg: <strong>{avg ? `${avg}/10` : "—"}</strong>
                </p>

                {isOpen ? (
                  <div className="expandedPanel">
                    {Array.isArray(album.tracks) && album.tracks.length > 0 ? renderTracks(album) : null}
                    {renderRatingEditor(album)}
                    {renderAllRatings(album.id)}
                  </div>
                ) : null}
              </div>

              <button className="expandBtn" onClick={() => toggleExpand(album.id)}>
                {isOpen ? "Collapse" : "Expand"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
