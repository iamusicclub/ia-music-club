import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

const PARTICIPANTS = {
  "scottcee01@googlemail.com": "Scott",
  "scottcee01@gmail.com": "Scott",
  "mattdhodges@outlook.com": "Matt",
  "matthodges@outlook.com": "Matt",
  "davews1621@gmail.com": "Dave",
  "jfield1968@gmail.com": "John",
  Scott: "Scott",
  Matt: "Matt",
  Dave: "Dave",
  John: "John",
};

function displayName(value) {
  if (!value) return "Unknown";

  const clean = String(value).trim();
  const lower = clean.toLowerCase();

  return PARTICIPANTS[clean] || PARTICIPANTS[lower] || clean;
}

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

function getAlbumDate(album) {
  // Imported 1001 Albums archive
  if (album.source === "1001_albums") {
    return album.generatedDate?.toDate?.() || null;
  }

  // Normal website nomination
  return album.nominationDate?.toDate?.() || null;
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
    console.error("Failed to fetch album art:", error);
    return "";
  }
}

export default function OnThisDay() {
  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [coverUrls, setCoverUrls] = useState({});

  const todayParts = useMemo(() => getLondonDateParts(new Date()), []);
  const todayLabel = `${todayParts.day}/${todayParts.month}`;

  // Load ALL albums because the two sources use different date fields
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "albums"),
      (snapshot) => {
        setAlbums(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (error) => {
        console.error("Failed to load albums:", error);
      }
    );

    return () => unsub();
  }, []);

  // Load ratings for both old/imported and website rating structures
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "ratings"),
      (snapshot) => {
        const map = {};

        snapshot.forEach((d) => {
          const rating = d.data();

          if (!rating.albumId) return;

          const value = Number(rating.rating ?? rating.score);

          if (Number.isNaN(value)) return;

          if (!map[rating.albumId]) {
            map[rating.albumId] = [];
          }

          map[rating.albumId].push({
            user: displayName(
              rating.user ||
                rating.userName ||
                rating.ratedBy ||
                rating.userEmail
            ),
            value,
          });
        });

        setRatingsByAlbum(map);
      },
      (error) => {
        console.error("Failed to load ratings:", error);
      }
    );

    return () => unsub();
  }, []);

  // Match either generatedDate OR nominationDate against today's day/month
  const matchingAlbums = useMemo(() => {
    return albums
      .map((album) => {
        const relevantDate = getAlbumDate(album);

        if (!relevantDate) return null;

        const parts = getLondonDateParts(relevantDate);

        return {
          album,
          parts,
          relevantDate,
        };
      })
      .filter((item) => {
        if (!item) return false;

        const sameDay =
          item.parts.day === todayParts.day &&
          item.parts.month === todayParts.month;

        // "On This Day" should show previous years, not today's current album
        const previousYear = item.parts.year !== todayParts.year;

        return sameDay && previousYear;
      })
      .sort((a, b) => {
        return (
          Number(b.parts.year) -
          Number(a.parts.year)
        );
      });
  }, [
    albums,
    todayParts.day,
    todayParts.month,
    todayParts.year,
  ]);

  // Use stored website artwork where available.
  // For imported 1001 albums, fetch it live from Last.fm.
  useEffect(() => {
    const loadCovers = async () => {
      for (const item of matchingAlbums) {
        const album = item.album;

        if (coverUrls[album.id] !== undefined) {
          continue;
        }

        if (album.coverUrl) {
          setCoverUrls((prev) => ({
            ...prev,
            [album.id]: album.coverUrl,
          }));
          continue;
        }

        const albumTitle =
          album.title ||
          album.album ||
          "";

        const artist = album.artist || "";

        if (!albumTitle || !artist) {
          setCoverUrls((prev) => ({
            ...prev,
            [album.id]: "",
          }));
          continue;
        }

        const fetchedCover = await fetchCoverUrl(
          artist,
          albumTitle
        );

        setCoverUrls((prev) => ({
          ...prev,
          [album.id]: fetchedCover || "",
        }));
      }
    };

    if (matchingAlbums.length > 0) {
      loadCovers();
    }
  }, [matchingAlbums, coverUrls]);

  return (
    <div style={{ marginTop: 14 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>📅 On This Day</h2>

        <p
          className="smallNote"
          style={{ marginBottom: 0 }}
        >
          Albums from both the 1001 Albums archive and
          previous IA Music Club nominations on{" "}
          <strong>{todayLabel}</strong>
        </p>
      </div>

      {matchingAlbums.length === 0 ? (
        <div
          className="card"
          style={{ marginTop: 12 }}
        >
          <p
            className="smallNote"
            style={{ margin: 0 }}
          >
            Nothing found for this date yet.
          </p>
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
          }}
        >
          {matchingAlbums.map(
            ({ album, parts }) => {
              const ratings =
                ratingsByAlbum[album.id] || [];

              const albumTitle =
                album.title ||
                album.album ||
                "Untitled album";

              const artist =
                album.artist ||
                "Unknown artist";

              const coverUrl =
                coverUrls[album.id] || "";

              const is1001 =
                album.source === "1001_albums";

              const scoreScale = is1001
                ? 5
                : 10;

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
                      border:
                        "1px solid #e5e7eb",
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

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          flex: "1 1 240px",
                          minWidth: 0,
                        }}
                      >
                        <h3
                          style={{
                            margin:
                              "0 0 4px 0",
                            lineHeight: 1.25,
                          }}
                        >
                          {albumTitle}
                        </h3>

                        <p
                          className="smallNote"
                          style={{
                            margin: 0,
                            fontSize: 15,
                          }}
                        >
                          {artist}
                        </p>
                      </div>

                      <span
                        className="badgeFriday"
                        style={{
                          whiteSpace: "nowrap",
                        }}
                      >
                        {parts.year}
                      </span>
                    </div>

                    <div
                      className="smallNote"
                      style={{
                        marginTop: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      {is1001 ? (
                        <>
                          1001 Albums archive ·
                          Generated:{" "}
                          <strong>
                            {parts.day}/
                            {parts.month}/
                            {parts.year}
                          </strong>
                        </>
                      ) : (
                        <>
                          Nominated by{" "}
                          <strong>
                            {displayName(
                              album.nominatedBy
                            )}
                          </strong>
                          {" · "}
                          Nominated:{" "}
                          <strong>
                            {parts.day}/
                            {parts.month}/
                            {parts.year}
                          </strong>
                        </>
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
                        {ratings.map(
                          (rating, index) => (
                            <span
                              key={`${rating.user}-${index}`}
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                gap: 4,
                                padding:
                                  "6px 10px",
                                borderRadius:
                                  999,
                                background:
                                  "#f3f4f6",
                                border:
                                  "1px solid #e5e7eb",
                                fontSize: 13,
                              }}
                            >
                              <strong>
                                {rating.user}
                              </strong>

                              <span>
                                {rating.value}/
                                {scoreScale}
                              </span>
                            </span>
                          )
                        )}
                      </div>
                    ) : (
                      <div
                        className="smallNote"
                        style={{
                          marginTop: 10,
                        }}
                      >
                        No ratings yet
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
