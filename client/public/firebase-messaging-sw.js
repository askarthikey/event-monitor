importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const SW_VERSION = '2.1.0';
console.log('[SW] Service Worker Version:', SW_VERSION);

const DEPLOYED_URLS = {
  PRIMARY: 'https://event-monitor.askarthikey.tech',
  SECONDARY: 'https://event-monitoring-omega.vercel.app',
  LOCAL: 'http://localhost:5173'
};

let firebaseConfig = null;
let messaging = null;
let clientOrigins = null;
let currentOrigin = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    clientOrigins = event.data.clientOrigins;
    currentOrigin = event.data.currentOrigin;
    console.log('[SW] Received Firebase config:', firebaseConfig?.projectId || 'No config');
    console.log('[SW] Supported client origins:', clientOrigins);
    console.log('[SW] Current origin:', currentOrigin);
    
    initializeFirebase();
  }
});

function getClientBaseUrl() {
  const hostname = self.location.hostname;
  
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     hostname === '0.0.0.0';
  
  let selectedUrl = null;
  
  if (isLocalhost) {
    selectedUrl = DEPLOYED_URLS.LOCAL;
  } else if (hostname.includes('askarthikey.tech')) {
    selectedUrl = DEPLOYED_URLS.PRIMARY;
  } else if (hostname.includes('vercel.app') || hostname.includes('event-monitoring-omega')) {
    selectedUrl = DEPLOYED_URLS.SECONDARY;
  } else {
    selectedUrl = DEPLOYED_URLS.PRIMARY;
  }
  
  console.log('[SW] Selected URL:', selectedUrl);
  return selectedUrl;
}

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
    
    messaging = firebase.messaging();
    setupBackgroundMessageHandler();
    
  } catch (error) {
    console.error('[SW] Error initializing Firebase:', error);
  }
}

function setupBackgroundMessageHandler() {
  if (!messaging) {
    console.warn('[SW] Messaging not initialized');
    return;
  }
  
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);
    
    const targetUrl = getClientBaseUrl();
    
    const notificationTitle = payload.notification?.title || 'AI Event Monitor Alert';
    const notificationOptions = {
      body: payload.notification?.body || 'New event notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'ai-event-notification',
      data: {
        ...payload.data,
        targetUrl: targetUrl,
        deployedUrl: DEPLOYED_URLS.PRIMARY,
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

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');

  event.notification.close();

  let targetUrl = null;
  
  if (event.notification.data?.targetUrl) {
    targetUrl = event.notification.data.targetUrl;
  } else if (event.notification.data?.forceDeployedUrl) {
    targetUrl = event.notification.data.forceDeployedUrl;
  } else if (event.notification.data?.deployedUrl) {
    targetUrl = event.notification.data.deployedUrl;
  } else {
    targetUrl = getClientBaseUrl();
  }
  
  const currentHostname = self.location.hostname;
  const isActuallyLocalhost = currentHostname === 'localhost' || 
                              currentHostname === '127.0.0.1';
  
  if (targetUrl.includes('localhost') && !isActuallyLocalhost) {
    targetUrl = DEPLOYED_URLS.PRIMARY;
  }

  let fullUrl;
  if (event.action === 'view') {
    const eventId = event.notification.data?.eventId;
    fullUrl = eventId ? `${targetUrl}/events/${eventId}/chat` : `${targetUrl}/events`;
  } else {
    fullUrl = `${targetUrl}/events`;
  }
  
  console.log('[SW] Opening URL:', fullUrl);
  
  event.waitUntil(
    clients.openWindow(fullUrl)
  );
});
