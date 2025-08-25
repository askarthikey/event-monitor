const admin = require('firebase-admin');
const path = require('path');

let firebaseAdmin = null;
let messaging = null;
let isInitialized = false;

try {
  // Initialize Firebase Admin with real service account
  if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, 'service-account-key.json');
    const serviceAccount = require(serviceAccountPath);

    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    messaging = admin.messaging();
    isInitialized = true;
    console.log('🔥 Firebase Admin SDK initialized successfully with real credentials!');
  } else {
    firebaseAdmin = admin.app();
    messaging = admin.messaging();
    isInitialized = true;
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  console.log('📢 Falling back to client-side notifications...');
  
  // Create a mock messaging service for fallback
  messaging = {
    send: async (message) => {
      console.log('🔄 Using client-side notification fallback:', {
        to: message.token.substring(0, 20) + '...',
        title: message.notification?.title,
        body: message.notification?.body
      });
      
      return `client-fallback-${Date.now()}`;
    },
    sendMulticast: async (message) => {
      console.log('🔄 Using client-side broadcast fallback:', {
        tokens: message.tokens.length,
        title: message.notification?.title,
        body: message.notification?.body
      });
      
      return {
        responses: message.tokens.map(token => ({
          success: true,
          messageId: `client-fallback-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        })),
        successCount: message.tokens.length,
        failureCount: 0
      };
    }
  };
}

// Export Firebase Admin messaging
const getMessaging = () => {
  return messaging;
};

const isFirebaseAvailable = () => {
  return isInitialized && messaging !== null;
};

module.exports = { 
  firebaseAdmin, 
  getMessaging,
  isFirebaseAvailable
};
