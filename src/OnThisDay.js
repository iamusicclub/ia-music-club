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

async function fetchCoverUrl(artist, album) {
  const apiKey = "b6ad7c38684dcfba8acbb9b4bb345e86";
  const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
    artist
  )}&album=${encodeURIComponent(album)}&format=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const image =
      data?.album?.image?.find((img) => img.size === "extralarge") ||
      data?.album?.image?.find((img) => img.size === "large") ||
      data?.album?.image?.find((img) => img.size === "medium");

    return image?.["#text"] || "";
  } catch (error) {
    console.error("Failed to fetch album art", error);
    return "";
  }
}

export default function OnThisDay() {
  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [coverUrls, setCoverUrls] = useState({});

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

  useEffect(() => {
    const loadMissingCovers = async () => {
      for (const album of albums) {
        if (coverUrls[album.id]) continue;

        const albumTitle = album.title || album.album || "";
        const artist = album.artist || "";

        if (!albumTitle || !artist) continue;

        const existingCover = album.coverUrl || "";
        if (existingCover) {
          setCoverUrls((prev) => ({
            ...prev,
            [album.id]: existingCover,
          }));
          continue;
        }

        const fetchedCover = await fetchCoverUrl(artist, albumTitle);

        if (fetchedCover) {
          setCoverUrls((prev) => ({
            ...prev,
            [album.id]: fetchedCover,
          }));
        }
      }
    };

    if (albums.length > 0) {
      loadMissingCovers();
    }
  }, [albums, coverUrls]);

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
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {sortedAlbums.map((album) => {
            const ratings = ratingsByAlbum[album.id] || [];
            const date = album.generatedDate?.toDate?.();
            const year = date ? date.getFullYear() : "";

            const albumTitle = album.title || album.album || "Untitled album";
            const artist = album.artist || "Unknown artist";
            const coverUrl = coverUrls[album.id];

            return (
              <div
                className="card"
                key={album.id}
                style={{
                  padding: 16,
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={`${albumTitle} cover`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        textAlign: "center",
                        padding: 6,
                      }}
                    >
                      No image
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <h3 style={{ margin: "0 0 4px 0", lineHeight: 1.25 }}>
                        {albumTitle}
                      </h3>

                      <p
                        className="smallNote"
                        style={{
                          margin: 0,
                          fontSize: 15,
                          lineHeight: 1.4,
                        }}
                      >
                        {artist}
                      </p>
                    </div>

                    {year ? (
                      <span
                        className="badgeFriday"
                        style={{
                          whiteSpace: "nowrap",
                          alignSelf: "flex-start",
                        }}
                      >
                        {year}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className="smallNote"
                    style={{
                      marginTop: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    {album.source === "1001_albums" ? (
                      <span>1001 Albums archive</span>
                    ) : (
                      <span>
                        Nominated by{" "}
                        <strong>{album.nominatedBy || "Unknown"}</strong>
                      </span>
                    )}
                  </div>

                  {ratings.length > 0 ? (
                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {ratings.map((r, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "#f3f4f6",
                            border: "1px solid #e5e7eb",
                            fontSize: 13,
                          }}
                        >
                          <strong>{r.user}</strong>
                          <span>{r.value}/5</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="smallNote" style={{ marginTop: 10 }}>
                      No ratings yet
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
