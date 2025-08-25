import { messaging, vapidKey } from "../firebase/config";
import { getToken, onMessage } from "firebase/messaging";

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
			const registration = await navigator.serviceWorker.register(
				"/firebase-messaging-sw.js"
			);
			console.log("Service Worker registered successfully:", registration);
			return registration;
		} catch (error) {
			console.error("Service Worker registration failed:", error);
			throw error;
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

			const response = await fetch(
				"http://localhost:4000/api/notifications/register",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify({ fcmToken: token }),
				}
			);

			if (response.ok) {
				const data = await response.json();
				console.log("✅ Successfully registered for notifications:", data);

				// Show a success notification to user
				if (Notification.permission === "granted") {
					new Notification("🔔 Notifications Enabled!", {
						body: "You will now receive AI event alerts even when the website is closed.",
						icon: "/favicon.ico",
						tag: "registration-success",
					});
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
				// Navigate to specific event if eventId is provided
				if (data?.eventId) {
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
			const authToken = localStorage.getItem("token");
			const response = await fetch(
				"http://localhost:4000/api/notifications/test",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
				}
			);

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
			const authToken = localStorage.getItem("token");
			const response = await fetch(
				"http://localhost:4000/api/notifications/ai-detection",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify({
						eventId,
						detectionType: detectionData.type, // 'fire', 'smoke', 'overcrowd', etc.
						probability: detectionData.probability,
						timestamp: new Date().toISOString(),
						location: detectionData.location || "Unknown",
					}),
				}
			);

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

			const response = await fetch(
				"http://localhost:4000/api/notifications/registered-users",
				{
					headers: {
						Authorization: `Bearer ${authToken}`,
					},
				}
			);

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
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
