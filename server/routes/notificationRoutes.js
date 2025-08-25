const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getMessaging, isFirebaseAvailable } = require('../firebase/admin');

// Database storage for FCM tokens (replacing in-memory Map)
const getFcmTokensCollection = (req) => {
  return req.app.get('onepiece').collection('fcmTokens');
};

// Debug function to log current registered users from database
const logRegisteredUsers = async (req) => {
  try {
    const fcmTokensCollection = getFcmTokensCollection(req);
    const tokens = await fcmTokensCollection.find({}).toArray();
    const userIds = tokens.map(token => token.userId);
    console.log('📊 Current registered users (DB):', userIds);
    console.log('📊 Total registered users (DB):', tokens.length);
  } catch (error) {
    console.error('Error logging registered users:', error);
  }
};

// Helper function to send Firebase notification
const sendFirebaseNotification = async (fcmToken, notificationPayload) => {
  try {
    if (!isFirebaseAvailable()) {
      console.log('Firebase Admin not available');
      return { success: false, messageId: null, method: 'unavailable', error: 'Firebase Admin SDK not initialized' };
    }

    const messaging = getMessaging();
    const message = {
      token: fcmToken,
      notification: notificationPayload.notification,
      data: notificationPayload.data || {},
      webpush: {
        notification: {
          ...notificationPayload.notification,
          icon: '/firebase-logo.png',
          badge: '/badge-icon.png',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'View Details'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ]
        }
      }
    };

    const messageId = await messaging.send(message);
    console.log('🔥 Firebase notification sent successfully via Admin SDK:', messageId);
    return { success: true, messageId, method: 'firebase-admin' };
  } catch (error) {
    console.error('❌ Error sending Firebase notification:', error);
    return { 
      success: false, 
      messageId: null, 
      method: 'firebase-admin-failed',
      error: error.message 
    };
  }
};

// Register FCM token
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user.username;

    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const fcmTokensCollection = getFcmTokensCollection(req);
    
    // Check if token already exists for this user
    const existingToken = await fcmTokensCollection.findOne({ userId });
    
    const tokenData = {
      userId,
      fcmToken,
      deviceInfo: req.headers['user-agent'] || 'Unknown Device',
      lastUpdated: new Date(),
      createdAt: existingToken ? existingToken.createdAt : new Date()
    };

    if (existingToken) {
      // Update existing token
      await fcmTokensCollection.updateOne(
        { userId },
        { $set: tokenData }
      );
      console.log(`🔄 FCM token updated for user ${userId}:`, fcmToken.substring(0, 20) + '...');
    } else {
      // Insert new token
      await fcmTokensCollection.insertOne(tokenData);
      console.log(`✅ FCM token registered for user ${userId}:`, fcmToken.substring(0, 20) + '...');
    }
    
    await logRegisteredUsers(req);

    res.json({ 
      success: true, 
      message: 'Notification token registered successfully' 
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ message: 'Failed to register notification token' });
  }
});

// Send test notification
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.username;
    const fcmTokensCollection = getFcmTokensCollection(req);
    const userTokenData = await fcmTokensCollection.findOne({ userId });

    if (!userTokenData) {
      return res.status(400).json({ message: 'No notification token found. Please enable notifications first.' });
    }

    // Create notification payload
    const notificationPayload = {
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification from AI Event Monitor',
      },
      data: {
        type: 'test',
        sender: userId,
        timestamp: new Date().toISOString()
      }
    };

    // Send real Firebase notification
    const result = await sendFirebaseNotification(userTokenData.fcmToken, notificationPayload);

    console.log(`Test notification sent to user ${userId}:`, result);

    res.json({ 
      success: true, 
      message: 'Test notification sent successfully',
      payload: notificationPayload,
      firebaseResult: result
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: 'Failed to send test notification' });
  }
});

