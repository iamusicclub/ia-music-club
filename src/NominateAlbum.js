import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export default function NominateAlbum() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [isTodayNominator, setIsTodayNominator] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    const checkNominator = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const ref = doc(db, "nominationsSchedule", todayStr);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setIsTodayNominator(currentUser?.uid === data.userId);
      } else {
        setIsTodayNominator(false); // No schedule found for today
      }

      setLoading(false);
    };

    if (currentUser) {
      checkNominator();
    }
  }, [currentUser]);

  const fetchCoverUrl = async (artist, album) => {
    const apiKey = "b6ad7c38684dcfba8acbb9b4bb345e86";
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
      artist
    )}&album=${encodeURIComponent(album)}&format=json`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const image = data?.album?.image?.find(
        (img) => img.size === "extralarge"
      );
      return image?.["#text"] || "";
    } catch (error) {
      console.error("Failed to fetch album art", error);
      return "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !artist) {
      alert("Please enter album and artist");
      return;
    }

    try {
      const coverUrl = await fetchCoverUrl(artist, title);

      await addDoc(collection(db, "albums"), {
        title,
        artist,
        coverUrl,
        nominatedBy: currentUser.email,
        nominationDate: serverTimestamp(),
      });

      setTitle("");
      setArtist("");
      alert("Album submitted!");
    } catch (error) {
      console.error("Submission error:", error.message);
      alert("Failed to submit album.");
    }
  };

  if (loading) return <p>Loading nomination form...</p>;

  if (!isTodayNominator) {
    return (
      <div
        style={{
          padding: "1rem",
          backgroundColor: "#fefefe",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      >
        <p>👋 You are not today's nominator.</p>
        <p>Please check back on your assigned day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
      <h3>🎵 Nominate an Album</h3>

      <label>
        Album Title: <br />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <br />
      <br />

      <label>
        Artist: <br />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          required
        />
      </label>
      <br />
      <br />

      <button type="submit">Submit Nomination</button>
    </form>
  );
}
