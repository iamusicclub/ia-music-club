import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

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

function getPartsFromTimestamp(ts) {
  if (!ts?.toDate) return null;
  return getLondonDateParts(ts.toDate());
}

export default function OnThisDay() {
  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});

  const todayParts = useMemo(() => getLondonDateParts(new Date()), []);
  const todayLabel = `${todayParts.day}/${todayParts.month}`;

  useEffect(() => {
    const qAlbums = query(
      collection(db, "albums"),
      orderBy("nominationDate", "desc")
    );

    const unsub = onSnapshot(qAlbums, (snapshot) => {
      setAlbums(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ratings"), (snapshot) => {
      const map = {};

      snapshot.forEach((d) => {
        const r = d.data();
        if (!r.albumId) return;

        if (!map[r.albumId]) map[r.albumId] = [];
        map[r.albumId].push(Number(r.score));
      });

      const avg = {};
      Object.keys(map).forEach((albumId) => {
        const scores = map[albumId].filter((s) => !Number.isNaN(s));
        if (scores.length === 0) return;

        const average = scores.reduce((sum, val) => sum + val, 0) / scores.length;
        avg[albumId] = {
          average: average.toFixed(1),
          count: scores.length,
        };
      });

      setRatingsByAlbum(avg);
    });

    return () => unsub();
  }, []);

  const matches = useMemo(() => {
    return albums
      .map((album) => {
        const parts = getPartsFromTimestamp(album.nominationDate);
        return { album, parts };
      })
      .filter(({ parts }) => {
        if (!parts) return false;

        return (
          parts.day === todayParts.day &&
          parts.month === todayParts.month &&
          parts.year !== todayParts.year
        );
      })
      .sort((a, b) => Number(b.parts.year) - Number(a.parts.year));
  }, [albums, todayParts.day, todayParts.month, todayParts.year]);

  return (
    <div style={{ marginTop: 14 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>📅 On This Day</h2>
        <p className="smallNote" style={{ marginBottom: 0 }}>
          Albums nominated on this date in previous years:{" "}
          <strong>{todayLabel}</strong>
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="smallNote" style={{ margin: 0 }}>
            Nothing found for this date yet. As your archive grows, this page
            will become more interesting.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {matches.map(({ album, parts }) => {
            const rating = ratingsByAlbum[album.id];

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
                      <strong>{parts.year}</strong>
                      {" · "}
                      Nominated by{" "}
                      <strong>{album.nominatedBy || "Unknown"}</strong>
                      {rating ? (
                        <>
                          {" · "}
                          <span className="muted">Avg:</span>{" "}
                          <strong>{rating.average}/10</strong>{" "}
                          <span className="muted">
                            ({rating.count} rating
                            {rating.count === 1 ? "" : "s"})
                          </span>
                        </>
                      ) : (
                        <>
                          {" · "}
                          <span className="muted">No ratings yet</span>
                        </>
                      )}
                    </p>
                  </div>

                  <span className="badgeFriday">{parts.year}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
