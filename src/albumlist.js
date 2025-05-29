import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function AlbumList() {
  const [albums, setAlbums] = useState([]);

  useEffect(() => {
    const ref = collection(db, "albums");
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const albumData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAlbums(albumData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h2>Album Nominations</h2>
      {albums.length === 0 && <p>No nominations yet.</p>}
      {albums.map((album) => (
        <div
          key={album.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          {album.coverUrl && (
            <img
              src={album.coverUrl}
              alt={`${album.title} cover`}
              style={{
                width: "100px",
                height: "100px",
                objectFit: "cover",
                marginRight: "10px",
              }}
            />
          )}
          <div>
            <strong>{album.title}</strong> by {album.artist}
            <br />
            Nominated by: <code>{album.nominatedBy}</code>
            <br />
            {album.nominationDate?.toDate && (
              <small>
                Nominated on: {album.nominationDate.toDate().toLocaleString()}
              </small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
