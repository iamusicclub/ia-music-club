import { useEffect, useMemo, useState } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

const PAGE_SIZE = 10;

export default function AlbumListNew() {
  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [allRatings, setAllRatings] = useState([]);

  const [feedback, setFeedback] = useState({});
  const [myRatings, setMyRatings] = useState({}); // { [albumId]: scoreAsString }
  const [minRating, setMinRating] = useState(0);

  const [nominators, setNominators] = useState([]);
  const [selectedNominator, setSelectedNominator] = useState("All");

  // newest | rating
  const [sortOrder, setSortOrder] = useState("newest");

  // pagination
  const [pageIndex, setPageIndex] = useState(0);

  // Load albums (live)
  useEffect(() => {
    const ref = collection(db, "albums");
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const albumData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Extract unique nominators
      const uniqueNominators = Array.from(
        new Set(albumData.map((a) => a.nominatedBy).filter(Boolean))
      ).sort((a, b) => String(a).localeCompare(String(b)));

      setAlbums(albumData);
      setNominators(uniqueNominators);
    });

    return () => unsubscribe();
  }, []);

  // Load ratings (live) + compute averages
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const ratingsMap = {};
      const all = [];
      const mine = {};

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        all.push({ id: docSnap.id, ...data });

        const { albumId, score } = data;
        if (albumId != null) {
          if (!ratingsMap[albumId]) ratingsMap[albumId] = [];
          if (typeof score === "number") ratingsMap[albumId].push(score);
        }

        // capture current user's score for dropdown value
        const u = auth.currentUser;
        if (u && data.userId === u.uid && data.albumId) {
          mine[data.albumId] = String(data.score ?? "");
        }
      });

      const avgMap = {};
      Object.keys(ratingsMap).forEach((albumId) => {
        const scores = ratingsMap[albumId];
        if (!scores || scores.length === 0) return;
        const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
        avgMap[albumId] = Number.isFinite(avg) ? avg.toFixed(1) : undefined;
      });

      setRatingsByAlbum(avgMap);
      setAllRatings(all);
      setMyRatings((prev) => ({ ...prev, ...mine }));
    });

    return () => unsubscribe();
  }, []);

  // If filters/sort change, jump back to page 1
  useEffect(() => {
    setPageIndex(0);
  }, [minRating, selectedNominator, sortOrder]);

  const handleRate = async (albumId, value) => {
    const user = auth.currentUser;
    if (!user) return;

    const userId = user.uid;
    const userEmail = user.email || "Unknown";

    const comment =
      window.prompt("Optional: Leave a short comment about this album") || "";

    setMyRatings((prev) => ({ ...prev, [albumId]: value }));

    try {
      const ratingId = `${userId}_${albumId}`;
      const ratingRef = doc(db, "ratings", ratingId);

      await setDoc(ratingRef, {
        albumId,
        userId,
        userEmail,
        score: Number(value),
        comment,
        timestamp: serverTimestamp(),
      });

      setFeedback((prev) => ({ ...prev, [albumId]: "Rating saved ✓" }));
      window.setTimeout(() => {
        setFeedback((prev) => ({ ...prev, [albumId]: "" }));
      }, 2000);
    } catch (error) {
      console.error("Rating error:", error?.message || error);
    }
  };

  // Filter + sort
  const filteredAndSorted = useMemo(() => {
    const filtered = albums
      .filter((album) => {
        const avg = ratingsByAlbum[album.id];
        return avg === undefined || Number(avg) >= minRating;
      })
      .filter((album) => {
        if (selectedNominator === "All") return true;
        return album.nominatedBy === selectedNominator;
      });

    filtered.sort((a, b) => {
      if (sortOrder === "rating") {
        const avgA = parseFloat(ratingsByAlbum[a.id] || "0");
        const avgB = parseFloat(ratingsByAlbum[b.id] || "0");
        return avgB - avgA;
      }

      const dateA = a.nominationDate?.toDate?.() || new Date(0);
      const dateB = b.nominationDate?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    return filtered;
  }, [albums, ratingsByAlbum, minRating, selectedNominator, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = filteredAndSorted.slice(start, end);

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>Album Nominations</h2>

      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Rating filter */}
        <label>
          Min Avg Rating:
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            style={{ marginLeft: "0.5rem" }}
          >
            {[0, 5, 6, 7, 8, 9].map((r) => (
              <option key={r} value={r}>
                {r}+
              </option>
            ))}
          </select>
        </label>

        {/* Nominator filter */}
        <label>
          Nominator:
          <select
            value={selectedNominator}
            onChange={(e) => setSelectedNominator(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          >
            <option value="All">All</option>
            {nominators.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Sort */}
        <label>
          Sort by:
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          >
            <option value="newest">Newest First</option>
            <option value="rating">Highest Rated</option>
          </select>
        </label>

        {/* Pagination controls */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={safePageIndex === 0}
          >
            Prev
          </button>
          <span style={{ alignSelf: "center" }}>
            Page {safePageIndex + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePageIndex >= totalPages - 1}
          >
            Next
          </button>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <p>No albums match this filter.</p>
      ) : (
        pageItems.map((album) => (
          <div
            key={album.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "flex-start",
              backgroundColor: "#fff",
            }}
          >
            {album.coverUrl ? (
              <img
                src={album.coverUrl}
                alt={`${album.title} cover`}
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "cover",
                  marginRight: "20px",
                  borderRadius: "8px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  backgroundColor: "#eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  color: "#888",
                  borderRadius: "8px",
                  marginRight: "20px",
                }}
              >
                No Image
              </div>
            )}

            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px 0" }}>{album.title}</h3>
              <p style={{ margin: 0, color: "#555" }}>by {album.artist}</p>

              {ratingsByAlbum[album.id] ? (
                <p style={{ margin: "6px 0", fontWeight: "bold" }}>
                  Avg: {ratingsByAlbum[album.id]} / 10
                </p>
              ) : (
                <p style={{ margin: "6px 0", color: "#888" }}>No ratings yet</p>
              )}

              <label>
                Your rating:
                <select
                  value={myRatings[album.id] || ""}
                  onChange={(e) => handleRate(album.id, e.target.value)}
                  style={{ padding: "4px", marginLeft: "8px" }}
                >
                  <option value="">--</option>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>

              {feedback[album.id] ? (
                <div style={{ color: "green", marginTop: "6px" }}>
                  {feedback[album.id]}
                </div>
              ) : null}

              <div style={{ marginTop: "10px" }}>
                {allRatings
                  .filter((r) => r.albumId === album.id)
                  .map((r) => (
                    <div
                      key={r.userId}
                      style={{ fontSize: "0.85em", marginBottom: "6px" }}
                    >
                      {r.username || r.userEmail} rated {r.score}/10
                      {r.comment ? (
                        <span style={{ fontStyle: "italic", marginLeft: "8px" }}>
                          "{r.comment}"
                        </span>
                      ) : null}
                    </div>
                  ))}
              </div>

              <div style={{ marginTop: "10px", fontSize: "0.8em", color: "#555" }}>
                Nominated by: <code>{album.nominatedBy}</code>
                <br />
                {album.nominationDate?.toDate?.()
                  ? `Nominated on: ${album.nominationDate.toDate().toLocaleDateString()}`
                  : null}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
