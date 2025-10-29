import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCbRSYJkSTe3vqKz71bU6yMyR493PE63yA",
  authDomain: "capstone-765-bd2ce.firebaseapp.com",
  databaseURL: "https://capstone-765-bd2ce-default-rtdb.firebaseio.com",
  projectId: "capstone-765-bd2ce",
  storageBucket: "capstone-765-bd2ce.firebasestorage.app",
  messagingSenderId: "484950060196",
  appId: "1:484950060196:web:0e9d398ef40b6c50a68a31"
};

    
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
