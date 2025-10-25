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
  // ALWAYS prioritize deployed sites over localhost
  const hostname = self.location.hostname;
  
  console.log('[SW] Detecting hostname:', hostname);
  console.log('[SW] Full location:', self.location.href);
  console.log('[SW] Current origin from main thread:', currentOrigin);
  console.log('[SW] Client origins from env:', clientOrigins);
  
  // First priority: Use currentOrigin if it's a deployed URL (not localhost)
  if (currentOrigin && !currentOrigin.includes('localhost')) {
    console.log('[SW] Using current origin (deployed):', currentOrigin);
    return currentOrigin;
  }
  
  // Second priority: Match hostname with deployed domains (custom domain first)
  if (hostname.includes('askarthikey.tech')) {
    console.log('[SW] Detected custom domain deployment (priority)');
    return 'https://event-monitor.askarthikey.tech';
  }
  
  if (hostname.includes('vercel.app')) {
    console.log('[SW] Detected Vercel deployment');
    return 'https://event-monitoring-omega.vercel.app';
  }
  
  // Third priority: Parse client origins for deployed URLs
  if (clientOrigins) {
    const originsArray = clientOrigins.split(',').map(o => o.trim());
    console.log('[SW] Available origins:', originsArray);
    
    // Find any deployed URL (not localhost)
    for (const origin of originsArray) {
      if (!origin.includes('localhost') && (origin.includes('https://') || origin.includes('http://'))) {
        console.log('[SW] Using first deployed origin:', origin);
        return origin;
      }
    }
  }
  
  // Fourth priority: Hard-coded deployed URLs (safety net) - custom domain first
  if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
    if (hostname.includes('askarthikey')) {
      console.log('[SW] Fallback to custom domain URL (priority)');
      return 'https://event-monitor.askarthikey.tech';
    }
    if (hostname.includes('vercel') || hostname.includes('event-monitoring')) {
      console.log('[SW] Fallback to Vercel URL');
      return 'https://event-monitoring-omega.vercel.app';
    }
  }
  
  // LAST resort: Only use localhost if we're actually on localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[SW] Using localhost (development mode)');
    return 'http://localhost:5173';
  }
  
  // Ultimate fallback: Use first deployed URL (custom domain priority)
  console.log('[SW] Ultimate fallback to custom domain URL');
  return 'https://event-monitor.askarthikey.tech';
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
    console.log('[SW] Payload data:', payload.data);
    
    // Determine the correct URL for this notification
    const deployedUrl = payload.data?.forceDeployedUrl || 
                       getClientBaseUrl();
    
    console.log('[SW] Using deployed URL for notification:', deployedUrl);
    
    const notificationTitle = payload.notification?.title || 'AI Event Monitor Alert';
    const notificationOptions = {
      body: payload.notification?.body || 'New event notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'ai-event-notification',
      data: {
        ...payload.data,
        clientOrigins: clientOrigins,
        currentOrigin: deployedUrl, // Use deployed URL
        forceDeployedUrl: payload.data?.forceDeployedUrl || 'https://event-monitor.askarthikey.tech'
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

    console.log('[SW] Notification options data:', notificationOptions.data);
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  console.log('[SW] Notification data:', event.notification.data);

  event.notification.close();

  // Get the base URL with multiple fallbacks, NEVER use localhost for deployed notifications
  let baseUrl = null;
  
  // Priority 1: Use forceDeployedUrl from server (always deployed URL)
  if (event.notification.data?.forceDeployedUrl) {
    baseUrl = event.notification.data.forceDeployedUrl;
    console.log('[SW] Using forced deployed URL:', baseUrl);
  }
  // Priority 2: Use currentOrigin if it's not localhost
  else if (event.notification.data?.currentOrigin && !event.notification.data.currentOrigin.includes('localhost')) {
    baseUrl = event.notification.data.currentOrigin;
    console.log('[SW] Using current origin (non-localhost):', baseUrl);
  }
  // Priority 3: Parse clientOrigins for deployed URLs
  else if (event.notification.data?.clientOrigins) {
    const origins = event.notification.data.clientOrigins.split(',').map(o => o.trim());
    for (const origin of origins) {
      if (!origin.includes('localhost')) {
        baseUrl = origin;
        console.log('[SW] Using client origin (non-localhost):', baseUrl);
        break;
      }
    }
  }
  
  // Priority 4: Use getClientBaseUrl() but ensure it's not localhost
  if (!baseUrl) {
    baseUrl = getClientBaseUrl();
    if (baseUrl.includes('localhost')) {
      baseUrl = 'https://event-monitor.askarthikey.tech'; // Force custom domain as priority
      console.log('[SW] Forced custom domain URL as fallback:', baseUrl);
    }
  }

  console.log('[SW] Final base URL for navigation:', baseUrl);

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
