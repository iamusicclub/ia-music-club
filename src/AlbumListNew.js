import { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

/** -------- London date helpers -------- */
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

function toLondonDateKeyFromTimestamp(ts) {
  if (!ts?.toDate) return "";
  return formatLondonDateKey(ts.toDate());
}

export default function AlbumListNew() {
  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [allRatings, setAllRatings] = useState([]);

  const [ratingsDraft, setRatingsDraft] = useState({});
  const [feedback, setFeedback] = useState({});

  const [minRating, setMinRating] = useState(0);
  const [nominators, setNominators] = useState([]);
  const [selectedNominator, setSelectedNominator] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest"); // newest | rating

  // expanded state: albumId -> boolean
  const [expanded, setExpanded] = useState({});

  const todayKey = useMemo(() => formatLondonDateKey(), []);
  const user = auth.currentUser;

  /** -------- Load albums -------- */
  useEffect(() => {
    const qAlbums = query(collection(db, "albums"), orderBy("nominationDate", "desc"));

    const unsub = onSnapshot(qAlbums, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Unique nominators list (for filter)
      const uniqueNoms = Array.from(new Set(data.map((a) => a.nominatedBy))).filter(Boolean);
      setNominators(uniqueNoms);

      setAlbums(data);

      // Force: today's album expanded, everything else collapsed by default
      const todaysAlbum = data.find((a) => toLondonDateKeyFromTimestamp(a.nominationDate) === todayKey);

      setExpanded((prev) => {
        const next = { ...prev };

        // Default everything in the list to collapsed unless already explicitly set
        for (const a of data) {
          if (next[a.id] === undefined) next[a.id] = false;
        }

        // Force today's expanded
        if (todaysAlbum?.id) next[todaysAlbum.id] = true;

        // Optional cleanup: remove keys that no longer exist
        const validIds = new Set(data.map((a) => a.id));
        Object.keys(next).forEach((k) => {
          if (!validIds.has(k)) delete next[k];
        });

        return next;
      });
    });

    return () => unsub();
  }, [todayKey]);

  /** -------- Load ratings & compute averages -------- */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const map = {};
      const all = [];

      snapshot.forEach((d) => {
        const data = d.data();
        all.push({ id: d.id, ...data });

        const { albumId, score } = data || {};
        if (!albumId) return;
        if (!map[albumId]) map[albumId] = [];
        map[albumId].push(Number(score || 0));
      });

      const avg = {};
      Object.keys(map).forEach((albumId) => {
        const scores = map[albumId];
        const average = scores.reduce((s, v) => s + v, 0) / Math.max(scores.length, 1);
        avg[albumId] = average.toFixed(1);
      });

      setRatingsByAlbum(avg);
      setAllRatings(all);
    });

    return () => unsub();
  }, []);

  /** -------- Rating submit -------- */
  const handleRate = async (albumId, value) => {
    const u = auth.currentUser;
    if (!u) return;

    const score = Number(value);
    const comment = prompt("Optional: Leave a short comment about this album") || "";

    setRatingsDraft((prev) => ({ ...prev, [albumId]: score }));

    try {
      const ratingId = `${u.uid}_${albumId}`;
      const ref = doc(db, "ratings", ratingId);

      await setDoc(ref, {
        albumId,
        userId: u.uid,
        userEmail: u.email,
        score,
        comment,
        timestamp: serverTimestamp(),
      });

      setFeedback((prev) => ({ ...prev, [albumId]: "Rating saved ✓" }));
      setTimeout(() => setFeedback((prev) => ({ ...prev, [albumId]: "" })), 2000);
    } catch (e) {
      console.error("Rating error:", e?.message || e);
      setFeedback((prev) => ({ ...prev, [albumId]: "Failed to save rating" }));
      setTimeout(() => setFeedback((prev) => ({ ...prev, [albumId]: "" })), 2500);
    }
  };

  /** -------- Filters + sorting -------- */
  const filteredAndSorted = useMemo(() => {
    const list = albums
      .filter((a) => {
        const avg = ratingsByAlbum[a.id];
        return avg === undefined || Number(avg) >= minRating;
      })
      .filter((a) => (selectedNominator === "All" ? true : a.nominatedBy === selectedNominator))
      .sort((a, b) => {
        if (sortOrder === "rating") {
          const aAvg = parseFloat(ratingsByAlbum[a.id] || 0);
          const bAvg = parseFloat(ratingsByAlbum[b.id] || 0);
          return bAvg - aAvg;
        }
        // newest
        const da = a.nominationDate?.toDate?.() || new Date(0);
        const dbb = b.nominationDate?.toDate?.() || new Date(0);
        return dbb - da;
      });

    return list;
  }, [albums, ratingsByAlbum, minRating, selectedNominator, sortOrder]);

  /** -------- Identify today album id for rendering rules -------- */
  const todaysAlbumId = useMemo(() => {
    const t = albums.find((a) => toLondonDateKeyFromTimestamp(a.nominationDate) === todayKey);
    return t?.id || null;
  }, [albums, todayKey]);

  const toggleExpand = (albumId) => {
    // Do not allow collapsing today's album
    if (albumId === todaysAlbumId) return;
    setExpanded((prev) => ({ ...prev, [albumId]: !prev[albumId] }));
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <h2 style={{ margin: "0 0 10px 0" }}>🎧 Album Nominations</h2>

      <div className="filtersRow">
        <label className="filter">
          Min Avg Rating
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            {[0, 5, 6, 7, 8, 9].map((r) => (
              <option key={r} value={r}>
                {r}+
              </option>
            ))}
          </select>
        </label>

        <label className="filter">
          Nominator
          <select value={selectedNominator} onChange={(e) => setSelectedNominator(e.target.value)}>
            <option value="All">All</option>
            {nominators.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="filter">
          Sort
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="rating">Highest Rated</option>
          </select>
        </label>
      </div>

      {filteredAndSorted.length === 0 ? (
        <p>No albums match this filter.</p>
      ) : (
        filteredAndSorted.map((album) => {
          const avg = ratingsByAlbum[album.id];
          const isToday = album.id === todaysAlbumId;
          const isExpanded = !!expanded[album.id]; // todays album will be forced true
          const cover = album.coverUrl;

          return (
            <div key={album.id} className={`albumCard ${isToday ? "todayCard" : ""}`}>
              <div className="albumRow">
                <div className="albumThumbWrap">
                  {cover ? (
                    <img
                      src={cover}
                      alt={`${album.title} cover`}
                      className={isToday ? "albumCoverToday" : "albumCoverThumb"}
                    />
                  ) : (
                    <div className={isToday ? "albumCoverToday placeholder" : "albumCoverThumb placeholder"}>
                      No Image
                    </div>
                  )}
                </div>

                <div className="albumMain">
                  <div className="albumTitleRow">
                    <div className="albumTitle">
                      <strong>{album.title}</strong>
                      <span className="albumArtist"> — {album.artist}</span>
                    </div>

                    <button
                      className={`btn tiny ${isToday ? "disabled" : ""}`}
                      onClick={() => toggleExpand(album.id)}
                      title={isToday ? "Today's album is always expanded" : "Expand/collapse"}
                    >
                      {isToday ? "Today" : isExpanded ? "Collapse" : "Expand"}
                    </button>
                  </div>

                  <div className="albumMeta">
                    <span>
                      Nominated by <strong>{album.nominatedBy || "Unknown"}</strong>
                    </span>
                    <span className="dot">•</span>
                    <span>
                      Avg: <strong>{avg ? `${avg}/10` : "—"}</strong>
                    </span>
                  </div>

                  {isExpanded ? (
                    <div className="albumExpanded">
                      <div className="rateRow">
                        <label>
                          Your rating{" "}
                          <select
                            value={ratingsDraft[album.id] || ""}
                            onChange={(e) => handleRate(album.id, e.target.value)}
                          >
                            <option value="">--</option>
                            {Array.from({ length: 10 }).map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </label>

                        {feedback[album.id] ? <span className="saveMsg">{feedback[album.id]}</span> : null}
                      </div>

                      <div className="ratingsList">
                        {allRatings
                          .filter((r) => r.albumId === album.id)
                          .map((r) => (
                            <div key={`${r.userId}_${r.albumId}`} className="ratingLine">
                              <strong>{r.username || r.userEmail}</strong> rated <strong>{r.score}/10</strong>
                              {r.comment ? <span className="comment">“{r.comment}”</span> : null}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
