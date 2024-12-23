import firebase from "firebase/compat/app";
import "firebase/compat/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCtG7Ax8DuD9NMtrsWw77Y1Un0dRHuQ-Fc",
  authDomain: "fast-cure-pharma-storage.firebaseapp.com",
  projectId: "fast-cure-pharma-storage",
  storageBucket: "fast-cure-pharma-storage.firebasestorage.app",
  messagingSenderId: "1077374136103",
  appId: "1:1077374136103:web:b23dc4b60664ddadfc4302",
};

// -- Initialize Firebase
firebase.initializeApp(firebaseConfig);
export const storageRef = firebase.storage().ref();
export default firebase;