// Send AI detection notification
router.post('/ai-detection', authenticateToken, async (req, res) => {
  try {
    const { eventId, detectionType, probability, timestamp, location } = req.body;
    const userId = req.user.username;
    const fcmTokensCollection = getFcmTokensCollection(req);
    const userTokenData = await fcmTokensCollection.findOne({ userId });

    if (!userTokenData) {
      return res.status(400).json({ message: 'No notification token found. Please enable notifications first.' });
    }

    // Validate input
    if (!eventId || !detectionType || !probability) {
      return res.status(400).json({ message: 'Missing required fields: eventId, detectionType, probability' });
    }

    // Create notification title and body based on detection type
    const getNotificationContent = (type, prob, loc) => {
      const probabilityPercent = Math.round(prob * 100);
      
      switch (type) {
        case 'fire':
          return {
            title: '🔥 Fire Detection Alert',
            body: `Fire detected with ${probabilityPercent}% confidence at ${loc || 'unknown location'}`
          };
        case 'smoke':
          return {
            title: '💨 Smoke Detection Alert',
            body: `Smoke detected with ${probabilityPercent}% confidence at ${loc || 'unknown location'}`
          };
        case 'overcrowd':
          return {
            title: '👥 Overcrowding Alert',
            body: `Overcrowding detected with ${probabilityPercent}% confidence at ${loc || 'unknown location'}`
          };
        default:
          return {
            title: '⚠️ AI Detection Alert',
            body: `${type} detected with ${probabilityPercent}% confidence at ${loc || 'unknown location'}`
          };
      }
    };

    const { title, body } = getNotificationContent(detectionType, probability, location);

    // Create notification payload
    const notificationPayload = {
      notification: {
        title,
        body,
      },
      data: {
        type: 'ai-detection',
        eventId: eventId.toString(),
        detectionType,
        probability: probability.toString(),
        timestamp,
        location: location || 'unknown'
      }
    };

    // Send real Firebase notification
    const result = await sendFirebaseNotification(userTokenData.fcmToken, notificationPayload);

    console.log(`AI detection notification sent to user ${userId}:`, result);

    // Store notification in database for history
    const notificationRecord = {
      userId,
      eventId,
      type: 'ai-detection',
      detectionType,
      probability,
      location,
      timestamp: new Date(timestamp),
      createdAt: new Date(),
      sent: true
    };

    const notificationsCollection = req.app.get('onepiece').collection('notificationsCollection');
    await notificationsCollection.insertOne(notificationRecord);

    res.json({ 
      success: true, 
      message: 'AI detection notification sent successfully',
      payload: notificationPayload,
      notificationId: notificationRecord._id
    });
  } catch (error) {
    console.error('Error sending AI detection notification:', error);
    res.status(500).json({ message: 'Failed to send AI detection notification' });
  }
});

// Get notification history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.username;
    const { limit = 50, page = 1 } = req.query;

    const notificationsCollection = req.app.get('onepiece').collection('notificationsCollection');
    
    const notifications = await notificationsCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .toArray();

    const total = await notificationsCollection.countDocuments({ userId });

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ message: 'Failed to fetch notification history' });
  }
});

// Send notification to specific user (admin function)
router.post('/send-to-user', authenticateToken, async (req, res) => {
  try {
    const { targetUsername, title, body, data } = req.body;
    
    if (!targetUsername) {
      return res.status(400).json({ message: 'Target username is required' });
    }

    const fcmTokensCollection = getFcmTokensCollection(req);
    const userTokenData = await fcmTokensCollection.findOne({ userId: targetUsername });
    
    if (!userTokenData) {
      return res.status(404).json({ 
        message: `User ${targetUsername} not found or no notification token registered` 
      });
    }

    const notificationTitle = title || 'AI Event Monitor Alert';
    const notificationBody = body || `Message from ${req.user.username}`;

    const notificationPayload = {
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        sender: req.user.username,
        timestamp: new Date().toISOString(),
        ...data
      }
    };

    // Send real Firebase notification
    const result = await sendFirebaseNotification(userTokenData.fcmToken, notificationPayload);

    console.log(`Notification sent from ${req.user.username} to ${targetUsername}:`, result);

    // Store notification in history
    try {
      const notificationsCollection = req.app.get('onepiece').collection('notificationsCollection');
      const notificationRecord = {
        userId: targetUsername,
        senderId: req.user.username,
        type: 'user-message',
        title: notificationTitle,
        body: notificationBody,
        data: notificationPayload.data,
        createdAt: new Date(),
        sent: true
      };
      
      const result = await notificationsCollection.insertOne(notificationRecord);
      console.log('Notification saved to database:', result.insertedId);
    } catch (dbError) {
      console.error('Error saving notification to database:', dbError);
    }

    res.json({ 
      success: true, 
      message: `Notification sent to ${targetUsername}`,
      payload: notificationPayload
    });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    res.status(500).json({ message: 'Failed to send notification to user' });
  }
});

