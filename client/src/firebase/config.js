// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqHA-YZeimyr4pGHjuj_Iw8tqlOu_M0PI",
  authDomain: "aeman-b14d6.firebaseapp.com",
  projectId: "aeman-b14d6",
  storageBucket: "aeman-b14d6.firebasestorage.app",
  messagingSenderId: "255778871842",
  appId: "1:255778871842:web:3420864363a7457c17887b",
  measurementId: "G-Y6NSGEE2VV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.log('Firebase messaging not available:', error.message);
}

// Vapid key for web push notifications
const vapidKey = "BDp_ZAdWjQKN_HOyI21VCRuSY8WOUZOXfDMF9_T8-7hg9DiJOYN6tVsPkabx5UMqmX6oi0mBSlzgxFRCFPw4j7A";

export { messaging, vapidKey };
export default app;
