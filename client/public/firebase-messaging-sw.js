// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

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
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'AI Event Monitor Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'New event notification',
    icon: '/firebase-logo.png', // Add your app icon
    badge: '/badge-icon.png', // Add your badge icon
    tag: 'ai-event-notification',
    data: payload.data,
    actions: [
      {
        action: 'view',
        title: 'View Event',
        icon: '/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/dismiss-icon.png'
      }
    ],
    requireInteraction: true, // Keep notification until user interacts
    silent: false,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  if (event.action === 'view') {
    // Open the app to the specific event
    const eventId = event.notification.data?.eventId;
    const url = eventId ? `/events/${eventId}/chat` : '/events';
    
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
});
