// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// SERVICE WORKER VERSION - Update this to force cache refresh
const SW_VERSION = '2.1.0';
console.log('[SW] 🚀🚀🚀 Service Worker Version:', SW_VERSION, '🚀🚀🚀');
console.log('[SW] 📍 Service Worker Location:', self.location.href);
console.log('[SW] 🌐 Service Worker Hostname:', self.location.hostname);

// HARD-CODED DEPLOYED URLS - NEVER USE LOCALHOST IN PRODUCTION
const DEPLOYED_URLS = {
  PRIMARY: 'https://event-monitor.askarthikey.tech',
  SECONDARY: 'https://event-monitoring-omega.vercel.app',
  LOCAL: 'http://localhost:5173'
};

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

// Get the correct base URL for the client - ALWAYS PREFER DEPLOYED OVER LOCALHOST
function getClientBaseUrl() {
  const hostname = self.location.hostname;
  
  console.log('[SW] ========================================');
  console.log('[SW] ===== URL DETECTION START =====');
  console.log('[SW] ========================================');
  console.log('[SW] Hostname:', hostname);
  console.log('[SW] Location:', self.location.href);
  console.log('[SW] Protocol:', self.location.protocol);
  console.log('[SW] Port:', self.location.port);
  
  // Check if we're actually running on localhost
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     hostname === '0.0.0.0';
  
  console.log('[SW] Is Localhost:', isLocalhost);
  console.log('[SW] Hostname includes "askarthikey.tech":', hostname.includes('askarthikey.tech'));
  console.log('[SW] Hostname includes "vercel.app":', hostname.includes('vercel.app'));
  
  let selectedUrl = null;
  
  // If we're on localhost, use local URL
  if (isLocalhost) {
    selectedUrl = DEPLOYED_URLS.LOCAL;
    console.log('[SW] ✅ DECISION: Using LOCALHOST URL');
  }
  // If hostname contains custom domain, use it
  else if (hostname.includes('askarthikey.tech')) {
    selectedUrl = DEPLOYED_URLS.PRIMARY;
    console.log('[SW] ✅ DECISION: Using CUSTOM DOMAIN (askarthikey.tech)');
  }
  // If hostname contains vercel, use vercel URL
  else if (hostname.includes('vercel.app') || hostname.includes('event-monitoring-omega')) {
    selectedUrl = DEPLOYED_URLS.SECONDARY;
    console.log('[SW] ✅ DECISION: Using VERCEL URL');
  }
  // DEFAULT: Always use primary deployed URL for any other case
  else {
    selectedUrl = DEPLOYED_URLS.PRIMARY;
    console.log('[SW] ✅ DECISION: Using DEFAULT DEPLOYED URL (custom domain)');
  }
  
  console.log('[SW] 🎯 SELECTED URL:', selectedUrl);
  console.log('[SW] ========================================');
  
  return selectedUrl;
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
    console.log('[SW] ===== BACKGROUND MESSAGE RECEIVED =====');
    console.log('[SW] Payload:', payload);
    
    // ALWAYS use the detected URL based on where service worker is running
    const targetUrl = getClientBaseUrl();
    
    console.log('[SW] Target URL for notification:', targetUrl);
    
    const notificationTitle = payload.notification?.title || 'AI Event Monitor Alert';
    const notificationOptions = {
      body: payload.notification?.body || 'New event notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'ai-event-notification',
      data: {
        ...payload.data,
        targetUrl: targetUrl, // Store the target URL
        deployedUrl: DEPLOYED_URLS.PRIMARY, // Always store primary as backup
        timestamp: Date.now()
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

    console.log('[SW] Notification data being stored:', notificationOptions.data);
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] ===== NOTIFICATION CLICKED =====');
  console.log('[SW] Event data:', event.notification.data);

  event.notification.close();

  // Determine the URL to open
  let targetUrl = null;
  
  // Priority 1: Use targetUrl from notification data
  if (event.notification.data?.targetUrl) {
    targetUrl = event.notification.data.targetUrl;
    console.log('[SW] Using stored targetUrl:', targetUrl);
  }
  // Priority 2: Use forceDeployedUrl from server
  else if (event.notification.data?.forceDeployedUrl) {
    targetUrl = event.notification.data.forceDeployedUrl;
    console.log('[SW] Using forceDeployedUrl:', targetUrl);
  }
  // Priority 3: Use deployedUrl backup
  else if (event.notification.data?.deployedUrl) {
    targetUrl = event.notification.data.deployedUrl;
    console.log('[SW] Using deployedUrl backup:', targetUrl);
  }
  // Priority 4: Detect based on current SW location
  else {
    targetUrl = getClientBaseUrl();
    console.log('[SW] Detected URL from SW location:', targetUrl);
  }
  
  // SAFETY CHECK: If somehow localhost is in the URL and we're not on localhost, force deployed URL
  const currentHostname = self.location.hostname;
  const isActuallyLocalhost = currentHostname === 'localhost' || 
                              currentHostname === '127.0.0.1';
  
  if (targetUrl.includes('localhost') && !isActuallyLocalhost) {
    console.log('[SW] ⚠️ LOCALHOST DETECTED BUT NOT ON LOCALHOST - FORCING DEPLOYED URL');
    targetUrl = DEPLOYED_URLS.PRIMARY;
  }

  console.log('[SW] ✅ FINAL TARGET URL:', targetUrl);

  // Build the full URL
  let fullUrl;
  if (event.action === 'view') {
    const eventId = event.notification.data?.eventId;
    fullUrl = eventId ? `${targetUrl}/events/${eventId}/chat` : `${targetUrl}/events`;
  } else {
    fullUrl = `${targetUrl}/events`;
  }
  
  console.log('[SW] 🌐 Opening URL:', fullUrl);
  
  event.waitUntil(
    clients.openWindow(fullUrl)
  );
});
