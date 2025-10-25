console.log('🔍 NOTIFICATION DEBUG SCRIPT 🔍');
console.log('================================');

// Check current location
console.log('📍 Current Location:');
console.log('  - Hostname:', window.location.hostname);
console.log('  - Origin:', window.location.origin);
console.log('  - Full URL:', window.location.href);

// Check service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('\n🤖 Service Workers:');
  console.log('  - Count:', registrations.length);
  
  registrations.forEach((reg, index) => {
    console.log(`\n  SW ${index + 1}:`);
    console.log('    - Scope:', reg.scope);
    console.log('    - Active:', reg.active ? 'Yes' : 'No');
    console.log('    - Installing:', reg.installing ? 'Yes' : 'No');
    console.log('    - Waiting:', reg.waiting ? 'Yes' : 'No');
    
    if (reg.active) {
      console.log('    - Script URL:', reg.active.scriptURL);
      console.log('    - State:', reg.active.state);
    }
  });
});

// Check notification permission
console.log('\n🔔 Notification Status:');
console.log('  - Permission:', Notification.permission);
console.log('  - Supported:', 'Notification' in window);

// Check if on localhost
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';
console.log('\n🏠 Environment:');
console.log('  - Is Localhost:', isLocalhost);
console.log('  - Is Custom Domain:', window.location.hostname.includes('askarthikey.tech'));
console.log('  - Is Vercel:', window.location.hostname.includes('vercel.app'));

// Expected URL
let expectedUrl;
if (isLocalhost) {
  expectedUrl = 'http://localhost:5173';
} else if (window.location.hostname.includes('askarthikey.tech')) {
  expectedUrl = 'https://event-monitor.askarthikey.tech';
} else if (window.location.hostname.includes('vercel.app')) {
  expectedUrl = 'https://event-monitoring-omega.vercel.app';
} else {
  expectedUrl = 'https://event-monitor.askarthikey.tech (default)';
}

console.log('\n✅ Expected Notification URL:');
console.log('  - Should Open:', expectedUrl);

console.log('\n================================');
console.log('📝 INSTRUCTIONS:');
console.log('1. Copy this entire output');
console.log('2. Send test notification');
console.log('3. Check DevTools console for [SW] logs');
console.log('4. Click notification and see what URL opens');
console.log('================================');
