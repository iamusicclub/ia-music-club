import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

const WEBSITE_SEASON_START = new Date(Date.UTC(2025, 4, 30)); // 30 May 2025
const WEBSITE_SEASON_END_DAY_OFFSET = -1;

const classicAlbums1001 = [
  {
    album: "Revolver",
    artist: "The Beatles",
    score: "5.00/5",
  },
  {
    album: "Sgt. Pepper's Lonely Hearts Club Band",
    artist: "The Beatles",
    score: "5.00/5",
  },
  {
    album: "The Stone Roses",
    artist: "The Stone Roses",
    score: "5.00/5",
  },
  {
    album: "The Queen Is Dead",
    artist: "The Smiths",
    score: "4.75/5",
  },
  {
    album: "Astral Weeks",
    artist: "Van Morrison",
    score: "4.75/5",
  },
  {
    album: "Moondance",
    artist: "Van Morrison",
    score: "4.75/5",
  },
  {
    album: "OK Computer",
    artist: "Radiohead",
    score: "4.75/5",
  },
  {
    album: "Tapestry",
    artist: "Carole King",
    score: "4.75/5",
  },
];

const iamcAlbumsOfTheYear = [
  {
    year: 2021,
    album: "As Days Get Dark",
    artist: "Arab Strap",
  },
  {
    year: 2022,
    album: "Autofiction",
    artist: "Suede",
  },
  {
    year: 2023,
    album: "Late Developers",
    artist: "Belle and Sebastian",
  },
  {
    year: 2024,
    album: "Nobody Loves You More",
    artist: "Kim Deal",
  },
  {
    year: 2025,
    album: "Alan Sparhawk with Trampled by Turtles",
    artist: "Alan Sparhawk",
    note: "Joint winner",
  },
  {
    year: 2025,
    album: "Sharon Van Etten & The Attachment Theory",
    artist: "Sharon Van Etten",
    note: "Joint winner",
  },
];

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

