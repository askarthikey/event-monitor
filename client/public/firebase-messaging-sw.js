// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration will be received from main thread
let firebaseConfig = null;
let messaging = null;

// Listen for messages from main thread to receive Firebase config
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    console.log('[SW] Received Firebase config:', firebaseConfig?.projectId || 'No config');
    
    // Initialize Firebase with received config
    initializeFirebase();
  }
});

// Initialize Firebase
function initializeFirebase() {
  if (!firebaseConfig) {
    console.error('[SW] No Firebase config available');
    return;
  }
  
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('[SW] Firebase initialized successfully');
    }
    
    // Initialize Firebase Cloud Messaging
    messaging = firebase.messaging();
    
    // Set up background message handler
    setupBackgroundMessageHandler();
    
  } catch (error) {
    console.error('[SW] Error initializing Firebase:', error);
  }
}

// Setup background message handler
function setupBackgroundMessageHandler() {
  if (!messaging) {
    console.warn('[SW] Messaging not initialized');
    return;
  }
  
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
}

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
