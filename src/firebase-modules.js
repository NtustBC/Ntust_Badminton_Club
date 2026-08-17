import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";

export {
  browserLocalPersistence,
  collection,
  createUserWithEmailAndPassword,
  deleteDoc,
  doc,
  getAuth,
  getDoc,
  getDocs,
  getFirestore,
  getFunctions,
  initializeApp,
  initializeAppCheck,
  httpsCallable,
  onAuthStateChanged,
  query,
  ReCaptchaEnterpriseProvider,
  serverTimestamp,
  setDoc,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
  where,
  writeBatch,
};
