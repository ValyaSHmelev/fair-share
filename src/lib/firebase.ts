import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

// Ваша конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAGzc5xQaVo4hfkzJ7SuqlmFadQVojEDJQ",
    authDomain: "fair-share-web.firebaseapp.com",
    projectId: "fair-share-web",
    storageBucket: "fair-share-web.firebasestorage.app",
    messagingSenderId: "873435158111",
    appId: "1:873435158111:web:ba99175cb845949f83edea",
    measurementId: "G-NJJ8PSB1CN"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const analytics = getAnalytics(app)
export const db = getFirestore(app)
export const auth = getAuth(app)