import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyDgBUVZR-1Dz6RZS8kzD8cxGXFaCWWGKX8",
  authDomain: "runaanime.firebaseapp.com",
  projectId: "runaanime",
  storageBucket: "runaanime.firebasestorage.app",
  messagingSenderId: "521333293493",
  appId: "1:521333293493:web:6ea5e0f8b174c9d776d9fc",
  measurementId: "G-G7Z1YL45E2"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
};
