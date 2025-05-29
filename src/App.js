import { useState, useEffect } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import NominateAlbum from "./NominateAlbum";
import AlbumList from "./AlbumListNew";
// import GenerateSchedule from "./GenerateSchedule"; // Only needed temporarily

function App() {
  const [user, setUser] = useState(null);
  const [todaysNominator, setTodaysNominator] = useState(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Fetch today's nominator from Firestore
  useEffect(() => {
    const fetchNominator = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const ref = doc(db, "nominationsSchedule", todayStr);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setTodaysNominator(snap.data().userEmail);
      } else {
        setTodaysNominator("No nominator scheduled for today");
      }
    };

    fetchNominator();
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
      <h2>🎤 Today's Nominator:</h2>
      <p>
        <strong>{todaysNominator || "Loading..."}</strong>
      </p>

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
