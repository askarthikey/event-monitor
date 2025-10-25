// NUCLEAR OPTION - Run this directly in browser console
(async function() {
    console.log('🚨 STARTING NUCLEAR FIX...');
    
    // Step 1: Unregister ALL service workers
    const regs = await navigator.serviceWorker.getRegistrations();
    console.log(`Found ${regs.length} service workers`);
    
    for (const reg of regs) {
        console.log('Unregistering:', reg.scope);
        console.log('  Script:', reg.active?.scriptURL);
        const result = await reg.unregister();
        console.log('  Result:', result ? '✅ SUCCESS' : '❌ FAILED');
    }
    
    // Step 2: Clear ALL caches
    const cacheNames = await caches.keys();
    console.log(`Found ${cacheNames.length} caches`);
    
    for (const cacheName of cacheNames) {
        console.log('Deleting cache:', cacheName);
        await caches.delete(cacheName);
    }
    
    console.log('');
    console.log('✅✅✅ DONE! ✅✅✅');
    console.log('');
    console.log('NOW RUN THIS:');
    console.log('location.reload(true);');
    console.log('');
    console.log('Then re-enable notifications!');
})();
