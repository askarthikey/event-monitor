/**
 * Firebase configuration for service worker
 * This config is passed from the main thread to the service worker
 * to avoid hardcoding values
 */

// This will be populated by the main thread
let firebaseConfigForSW = null;

// Function to receive config from main thread
export const setFirebaseConfig = (config) => {
  firebaseConfigForSW = config;
  // Make it available globally for the service worker
  if (typeof self !== 'undefined') {
    self.firebaseConfigForSW = config;
  }
};

// Function to get the config
export const getFirebaseConfig = () => {
  return firebaseConfigForSW;
};

// For backwards compatibility, export empty object if no config set
export { firebaseConfigForSW };