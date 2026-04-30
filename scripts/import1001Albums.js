const admin = require("firebase-admin");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const csvPath = path.join(__dirname, "../data/1001albums.csv");
const rows = [];

fs.createReadStream(csvPath)
  .pipe(csv())
  .on("data", (data) => rows.push(data))
  .on("end", async () => {
    console.log(`Processing ${rows.length} rows...`);

    for (const row of rows) {
      const artist = row["Artist"]?.trim();
      const album = row["Album"]?.trim();
      const dateText = row["Generated Date"]?.trim();

      if (!artist || !album || !dateText) {
        console.log("Skipping row:", row);
        continue;
      }

      const [day, month, year] = dateText.split("/").map(Number);

      const albumRef = await db.collection("albums").add({
        artist,
        album,
        generatedDate: admin.firestore.Timestamp.fromDate(
          new Date(Date.UTC(year, month - 1, day))
        ),
        generatedDay: day,
        generatedMonth: month,
        source: "1001_albums",
      });

      const ratings = [
        { user: "Scott", value: row["Scott Rating"] },
        { user: "Matt", value: row["Matt Rating"] },
        { user: "Dave", value: row["Dave Rating"] },
        { user: "John", value: row["John rating"] },
      ];

      for (const r of ratings) {
        if (r.value !== undefined && r.value !== "") {
          await db.collection("ratings").add({
            albumId: albumRef.id,
            user: r.user,
            rating: Number(r.value),
            source: "1001_albums",
          });
        }
      }

      console.log(`Imported: ${artist} - ${album}`);
    }

    console.log("Import complete.");
  });
