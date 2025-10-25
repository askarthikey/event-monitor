import { messaging, vapidKey } from "../firebase/config";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import apiService from "./apiService";

class NotificationService {
	constructor() {
		this.isSupported =
			"Notification" in window &&
			"serviceWorker" in navigator &&
			messaging !== null;
		this.permission = null;
		this.token = null;
		this.isFirebaseConfigured = messaging !== null;
	}

	// Initialize notification service
	async init() {
		if (!this.isSupported) {
			console.warn(
				"This browser does not support notifications or Firebase is not configured"
			);
			return false;
		}

		if (!this.isFirebaseConfigured) {
			console.warn(
				"Firebase messaging is not configured. Please set up Firebase config."
			);
			return false;
		}

		try {
			// Register service worker
			await this.registerServiceWorker();

			// Request permission
			await this.requestPermission();

			// Get FCM token
			await this.getToken();

			// Set up foreground message handler
			this.setupForegroundHandler();

			return true;
		} catch (error) {
			console.error("Error initializing notifications:", error);
			return false;
		}
	}

	// Register service worker
	async registerServiceWorker() {
		try {
			// Add cache-busting parameter to force reload of service worker
			const swVersion = '2.0.1'; // Match SW_VERSION in firebase-messaging-sw.js
			const registration = await navigator.serviceWorker.register(
				`/firebase-messaging-sw.js?v=${swVersion}`,
				{ updateViaCache: 'none' } // Force check for updates
			);
			console.log("Service Worker registered successfully:", registration);
			
			// Force immediate update check
			await registration.update();
			
			// Send Firebase config to service worker
			await this.sendConfigToServiceWorker(registration);
			
			return registration;
		} catch (error) {
			console.error("Service Worker registration failed:", error);
			throw error;
		}
	}

