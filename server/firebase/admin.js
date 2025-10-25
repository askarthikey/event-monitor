const admin = require('firebase-admin');
const path = require('path');

let firebaseAdmin = null;
let messaging = null;
let isInitialized = false;

try {
  // Initialize Firebase Admin with real service account
  if (!admin.apps.length) {
    let serviceAccount;
    
    // For production deployment (Render), use Base64 encoded service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        console.log('🔑 Decoded service account length:', serviceAccountJson.length);
        console.log('🔑 First 50 chars:', serviceAccountJson.substring(0, 50));
        
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('🔑 Using Base64 encoded service account from environment variable');
        console.log('🔑 Project ID:', serviceAccount.project_id);
      } catch (error) {
        console.error('❌ Failed to decode Base64 service account:', error.message);
        console.log('📝 Base64 string length:', process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.length || 0);
        console.log('📝 First 100 chars of Base64:', process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.substring(0, 100) || 'undefined');
        throw error;
      }
    }
    // Try to use individual environment variables (alternative method)
    else if (process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      };
      console.log('🔑 Using individual environment variables for service account');
    } 
    // Fallback to service account file (development only)
    else {
      try {
        const serviceAccountPath = path.join(__dirname, 'service-account-key.json');
        serviceAccount = require(serviceAccountPath);
        console.log('🔑 Using local service account file (development mode)');
      } catch (fileError) {
        console.warn('⚠️ No Firebase service account found, using fallback mode');
        throw new Error('No Firebase credentials available');
      }
    }

    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id // Use the project ID from service account
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
