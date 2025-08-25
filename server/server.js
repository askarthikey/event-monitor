const exp = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoClient = require("mongodb").MongoClient;
const multer = require("multer");
const fs = require("fs");
const { detectOvercrowding } = require("./helpers/overCrowddetection");
const { detectFireIntensity } = require("./helpers/firedetection");
const { preprocess } = require("./helpers/preprocessing");
const clientNotificationBridge = require("./services/clientNotificationBridge");
require("dotenv").config();
const app = exp();
const cors = require("cors");

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: ["http://localhost:3000", "http://localhost:5173"],
		methods: ["GET", "POST"],
	},
});

app.use(cors());
app.use(exp.json());

// Configure multer for AI processing endpoints
const aiUpload = multer({ dest: "uploads/" });

// Import routes
const userRoutes = require("./routes/userRoutes");
const eventRoutes = require("./routes/eventRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

mongoClient
	.connect(process.env.DB_URL)
	.then((client) => {
		const onepiece = client.db("onepiece");
		const usersCollection = onepiece.collection("usersCollection");
		const eventsCollection = onepiece.collection("eventsCollection");
		const messagesCollection = onepiece.collection("messagesCollection");

		app.set("onepiece", onepiece);
		app.set("usersCollection", usersCollection);
		app.set("eventsCollection", eventsCollection);
		app.set("messagesCollection", messagesCollection);

		console.log("DB Connection Successful");

		// WebSocket event handling
		io.on("connection", (socket) => {
			console.log("User connected:", socket.id);

			// Join event room
			socket.on("join-event", (eventId) => {
				socket.join(`event-${eventId}`);
				console.log(`User ${socket.id} joined event ${eventId}`);
			});

			// Leave event room
			socket.on("leave-event", (eventId) => {
				socket.leave(`event-${eventId}`);
				console.log(`User ${socket.id} left event ${eventId}`);
			});

			// Handle new message
			socket.on("send-message", async (data) => {
				try {
					const { eventId, message, username, timestamp } = data;

					// Save message to database
					const messageDoc = {
						eventId,
						message,
						username,
						timestamp: new Date(timestamp),
						createdAt: new Date(),
					};

					await messagesCollection.insertOne(messageDoc);

					// Broadcast message to all users in the event room
					io.to(`event-${eventId}`).emit("new-message", {
						_id: messageDoc._id,
						...messageDoc,
					});
				} catch (error) {
					console.error("Error saving message:", error);
					socket.emit("message-error", { error: "Failed to send message" });
				}
			});

			// Handle disconnect
			socket.on("disconnect", () => {
				console.log("User disconnected:", socket.id);
			});
		});

		// Use routes after database connection is established
		app.use("/api/users", userRoutes);
		app.use("/api/events", eventRoutes);
		app.use("/api/notifications", notificationRoutes);

		// // AI Processing Endpoints
		// // --- Person Count Detection Endpoint ---
		// app.post("/api/ai/count", aiUpload.single("image"), async (req, res) => {
		//   if (!req.file) return res.status(400).json({ message: "No image uploaded." });

		//   try {
		//     const imageBuffer = fs.readFileSync(req.file.path);
		//     fs.unlinkSync(req.file.path);

		//     const { personCount, isOvercrowded, detections } = await detectOvercrowding(
		//       imageBuffer
		//     );
		//     res.json({ personCount, isOvercrowded, detections });
		//   } catch (err) {
		//     console.error("❌ Inference failed:", err);
		//     if (req.file) fs.unlinkSync(req.file.path);
		//     res.status(500).json({ message: "Failed to process image.", error: err.message });
		//   }
		// });

		// // --- Fire Detection Endpoint ---
		// app.post("/api/ai/fire", aiUpload.single("image"), async (req, res) => {
		//   if (!req.file) return res.status(400).json({ message: "No image uploaded." });

		//   try {
		//     const imageBuffer = fs.readFileSync(req.file.path);
		//     fs.unlinkSync(req.file.path);

		//     const { inputTensor, originalWidth, originalHeight } = await preprocess(
		//       imageBuffer
		//     );
		//     const { intensity, fireDetected } = await detectFireIntensity(
		//       inputTensor,
		//       originalWidth,
		//       originalHeight
		//     );

		//     res.json({ intensity, fireDetected });
		//   } catch (err) {
		//     console.error("❌ Fire detection failed:", err);
		//     if (req.file) fs.unlinkSync(req.file.path);
		//     res.status(500).json({ message: "Failed to process image.", error: err.message });
		//   }
		// });

		// Start the server after everything is set up
		server.listen(4000, () => {
			console.log("Server is running on port 4000");
			console.log("🚀 WebSocket server active for real-time chat");
			console.log("🚀 AI processing endpoints available at:");
			console.log("  - POST /api/ai/count (person counting)");
			console.log("  - POST /api/ai/fire (fire detection)");
		});
	})
	.catch((err) => console.log("Error in connection of database", err));

app.use((err, req, res, next) => {
	// Handle multer errors
	if (err instanceof require("multer").MulterError) {
		if (err.code === "LIMIT_FILE_SIZE") {
			return res
				.status(400)
				.json({ message: "File too large. Maximum size is 50MB." });
		}
		if (err.code === "LIMIT_UNEXPECTED_FILE") {
			return res
				.status(400)
				.json({ message: "Unexpected field in form data." });
		}
		return res
			.status(400)
			.json({ message: "File upload error: " + err.message });
	}

	// Handle other errors
	if (err.message === "Only video and image files are allowed") {
		return res.status(400).json({ message: err.message });
	}

	console.error("Server error:", err);
	res
		.status(500)
		.json({ message: "Internal server error", payload: err.message });
});
