// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration will be received from main thread
let firebaseConfig = null;
let messaging = null;
let clientOrigins = null;
let currentOrigin = null;

// Listen for messages from main thread to receive Firebase config
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    clientOrigins = event.data.clientOrigins;
    currentOrigin = event.data.currentOrigin;
    console.log('[SW] Received Firebase config:', firebaseConfig?.projectId || 'No config');
    console.log('[SW] Supported client origins:', clientOrigins);
    console.log('[SW] Current origin:', currentOrigin);
    
    // Initialize Firebase with received config
    initializeFirebase();
  }
});

// Get the correct base URL for the client
function getClientBaseUrl() {
  // If we have the current origin from the main thread, use it
  if (currentOrigin) {
    return currentOrigin;
  }
  
  // Use any provided client origins, prefer the first one or match current hostname
  if (clientOrigins) {
    const originsArray = clientOrigins.split(',').map(o => o.trim());
    const hostname = self.location.hostname;
    
    // Try to match current hostname with one of the origins
    for (const origin of originsArray) {
      if (origin.includes(hostname)) {
        return origin;
      }
    }
    
    // If no match, use the first origin
    return originsArray[0];
  }
  
  // Fallback: detect if we're on localhost or deployed
  const hostname = self.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
    return 'http://localhost:5173';
  } else if (hostname.includes('vercel.app')) {
    return 'https://event-monitoring-omega.vercel.app';
  } else if (hostname.includes('askarthikey.tech')) {
    return 'https://event-monitor.askarthikey.tech';
  } else {
    // Generic fallback
    return self.location.origin;
  }
}

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
      data: {
        ...payload.data,
        clientOrigins: clientOrigins, // Store supported client origins
        currentOrigin: getClientBaseUrl() // Store the correct client URL
      },
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

  // Get the base URL, prefer currentOrigin from notification data, then fallback
  const baseUrl = event.notification.data?.currentOrigin || 
                  event.notification.data?.clientOrigins?.split(',')[0]?.trim() || 
                  getClientBaseUrl();
  console.log('[SW] Using base URL for navigation:', baseUrl);

  if (event.action === 'view') {
    // Open the app to the specific event
    const eventId = event.notification.data?.eventId;
    const url = eventId ? `${baseUrl}/events/${eventId}/chat` : `${baseUrl}/events`;
    
    console.log('[SW] Opening URL:', url);
    event.waitUntil(
      clients.openWindow(url)
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    const url = `${baseUrl}/events`;
    console.log('[SW] Opening default URL:', url);
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});
