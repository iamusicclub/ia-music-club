import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

function getLondonDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: parts.find((p) => p.type === "year")?.value,
    month: parts.find((p) => p.type === "month")?.value,
    day: parts.find((p) => p.type === "day")?.value,
  };
}

export default function OnThisDay() {
  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});

  const todayParts = useMemo(() => getLondonDateParts(new Date()), []);
  const todayDay = Number(todayParts.day);
  const todayMonth = Number(todayParts.month);
  const todayLabel = `${todayParts.day}/${todayParts.month}`;

  useEffect(() => {
    const qAlbums = query(
      collection(db, "albums"),
      where("generatedDay", "==", todayDay),
      where("generatedMonth", "==", todayMonth)
    );

    const unsub = onSnapshot(qAlbums, (snapshot) => {
      setAlbums(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [todayDay, todayMonth]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const map = {};

      snapshot.forEach((d) => {
        const r = d.data();
        if (!r.albumId) return;

        const value = Number(r.rating ?? r.score);
        if (Number.isNaN(value)) return;

        if (!map[r.albumId]) map[r.albumId] = [];

        map[r.albumId].push({
          user: r.user || r.userName || r.ratedBy || "User",
          value,
        });
      });

      setRatingsByAlbum(map);
    });

    return () => unsub();
  }, []);

  const sortedAlbums = useMemo(() => {
    return [...albums].sort((a, b) => {
      const aDate = a.generatedDate?.toDate?.();
      const bDate = b.generatedDate?.toDate?.();

      if (!aDate || !bDate) return 0;

      return bDate.getFullYear() - aDate.getFullYear();
    });
  }, [albums]);

  return (
    <div style={{ marginTop: 14 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>📅 On This Day</h2>
        <p className="smallNote" style={{ marginBottom: 0 }}>
          Albums generated for this date: <strong>{todayLabel}</strong>
        </p>
      </div>

      {sortedAlbums.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="smallNote" style={{ margin: 0 }}>
            Nothing found for this date yet.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {sortedAlbums.map((album) => {
            const ratings = ratingsByAlbum[album.id] || [];
            const date = album.generatedDate?.toDate?.();
            const year = date ? date.getFullYear() : "";

            const albumTitle = album.title || album.album || "Untitled album";
            const artist = album.artist || "Unknown artist";

            return (
              <div className="albumCard" key={album.id}>
                <div className="albumRow">
                  <div>
                    <p className="albumTitle">
                      {albumTitle}{" "}
                      <span style={{ fontWeight: 500, color: "#6b7280" }}>
                        — {artist}
                      </span>
                    </p>

                    <p className="albumSub">
                      {year ? (
                        <>
                          <strong>{year}</strong>
                          {" · "}
                        </>
                      ) : null}

                      {album.source === "1001_albums" ? (
                        <>1001 Albums archive</>
                      ) : (
                        <>
                          Nominated by{" "}
                          <strong>{album.nominatedBy || "Unknown"}</strong>
                        </>
                      )}
                    </p>

                    {ratings.length > 0 ? (
                      <div className="smallNote" style={{ marginTop: 6 }}>
                        <strong>Ratings:</strong>{" "}
                        {ratings.map((r, idx) => (
                          <span key={idx} style={{ marginRight: 10 }}>
                            {r.user}: <strong>{r.value}/10</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="smallNote" style={{ marginTop: 6 }}>
                        No ratings yet
                      </div>
                    )}
                  </div>

                  {year ? <span className="badgeFriday">{year}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
