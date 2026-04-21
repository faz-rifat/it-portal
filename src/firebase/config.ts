/**
 * Firebase Configuration
 * 
 * In production (Vercel), these values must be added to Environment Variables.
 * In development, defaults are provided from the ITO-Management-Portal project.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC1DMl2Lxds7WiwZtY6O5G95V3J1P12Hjg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ito-management-portal.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ito-management-portal",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ito-management-portal.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "71593926838",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:71593926838:web:855dd08538b3234dcf0617",
};
