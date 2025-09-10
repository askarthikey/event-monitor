import React, { useState, useEffect } from 'react';
import notificationService from '../services/notificationService';

const NotificationSettings = ({ onClose }) => {
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState('unknown');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsSupported(notificationService.isNotificationSupported());
    setPermission(notificationService.getPermissionStatus());
    setToken(notificationService.getCurrentToken());
    setIsFirstTime(notificationService.isFirstTimeNotification());
    
    // Check if user is registered
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const isRegistered = await notificationService.isUserRegistered();
      setRegistrationStatus(isRegistered ? 'registered' : 'not-registered');
    } catch (error) {
      setRegistrationStatus('unknown');
    }
  };

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    const wasFirstTime = notificationService.isFirstTimeNotification();
    
    try {
      console.log('🔔 Enabling notifications...');
      const success = await notificationService.init();
      if (success) {
        setPermission(notificationService.getPermissionStatus());
        setToken(notificationService.getCurrentToken());
        setIsFirstTime(notificationService.isFirstTimeNotification());
        
        // Recheck registration status
        await checkRegistrationStatus();
        
        // Show success message if this was the first time
        if (wasFirstTime) {
          setShowSuccessMessage(true);
          // Auto-hide success message after 5 seconds
          setTimeout(() => setShowSuccessMessage(false), 5000);
        }
        
        console.log('✅ Notifications enabled and user registered!');
      } else {
        console.log('❌ Failed to enable notifications');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    }
    setIsLoading(false);
  };

  const handleSendTestNotification = async () => {
    setIsLoading(true);
    try {
      await notificationService.sendTestNotification();
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
    setIsLoading(false);
  };

  const getPermissionStatusColor = () => {
    switch (permission) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getPermissionStatusText = () => {
    switch (permission) {
      case 'granted':
        return 'Enabled';
      case 'denied':
        return 'Denied';
      default:
        return 'Not Set';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl border-2 border-black shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-black">Notification Settings</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Success Message for First Time */}
        {showSuccessMessage && (
          <div className="mx-6 mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-green-800">🔔 Notifications Enabled!</h4>
                <p className="text-sm text-green-700 mt-1">
                  Notifications enabled only once for first time. You will now receive AI event alerts even when the website is closed.
                </p>
              </div>
              <button
                onClick={() => setShowSuccessMessage(false)}
                className="w-5 h-5 text-green-600 hover:text-green-800 transition-colors"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {!isSupported ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">Not Supported</h3>
              <p className="text-gray-600 text-sm">
                Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Edge.
              </p>
            </div>
          ) : (
            <>
              {/* Current Status */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-black mb-3">Current Status</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Permission:</span>
                    <span className={`text-sm font-medium ${getPermissionStatusColor()}`}>
                      {getPermissionStatusText()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Token:</span>
                    <span className="text-sm text-gray-800">
                      {token ? '✓ Generated' : '✗ Not generated'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Registration:</span>
                    <span className={`text-sm font-medium ${
                      registrationStatus === 'registered' ? 'text-green-600' :
                      registrationStatus === 'not-registered' ? 'text-orange-600' :
                      'text-gray-600'
                    }`}>
                      {registrationStatus === 'registered' ? '✓ Registered for alerts' :
                       registrationStatus === 'not-registered' ? '⚠ Not registered' :
                       '? Checking...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* First Time User Info */}
              {isFirstTime && permission !== 'granted' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-800">First Time Setup</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        This will be your first time enabling notifications. You'll receive a welcome notification to confirm everything is working properly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Types */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-black">You'll receive notifications for:</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Fire detection alerts</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Smoke detection alerts</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Overcrowding warnings</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Unusual activity detection</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {permission !== 'granted' && (
                  <button
                    onClick={handleEnableNotifications}
                    disabled={isLoading}
                    className="w-full py-3 bg-black text-white font-semibold rounded-xl border-2 border-black transition-all duration-200 hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Enabling...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center space-x-2">
                        <span>{isFirstTime ? '🔔 Enable Notifications (First Time)' : 'Enable Notifications'}</span>
                        {isFirstTime && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            New
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                )}

                {permission === 'granted' && (
                  <button
                    onClick={handleSendTestNotification}
                    disabled={isLoading}
                    className="w-full py-3 bg-white border-2 border-black text-black font-semibold rounded-xl transition-all duration-200 hover:bg-gray-50 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Sending...</span>
                      </span>
                    ) : (
                      'Send Test Notification'
                    )}
                  </button>
                )}
              </div>

              {permission === 'denied' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.729-.833-2.499 0L4.315 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-800">Permission Denied</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        To enable notifications, please allow them in your browser settings and refresh the page.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
