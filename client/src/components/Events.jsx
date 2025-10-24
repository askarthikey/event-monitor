import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/apiService";
import AddEventModal from "./AddEventModal";
import NotificationSettings from "./NotificationSettings";
import SendNotificationModal from "./SendNotificationModal";
import notificationService from "../services/notificationService";

// Error Boundary Component
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		console.error("Events component error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-white flex items-center justify-center p-4">
					<div className="text-center">
						<h2 className="text-2xl font-bold text-red-600 mb-4">
							Something went wrong
						</h2>
						<p className="text-gray-600 mb-4">
							An error occurred while loading the events.
						</p>
						<button
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
							Reload Page
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

const Events = () => {
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
	const [isVisible, setIsVisible] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] =
		useState(false);
	const [isSendNotificationOpen, setIsSendNotificationOpen] = useState(false);
	const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
	const [selectedEventLogs, setSelectedEventLogs] = useState(null);
	const [loadingLogs, setLoadingLogs] = useState(false);
	const [notificationPermission, setNotificationPermission] =
		useState("default");
	const navigate = useNavigate();

	useEffect(() => {
		setIsVisible(true);

		const handleMouseMove = (e) => {
			setMousePosition({ x: e.clientX, y: e.clientY });
		};

		window.addEventListener("mousemove", handleMouseMove);

		// Fetch events when component mounts
		fetchEvents();

		// Initialize notification service
		initializeNotifications();

		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, []);

	// Events data - fetched from API
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);

	// Initialize notifications
	const initializeNotifications = async () => {
		try {
			if (notificationService.isNotificationSupported()) {
				const permission = notificationService.getPermissionStatus();
				setNotificationPermission(permission);

				// Auto-initialize if permission was previously granted
				if (permission === "granted") {
					await notificationService.init();
				}
			}
		} catch (error) {
			console.error("Error initializing notifications:", error);
		}
	};

	const fetchEvents = async () => {
		try {
			const token = localStorage.getItem("token");
			if (!token) {
				console.error("No token found");
				setLoading(false);
				return;
			}

			const response = await apiService.getEvents();

			if (response.ok) {
				const eventsData = await response.json();
				setEvents(eventsData);
			} else {
				console.error("Failed to fetch events");
			}
		} catch (error) {
			console.error("Error fetching events:", error);
		} finally {
			setLoading(false);
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case "active":
				return "bg-green-500/20 text-green-300 border-green-500/30";
			case "upcoming":
				return "bg-blue-500/20 text-blue-300 border-blue-500/30";
			case "completed":
				return "bg-gray-500/20 text-gray-300 border-gray-500/30";
			default:
				return "bg-white/20 text-white border-white/30";
		}
	};

	// Safe text rendering helper
	const safeRenderText = (content) => {
		if (typeof content === "string") {
			return content;
		} else if (typeof content === "object" && content !== null) {
			// If it's an object, try to extract meaningful text
			if (content.summary) return content.summary;
			if (content.logs && Array.isArray(content.logs))
				return content.logs.join("\n");
			// Otherwise, stringify it safely
			return JSON.stringify(content, null, 2);
		}
		return String(content || "");
	};

	// Safe image source generation
	const generateEventImageSrc = (event) => {
		if (event?.image) {
			return event.image;
		}

		const title = event?.title || "Event";
		const svgContent = `
			<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" style="stop-color:#374151;stop-opacity:1" />
						<stop offset="100%" style="stop-color:#1f2937;stop-opacity:1" />
					</linearGradient>
				</defs>
				<rect width="400" height="300" fill="url(#grad)"/>
				<circle cx="120" cy="100" r="30" fill="#6b7280" opacity="0.3"/>
				<circle cx="280" cy="100" r="25" fill="#9ca3af" opacity="0.2"/>
				<circle cx="200" cy="200" r="35" fill="#4b5563" opacity="0.4"/>
				<text x="200" y="150" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#e5e7eb" text-anchor="middle" dominant-baseline="middle">${title}</text>
				<text x="200" y="175" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">Event Monitoring</text>
			</svg>
		`;

		return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
	};

	const formatDate = (dateString) => {
		if (!dateString) return "Date TBD";
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return "Invalid Date";
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const getEventStatus = (event) => {
		if (!event.startDate || !event.endDate) return "upcoming";

		const now = new Date();
		const startDate = new Date(event.startDate);
		const endDate = new Date(event.endDate);

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
			return "upcoming";

		if (now < startDate) return "upcoming";
		if (now > endDate) return "completed";
		return "active";
	};

	const handleViewEvent = (eventId) => {
		// Navigate to event chat page
		navigate(`/events/${eventId}/chat`);
	};

	const handleMoreInfo = (event) => {
		// Navigate to CCTV links management page with event data
		console.log("More info for event:", event);
		navigate("/cctvlinks", { state: { event } });
	};

	const handleAddEvent = () => {
		setIsModalOpen(true);
	};

	const handleModalClose = () => {
		setIsModalOpen(false);
	};

	const handleNotificationSettings = () => {
		setIsNotificationSettingsOpen(true);
	};

	const handleNotificationSettingsClose = () => {
		setIsNotificationSettingsOpen(false);
		// Update permission status after settings modal closes
		setNotificationPermission(notificationService.getPermissionStatus());
	};

	const handleSendNotification = () => {
		setIsSendNotificationOpen(true);
	};

	const handleSendNotificationClose = () => {
		setIsSendNotificationOpen(false);
	};

	// Handle show logs
	const handleShowLogs = async (event) => {
		try {
			setLoadingLogs(true);
			const token = localStorage.getItem("token");

			if (!token) {
				console.error("No authentication token found");
				setSelectedEventLogs({
					aiSummary: "Authentication required to view logs.",
					aiLogs: ["Please log in to view event logs"],
					aiAnalysis: "Authentication needed",
				});
				setIsLogsModalOpen(true);
				return;
			}

			const eventId = event?.id || event?._id;
			if (!eventId) {
				console.error("No event ID found");
				setSelectedEventLogs({
					aiSummary: "Event ID not found.",
					aiLogs: ["Invalid event data"],
					aiAnalysis: "Error: Event ID missing",
				});
				setIsLogsModalOpen(true);
				return;
			}

			console.log(`Fetching logs for event: ${eventId}`);

			const response = await apiService.getEventLogs(eventId);

			console.log(`Response status: ${response.status}`);

			if (response.ok) {
				const result = await response.json();
				console.log("Logs response:", result);

				if (result.success && result.data) {
					// Safely extract and convert the data
					const aiSummary =
						typeof result.data.aiSummary === "object"
							? result.data.aiSummary.summary ||
							  JSON.stringify(result.data.aiSummary)
							: result.data.aiSummary || "No AI summary available yet.";

					const aiLogs = Array.isArray(result.data.aiLogs)
						? result.data.aiLogs
						: typeof result.data.aiLogs === "object" && result.data.aiLogs?.logs
						? result.data.aiLogs.logs
						: ["Event created", "Monitoring initiated"];

					const aiAnalysis =
						typeof result.data.aiAnalysis === "object"
							? result.data.aiAnalysis.summary ||
							  JSON.stringify(result.data.aiAnalysis)
							: result.data.aiAnalysis || "Analysis pending";

					setSelectedEventLogs({
						aiSummary,
						aiLogs,
						aiAnalysis,
						detectionResults: result.data.detectionResults || null,
						processingStatus: result.data.processingStatus || "unknown",
						hasAIData: result.data.hasAIData || false,
					});
				} else {
					throw new Error(result.error || "Invalid response format");
				}
			} else {
				const errorText = await response.text();
				console.error(
					`Failed to fetch logs: ${response.status} - ${errorText}`
				);

				// Show more detailed error information
				setSelectedEventLogs({
					aiSummary: `Error fetching logs: ${response.status} ${response.statusText}`,
					aiLogs: [
						`HTTP ${response.status}: ${response.statusText}`,
						"Please try again later",
					],
					aiAnalysis: `Server error: ${errorText || "Unknown error"}`,
				});
			}

			setIsLogsModalOpen(true);
		} catch (error) {
			console.error("Error fetching logs:", error);

			// Show detailed error information
			setSelectedEventLogs({
				aiSummary: `Network error: ${error.message}`,
				aiLogs: [
					"Failed to connect to server",
					`Error: ${error.message}`,
					"Please check your connection and try again",
				],
				aiAnalysis: `Connection failed: ${error.name || "Unknown error"}`,
			});
			setIsLogsModalOpen(true);
		} finally {
			setLoadingLogs(false);
		}
	};

	// Handle logs modal close
	const handleLogsModalClose = () => {
		setIsLogsModalOpen(false);
		setSelectedEventLogs(null);
	};

	// Simulate AI detection for testing
	const simulateAIDetection = async (event, detectionType = "fire") => {
		const detectionData = {
			type: detectionType,
			probability: Math.random() * 0.4 + 0.6, // 60-100%
			location: `Camera ${Math.floor(Math.random() * 5) + 1}`,
			timestamp: new Date().toISOString(),
		};

		try {
			await notificationService.sendAIDetectionNotification(
				event.id || event._id,
				detectionData
			);
			console.log(
				`Simulated ${detectionType} detection for event:`,
				event.title
			);
		} catch (error) {
			console.error("Error sending AI detection notification:", error);
		}
	};

	const handleEventSubmit = async (eventData) => {
		try {
			const token = localStorage.getItem("token");
			if (!token) {
				console.error("No token found");
				return;
			}

			// Create FormData for multipart/form-data submission
			const formData = new FormData();

			// Add all text fields
			formData.append("title", eventData.title);
			formData.append("startDate", eventData.startDate);
			formData.append("endDate", eventData.endDate);

			// Add CCTV configurations as JSON string
			formData.append(
				"cctvConfigs",
				JSON.stringify(eventData.cctvConfigs || [])
			);

			// Video source fields commented out for now
			/*
      formData.append('videoSource', eventData.videoSource);
      
      // Add video source specific data
      if (eventData.videoSource === 'rtsp') {
        formData.append('rtspLink', eventData.rtspLink);
      } else if (eventData.videoSource === 'file' && eventData.videoFile) {
        formData.append('videoFile', eventData.videoFile);
      }
      */

			// Add event image if provided
			if (eventData.eventImage) {
				formData.append("eventImage", eventData.eventImage);
			}

			// Add additional organizers as JSON string
			formData.append(
				"additionalOrganizers",
				JSON.stringify(eventData.additionalOrganizers || [])
			);

			const response = await apiService.createEvent(formData);

			if (response.ok) {
				const result = await response.json();
				console.log("Event created successfully:", result);

				// Add the new event to the local state
				setEvents((prevEvents) => [...prevEvents, result.event]);

				return result; // Return success result
			} else {
				const error = await response.json();
				console.error("Failed to create event:", error);
				throw new Error(error.message || "Failed to create event");
			}
		} catch (error) {
			console.error("Error creating event:", error);
			throw error; // Re-throw to be caught by modal
		}
	};

	return (
		<>
			{/* Custom animations - moved to CSS file or inline styles */}
			<style>{`
				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(30px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				@keyframes slideInLeft {
					from {
						opacity: 0;
						transform: translateX(-30px);
					}
					to {
						opacity: 1;
						transform: translateX(0);
					}
				}

				@keyframes slideInRight {
					from {
						opacity: 0;
						transform: translateX(30px);
					}
					to {
						opacity: 1;
						transform: translateX(0);
					}
				}

				@keyframes float {
					0%,
					100% {
						transform: translateY(0px) rotate(0deg);
					}
					50% {
						transform: translateY(-20px) rotate(180deg);
					}
				}

				@keyframes floatSlow {
					0%,
					100% {
						transform: translateY(0px) translateX(0px);
					}
					25% {
						transform: translateY(-15px) translateX(10px);
					}
					50% {
						transform: translateY(-30px) translateX(-10px);
					}
					75% {
						transform: translateY(-15px) translateX(15px);
					}
				}

				@keyframes twinkle {
					0%,
					100% {
						opacity: 0.3;
						transform: scale(0.8);
					}
					50% {
						opacity: 1;
						transform: scale(1.2);
					}
				}

				.animate-fadeInUp {
					animation: fadeInUp 0.8s ease-out forwards;
					opacity: 0;
				}

				.animate-slideInLeft {
					animation: slideInLeft 0.6s ease-out forwards;
					opacity: 0;
				}

				.animate-slideInRight {
					animation: slideInRight 0.6s ease-out forwards;
					opacity: 0;
				}

				.animate-float {
					animation: float 6s ease-in-out infinite;
				}

				.animate-floatSlow {
					animation: floatSlow 8s ease-in-out infinite;
				}

				.animate-twinkle {
					animation: twinkle 2s ease-in-out infinite;
				}

				.card-hover:hover {
					transform: translateY(-8px);
				}
			`}</style>

			<div className="relative overflow-hidden min-h-screen bg-white">
				{/* Subtle dynamic background gradient that follows mouse */}
				<div
					className="absolute inset-0 opacity-5 transition-all duration-1000 ease-out pointer-events-none"
					style={{
						background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.05), transparent 50%)`,
					}}
				/>

				{/* Minimalist animated background particles */}
				<div className="absolute inset-0 pointer-events-none">
					{/* Floating particles */}
					<div
						className="absolute top-20 left-10 w-2 h-2 bg-black/10 rounded-full animate-float"
						style={{ animationDelay: "0s" }}></div>
					<div
						className="absolute top-40 right-20 w-1.5 h-1.5 bg-gray-400/20 rounded-full animate-floatSlow"
						style={{ animationDelay: "1s" }}></div>
					<div
						className="absolute bottom-32 left-1/4 w-1 h-1 bg-black/15 rounded-full animate-float"
						style={{ animationDelay: "2s" }}></div>
					<div
						className="absolute top-1/3 right-1/3 w-2.5 h-2.5 bg-gray-300/15 rounded-full animate-floatSlow"
						style={{ animationDelay: "0.5s" }}></div>
					<div
						className="absolute bottom-20 right-10 w-1.5 h-1.5 bg-black/12 rounded-full animate-float"
						style={{ animationDelay: "1.5s" }}></div>
					<div
						className="absolute top-2/3 left-1/5 w-1 h-1 bg-gray-400/18 rounded-full animate-floatSlow"
						style={{ animationDelay: "3s" }}></div>

					{/* Subtle twinkling dots */}
					<div
						className="absolute top-10 left-10 w-1 h-1 bg-black/30 rounded-full animate-twinkle"
						style={{ animationDelay: "0s" }}></div>
					<div
						className="absolute top-20 right-20 w-0.5 h-0.5 bg-gray-500/40 rounded-full animate-twinkle"
						style={{ animationDelay: "1s" }}></div>
					<div
						className="absolute top-32 left-1/3 w-1.5 h-1.5 bg-black/25 rounded-full animate-twinkle"
						style={{ animationDelay: "2s" }}></div>
					<div
						className="absolute bottom-20 left-1/4 w-0.5 h-0.5 bg-gray-600/35 rounded-full animate-twinkle"
						style={{ animationDelay: "1.5s" }}></div>
					<div
						className="absolute bottom-40 right-1/3 w-1 h-1 bg-black/20 rounded-full animate-twinkle"
						style={{ animationDelay: "2.5s" }}></div>
				</div>

				{/* Main content */}
				<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					{/* Header */}
					<div
						className={`mb-12 transition-all duration-700 ${
							isVisible ? "animate-fadeInUp" : "opacity-0"
						}`}>
						<div className="flex items-center justify-between">
							{/* Left - Title */}
							<div>
								<h1 className="text-4xl font-bold text-black mb-2">
									Event Monitoring Dashboard
								</h1>
								<p className="text-gray-600 text-lg">
									Monitor and manage events in real-time with AI-powered
									insights
								</p>
							</div>

							{/* Right - Action Buttons */}
							<div className="flex items-center space-x-4">
								{/* Notification Settings Button */}
								<button
									onClick={handleNotificationSettings}
									className={`px-4 py-3 font-semibold rounded-xl shadow-lg border-2 transition-all duration-200 transform hover:shadow-xl hover:-translate-y-0.5 flex items-center space-x-2 ${
										notificationPermission === "granted"
											? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
											: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200"
									}`}>
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M15 17h5l-5 5-5-5h5V6a1 1 0 011-1h0a1 1 0 011 1v11z"
										/>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M13.5 3H12H8C6.5 3 5 4.5 5 6v14c0 1.5 1.5 3 3 3h8c1.5 0 3-1.5 3-3V6c0-1.5-1.5-3-3-3h-1.5z"
										/>
									</svg>
									<span>
										{notificationPermission === "granted"
											? "Notifications On"
											: "Enable Alerts"}
									</span>
								</button>

								{/* Send Notification Button */}
								<button
									onClick={handleSendNotification}
									className="px-4 py-3 bg-blue-100 text-blue-800 border-blue-300 font-semibold rounded-xl shadow-lg border-2 transition-all duration-200 transform hover:bg-blue-200 hover:shadow-xl hover:-translate-y-0.5 flex items-center space-x-2">
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
										/>
									</svg>
									<span>Send Message</span>
								</button>

								{/* Add New Event Button */}
								<button
									onClick={handleAddEvent}
									className="px-6 py-3 bg-black text-white font-semibold rounded-xl shadow-lg border-2 border-black transition-all duration-200 transform hover:bg-gray-800 hover:shadow-xl hover:-translate-y-0.5 flex items-center space-x-2">
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4v16m8-8H4"
										/>
									</svg>
									<span>Add New Event</span>
								</button>
							</div>
						</div>
					</div>

					{/* Events Grid */}
					<div
						className={`transition-all duration-700 delay-300 ${
							isVisible ? "animate-slideInLeft" : "opacity-0"
						}`}>
						{loading ? (
							/* Loading State */
							<div className="text-center py-16">
								<div className="flex justify-center mb-6">
									<div className="w-24 h-24 bg-white border-2 border-black rounded-full flex items-center justify-center animate-pulse shadow-lg">
										<svg
											className="w-12 h-12 text-black"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
											/>
										</svg>
									</div>
								</div>
								<h3 className="text-2xl font-semibold text-black mb-4">
									Loading Events...
								</h3>
								<p className="text-gray-600">
									Please wait while we fetch your events.
								</p>
							</div>
						) : events.length === 0 ? (
							/* No Events Message */
							<div className="text-center py-16">
								<div className="flex justify-center mb-6">
									<div className="w-24 h-24 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-lg">
										<svg
											className="w-12 h-12 text-black"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
											/>
										</svg>
									</div>
								</div>
								<h3 className="text-2xl font-semibold text-black mb-4">
									No Events Found
								</h3>
								<p className="text-gray-600 mb-8 max-w-md mx-auto">
									There are currently no events to display. Start by creating
									your first event using the button above.
								</p>
								<button
									onClick={handleAddEvent}
									className="px-6 py-3 bg-black text-white font-semibold rounded-xl shadow-lg border-2 border-black transition-all duration-200 transform hover:bg-gray-800 hover:shadow-xl hover:-translate-y-0.5 inline-flex items-center space-x-2">
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4v16m8-8H4"
										/>
									</svg>
									<span>Create Your First Event</span>
								</button>
							</div>
						) : (
							/* Events Grid */
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
								{events.map((event, index) => (
									<div
										key={event.id || event._id || index}
										className="card-hover bg-white rounded-2xl border-2 border-black shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-3xl hover:-translate-y-2"
										style={{ animationDelay: `${index * 100}ms` }}>
										{/* Event Image */}
										<div className="relative h-48 overflow-hidden">
											<img
												src={generateEventImageSrc(event)}
												alt={event?.title || "Event"}
												className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
												onError={(e) => {
													e.target.src = generateEventImageSrc({
														title: "Event",
													});
												}}
											/>
											<div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

											{/* Status Badge */}
											<div
												className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium border-2 backdrop-blur-sm ${
													getEventStatus(event) === "active"
														? "bg-green-100 text-green-800 border-green-300"
														: getEventStatus(event) === "upcoming"
														? "bg-blue-100 text-blue-800 border-blue-300"
														: "bg-gray-100 text-gray-800 border-gray-300"
												}`}>
												{(() => {
													const status = getEventStatus(event);
													return (
														status.charAt(0).toUpperCase() + status.slice(1)
													);
												})()}
											</div>

											{/* Date Badge */}
											<div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20">
												<div className="text-white text-sm font-medium">
													{formatDate(event?.startDate || event?.date)}
												</div>
											</div>
										</div>

										{/* Event Content */}
										<div className="p-6">
											<h3 className="text-xl font-semibold text-black mb-3 line-clamp-1">
												{event?.title || "Untitled Event"}
											</h3>

											<p className="text-gray-600 text-sm mb-6 line-clamp-2">
												{event?.description || "No description available"}
											</p>

											{/* Action Buttons */}
											<div className="space-y-3">
												<button
													onClick={() =>
														handleViewEvent(event?.id || event?._id)
													}
													className="w-full py-3 bg-white border-2 border-black text-black font-semibold rounded-xl shadow-md transition-all duration-200 transform hover:bg-gray-50 hover:shadow-lg hover:-translate-y-0.5">
													<span className="flex items-center justify-center space-x-2">
														<span>View Details</span>
														<svg
															className="w-4 h-4"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24">
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
															/>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
															/>
														</svg>
													</span>
												</button>

												<div className="grid grid-cols-2 gap-2">
													<button
														onClick={() => handleMoreInfo(event)}
														className="py-2 bg-black text-white font-semibold rounded-xl border-2 border-black shadow-md transition-all duration-200 transform hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 text-sm">
														<span className="flex items-center justify-center space-x-1">
															<span>More Info</span>
															<svg
																className="w-3 h-3"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24">
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
																/>
															</svg>
														</span>
													</button>

													{/* Test Notification Button */}
													<button
														onClick={() => simulateAIDetection(event, "fire")}
														className="py-2 bg-red-600 text-white font-semibold rounded-xl border-2 border-red-600 shadow-md transition-all duration-200 transform hover:bg-red-700 hover:shadow-lg hover:-translate-y-0.5 text-sm"
														title="Simulate Fire Detection">
														<span className="flex items-center justify-center space-x-1">
															<span>🔥 Test</span>
														</span>
													</button>
												</div>

												{/* Show Logs Button */}
												<button
													onClick={() => handleShowLogs(event)}
													disabled={loadingLogs}
													className="w-full py-2 bg-blue-600 text-white font-semibold rounded-xl border-2 border-blue-600 shadow-md transition-all duration-200 transform hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
													<span className="flex items-center justify-center space-x-1">
														{loadingLogs ? (
															<>
																<svg
																	className="animate-spin w-3 h-3"
																	fill="none"
																	viewBox="0 0 24 24">
																	<circle
																		className="opacity-25"
																		cx="12"
																		cy="12"
																		r="10"
																		stroke="currentColor"
																		strokeWidth="4"></circle>
																	<path
																		className="opacity-75"
																		fill="currentColor"
																		d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
																</svg>
																<span>Loading...</span>
															</>
														) : (
															<>
																<span>📊 Show Logs</span>
															</>
														)}
													</span>
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Load More Button - only show if there are events */}
					{events.length > 0 && (
						<div className="text-center mt-12">
							<button className="px-8 py-3 bg-white border-2 border-black rounded-xl text-black hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 font-medium">
								Load More Events
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Add Event Modal */}
			<AddEventModal
				isOpen={isModalOpen}
				onClose={handleModalClose}
				onSubmit={handleEventSubmit}
			/>

			{/* Notification Settings Modal */}
			{isNotificationSettingsOpen && (
				<NotificationSettings onClose={handleNotificationSettingsClose} />
			)}

			{/* Send Notification Modal */}
			<SendNotificationModal
				isOpen={isSendNotificationOpen}
				onClose={handleSendNotificationClose}
			/>

			{/* Logs Modal */}
			{isLogsModalOpen && selectedEventLogs && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-2xl border-2 border-black shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
						{/* Modal Header */}
						<div className="flex justify-between items-center p-6 border-b-2 border-black">
							<h2 className="text-2xl font-bold text-black">
								📊 Event Analysis & Logs
							</h2>
							<button
								onClick={handleLogsModalClose}
								className="text-gray-500 hover:text-black transition-colors duration-200">
								<svg
									className="w-6 h-6"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						{/* Modal Content */}
						<div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
							{/* Processing Status (if available) */}
							{selectedEventLogs?.processingStatus && (
								<div className="mb-6">
									<h3 className="text-lg font-semibold text-black mb-3 flex items-center">
										<span className="mr-2">⚙️</span>
										Processing Status
									</h3>
									<div
										className={`border-2 rounded-xl p-4 ${
											selectedEventLogs.processingStatus === "completed"
												? "bg-green-50 border-green-200"
												: selectedEventLogs.processingStatus === "processing"
												? "bg-yellow-50 border-yellow-200"
												: selectedEventLogs.processingStatus === "failed"
												? "bg-red-50 border-red-200"
												: "bg-gray-50 border-gray-200"
										}`}>
										<p className="text-gray-800 leading-relaxed font-medium">
											Status:{" "}
											{selectedEventLogs.processingStatus
												?.charAt(0)
												.toUpperCase() +
												selectedEventLogs.processingStatus?.slice(1)}
										</p>
										{selectedEventLogs.hasAIData !== undefined && (
											<p className="text-gray-600 text-sm mt-1">
												AI Data Available:{" "}
												{selectedEventLogs.hasAIData ? "Yes" : "No"}
											</p>
										)}
									</div>
								</div>
							)}

							{/* AI Summary Section */}
							<div className="mb-6">
								<h3 className="text-lg font-semibold text-black mb-3 flex items-center">
									<span className="mr-2">🤖</span>
									AI Summary
								</h3>
								<div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
									<p className="text-gray-800 leading-relaxed">
										{safeRenderText(selectedEventLogs?.aiSummary) ||
											"No AI summary available"}
									</p>
								</div>
							</div>

							{/* AI Analysis Section */}
							{selectedEventLogs?.aiAnalysis && (
								<div className="mb-6">
									<h3 className="text-lg font-semibold text-black mb-3 flex items-center">
										<span className="mr-2">🔍</span>
										Detailed Analysis
									</h3>
									<div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
										<p className="text-gray-800 leading-relaxed">
											{safeRenderText(selectedEventLogs.aiAnalysis)}
										</p>
									</div>
								</div>
							)}

							{/* Activity Logs Section */}
							<div className="mb-6">
								<h3 className="text-lg font-semibold text-black mb-3 flex items-center">
									<span className="mr-2">📝</span>
									Activity Logs
								</h3>
								<div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 max-h-60 overflow-y-auto">
									{selectedEventLogs?.aiLogs &&
									Array.isArray(selectedEventLogs.aiLogs) &&
									selectedEventLogs.aiLogs.length > 0 ? (
										<ul className="space-y-2">
											{selectedEventLogs.aiLogs.map((log, index) => (
												<li key={index} className="flex items-start space-x-2">
													<span className="text-blue-600 mt-1">•</span>
													<span className="text-gray-800 text-sm">
														{safeRenderText(log)}
													</span>
												</li>
											))}
										</ul>
									) : (
										<p className="text-gray-500 text-sm">
											No activity logs available
										</p>
									)}
								</div>
							</div>

							{/* Detection Results Section */}
							{selectedEventLogs?.detectionResults && (
								<div className="mb-6">
									<h3 className="text-lg font-semibold text-black mb-3 flex items-center">
										<span className="mr-2">⚠️</span>
										Detection Results
									</h3>
									<div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
										<pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
											{JSON.stringify(
												selectedEventLogs.detectionResults,
												null,
												2
											)}
										</pre>
									</div>
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className="flex justify-end p-6 border-t-2 border-gray-200">
							<button
								onClick={handleLogsModalClose}
								className="px-6 py-2 bg-black text-white font-semibold rounded-xl border-2 border-black shadow-md transition-all duration-200 transform hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5">
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

const EventsWithErrorBoundary = () => {
	return (
		<ErrorBoundary>
			<Events />
		</ErrorBoundary>
	);
};

export default EventsWithErrorBoundary;
