// EMERGENCY SERVICE WORKER FIX
// Run this in browser console: fetch('/force-fix-sw.js').then(r => r.text()).then(eval);

(async () => {
  console.log('🚨 EMERGENCY SERVICE WORKER FIX 🚨');
  console.log('====================================');
  
  // Get all service workers
  const registrations = await navigator.serviceWorker.getRegistrations();
  console.log(`Found ${registrations.length} service worker(s)`);
  
  // Unregister ALL of them
  for (const reg of registrations) {
    console.log('🗑️ Unregistering:', reg.scope);
    console.log('   Script URL:', reg.active?.scriptURL || 'N/A');
    await reg.unregister();
  }
  
  console.log('✅ All service workers unregistered');
  
  // Clear all caches
  const cacheNames = await caches.keys();
  console.log(`Found ${cacheNames.length} cache(s)`);
  for (const name of cacheNames) {
    console.log('🗑️ Deleting cache:', name);
    await caches.delete(name);
  }
  
  console.log('✅ All caches cleared');
  console.log('');
  console.log('🔄 Page will reload in 3 seconds...');
  console.log('⚠️ After reload, please RE-ENABLE notifications!');
  console.log('====================================');
  
  setTimeout(() => {
    location.reload();
  }, 3000);
})();
