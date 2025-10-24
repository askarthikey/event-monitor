/**
 * Environment variables checker for debugging
 */

export const checkEnvironmentVariables = () => {
  console.log('🔍 Environment Variables Check:');
  console.log('=================================');
  
  // API URLs
  console.log('📡 API Configuration:');
  console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || '❌ Not set');
  console.log('VITE_SOCKET_URL:', import.meta.env.VITE_SOCKET_URL || '❌ Not set');
  
  // Firebase Config
  console.log('\n🔥 Firebase Configuration:');
  console.log('VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID || '❌ Not set');
  console.log('VITE_FIREBASE_APP_ID:', import.meta.env.VITE_FIREBASE_APP_ID ? '✅ Set' : '❌ Not set');
  console.log('VITE_FIREBASE_VAPID_KEY:', import.meta.env.VITE_FIREBASE_VAPID_KEY ? '✅ Set' : '❌ Not set');
  
  // Environment info
  console.log('\n🌍 Environment Info:');
  console.log('Mode:', import.meta.env.MODE);
  console.log('Dev:', import.meta.env.DEV);
  console.log('Prod:', import.meta.env.PROD);
  
  console.log('=================================');
};

export const getResolvedConfig = () => {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    socketUrl: import.meta.env.VITE_SOCKET_URL,
    firebase: {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    }
  };
};