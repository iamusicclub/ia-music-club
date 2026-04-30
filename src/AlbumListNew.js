import { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
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

function toDateKeyFromTimestamp(ts) {
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
    const arr = Array.isArray(rawTracks)
      ? rawTracks
      : rawTracks
      ? [rawTracks]
      : [];

    return arr
      .map((t) => (typeof t?.name === "string" ? t.name.trim() : ""))
      .filter(Boolean);
  } catch (e) {
    console.error("Failed to fetch tracks from Last.fm:", e?.message || e);
    return [];
  }
}

export default function AlbumListNew() {
  const [user, setUser] = useState(null);

  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [allRatings, setAllRatings] = useState([]);

  const [ratingsDraft, setRatingsDraft] = useState({});
  const [feedback, setFeedback] = useState({});

  const [minRating, setMinRating] = useState(0);
  const [nominators, setNominators] = useState([]);
  const [selectedNominator, setSelectedNominator] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest"); // newest | rating
  const [showUnratedOnly, setShowUnratedOnly] = useState(false);

  const [expanded, setExpanded] = useState({});
  const [tracksByAlbum, setTracksByAlbum] = useState({}); // albumId -> string[]

  const todayKey = useMemo(() => formatLondonDateKey(), []);

  // Auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  // Albums
  useEffect(() => {
    const qAlbums = query(
      collection(db, "albums"),
      orderBy("nominationDate", "desc")
    );

    const unsub = onSnapshot(qAlbums, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const uniqueNominators = Array.from(
        new Set(data.map((a) => a.nominatedBy))
      ).filter(Boolean);

      setAlbums(data);
      setNominators(uniqueNominators);
    });

    return () => unsub();
  }, []);

  // Ratings
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const map = {};
      const all = [];
      const myDrafts = {};

      snapshot.forEach((d) => {
        const r = d.data();
        all.push({ id: d.id, ...r });

        const { albumId, score } = r;
        if (!albumId) return;

        if (!map[albumId]) map[albumId] = [];
        map[albumId].push(Number(score));

        if (user?.uid && r.userId === user.uid) {
          myDrafts[albumId] = Number(score);
        }
      });

      const avg = {};
      Object.keys(map).forEach((albumId) => {
        const scores = map[albumId];
        const validScores = scores.filter((s) => !Number.isNaN(s));
        if (validScores.length === 0) return;

        const average =
          validScores.reduce((s, v) => s + v, 0) / validScores.length;
        avg[albumId] = average.toFixed(1);
      });

      setAllRatings(all);
      setRatingsByAlbum(avg);
      setRatingsDraft((prev) => ({ ...prev, ...myDrafts }));
    });

    return () => unsub();
  }, [user?.uid]);

  const myRatedAlbumIds = useMemo(() => {
    if (!user?.uid) return new Set();

    return new Set(
      allRatings
        .filter((r) => r.userId === user.uid)
        .map((r) => r.albumId)
        .filter(Boolean)
    );
  }, [allRatings, user?.uid]);

  const unratedAlbums = useMemo(() => {
    if (!user?.uid) return [];
    return albums.filter((album) => !myRatedAlbumIds.has(album.id));
  }, [albums, myRatedAlbumIds, user?.uid]);

  async function handleRate(albumId, value) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const userId = currentUser.uid;
    const userEmail = currentUser.email;
    const comment =
      prompt("Optional: Leave a short comment about this album") || "";

    setRatingsDraft((prev) => ({ ...prev, [albumId]: value }));

    try {
      const ratingId = `${userId}_${albumId}`;
      const ref = doc(db, "ratings", ratingId);

      await setDoc(ref, {
        albumId,
        userId,
        userEmail,
        score: Number(value),
        comment,
        timestamp: serverTimestamp(),
      });

      setFeedback((prev) => ({ ...prev, [albumId]: "Rating saved ✓" }));
      setTimeout(() => {
        setFeedback((prev) => ({ ...prev, [albumId]: "" }));
      }, 2000);
    } catch (e) {
      console.error("Rating error:", e?.message || e);
      setFeedback((prev) => ({ ...prev, [albumId]: "Failed to save rating" }));
      setTimeout(() => {
        setFeedback((prev) => ({ ...prev, [albumId]: "" }));
      }, 2500);
    }
  }

  async function toggleExpand(album) {
    const next = !expanded[album.id];
    setExpanded((prev) => ({ ...prev, [album.id]: next }));

    // Lazy-load tracks on first expand
    if (next && !tracksByAlbum[album.id]) {
      const tracks = await fetchTracksFromLastFM(album.artist, album.title);
      setTracksByAlbum((prev) => ({ ...prev, [album.id]: tracks }));
    }
  }

  const filteredAndSorted = albums
    .filter((a) => {
      const avg = ratingsByAlbum[a.id];
      return avg === undefined || Number(avg) >= minRating;
    })
    .filter((a) =>
      selectedNominator === "All" ? true : a.nominatedBy === selectedNominator
    )
    .filter((a) => {
      if (!showUnratedOnly) return true;
      if (!user?.uid) return true;
      return !myRatedAlbumIds.has(a.id);
    })
    .sort((a, b) => {
      if (sortOrder === "rating") {
        const avgA = parseFloat(ratingsByAlbum[a.id] || "0");
        const avgB = parseFloat(ratingsByAlbum[b.id] || "0");
        return avgB - avgA;
      }

      const da = a.nominationDate?.toDate?.() || new Date(0);
      const dbb = b.nominationDate?.toDate?.() || new Date(0);
      return dbb - da;
    });

  return (
    <div style={{ marginTop: "1rem" }}>
      <h2 style={{ marginBottom: 8 }}>Historic Nominations</h2>

      {user ? (
        <div className="albumCard" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong>Albums still to rate</strong>
              <p className="smallNote" style={{ margin: "4px 0 0 0" }}>
                You have <strong>{unratedAlbums.length}</strong>{" "}
                {unratedAlbums.length === 1 ? "album" : "albums"} still to rate.
              </p>
            </div>

            <button
              className="expandBtn"
              type="button"
              onClick={() => setShowUnratedOnly((prev) => !prev)}
            >
              {showUnratedOnly ? "Show all albums" : "Show unrated only"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="controlsRow">
        <div className="controlItem">
          <label>Min Avg Rating</label>
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
          >
            {[0, 5, 6, 7, 8, 9].map((r) => (
              <option key={r} value={r}>
                {r}+
              </option>
            ))}
          </select>
        </div>

        <div className="controlItem">
          <label>Nominator</label>
          <select
            value={selectedNominator}
            onChange={(e) => setSelectedNominator(e.target.value)}
          >
            <option value="All">All</option>
            {nominators.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="controlItem">
          <label>Sort</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <p className="smallNote" style={{ marginTop: 12 }}>
          No albums match this filter.
        </p>
      ) : (
        <div style={{ marginTop: 12 }}>
          {filteredAndSorted.map((album) => {
            const avg = ratingsByAlbum[album.id];
            const dateKey = toDateKeyFromTimestamp(album.nominationDate);
            const isTodayAlbum = dateKey && dateKey === todayKey;
            const hasRated = user?.uid ? myRatedAlbumIds.has(album.id) : false;

            return (
              <div className="albumCard" key={album.id}>
                <div className="albumRow">
                  <div className="albumThumb">
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt={`${album.title} cover`} />
                    ) : (
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        No image
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="albumTitle">
                      {album.title}{" "}
                      <span style={{ fontWeight: 500, color: "#6b7280" }}>
                        — {album.artist}
                      </span>
                    </p>

                    <p className="albumSub">
                      Nominated by{" "}
                      <strong>{album.nominatedBy || "Unknown"}</strong>
                      {avg ? (
                        <>
                          {" "}
                          · <span className="muted">Avg:</span>{" "}
                          <strong>{avg}/10</strong>
                        </>
                      ) : (
                        <>
                          {" "}
                          · <span className="muted">No ratings yet</span>
                        </>
                      )}

                      {user && !hasRated ? (
                        <span
                          className="badgeFriday"
                          style={{ marginLeft: 10 }}
                        >
                          Not rated by you
                        </span>
                      ) : null}

                      {isTodayAlbum ? (
                        <span
                          className="badgeFriday"
                          style={{ marginLeft: 10 }}
                        >
                          Today’s album
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <button
                    className="expandBtn"
                    onClick={() => toggleExpand(album)}
                  >
                    {expanded[album.id] ? "Collapse" : "Expand"}
                  </button>
                </div>

                {expanded[album.id] ? (
                  <div className="albumExpanded">
                    <div className="albumExpandedGrid">
                      <div className="albumHero">
                        {album.coverUrl ? (
                          <img
                            src={album.coverUrl}
                            alt={`${album.title} cover large`}
                          />
                        ) : null}
                      </div>

                      <div>
                        <div className="ratingRow">
                          <div>
                            <strong>Your rating</strong>
                          </div>

                          <select
                            value={ratingsDraft[album.id] || ""}
                            onChange={(e) =>
                              handleRate(album.id, e.target.value)
                            }
                            style={{ maxWidth: 180 }}
                          >
                            <option value="">--</option>
                            {[...Array(10)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </div>

                        {feedback[album.id] ? (
                          <div className="feedbackOk">
                            {feedback[album.id]}
                          </div>
                        ) : null}

                        <div style={{ marginTop: 10 }}>
                          <strong>Track listing</strong>
                          {tracksByAlbum[album.id] ? (
                            tracksByAlbum[album.id].length ? (
                              <ol className="trackList">
                                {tracksByAlbum[album.id].map((t, idx) => (
                                  <li key={idx}>{t}</li>
                                ))}
                              </ol>
                            ) : (
                              <p className="smallNote" style={{ marginTop: 6 }}>
                                No tracks found for this album.
                              </p>
                            )
                          ) : (
                            <p className="smallNote" style={{ marginTop: 6 }}>
                              Loading tracks…
                            </p>
                          )}
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <strong>Ratings</strong>
                          <div style={{ marginTop: 8 }}>
                            {allRatings
                              .filter((r) => r.albumId === album.id)
                              .map((r) => (
                                <div className="ratingItem" key={r.id}>
                                  <strong>{r.username || r.userEmail}</strong>{" "}
                                  rated <strong>{r.score}/10</strong>
                                  {r.comment ? (
                                    <>
                                      {" "}
                                      <em>“{r.comment}”</em>
                                    </>
                                  ) : null}
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
