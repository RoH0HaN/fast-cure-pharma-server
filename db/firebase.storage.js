import firebase from "firebase/compat/app";
import "firebase/compat/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA1SX5VE4gPyt9EKHDnt2U8KsyrrhfhlT0",
  authDomain: "fir-310d6.firebaseapp.com",
  databaseURL: "https://fir-310d6-default-rtdb.firebaseio.com",
  projectId: "fir-310d6",
  storageBucket: "fir-310d6.appspot.com",
  messagingSenderId: "1014257585836",
  appId: "1:1014257585836:web:f64796799a1c3788069909",
  measurementId: "G-DQPM77WR3P",
};

// -- Initialize Firebase
firebase.initializeApp(firebaseConfig);
export const storageRef = firebase.storage().ref();
export default firebase;
