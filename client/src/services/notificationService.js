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
			console.log('Checking for old service workers...');
			const existingRegistrations = await navigator.serviceWorker.getRegistrations();
			for (const reg of existingRegistrations) {
				if (reg.active?.scriptURL.includes('firebase-messaging-sw.js') && 
				    !reg.active?.scriptURL.includes('v=2.1.0')) {
					console.log('Unregistering old service worker:', reg.scope);
					await reg.unregister();
				}
			}
			
			await new Promise(resolve => setTimeout(resolve, 500));
			
			const swVersion = '2.1.0';
			const registration = await navigator.serviceWorker.register(
				`/firebase-messaging-sw.js?v=${swVersion}`,
				{ 
					updateViaCache: 'none',
					scope: '/'
				}
			);
			console.log("Service Worker registered successfully");
			
			await registration.update();
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
			const firebaseConfig = {
				apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
				authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
				projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
				storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
				messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
				appId: import.meta.env.VITE_FIREBASE_APP_ID,
				measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
			};

			const clientOrigins = import.meta.env.VITE_CLIENT_ORIGIN || 'https://event-monitoring-omega.vercel.app,https://event-monitor.askarthikey.tech';
			const currentOrigin = window.location.origin;

			await registration.update();
			
			const configMessage = {
				type: 'FIREBASE_CONFIG',
				config: firebaseConfig,
				clientOrigins: clientOrigins,
				currentOrigin: currentOrigin
			};
			
			if (registration.active) {
				registration.active.postMessage(configMessage);
			} else {
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					newWorker?.addEventListener('statechange', () => {
						if (newWorker.state === 'activated') {
							newWorker.postMessage(configMessage);
						}
					});
				});
			}
		} catch (error) {
			console.error('Error sending config to service worker:', error);
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
			const registration = await navigator.serviceWorker.getRegistration('/');
			if (!registration) {
				console.error("No service worker registration found!");
				return null;
			}
			
			const currentToken = await getToken(messaging, { 
				vapidKey,
				serviceWorkerRegistration: registration
			});
			
			if (currentToken) {
				console.log(
					"FCM Registration token obtained:",
					currentToken.substring(0, 20) + "..."
				);
				this.token = currentToken;

				// Send token to your server to register the user for notifications
				const registrationSuccess = await this.sendTokenToServer(currentToken);

				if (registrationSuccess) {
					console.log("User successfully registered for notifications");
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
				console.log("Successfully registered for notifications");

				const hasShownWelcome = localStorage.getItem("notifications_welcome_shown");
				
				if (Notification.permission === "granted" && !hasShownWelcome) {
					new Notification("🔔 Notifications Enabled!", {
						body: "You will now receive AI event alerts even when the website is closed.",
						icon: "/favicon.ico",
						tag: "registration-success",
					});
					
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
				const clientOrigin = import.meta.env.VITE_CLIENT_ORIGIN || window.location.origin;
				
				if (data?.eventId) {
					window.location.href = `/events/${data.eventId}/chat`;
				} else {
					window.location.href = "/events";
				}
				browserNotification.close();
			};

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
			return await this.sendTokenToServer(this.token);
		} else {
			return await this.init();
		}
	}

	// Force service worker update and reconfiguration
	async forceServiceWorkerUpdate() {
		try {
			console.log("Forcing service worker update...");
			
			const registrations = await navigator.serviceWorker.getRegistrations();
			for (const registration of registrations) {
				if (registration.scope.includes('firebase-messaging-sw.js') || 
					registration.active?.scriptURL.includes('firebase-messaging-sw.js')) {
					await registration.unregister();
				}
			}

			await new Promise(resolve => setTimeout(resolve, 1000));
			await this.registerServiceWorker();
			
			return true;
		} catch (error) {
			console.error("Error force updating service worker:", error);
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
