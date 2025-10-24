/**
 * Dynamic Firebase Service Worker Generator
 * This generates the service worker with the correct Firebase configuration
 * based on environment variables
 */

export const generateServiceWorkerConfig = () => {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  };

  return `// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration from environment variables
const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};

console.log('[SW] Initializing with config for project:', firebaseConfig.projectId);

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log('[SW] Firebase initialized successfully');
} catch (error) {
  console.error('[SW] Error initializing Firebase:', error);
}

// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'AI Event Monitor Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'New event notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'ai-event-notification',
    data: payload.data,
    actions: [
      {
        action: 'view',
        title: 'View Event',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      }
    ],
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');

  event.notification.close();

  if (event.action === 'view') {
    // Open the app to the specific event
    const eventId = event.notification.data?.eventId;
    const url = eventId ? \`/events/\${eventId}/chat\` : '/events';
    
    event.waitUntil(
      clients.openWindow(url)
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/events')
    );
  }
});`;
};

export const validateFirebaseConfig = () => {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  const missing = requiredVars.filter(varName => !import.meta.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing Firebase environment variables:', missing);
    return false;
  }
  
  console.log('✅ All Firebase environment variables are set');
  return true;
};