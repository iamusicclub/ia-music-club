import { useState, useEffect } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import NominateAlbum from "./NominateAlbum";
import AlbumList from "./AlbumList"; // Ensure correct case

function App() {
  const [user, setUser] = useState(null);

  // Enable persistent login
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("🔒 Persistent login enabled");
      })
      .catch((error) => {
        console.error("❌ Persistence error:", error.message);
      });
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const login = async () => {
    const email = prompt("Enter your email");
    const password = prompt("Enter your password");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <div style={{ padding: 20 }}>
      {user ? (
        <>
          <p>Hello, {user.email}</p>
          <NominateAlbum />
          <AlbumList />
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={login}>Login</button>
      )}
    </div>
  );
}

export default App;
