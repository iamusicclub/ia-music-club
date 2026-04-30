import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

const PARTICIPANTS = {
  Scott: ["Scott", "scottcee01@gmail.com"],
  Matt: ["Matt", "matthodges@outlook.com"],
  Dave: ["Dave", "davews1621@gmail.com"],
  John: ["John", "jfield1968@gmail.com"],
};

const USERS = Object.keys(PARTICIPANTS);

function normaliseIdentity(value) {
  if (!value) return null;

  const clean = String(value).trim().toLowerCase();

  for (const [name, aliases] of Object.entries(PARTICIPANTS)) {
    if (aliases.some((alias) => alias.toLowerCase() === clean)) {
      return name;
    }
  }

  return null;
}

export default function TasteMap() {
  const [matrix, setMatrix] = useState({});

  useEffect(() => {
    let albums = [];
    let ratings = [];

    const buildMatrix = (currentAlbums, currentRatings) => {
      if (!currentAlbums.length || !currentRatings.length) return;

      const albumMap = {};

      currentAlbums.forEach((album) => {
        albumMap[album.id] = album;
      });

      const temp = {};

      USERS.forEach((rater) => {
        temp[rater] = {};
        USERS.forEach((nominator) => {
          temp[rater][nominator] = [];
        });
      });

      currentRatings.forEach((ratingDoc) => {
        const album = albumMap[ratingDoc.albumId];
        if (!album) return;

        const rater = normaliseIdentity(
          ratingDoc.user || ratingDoc.userName || ratingDoc.ratedBy
        );

        const nominator = normaliseIdentity(album.nominatedBy);

        if (!rater || !nominator) return;
        if (!temp[rater] || !temp[rater][nominator]) return;

        const rawValue = Number(ratingDoc.rating ?? ratingDoc.score);
        if (Number.isNaN(rawValue)) return;

        const normalisedValue =
          album.source === "1001_albums" ? rawValue * 2 : rawValue;

        temp[rater][nominator].push(normalisedValue);
      });

      const result = {};

      USERS.forEach((rater) => {
        result[rater] = {};

        USERS.forEach((nominator) => {
          const scores = temp[rater][nominator];

          if (!scores.length) {
            result[rater][nominator] = {
              average: null,
              count: 0,
            };
          } else {
            const average =
              scores.reduce((sum, value) => sum + value, 0) / scores.length;

            result[rater][nominator] = {
              average,
              count: scores.length,
            };
          }
        });
      });

      setMatrix(result);
    };

    const unsubAlbums = onSnapshot(collection(db, "albums"), (snapshot) => {
      albums = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      buildMatrix(albums, ratings);
    });

    const unsubRatings = onSnapshot(collection(db, "ratings"), (snapshot) => {
      ratings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      buildMatrix(albums, ratings);
    });

    return () => {
      unsubAlbums();
      unsubRatings();
    };
  }, []);

  const getColor = (average) => {
    if (average === null || average === undefined) return "#f3f4f6";

    const capped = Math.max(0, Math.min(10, average));

    const red = Math.round(255 - (capped / 10) * 120);
    const green = Math.round(120 + (capped / 10) * 120);
    const blue = 140;

    return `rgb(${red}, ${green}, ${blue})`;
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🎨 Taste Map</h2>
        <p className="smallNote" style={{ marginBottom: 0 }}>
          Average rating given by each person to each nominator. Website email
          accounts and 1001 archive names are merged into the same four
          participant names.
        </p>
      </div>

      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: 520,
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Rater ↓ / Nominator →</th>
              {USERS.map((user) => (
                <th key={user} style={thStyle}>
                  {user}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {USERS.map((rater) => (
              <tr key={rater}>
                <td style={rowHeaderStyle}>
                  <strong>{rater}</strong>
                </td>

                {USERS.map((nominator) => {
                  const cell = matrix?.[rater]?.[nominator];
                  const average = cell?.average ?? null;
                  const count = cell?.count ?? 0;

                  const tooltip =
                    average === null
                      ? `${rater} has not rated any of ${nominator}'s nominations yet.`
                      : `${rater} gives ${nominator}'s nominations an average of ${average.toFixed(
                          1
                        )}/10 across ${count} rating${
                          count === 1 ? "" : "s"
                        }.`;

                  return (
                    <td
                      key={nominator}
                      title={tooltip}
                      style={{
                        ...cellStyle,
                        background: getColor(average),
                      }}
                    >
                      {average === null ? (
                        <span style={{ color: "#6b7280" }}>—</span>
                      ) : (
                        <>
                          <strong>{average.toFixed(1)}</strong>
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 500,
                              marginTop: 2,
                            }}
                          >
                            {count} rating{count === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="smallNote" style={{ marginTop: 12, marginBottom: 0 }}>
          Note: the rater/nominator heatmap only includes albums nominated by a
          named club member. 1001 archive scores are normalised and can be used
          in future taste-analysis views, but they do not have a club nominator.
        </p>
      </div>
    </div>
  );
}

const thStyle = {
  padding: "10px 8px",
  textAlign: "center",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
};

const rowHeaderStyle = {
  padding: "10px 8px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const cellStyle = {
  padding: "12px 8px",
  textAlign: "center",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
  borderRadius: 6,
  cursor: "help",
};
