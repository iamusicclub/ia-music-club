import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

export default function AlbumList() {
  const [albums, setAlbums] = useState([]);
  const [ratings, setRatings] = useState({});
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [allRatings, setAllRatings] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState("date"); // "date" or "rating"

  // Load albums
  useEffect(() => {
    const ref = collection(db, "albums");
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const albumData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAlbums(albumData);
    });
    return () => unsubscribe();
  }, []);

  // Load ratings
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const ratingsMap = {};
      const all = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        all.push({ id: doc.id, ...data });

        const { albumId, score } = data;
        if (!ratingsMap[albumId]) ratingsMap[albumId] = [];
        ratingsMap[albumId].push(score);
      });

      const avgMap = {};
      Object.keys(ratingsMap).forEach((albumId) => {
        const scores = ratingsMap[albumId];
        const average =
          scores.reduce((sum, val) => sum + val, 0) / scores.length;
        avgMap[albumId] = average.toFixed(1);
      });

      setRatingsByAlbum(avgMap);
      setAllRatings(all);
    });

    return () => unsubscribe();
  }, []);

  const handleRate = async (albumId, value) => {
    const user = auth.currentUser;
    if (!user) return;

    const userId = user.uid;
    const userEmail = user.email;
    const comment =
      prompt("Optional: Leave a short comment about this album") || "";

    setRatings((prev) => ({ ...prev, [albumId]: value }));

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
    } catch (error) {
      console.error("Rating error:", error.message);
    }
  };

  const sortedAlbums = [...albums]
    .filter((album) => {
      const avg = ratingsByAlbum[album.id];
      return avg === undefined || Number(avg) >= minRating;
    })
    .sort((a, b) => {
      if (sortBy === "rating") {
        const ratingA = parseFloat(ratingsByAlbum[a.id]) || 0;
        const ratingB = parseFloat(ratingsByAlbum[b.id]) || 0;
        return ratingB - ratingA;
      } else {
        const dateA = a.nominationDate?.toDate?.() || new Date(0);
        const dateB = b.nominationDate?.toDate?.() || new Date(0);
        return dateB - dateA;
      }
    });

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>🎧 Album Nominations</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ marginRight: "1rem" }}>
          Filter by minimum average rating:{" "}
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            style={{
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              marginRight: "1rem",
            }}
          >
            {[0, 5, 6, 7, 8, 9].map((r) => (
              <option key={r} value={r}>
                {r}+
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort by:{" "}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          >
            <option value="date">Most Recent</option>
            <option value="rating">Highest Rated</option>
          </select>
        </label>
      </div>

      {sortedAlbums.length === 0 && <p>No nominations found.</p>}

      {sortedAlbums.map((album) => (
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
                ⭐ {ratingsByAlbum[album.id]} / 10
              </p>
            ) : (
              <p style={{ margin: "6px 0", color: "#888" }}>No ratings yet</p>
            )}

            <label>
              Your rating:{" "}
              <select
                value={ratings[album.id] || ""}
                onChange={(e) => handleRate(album.id, e.target.value)}
                style={{ padding: "4px", marginLeft: "4px" }}
              >
                <option value="">--</option>
                {[...Array(10)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>

            {feedback[album.id] && (
              <div style={{ color: "green", marginTop: "4px" }}>
                {feedback[album.id]}
              </div>
            )}

            <div style={{ marginTop: "8px" }}>
              {allRatings
                .filter((r) => r.albumId === album.id)
                .map((r) => (
                  <div
                    key={r.userId}
                    style={{ fontSize: "0.85em", marginBottom: "4px" }}
                  >
                    {r.username || r.userEmail} rated {r.score}/10
                    {r.comment && (
                      <span
                        style={{ fontStyle: "italic", marginLeft: "6px" }}
                      >
                        “{r.comment}”
                      </span>
                    )}
                  </div>
                ))}
            </div>

            <div
              style={{ marginTop: "10px", fontSize: "0.8em", color: "#555" }}
            >
              Nominated by: <code>{album.nominatedBy}</code>
              <br />
              {album.nominationDate?.toDate?.() && (
                <>
                  Nominated on:{" "}
                  {album.nominationDate.toDate().toLocaleDateString()}
                  <br />
                  {(() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const albumDate = album.nominationDate
                      ?.toDate?.()
                      ?.toISOString()
                      .split("T")[0];
                    return albumDate === todayStr ? (
                      <span style={{ color: "green", fontWeight: "bold" }}>
                        🆕 Nominated Today
                      </span>
                    ) : null;
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
