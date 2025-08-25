// Client-side notification bridge for real-time notifications
// This will work with your existing Firebase client setup

class ClientNotificationBridge {
  constructor() {
    this.connections = new Map(); // Store WebSocket connections by user
  }

  // Register a WebSocket connection for real-time notifications
  registerConnection(userId, ws) {
    this.connections.set(userId, ws);
    console.log(`📡 User ${userId} connected for real-time notifications`);
    
    ws.on('close', () => {
      this.connections.delete(userId);
      console.log(`📡 User ${userId} disconnected from notifications`);
    });
  }

  // Send real-time notification to client
  sendToClient(userId, notificationPayload) {
    const connection = this.connections.get(userId);
    
    if (connection && connection.readyState === 1) { // WebSocket.OPEN
      try {
        connection.send(JSON.stringify({
          type: 'notification',
          payload: notificationPayload
        }));
        console.log(`✅ Real-time notification sent to ${userId}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to send real-time notification to ${userId}:`, error);
        this.connections.delete(userId);
        return false;
      }
    }
    
    console.log(`📱 No active connection for ${userId}, notification will be handled by service worker`);
    return false;
  }

  // Broadcast to all connected clients
  broadcast(notificationPayload, excludeUser = null) {
    let sent = 0;
    
    for (const [userId, connection] of this.connections.entries()) {
      if (excludeUser && userId === excludeUser) continue;
      
      if (this.sendToClient(userId, notificationPayload)) {
        sent++;
      }
    }
    
    return sent;
  }

  // Send notification to multiple users
  sendToUsers(tokens, notificationPayload) {
    // For now, we'll broadcast to all connected users since we don't have
    // a direct token-to-userId mapping in this bridge
    console.log(`📡 Broadcasting notification to connected users: ${notificationPayload.title}`);
    return this.broadcast(notificationPayload);
  }

  // Get list of connected users
  getConnectedUsers() {
    return Array.from(this.connections.keys());
  }
}

module.exports = new ClientNotificationBridge();
