import React, { useState, useEffect } from "react";

const SendNotificationModal = ({ isOpen, onClose }) => {
	const [registeredUsers, setRegisteredUsers] = useState([]);
	const [selectedUser, setSelectedUser] = useState("");
	const [title, setTitle] = useState("");
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);
	const [sendMode, setSendMode] = useState("individual"); // 'individual' or 'broadcast'

	useEffect(() => {
		if (isOpen) {
			fetchRegisteredUsers();
		}
	}, [isOpen]);

	const fetchRegisteredUsers = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				"http://localhost:4000/api/notifications/registered-users",
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);
			const data = await response.json();
			if (data.success) {
				setRegisteredUsers(data.users);
			}
		} catch (error) {
			console.error("Error fetching users:", error);
		}
	};

	const generateTestToken = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				"http://localhost:4000/api/notifications/generate-test-token",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						deviceName: "test-device",
					}),
				}
			);

			const data = await response.json();
			if (data.success) {
				alert(`Test FCM token generated for ${data.userId}!`);
				fetchRegisteredUsers(); // Refresh the user list
			} else {
				alert(`Error: ${data.message}`);
			}
		} catch (error) {
			console.error("Error generating test token:", error);
			alert("Failed to generate test token");
		}
	};

	const sendNotification = async () => {
		if (!title || !message) {
			alert("Please fill in title and message");
			return;
		}

		if (sendMode === "individual" && !selectedUser) {
			alert("Please select a user");
			return;
		}

		setLoading(true);
		try {
			const token = localStorage.getItem("token");

			let endpoint, body;
			if (sendMode === "broadcast") {
				endpoint = "http://localhost:4000/api/notifications/broadcast";
				body = { title, body: message };
			} else {
				endpoint = "http://localhost:4000/api/notifications/send-to-user";
				body = { targetUsername: selectedUser, title, body: message };
			}

			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(body),
			});

			const data = await response.json();
			if (data.success) {
				if (sendMode === "broadcast") {
					alert(
						`Broadcast sent successfully to ${data.sent?.length || 0} users!`
					);
				} else {
					alert(`Notification sent to ${selectedUser}!`);
				}
				setTitle("");
				setMessage("");
				setSelectedUser("");
				onClose();
			} else {
				alert(`Error: ${data.message}`);
			}
		} catch (error) {
			console.error("Error sending notification:", error);
			alert("Failed to send notification");
		} finally {
			setLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 w-96 max-w-md max-h-[90vh] overflow-y-auto">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-bold">Send Notification</h2>
					<button
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700">
						✕
					</button>
				</div>

				<div className="space-y-4">
					{/* Send Mode Toggle */}
					<div>
						<label className="block text-sm font-medium mb-2">Send Mode:</label>
						<div className="flex space-x-2">
							<button
								onClick={() => setSendMode("individual")}
								className={`px-3 py-2 rounded-md text-sm font-medium ${
									sendMode === "individual"
										? "bg-blue-600 text-white"
										: "bg-gray-200 text-gray-700 hover:bg-gray-300"
								}`}>
								Individual User
							</button>
							<button
								onClick={() => setSendMode("broadcast")}
								className={`px-3 py-2 rounded-md text-sm font-medium ${
									sendMode === "broadcast"
										? "bg-purple-600 text-white"
										: "bg-gray-200 text-gray-700 hover:bg-gray-300"
								}`}>
								Broadcast to All
							</button>
						</div>
					</div>

					{/* User Selection (only for individual mode) */}
					{sendMode === "individual" && (
						<div>
							<label className="block text-sm font-medium mb-1">
								Send to user:
							</label>
							<select
								value={selectedUser}
								onChange={(e) => setSelectedUser(e.target.value)}
								className="w-full p-2 border border-gray-300 rounded-md">
								<option value="">Select a user...</option>
								{registeredUsers.map((user) => (
									<option key={user} value={user}>
										{user}
									</option>
								))}
							</select>
						</div>
					)}

					{/* Broadcast Info */}
					{sendMode === "broadcast" && (
						<div className="bg-purple-50 border border-purple-200 rounded-md p-3">
							<p className="text-sm text-purple-800">
								📢 This will send to{" "}
								<strong>{registeredUsers.length} users</strong>:{" "}
								{registeredUsers.join(", ")}
							</p>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium mb-1">Title:</label>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Notification title"
							className="w-full p-2 border border-gray-300 rounded-md"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-1">Message:</label>
						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Your message here..."
							rows={3}
							className="w-full p-2 border border-gray-300 rounded-md"
						/>
					</div>

					{/* Quick Test Messages */}
					<div>
						<label className="block text-sm font-medium mb-2">
							Quick Test Messages:
						</label>
						<div className="grid grid-cols-2 gap-2">
							<button
								onClick={() => {
									setTitle("🔥 Fire Alert");
									setMessage("Fire detected in Camera 3 with 85% confidence!");
								}}
								className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200">
								Fire Alert
							</button>
							<button
								onClick={() => {
									setTitle("👥 Crowd Alert");
									setMessage("Overcrowding detected in main entrance area!");
								}}
								className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200">
								Crowd Alert
							</button>
							<button
								onClick={() => {
									setTitle("✅ System Test");
									setMessage(
										"This is a test notification. System is working properly."
									);
								}}
								className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200">
								System Test
							</button>
							<button
								onClick={() => {
									setTitle("🚨 Emergency");
									setMessage(
										"Emergency situation detected! Please respond immediately."
									);
								}}
								className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200">
								Emergency
							</button>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-2">
						<button
							onClick={sendNotification}
							disabled={loading}
							className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
							{loading
								? "Sending..."
								: sendMode === "broadcast"
								? "Broadcast"
								: "Send"}
						</button>
						<button
							onClick={onClose}
							className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
							Cancel
						</button>
					</div>

					{/* Generate Test Token */}
					<div className="border-t pt-4">
						<label className="block text-sm font-medium mb-2">
							Troubleshooting:
						</label>
						<button
							onClick={generateTestToken}
							className="w-full bg-yellow-100 text-yellow-800 py-2 px-4 rounded-md hover:bg-yellow-200 text-sm">
							🔧 Generate Test FCM Token (for device issues)
						</button>
					</div>
				</div>

				<div className="mt-4 text-sm text-gray-600">
					<p>
						<strong>Registered Users:</strong> {registeredUsers.length}
					</p>
					<p className="text-xs">
						Only users who have enabled notifications can receive messages.
					</p>
				</div>
			</div>
		</div>
	);
};

export default SendNotificationModal;
