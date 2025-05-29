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

  useEffect(() => {
    const ref = collection(db, "albums");
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const albumData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort albums by nominationDate descending (most recent first)
      albumData.sort((a, b) => {
        const dateA = a.nominationDate?.toDate?.() || new Date(0);
        const dateB = b.nominationDate?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setAlbums(albumData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const ratingsMap = {};
      const all = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        all.push({ id: doc.id, ...data });

        const { albumId, score } = data;
        if (!ratingsMap[albumId]) {
          ratingsMap[albumId] = [];
        }
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
    if (!user) {
      console.warn("User not authenticated.");
      return;
    }

    const userId = user.uid;
    const userEmail = user.email || "Unknown";
    const comment =
      prompt("Optional: Leave a short comment about this album") || "";

    setRatings((prev) => ({ ...prev, [albumId]: value }));

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
      setTimeout(() => {
        setFeedback((prev) => ({ ...prev, [albumId]: "" }));
      }, 2000);
    } catch (error) {
      console.error("Rating error:", error.message);
    }
  };

  return (
    <div>
      <h2>Album Nominations</h2>

      <label>
        Filter by minimum average rating:
        <select onChange={(e) => setMinRating(Number(e.target.value))}>
          {[0, 5, 6, 7, 8, 9].map((r) => (
            <option key={r} value={r}>
              {r}+
            </option>
          ))}
        </select>
      </label>

      {albums.length === 0 && <p>No nominations yet.</p>}

      {albums
        .filter((album) => {
          const avg = ratingsByAlbum[album.id];
          return avg === undefined || Number(avg) >= minRating;
        })
        .map((album) => (
          <div
            key={album.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
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
                  marginRight: "16px",
                  borderRadius: "4px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  backgroundColor: "#eee",
                  marginRight: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  color: "#888",
                  borderRadius: "4px",
                }}
              >
                No Image
              </div>
            )}

            <div>
              <h3 style={{ margin: "0 0 4px 0" }}>{album.title}</h3>
              <p style={{ margin: 0 }}>by {album.artist}</p>

              {ratingsByAlbum[album.id] ? (
                <p style={{ margin: "4px 0" }}>
                  ⭐ Average Rating: <strong>{ratingsByAlbum[album.id]}</strong>
                  /10
                </p>
              ) : (
                <p style={{ margin: "4px 0", color: "#888" }}>No ratings yet</p>
              )}

              <label>
                Your rating:{" "}
                <select
                  value={ratings[album.id] || ""}
                  onChange={(e) => handleRate(album.id, e.target.value)}
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
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "0.85em",
                    color: "green",
                  }}
                >
                  {feedback[album.id]}
                </div>
              )}

              <div style={{ marginTop: "8px" }}>
                {allRatings
                  .filter((r) => r.albumId === album.id)
                  .map((r) => (
                    <div
                      key={r.userId}
                      style={{ fontSize: "0.85em", color: "#444" }}
                    >
                      {r.userEmail} rated: {r.score}/10
                      {r.comment && (
                        <div style={{ fontStyle: "italic", marginLeft: "8px" }}>
                          “{r.comment}”
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <br />
              <small>
                Nominated by: <code>{album.nominatedBy}</code>
                <br />
                {album.nominationDate?.toDate &&
                  `Nominated on: ${album.nominationDate
                    .toDate()
                    .toLocaleDateString()}`}
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
              </small>
            </div>
          </div>
        ))}
    </div>
  );
}
