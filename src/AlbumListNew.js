import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
} from "firebase/firestore";
import { setDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";

export default function AlbumList() {
  const [albums, setAlbums] = useState([]);
  const [ratings, setRatings] = useState({});
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [allRatings, setAllRatings] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [minRating, setMinRating] = useState(0);
  const [nominators, setNominators] = useState([]);
  const [selectedNominator, setSelectedNominator] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");

  // Pagination state
  const PAGE_SIZE = 10;
  const [lastDoc, setLastDoc] = useState(null);
  const [pageHistory, setPageHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load ratings (live updates)
  useEffect(() =&gt; {
    const unsubscribe = onSnapshot(collection(db, "ratings"), (snapshot) =&gt; {
      const ratingsMap = {};
      const all = [];

      snapshot.forEach((doc) =&gt; {
        const data = doc.data();
        all.push({ id: doc.id, ...data });

        const { albumId, score } = data;
        if (!ratingsMap[albumId]) ratingsMap[albumId] = [];
        ratingsMap[albumId].push(score);
      });

      const avgMap = {};
      Object.keys(ratingsMap).forEach((albumId) =&gt; {
        const scores = ratingsMap[albumId];
        const average =
          scores.reduce((sum, val) =&gt; sum + val, 0) / scores.length;
        avgMap[albumId] = average.toFixed(1);
      });

      setRatingsByAlbum(avgMap);
      setAllRatings(all);
    });

    return () =&gt; unsubscribe();
  }, []);

  // Fetch albums (paginated, 10 at a time)
  const fetchAlbums = async (direction = "initial") =&gt; {
    setLoading(true);

    try {
      let q;
      const ref = collection(db, "albums");

      if (direction === "next" &amp;&amp; lastDoc) {
        q = query(ref, orderBy("nominationDate", "desc"), startAfter(lastDoc), limit(PAGE_SIZE));
      } else {
        // Reset to first page
        q = query(ref, orderBy("nominationDate", "desc"), limit(PAGE_SIZE));
        setPageHistory([]);
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const albumData = snapshot.docs.map((doc) =&gt; ({
          id: doc.id,
          ...doc.data(),
        }));

        setAlbums(albumData);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        if (direction === "next") {
          setPageHistory([...pageHistory, lastDoc]);
        }

        // Extract unique nominators
        const uniqueNominators = Array.from(
          new Set(albumData.map((a) =&gt; a.nominatedBy))
        ).filter(Boolean);
        setNominators(uniqueNominators);
      }
    } catch (err) {
      console.error("❌ Failed to fetch albums:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() =&gt; {
    fetchAlbums("initial");
  }, []);

  const handleRate = async (albumId, value) =&gt; {
    const user = auth.currentUser;
    if (!user) return;

    const userId = user.uid;
    const userEmail = user.email;
    const comment =
      prompt("Optional: Leave a short comment about this album") || "";

    setRatings((prev) =&gt; ({ ...prev, [albumId]: value }));

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

      setFeedback((prev) =&gt; ({ ...prev, [albumId]: "Rating saved ✓" }));
      setTimeout(() =&gt; {
        setFeedback((prev) =&gt; ({ ...prev, [albumId]: "" }));
      }, 2000);
    } catch (error) {
      console.error("Rating error:", error.message);
    }
  };

  // Apply filters &amp; sorting
  const filteredAndSorted = albums
    .filter((album) =&gt; {
      const avg = ratingsByAlbum[album.id];
      return avg === undefined || Number(avg) &gt;= minRating;
    })
    .filter((album) =&gt;
      selectedNominator === "All"
        ? true
        : album.nominatedBy === selectedNominator
    )
    .sort((a, b) =&gt; {
      if (sortOrder === "rating") {
        const avgA = parseFloat(ratingsByAlbum[a.id] || 0);
        const avgB = parseFloat(ratingsByAlbum[b.id] || 0);
        return avgB - avgA;
      } else {
        const dateA = a.nominationDate?.toDate?.() || new Date(0);
        const dateB = b.nominationDate?.toDate?.() || new Date(0);
        return dateB - dateA;
      }
    });

  return (
    <div style="{{">
      <h2>🎧 Album Nominations</h2>

      <div style="{{">
        {/* Rating Filter */}
        <label>
          Min Avg Rating:
          <select value="{minRating}"> setMinRating(Number(e.target.value))}
            style={{ marginLeft: "0.5rem" }}
          &gt;
            {[0, 5, 6, 7, 8, 9].map((r) =&gt; (
              <option value="{r}">
                {r}+
              </option>
            ))}
          </select>
        </label>

        {/* Nominator Filter */}
        <label>
          Nominator:
          <select value="{selectedNominator}"> setSelectedNominator(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          &gt;
            <option value="All">All</option>
            {nominators.map((n) =&gt; (
              <option value="{n}">
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Sort Option */}
        <label>
          Sort by:
          <select value="{sortOrder}"> setSortOrder(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          &gt;
            <option value="newest">Newest First</option>
            <option value="rating">Highest Rated</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filteredAndSorted.length === 0 ? (
        <p>No albums match this filter.</p>
      ) : (
        &lt;&gt;
          {filteredAndSorted.map((album) =&gt; (
            <div style="{{">
              {album.coverUrl ? (
                <img style="{{" alt="{`${album.title}" src="{album.coverUrl}">
              ) : (
                <div style="{{">
                  No Image
                </div>
              )}

              <div style="{{">
                <h3 style="{{">{album.title}</h3>
                <p style="{{">by {album.artist}</p>

                {ratingsByAlbum[album.id] ? (
                  <p style="{{">
                    ⭐ {ratingsByAlbum[album.id]} / 10
                  </p>
                ) : (
                  <p style="{{">No ratings yet</p>
                )}

                <label>
                  Your rating:{" "}
                  <select value="{ratings[album.id]"> handleRate(album.id, e.target.value)}
                    style={{ padding: "4px", marginLeft: "4px" }}
                  &gt;
                    <option value="">--</option>
                    {[...Array(10)].map((_, i) =&gt; (
                      <option value="{i">
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>

                {feedback[album.id] &amp;&amp; (
                  <div style="{{">
                    {feedback[album.id]}
                  </div>
                )}

                <div style="{{">
                  {allRatings
                    .filter((r) =&gt; r.albumId === album.id)
                    .map((r) =&gt; (
                      <div style="{{">
                        {r.username || r.userEmail} rated {r.score}/10
                        {r.comment &amp;&amp; (
                          <span style="{{">
                            “{r.comment}”
                          </span>
                        )}
                      </div>
                    ))}
                </div>

                <div style="{{">
                  Nominated by: <code>{album.nominatedBy}</code>
                  <br>
                  {album.nominationDate?.toDate?.() &amp;&amp; (
                    &lt;&gt;Nominated on: {album.nominationDate.toDate().toLocaleDateString()}
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination controls */}
          <div style="{{">
            <button> fetchAlbums("initial")}
              style={{ marginRight: "1rem" }}
            &gt;
              ⬅ First Page
            </button>
            <button> fetchAlbums("next")}&gt;Next ➡</button>
          </div>
        
      )}
    </div>
  );
}

