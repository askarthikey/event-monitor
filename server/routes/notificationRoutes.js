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

    // Validate FCM token format
    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
      throw new Error('Invalid FCM token provided');
    }

    // Check if it's a test token (should not be sent via Firebase)
    if (fcmToken.startsWith('fake-fcm-token-')) {
      console.log('🧪 Skipping Firebase send for test token:', fcmToken.substring(0, 30) + '...');
      return { 
        success: true, 
        messageId: `test-message-${Date.now()}`, 
        method: 'test-token-simulation',
        note: 'Test token simulated successful delivery'
      };
    }

    const messaging = getMessaging();
    const message = {
      token: fcmToken,
      notification: notificationPayload.notification,
      data: {
        ...notificationPayload.data,
        clientOrigins: process.env.CLIENT_ORIGIN || 'https://event-monitoring-omega.vercel.app,https://event-monitor.askarthikey.tech'
      },
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
    
    // Handle specific Firebase errors
    let errorType = 'unknown';
    let shouldRemoveToken = false;
    
    if (error.code) {
      switch (error.code) {
        case 'messaging/registration-token-not-registered':
          errorType = 'token-not-registered';
          shouldRemoveToken = true;
          console.log('🗑️ FCM token not registered, should be removed from database');
          break;
        case 'messaging/invalid-registration-token':
          errorType = 'invalid-token';
          shouldRemoveToken = true;
          console.log('🗑️ FCM token is invalid, should be removed from database');
          break;
        case 'messaging/invalid-argument':
          // This includes invalid token format and "Requested entity was not found"
          if (error.message.includes('registration token') || error.message.includes('not found')) {
            errorType = 'invalid-token-format';
            shouldRemoveToken = true;
            console.log('🗑️ FCM token format is invalid or entity not found, should be removed from database');
          } else {
            errorType = 'invalid-payload';
          }
          break;
        case 'messaging/invalid-payload':
          errorType = 'empty-token';
          shouldRemoveToken = true;
          console.log('🗑️ Empty or null FCM token, should be removed from database');
          break;
        case 'messaging/mismatched-credential':
          errorType = 'credential-mismatch';
          console.log('🔑 Service account credentials mismatch with project');
          break;
        case 'messaging/authentication-error':
          errorType = 'auth-error';
          console.log('🔐 Firebase authentication error');
          break;
        default:
          errorType = error.code;
      }
    } else if (error.message.includes('Requested entity was not found')) {
      // Handle the specific error from the user's original problem
      errorType = 'entity-not-found';
      shouldRemoveToken = true;
      console.log('🗑️ Requested entity was not found - token likely expired or invalid');
    }
    
    return { 
      success: false, 
      messageId: null, 
      method: 'firebase-admin-failed',
      error: error.message,
      errorCode: error.code,
      errorType,
      shouldRemoveToken
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

    // If token is invalid or not registered, remove it from database
    if (result.shouldRemoveToken) {
      console.log(`🗑️ Removing invalid FCM token for user ${userId}`);
      await fcmTokensCollection.deleteOne({ userId });
      
      return res.status(400).json({
        success: false,
        message: 'Your notification token has expired or is invalid. Please refresh the page and enable notifications again.',
        error: result.error,
        errorType: result.errorType,
        action: 'token-removed'
      });
    }

    console.log(`Test notification sent to user ${userId}:`, result);

    res.json({ 
      success: result.success, 
      message: result.success ? 'Test notification sent successfully' : 'Failed to send notification',
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

    // If token is invalid or not registered, remove it from database
    if (result.shouldRemoveToken) {
      console.log(`🗑️ Removing invalid FCM token for user ${userId}`);
      await fcmTokensCollection.deleteOne({ userId });
      
      return res.status(400).json({
        success: false,
        message: 'Your AI detection notification token has expired or is invalid. Please refresh the page and enable notifications again.',
        error: result.error,
        errorType: result.errorType,
        action: 'token-removed'
      });
    }

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

    // If token is invalid, remove it and notify user
    if (result.shouldRemoveToken) {
      console.log(`🗑️ Removing invalid FCM token for user ${targetUsername}`);
      await fcmTokensCollection.deleteOne({ userId: targetUsername });
      
      return res.status(400).json({
        success: false,
        message: `User ${targetUsername}'s notification token is invalid. They need to re-enable notifications.`,
        error: result.error,
        errorType: result.errorType,
        action: 'token-removed'
      });
    }

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

        // If token is invalid, remove it and track failure
        if (result.shouldRemoveToken) {
          console.log(`🗑️ Removing invalid FCM token for user ${tokenData.userId}`);
          await fcmTokensCollection.deleteOne({ userId: tokenData.userId });
          failedNotifications.push(tokenData.userId);
          continue;
        }

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

// Validate all FCM tokens and remove invalid ones
router.post('/validate-tokens', authenticateToken, async (req, res) => {
  try {
    const fcmTokensCollection = getFcmTokensCollection(req);
    const allTokens = await fcmTokensCollection.find({}).toArray();
    
    if (allTokens.length === 0) {
      return res.json({
        success: true,
        message: 'No tokens to validate',
        results: { valid: 0, invalid: 0, test: 0 }
      });
    }

    const results = {
      valid: [],
      invalid: [],
      test: [],
      removed: []
    };

    // Test each token with a simple validation message
    for (const tokenData of allTokens) {
      try {
        // Skip test tokens but count them
        if (tokenData.fcmToken.startsWith('fake-fcm-token-')) {
          results.test.push(tokenData.userId);
          continue;
        }

        const testPayload = {
          notification: {
            title: 'Token Validation',
            body: 'Validating your notification token...',
          },
          data: {
            type: 'validation',
            timestamp: new Date().toISOString()
          }
        };

        const result = await sendFirebaseNotification(tokenData.fcmToken, testPayload);

        if (result.success) {
          results.valid.push(tokenData.userId);
        } else if (result.shouldRemoveToken) {
          results.invalid.push(tokenData.userId);
          // Remove invalid token
          await fcmTokensCollection.deleteOne({ userId: tokenData.userId });
          results.removed.push(tokenData.userId);
          console.log(`🗑️ Removed invalid token for user ${tokenData.userId}`);
        } else {
          results.invalid.push(tokenData.userId);
        }
      } catch (error) {
        console.error(`Error validating token for ${tokenData.userId}:`, error);
        results.invalid.push(tokenData.userId);
      }
    }

    res.json({
      success: true,
      message: 'Token validation completed',
      results: {
        valid: results.valid.length,
        invalid: results.invalid.length,
        test: results.test.length,
        removed: results.removed.length
      },
      details: results
    });
  } catch (error) {
    console.error('Error validating tokens:', error);
    res.status(500).json({ message: 'Failed to validate tokens' });
  }
});

// Debug route to check specific token format
router.post('/debug-token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    console.log('🔍 Debugging token:', token.substring(0, 50) + '...');
    
    // Basic format checks
    const tokenInfo = {
      length: token.length,
      startsWithFake: token.startsWith('fake-fcm-token-'),
      isEmpty: !token || token.trim().length === 0,
      format: 'unknown'
    };

    // Try to identify token format
    if (token.includes(':APA91b')) {
      tokenInfo.format = 'FCM-Android';
    } else if (token.includes('-') && token.length > 100) {
      tokenInfo.format = 'FCM-Web';
    } else if (token.startsWith('fake-fcm-token-')) {
      tokenInfo.format = 'Test-Token';
    }

    // Try to send a test notification
    const testPayload = {
      notification: {
        title: 'Debug Test',
        body: 'Testing token format...',
      },
      data: {
        type: 'debug',
        timestamp: new Date().toISOString()
      }
    };

    const result = await sendFirebaseNotification(token, testPayload);

    res.json({
      success: true,
      tokenInfo,
      firebaseResult: result
    });
  } catch (error) {
    console.error('Error debugging token:', error);
    res.status(500).json({ message: 'Failed to debug token' });
  }
});

// Debug environment information
router.get('/debug-env', authenticateToken, async (req, res) => {
  try {
    const clientOrigins = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim()) : [];
    
    const environmentInfo = {
      nodeEnv: process.env.NODE_ENV,
      clientOrigins: clientOrigins,
      corsOrigins: process.env.CORS_ORIGINS,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      firebaseAvailable: isFirebaseAvailable(),
      timestamp: new Date().toISOString()
    };

    console.log('🔍 Environment debug requested:', environmentInfo);

    res.json({
      success: true,
      environment: environmentInfo
    });
  } catch (error) {
    console.error('Error getting environment info:', error);
    res.status(500).json({ message: 'Failed to get environment info' });
  }
});

module.exports = router;