	// Send Firebase configuration to service worker
	async sendConfigToServiceWorker(registration) {
		try {
			// Get Firebase config from environment variables
			const firebaseConfig = {
				apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
				authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
				projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
				storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
				messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
				appId: import.meta.env.VITE_FIREBASE_APP_ID,
				measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
			};

			// Get the correct client origins for notifications (support multiple domains)
			const clientOrigins = import.meta.env.VITE_CLIENT_ORIGIN || 'https://event-monitoring-omega.vercel.app,https://event-monitor.askarthikey.tech';
			const currentOrigin = window.location.origin;

			console.log('🔧 Sending Firebase config to service worker:', firebaseConfig.projectId);
			console.log('🌐 Supported client origins:', clientOrigins);
			console.log('🌐 Current origin:', currentOrigin);

			// Wait for service worker to be ready
			await registration.update();
			
			// Send config to service worker with client origins
			const configMessage = {
				type: 'FIREBASE_CONFIG',
				config: firebaseConfig,
				clientOrigins: clientOrigins,
				currentOrigin: currentOrigin
			};
			
			if (registration.active) {
				registration.active.postMessage(configMessage);
				console.log('✅ Firebase config and client origins sent to service worker');
			} else {
				console.warn('⚠️ Service worker not active, config will be sent when ready');
				// Listen for service worker to become active
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					newWorker?.addEventListener('statechange', () => {
						if (newWorker.state === 'activated') {
							newWorker.postMessage(configMessage);
							console.log('✅ Firebase config and client origins sent to newly activated service worker');
						}
					});
				});
			}
		} catch (error) {
			console.error('❌ Error sending config to service worker:', error);
		}
	}

	// Request notification permission
	async requestPermission() {
		if (this.permission === "granted") {
			return true;
		}

		const permission = await Notification.requestPermission();
		this.permission = permission;

		if (permission === "granted") {
			console.log("Notification permission granted.");
			return true;
		} else {
			console.log("Notification permission denied.");
			return false;
		}
	}

	// Get FCM registration token
	async getToken() {
		if (!this.isFirebaseConfigured) {
			console.log("Firebase not configured, skipping token generation");
			return null;
		}

		try {
			const currentToken = await getToken(messaging, { vapidKey });
			if (currentToken) {
				console.log(
					"FCM Registration token obtained:",
					currentToken.substring(0, 20) + "..."
				);
				this.token = currentToken;

				// Send token to your server to register the user for notifications
				const registrationSuccess = await this.sendTokenToServer(currentToken);

				if (registrationSuccess) {
					console.log("✅ User successfully registered for notifications");
				} else {
					console.log("⚠️ Token obtained but registration failed");
				}

				return currentToken;
			} else {
				console.log(
					"No registration token available - user may have denied permissions or Firebase setup issue"
				);
				return null;
			}
		} catch (error) {
			console.error("An error occurred while retrieving token:", error);
			return null;
		}
	}

	// Send token to server
	async sendTokenToServer(token) {
		try {
			const authToken = localStorage.getItem("token");
			if (!authToken) {
				console.warn("No auth token found, cannot register for notifications");
				return false;
			}

			const response = await apiService.registerForNotifications({ fcmToken: token });

			if (response.ok) {
				const data = await response.json();
				console.log("✅ Successfully registered for notifications:", data);

				// Check if this is the first time enabling notifications
				const hasShownWelcome = localStorage.getItem("notifications_welcome_shown");
				
				// Show a success notification to user only on first time
				if (Notification.permission === "granted" && !hasShownWelcome) {
					new Notification("🔔 Notifications Enabled!", {
						body: "Notifications enabled only once for first time. You will now receive AI event alerts even when the website is closed.",
						icon: "/favicon.ico",
						tag: "registration-success",
					});
					
					// Mark that we've shown the welcome notification
					localStorage.setItem("notifications_welcome_shown", "true");
				}

				return true;
			} else {
				const errorData = await response.json();
				console.error("Failed to register for notifications:", errorData);
				return false;
			}
		} catch (error) {
			console.error("Error registering for notifications:", error);
			return false;
		}
	}

	// Setup foreground message handler
	setupForegroundHandler() {
		if (!this.isFirebaseConfigured) {
			console.log("Firebase not configured, skipping foreground handler setup");
			return;
		}

		onMessage(messaging, (payload) => {
			console.log("Message received in foreground:", payload);

			// Show custom notification or update UI
			this.showForegroundNotification(payload);
		});
	}

	// Show custom notification for foreground messages
	showForegroundNotification(payload) {
		const { notification, data } = payload;

		// Create a custom notification element or use browser notification
		if (this.permission === "granted") {
			const notificationOptions = {
				body: notification?.body || "New AI event detected",
				icon: "/favicon.ico",
				badge: "/badge-icon.png",
				tag: "ai-event-foreground",
				data: data,
				requireInteraction: true,
			};

			const browserNotification = new Notification(
				notification?.title || "AI Event Monitor Alert",
				notificationOptions
			);

			browserNotification.onclick = () => {
				window.focus();
				// Get the correct client origin
				const clientOrigin = import.meta.env.VITE_CLIENT_ORIGIN || window.location.origin;
				
				// Navigate to specific event if eventId is provided
				if (data?.eventId) {
					// For foreground notifications, we can use relative paths since we're in the same origin
					window.location.href = `/events/${data.eventId}/chat`;
				} else {
					window.location.href = "/events";
				}
				browserNotification.close();
			};

			// Auto close after 10 seconds
			setTimeout(() => {
				browserNotification.close();
			}, 10000);
		}
	}

	// Send test notification
	async sendTestNotification() {
		try {
			const response = await apiService.testNotification();

			if (response.ok) {
				console.log("Test notification sent");
				return true;
			} else {
				console.error("Failed to send test notification");
				return false;
			}
		} catch (error) {
			console.error("Error sending test notification:", error);
			return false;
		}
	}

	// Send AI detection notification
	async sendAIDetectionNotification(eventId, detectionData) {
		try {
			const response = await apiService.sendAIDetectionNotification({
				eventId,
				detectionType: detectionData.type, // 'fire', 'smoke', 'overcrowd', etc.
				probability: detectionData.probability,
				timestamp: new Date().toISOString(),
				location: detectionData.location || "Unknown",
			});

			if (response.ok) {
				console.log("AI detection notification sent");
				return true;
			} else {
				console.error("Failed to send AI detection notification");
				return false;
			}
		} catch (error) {
			console.error("Error sending AI detection notification:", error);
			return false;
		}
	}

	// Get current permission status
	getPermissionStatus() {
		return this.permission || Notification.permission;
	}

	// Get current token
	getCurrentToken() {
		return this.token;
	}

	// Check if notifications are supported
	isNotificationSupported() {
		return this.isSupported;
	}

	// Check if user is currently registered for notifications
	async isUserRegistered() {
		try {
			const authToken = localStorage.getItem("token");
			if (!authToken) return false;

			const response = await apiService.getRegisteredUsers();

			if (response.ok) {
				const data = await response.json();
				const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
				return data.users.includes(currentUser.username);
			}
			return false;
		} catch (error) {
			console.error("Error checking registration status:", error);
			return false;
		}
	}

	// Check if this is the first time enabling notifications
	isFirstTimeNotification() {
		return !localStorage.getItem("notifications_welcome_shown");
	}

	// Force re-registration (useful for debugging or refreshing token)
	async forceRegister() {
		if (this.token) {
			console.log("🔄 Force re-registering current token...");
			return await this.sendTokenToServer(this.token);
		} else {
			console.log("🔄 No token available, initializing notifications...");
			return await this.init();
		}
	}

	// Force service worker update and reconfiguration
	async forceServiceWorkerUpdate() {
		try {
			console.log("🔄 Forcing service worker update...");
			
			// Unregister existing service worker
			const registrations = await navigator.serviceWorker.getRegistrations();
			for (const registration of registrations) {
				if (registration.scope.includes('firebase-messaging-sw.js') || 
					registration.active?.scriptURL.includes('firebase-messaging-sw.js')) {
					console.log("🗑️ Unregistering existing Firebase service worker");
					await registration.unregister();
				}
			}

			// Wait a bit for cleanup
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Re-register service worker
			await this.registerServiceWorker();
			
			console.log("✅ Service worker force updated successfully");
			return true;
		} catch (error) {
			console.error("❌ Error force updating service worker:", error);
			return false;
		}
	}

	// Debug environment information
	getEnvironmentInfo() {
		return {
			hostname: window.location.hostname,
			origin: window.location.origin,
			clientOrigins: import.meta.env.VITE_CLIENT_ORIGIN,
			isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
			isVercel: window.location.hostname.includes('vercel.app'),
			isCustomDomain: window.location.hostname.includes('askarthikey.tech'),
			userAgent: navigator.userAgent,
			notificationPermission: Notification.permission,
			serviceWorkerSupported: 'serviceWorker' in navigator,
			firebaseConfigured: this.isFirebaseConfigured
		};
	}
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
