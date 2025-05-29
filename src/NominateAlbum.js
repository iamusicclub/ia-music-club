import { useState } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function NominateAlbum() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to nominate an album.");
      return;
    }

    try {
      await addDoc(collection(db, "albums"), {
        title,
        artist,
        coverUrl,
        nominatedBy: user.uid,
        nominationDate: serverTimestamp(),
      });

      alert("Album nominated!");
      setTitle("");
      setArtist("");
      setCoverUrl("");
    } catch (error) {
      console.error("Error adding album:", error);
      alert("Something went wrong.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Nominate an Album</h2>
      <input
        type="text"
        placeholder="Album Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Artist"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        required
      />
      <input
        type="url"
        placeholder="Cover Image URL (optional)"
        value={coverUrl}
        onChange={(e) => setCoverUrl(e.target.value)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
