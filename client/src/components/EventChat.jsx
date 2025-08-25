import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";

const EventChat = () => {
	const { eventId } = useParams();
	const navigate = useNavigate();
	const [socket, setSocket] = useState(null);
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState("");
	const [event, setEvent] = useState(null);
	const [loading, setLoading] = useState(true);
	const [connected, setConnected] = useState(false);
	const messagesEndRef = useRef(null);
	const [username, setUsername] = useState("");

	useEffect(() => {
		// Get username from localStorage (assuming it's stored during login)
		const token = localStorage.getItem("token");
		if (!token) {
			navigate("/login");
			return;
		}

		// Decode token to get username (simple approach)
		try {
			const payload = JSON.parse(atob(token.split(".")[1]));
			setUsername(payload.username);
		} catch (error) {
			console.error("Error decoding token:", error);
			navigate("/login");
			return;
		}

		// Fetch event details
		fetchEventDetails();

		// Initialize socket connection
		const newSocket = io("http://localhost:4000", {
			cors: {
				origin: "http://localhost:3000",
				methods: ["GET", "POST"],
			},
			transports: ["websocket", "polling"],
			timeout: 20000,
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});
		setSocket(newSocket);

		newSocket.on("connect", () => {
			console.log("Connected to server");
			setConnected(true);
			newSocket.emit("join-event", eventId);
		});

		newSocket.on("connect_error", (error) => {
			console.error("Connection error:", error);
			setConnected(false);
		});

		newSocket.on("disconnect", (reason) => {
			console.log("Disconnected from server:", reason);
			setConnected(false);
		});

		newSocket.on("reconnect", () => {
			console.log("Reconnected to server");
			setConnected(true);
			newSocket.emit("join-event", eventId);
		});

		newSocket.on("new-message", (message) => {
			setMessages((prev) => [...prev, message]);
		});

		newSocket.on("message-error", (error) => {
			console.error("Message error:", error);
			alert("Failed to send message");
		});

		// Cleanup on unmount
		return () => {
			newSocket.emit("leave-event", eventId);
			newSocket.disconnect();
		};
	}, [eventId, navigate]);

	useEffect(() => {
		// Scroll to bottom when new messages arrive
		scrollToBottom();
	}, [messages]);

	const fetchEventDetails = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`http://localhost:4000/api/events/${eventId}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (response.ok) {
				const eventData = await response.json();
				setEvent(eventData);

				// Fetch messages
				await fetchMessages();
			} else {
				console.error("Failed to fetch event details");
				navigate("/events");
			}
		} catch (error) {
			console.error("Error fetching event details:", error);
			navigate("/events");
		} finally {
			setLoading(false);
		}
	};

	const fetchMessages = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`http://localhost:4000/api/events/${eventId}/messages`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setMessages(data.messages);
			}
		} catch (error) {
			console.error("Error fetching messages:", error);
		}
	};

	const sendMessage = (e) => {
		e.preventDefault();
		if (!newMessage.trim() || !socket || !connected) return;

		const messageData = {
			eventId,
			message: newMessage.trim(),
			username,
			timestamp: new Date().toISOString(),
		};

		socket.emit("send-message", messageData);
		setNewMessage("");
	};

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const formatTime = (timestamp) => {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatDate = (timestamp) => {
		return new Date(timestamp).toLocaleDateString([], {
			month: "short",
			day: "numeric",
		});
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
				<div className="text-center">
					<div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-white text-lg">Loading event chat...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
			{/* Header */}
			<div className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
				<div className="max-w-6xl mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<button
								onClick={() => navigate("/events")}
								className="p-2 hover:bg-white/10 rounded-lg transition-colors">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>
							<div>
								<h1 className="text-xl font-semibold text-white">
									{event?.title || "Event Chat"}
								</h1>
								<p className="text-gray-400 text-sm">
									{event?.organizers?.length > 0 &&
										`Organized by ${event.organizers[0]}`}
								</p>
							</div>
						</div>

						<div className="flex items-center space-x-2">
							<div
								className={`w-3 h-3 rounded-full ${
									connected ? "bg-green-500" : "bg-red-500"
								}`}></div>
							<span className="text-white text-sm">
								{connected ? "Connected" : "Connecting..."}
							</span>
							{!connected && (
								<button
									onClick={() => window.location.reload()}
									className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
									Retry
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Chat Container */}
			<div className="max-w-6xl mx-auto px-4 py-6 h-[calc(100vh-100px)] flex flex-col">
				{/* Messages Area */}
				<div className="flex-1 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col">
					<div className="flex-1 overflow-y-auto p-6 space-y-4">
						{messages.length === 0 ? (
							<div className="text-center text-gray-400 py-16">
								<div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
									<svg
										className="w-8 h-8"
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
								</div>
								<p className="text-lg font-medium mb-2">No messages yet</p>
								<p className="text-sm">
									Be the first to start the conversation!
								</p>
							</div>
						) : (
							messages.map((message, index) => {
								const isOwn = message.username === username;
								const showDate =
									index === 0 ||
									formatDate(message.timestamp) !==
										formatDate(messages[index - 1]?.timestamp);

								return (
									<div key={message._id || index}>
										{showDate && (
											<div className="text-center text-gray-500 text-sm py-2">
												{formatDate(message.timestamp)}
											</div>
										)}
										<div
											className={`flex ${
												isOwn ? "justify-end" : "justify-start"
											}`}>
											<div
												className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
													isOwn
														? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
														: "bg-white/10 text-white border border-white/20"
												}`}>
												{!isOwn && (
													<p className="text-xs text-gray-300 mb-1 font-medium">
														{message.username}
													</p>
												)}
												<p className="text-sm leading-relaxed">
													{message.message}
												</p>
												<p
													className={`text-xs mt-1 ${
														isOwn ? "text-blue-200" : "text-gray-400"
													}`}>
													{formatTime(message.timestamp)}
												</p>
											</div>
										</div>
									</div>
								);
							})
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Message Input */}
					<div className="p-6 border-t border-white/10">
						<form onSubmit={sendMessage} className="flex space-x-4">
							<input
								type="text"
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								placeholder="Type your message..."
								className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								disabled={!connected}
							/>
							<button
								type="submit"
								disabled={!newMessage.trim() || !connected}
								className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2">
								<svg
									className="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
									/>
								</svg>
								<span>Send</span>
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
};

export default EventChat;