// Get list of users with registered tokens
router.get('/registered-users', authenticateToken, async (req, res) => {
  try {
    const fcmTokensCollection = getFcmTokensCollection(req);
    const tokens = await fcmTokensCollection.find({}).toArray();
    const registeredUsers = tokens.map(token => token.userId);
    
    console.log('🔍 Requested registered users from DB:', registeredUsers);
    await logRegisteredUsers(req);
    
    res.json({
      success: true,
      users: registeredUsers,
      total: tokens.length,
      details: tokens.map(token => ({
        userId: token.userId,
        deviceInfo: token.deviceInfo,
        lastUpdated: token.lastUpdated,
        createdAt: token.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting registered users:', error);
    res.status(500).json({ message: 'Failed to get registered users' });
  }
});

// Broadcast notification to all registered users
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    const { title, body, data } = req.body;
    const senderUsername = req.user.username;
    
    const fcmTokensCollection = getFcmTokensCollection(req);
    const allTokens = await fcmTokensCollection.find({}).toArray();
    
    if (allTokens.length === 0) {
      return res.status(400).json({ message: 'No users have registered for notifications yet' });
    }

    const notificationTitle = title || 'Broadcast Alert';
    const notificationBody = body || `Message from ${senderUsername}`;
    
    const sentNotifications = [];
    const failedNotifications = [];
    const notificationIds = [];

    // Send to all users with registered tokens
    for (const tokenData of allTokens) {
      try {
        const notificationPayload = {
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data: {
            sender: senderUsername,
            type: 'broadcast',
            timestamp: new Date().toISOString(),
            ...data
          }
        };

        // Send real Firebase notification
        const result = await sendFirebaseNotification(tokenData.fcmToken, notificationPayload);

        console.log(`Broadcast notification sent to ${tokenData.userId}:`, result);

        // Store notification in history
        try {
          const notificationsCollection = req.app.get('onepiece').collection('notificationsCollection');
          const notificationRecord = {
            userId: tokenData.userId,
            senderId: senderUsername,
            type: 'broadcast',
            title: notificationTitle,
            body: notificationBody,
            data: notificationPayload.data,
            createdAt: new Date(),
            sent: true
          };
          
          const result = await notificationsCollection.insertOne(notificationRecord);
          notificationIds.push(result.insertedId);
        } catch (dbError) {
          console.error('Error saving notification to database:', dbError);
        }

        sentNotifications.push(tokenData.userId);
      } catch (error) {
        console.error(`Failed to send to ${tokenData.userId}:`, error);
        failedNotifications.push(tokenData.userId);
      }
    }

    res.json({
      success: true,
      message: `Broadcast sent to ${sentNotifications.length} users`,
      sent: sentNotifications,
      failed: failedNotifications,
      total: sentNotifications.length + failedNotifications.length,
      notificationIds
    });

  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ message: 'Failed to send broadcast notification' });
  }
});

// Generate fake FCM token for testing (when devices have issues)
router.post('/generate-test-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.username;
    const { deviceName } = req.body;
    
    // Generate a fake but realistic-looking FCM token
    const fakeToken = `fake-fcm-token-${userId}-${deviceName || 'device'}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    const fcmTokensCollection = getFcmTokensCollection(req);
    
    // Check if token already exists for this user
    const existingToken = await fcmTokensCollection.findOne({ userId });
    
    const tokenData = {
      userId,
      fcmToken: fakeToken,
      deviceInfo: `Test Device - ${deviceName || 'Unknown'}`,
      lastUpdated: new Date(),
      createdAt: existingToken ? existingToken.createdAt : new Date(),
      isTestToken: true
    };

    if (existingToken) {
      // Update existing token
      await fcmTokensCollection.updateOne(
        { userId },
        { $set: tokenData }
      );
      console.log(`� Test FCM token updated for user ${userId}:`, fakeToken.substring(0, 30) + '...');
    } else {
      // Insert new token
      await fcmTokensCollection.insertOne(tokenData);
      console.log(`🔧 Test FCM token generated for user ${userId}:`, fakeToken.substring(0, 30) + '...');
    }
    
    await logRegisteredUsers(req);

    res.json({
      success: true,
      message: 'Test FCM token generated and registered successfully',
      token: fakeToken.substring(0, 30) + '...',
      userId
    });
  } catch (error) {
    console.error('Error generating test token:', error);
    res.status(500).json({ message: 'Failed to generate test token' });
  }
});

module.exports = router;