function addYears(date, years) {
  const copy = new Date(date);
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

function getSeasonInfo(date) {
  if (!date) return null;

  let index = 0;
  let start = new Date(WEBSITE_SEASON_START);
  let end = addYears(start, 1);

  end.setUTCDate(end.getUTCDate() + WEBSITE_SEASON_END_DAY_OFFSET);

  while (date >= end) {
    index += 1;
    start = addYears(WEBSITE_SEASON_START, index);
    end = addYears(WEBSITE_SEASON_START, index + 1);
    end.setUTCDate(end.getUTCDate() + WEBSITE_SEASON_END_DAY_OFFSET);
  }

  const startYear = start.getUTCFullYear();
  const endYearShort = String(end.getUTCFullYear()).slice(-2);

  return {
    key: `${startYear}-${end.getUTCFullYear()}`,
    label: `${startYear}–${endYearShort}`,
    start,
    end,
    isClosed: new Date() >= end,
  };
}

function formatDate(value) {
  if (!value) return "";

  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function WinnerCard({ item, coverUrl, badge }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 12,
        background: "#fff",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
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
            alt={`${item.album} cover`}
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
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>{item.album}</strong>
            <div className="smallNote" style={{ marginTop: 4 }}>
              {item.artist}
            </div>
          </div>

          {badge ? (
            <span className="badgeFriday" style={{ whiteSpace: "nowrap" }}>
              {badge}
            </span>
          ) : null}
        </div>

        {item.extra ? (
          <div className="smallNote" style={{ marginTop: 8 }}>
            {item.extra}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function HallOfFame() {
  const [albums, setAlbums] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [coverUrls, setCoverUrls] = useState({});

  useEffect(() => {
    const unsubAlbums = onSnapshot(collection(db, "albums"), (snapshot) => {
      setAlbums(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubRatings = onSnapshot(collection(db, "ratings"), (snapshot) => {
      setRatings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubAlbums();
      unsubRatings();
    };
  }, []);

  const websiteSeasonWinners = useMemo(() => {
    const ratingsByAlbum = {};

    ratings.forEach((rating) => {
      const albumId = rating.albumId;
      const score = Number(rating.score ?? rating.rating);

      if (!albumId || Number.isNaN(score)) return;

      if (!ratingsByAlbum[albumId]) ratingsByAlbum[albumId] = [];
      ratingsByAlbum[albumId].push(score);
    });

    const seasonBuckets = {};

    albums.forEach((album) => {
      if (album.source === "1001_albums") return;

      const nominationDate = album.nominationDate?.toDate?.();
      if (!nominationDate) return;

      if (nominationDate < WEBSITE_SEASON_START) return;

      const season = getSeasonInfo(nominationDate);
      if (!season) return;

      const albumRatings = ratingsByAlbum[album.id] || [];
      if (albumRatings.length === 0) return;

      const average =
        albumRatings.reduce((sum, value) => sum + value, 0) /
        albumRatings.length;

      if (!seasonBuckets[season.key]) {
        seasonBuckets[season.key] = {
          ...season,
          albums: [],
        };
      }

      seasonBuckets[season.key].albums.push({
        id: album.id,
        album: album.title || album.album || "Untitled album",
        artist: album.artist || "Unknown artist",
        coverUrl: album.coverUrl || "",
        average,
        ratingCount: albumRatings.length,
        nominationDate,
      });
    });

    return Object.values(seasonBuckets)
      .map((season) => {
        const sorted = [...season.albums].sort((a, b) => {
          if (b.average !== a.average) return b.average - a.average;
          return b.ratingCount - a.ratingCount;
        });

        return {
          ...season,
          winner: sorted[0],
        };
      })
      .filter((season) => season.winner)
      .sort((a, b) => a.start - b.start);
  }, [albums, ratings]);

  useEffect(() => {
    const staticItems = [...classicAlbums1001, ...iamcAlbumsOfTheYear];
    const dynamicItems = websiteSeasonWinners.map((season) => season.winner);
    const allItems = [...staticItems, ...dynamicItems];

    const loadCovers = async () => {
      for (const item of allItems) {
        const key = `${item.artist}__${item.album}`;

        if (coverUrls[key]) continue;

        if (item.coverUrl) {
          setCoverUrls((prev) => ({
            ...prev,
            [key]: item.coverUrl,
          }));
          continue;
        }

        const fetched = await fetchCoverUrl(item.artist, item.album);

        if (fetched) {
          setCoverUrls((prev) => ({
            ...prev,
            [key]: fetched,
          }));
        }
      }
    };

    if (allItems.length > 0) {
      loadCovers();
    }
  }, [websiteSeasonWinners, coverUrls]);

  const getCover = (item) => {
    const key = `${item.artist}__${item.album}`;
    return item.coverUrl || coverUrls[key] || "";
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🏆 Hall of Fame</h2>
        <p className="smallNote" style={{ marginBottom: 0 }}>
          IAMC annual winners, 1001 archive favourites and website nomination
          champions.
        </p>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>📚 1001 Albums Classics</h3>
        <p className="smallNote">
          Albums from the 1001 Albums project with a group average of 4.75/5 or
          higher.
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {classicAlbums1001.map((item) => (
            <WinnerCard
              key={`${item.artist}-${item.album}`}
              item={{
                ...item,
                extra:
                  item.score === "5.00/5"
                    ? "1001 albums to hear before you die"
                    : "1001 albums to hear before you die",
              }}
              coverUrl={getCover(item)}
              badge={item.score}
            />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>🎧 IAMC Album of the Year</h3>
        <p className="smallNote">
          IAMC annual best albums.
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {iamcAlbumsOfTheYear.map((item, idx) => (
            <WinnerCard
              key={`${item.year}-${item.album}-${idx}`}
              item={{
                ...item,
                extra: item.note
                  ? `${item.year} · ${item.note}`
                  : `${item.year} winner`,
              }}
              coverUrl={getCover(item)}
              badge={String(item.year)}
            />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>🌟 Website Nomination Winners</h3>
        <p className="smallNote">
          Highest-rated album from each website nomination year.
        </p>

        {websiteSeasonWinners.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
              marginTop: 12,
            }}
          >
            <strong>No website winners yet</strong>
            <p className="smallNote" style={{ margin: "6px 0 0 0" }}>
              Once enough nominated albums have ratings, this section will show
              the highest-rated album for each completed season.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {websiteSeasonWinners.map((season) => {
              const winner = season.winner;

              return (
                <WinnerCard
                  key={season.key}
                  item={{
                    ...winner,
                    extra: `${season.isClosed ? "Winner" : "Current leader"} · ${
                      winner.average.toFixed(1)
                    }/10 from ${winner.ratingCount} rating${
                      winner.ratingCount === 1 ? "" : "s"
                    } · Nominated ${formatDate(winner.nominationDate)}`,
                  }}
                  coverUrl={getCover(winner)}
                  badge={season.label}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
