// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('🔥 Firebase Config Debug:', {
  apiKey: firebaseConfig.apiKey ? '✅ Set' : '❌ Missing',
  authDomain: firebaseConfig.authDomain ? '✅ Set' : '❌ Missing',
  projectId: firebaseConfig.projectId ? '✅ Set' : '❌ Missing',
  storageBucket: firebaseConfig.storageBucket ? '✅ Set' : '❌ Missing',
  messagingSenderId: firebaseConfig.messagingSenderId ? '✅ Set' : '❌ Missing',
  appId: firebaseConfig.appId ? '✅ Set' : '❌ Missing',
  actualProjectId: firebaseConfig.projectId
});

// Validate required fields
if (!firebaseConfig.projectId || !firebaseConfig.apiKey || !firebaseConfig.appId) {
  console.error('❌ Firebase configuration is incomplete:', firebaseConfig);
  throw new Error('Missing required Firebase configuration values');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging = null;
try {
  messaging = getMessaging(app);
  console.log('✅ Firebase messaging initialized successfully');
} catch (error) {
  console.error('❌ Firebase messaging not available:', error.message);
}

// Vapid key for web push notifications
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

console.log('🔑 VAPID Key Status:', vapidKey ? '✅ Set' : '❌ Missing');

export { messaging, vapidKey };
export default app;
