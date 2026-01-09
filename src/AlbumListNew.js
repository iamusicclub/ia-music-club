import { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

function formatLondonDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

function toDateKeyFromTimestamp(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return formatLondonDateKey(d);
}

async function fetchTracksFromLastFM(artist, album) {
  const apiKey = "b6ad7c38684dcfba8acbb9b4bb345e86";
  const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(
    artist
  )}&album=${encodeURIComponent(album)}&format=json`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const rawTracks = data?.album?.tracks?.track;
    const arr = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];

    return arr
      .map((t) => (typeof t?.name === "string" ? t.name.trim() : ""))
      .filter(Boolean);
  } catch (e) {
    console.error("Failed to fetch tracks from Last.fm:", e?.message || e);
    return [];
  }
}

export default function AlbumListNew() {
  const [albums, setAlbums] = useState([]);
  const [ratingsByAlbum, setRatingsByAlbum] = useState({});
  const [allRatings, setAllRatings] = useState([]);

  const [ratingsDraft, setRatingsDraft] = useState({});
  const [feedback, setFeedback] = useState({});

  const [minRating, setMinRating] = useState(0);
  const [nominators, setNominators] = useState([]);
  const [selectedNominator, setSelectedNominator] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest"); // newest | rating

  const [expanded, setExpanded] = useState({}); // albumId -> boolean

  const user = auth.currentUser;
  const todayKey = useMemo(() => formatLondonDateKey(), []);

  // Load albums (newest first)
  useEffect(() => {
    const qAlbums = query(collection(db, "albums"), orderBy("nominationDate", "desc"));
    const unsub = onSnapshot(qAlbums, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Unique nominators
      const uniqueNominators = Array.from(
        new Set(data.map((a) => a
