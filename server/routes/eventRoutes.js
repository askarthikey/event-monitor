const express = require("express");
const multer = require("multer");
const router = express.Router();

const { preprocess } = require("../helpers/preprocessing");
const postprocess = require("../helpers/postprocessing");

const { authenticateToken } = require("../middleware/auth");
const VideoUploadService = require("../services/videoUploadService");
const VideoProcessingService = require("../services/videoProcessingService");
const { detectOvercrowding } = require("../helpers/overCrowddetection");
const { detectFireIntensity } = require("../helpers/firedetection");
const { detectUnconsciousPersons } = require("../helpers/unconsciousDetection");
const {
	ComprehensiveSafetyDetector,
} = require("../helpers/comprehensiveSafetyDetector");
const GeminiService = require("../services/geminiService");

// Configure multer for video and image file uploads
const storage = multer.memoryStorage();
const upload = multer({
	storage: storage,
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB limit for videos, will check images separately
	},
	fileFilter: (req, file, cb) => {
		// Allow video and image files
		if (
			file.mimetype.startsWith("video/") ||
			file.mimetype.startsWith("image/")
		) {
			cb(null, true);
		} else {
			cb(new Error("Only video and image files are allowed"), false);
		}
	},
});

// GET /api/events - Get all events for the authenticated user
router.get("/", authenticateToken, async (req, res) => {
	try {
		const eventsCollection = req.app.get("eventsCollection");

		// Find events where user is organizer, participant, or event is public
		const userEvents = await eventsCollection
			.find({
				$or: [
					{ organizers: req.user.username },
					{ participants: req.user.username },
					{ isPublic: true },
				],
			})
			.toArray();

		res.json(userEvents);
	} catch (error) {
		console.error("Error fetching events:", error);
		res
			.status(500)
			.json({ message: "Internal server error: " + error.message });
	}
});

// POST /api/events - Create a new event (with video and image upload)
router.post(
	"/",
	authenticateToken,
	upload.fields([
		{ name: "videoFile", maxCount: 1 },
		{ name: "eventImage", maxCount: 1 },
	]),
	async (req, res) => {
		try {
			const {
				title,
				startDate,
				endDate,
				cctvConfigs,
				// Video source fields commented out for now
				// videoSource,
				// rtspLink,
				additionalOrganizers,
			} = req.body;

			// Parse CCTV configurations from JSON string
			let parsedCctvConfigs = [];
			try {
				parsedCctvConfigs = JSON.parse(cctvConfigs || "[]");
			} catch (error) {
				return res
					.status(400)
					.json({ message: "Invalid CCTV configurations format" });
			}

			// Validation
			if (!title || !startDate || !endDate) {
				return res
					.status(400)
					.json({ message: "Title, start date, and end date are required" });
			}

			if (!parsedCctvConfigs || parsedCctvConfigs.length === 0) {
				return res
					.status(400)
					.json({ message: "At least one CCTV configuration is required" });
			}

			// Validate each CCTV configuration
			for (let i = 0; i < parsedCctvConfigs.length; i++) {
				const config = parsedCctvConfigs[i];
				if (
					!config.cctvId ||
					!config.mountingHeight ||
					!config.verticalFOV ||
					!config.horizontalFOV ||
					config.cameraTilt === undefined ||
					config.cameraTilt === null
				) {
					return res.status(400).json({
						message: `Missing required fields in CCTV configuration ${i + 1}`,
					});
				}
			}

			// Video source validation commented out for now
			/*
    if (videoSource === 'rtsp' && !rtspLink) {
      return res.status(400).json({ message: 'RTSP link is required when using RTSP source' });
    }

    if (videoSource === 'file' && (!req.files || !req.files.videoFile)) {
      return res.status(400).json({ message: 'Video file is required when using file source' });
    }
    */

			// Validate dates
			const start = new Date(startDate);
			const end = new Date(endDate);
			if (start >= end) {
				return res
					.status(400)
					.json({ message: "End date must be after start date" });
			}

			let videoFileUrl = null;
			let eventImageUrl = null;

			// Video file upload section commented out for now
			/*
    // Handle video file upload to Supabase
    if (videoSource === 'file' && req.files && req.files.videoFile) {
      const videoFile = req.files.videoFile[0];
      
      // Validate video file
      const videoValidation = VideoUploadService.validateVideoFile(videoFile);
      if (!videoValidation.valid) {
        return res.status(400).json({ message: videoValidation.error });
      }

      try {
        // Upload video to Supabase
        videoFileUrl = await VideoUploadService.uploadVideo(
          videoFile.buffer,
          videoFile.originalname,
          videoFile.mimetype
        );
      } catch (uploadError) {
        console.error('Video upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload video file' });
      }
    }
    */

			// Handle event image upload to Supabase
			if (req.files && req.files.eventImage) {
				const imageFile = req.files.eventImage[0];

				// Validate image file
				const imageValidation = VideoUploadService.validateImageFile(imageFile);
				if (!imageValidation.valid) {
					return res.status(400).json({ message: imageValidation.error });
				}

				try {
					// Upload image to Supabase
					eventImageUrl = await VideoUploadService.uploadImage(
						imageFile.buffer,
						imageFile.originalname,
						imageFile.mimetype
					);
				} catch (uploadError) {
					console.error("Image upload error:", uploadError);
					return res
						.status(500)
						.json({ message: "Failed to upload event image" });
				}
			}

			// Parse additional organizers if it's a string
			let organizersList = [];
			if (additionalOrganizers) {
				try {
					organizersList =
						typeof additionalOrganizers === "string"
							? JSON.parse(additionalOrganizers)
							: additionalOrganizers;
				} catch (e) {
					organizersList = [];
				}
			}

			// Generate default image URL if no image uploaded
			const defaultImageUrl =
				eventImageUrl ||
				`data:image/svg+xml,${encodeURIComponent(`
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
    `)}`;

			// Create the event object
			const newEvent = {
				title,
				startDate,
				endDate,
				cctvConfigs: parsedCctvConfigs.map((config) => ({
					cctvId: config.cctvId,
					location: config.location || "Unknown location",
					mountingHeight: parseFloat(config.mountingHeight),
					verticalFOV: parseFloat(config.verticalFOV),
					horizontalFOV: parseFloat(config.horizontalFOV),
					cameraTilt: parseFloat(config.cameraTilt),
					coordinates: config.coordinates || null,
					// Include video source configuration
					videoSource: config.videoSource || null,
					rtspLink: config.videoSource === "rtsp" ? config.rtspLink : null,
					videoFileUrl:
						config.videoSource === "file" ? config.videoFileUrl : null,
				})),
				organizers: [
					req.user.username,
					...organizersList.filter((org) => org && org.trim() !== ""),
				],
				participants: [],
				status: "upcoming", // upcoming, active, completed
				createdBy: req.user.username,
				createdAt: new Date(),
				updatedAt: new Date(),
				isPublic: false, // Events are private by default
				attendees: 0, // Will be calculated based on participants
				image: defaultImageUrl, // Store the uploaded image URL or generated default
			};

			// Save the event to MongoDB
			const eventsCollection = req.app.get("eventsCollection");
			const result = await eventsCollection.insertOne(newEvent);

			// Add the MongoDB _id to the event object
			newEvent._id = result.insertedId;

			res.status(201).json({
				message: "Event created successfully",
				event: newEvent,
			});
		} catch (error) {
			console.error("Error creating event:", error);

			// If there was an error after uploading files, try to clean them up
			if (videoFileUrl) {
				try {
					await VideoUploadService.deleteVideo(videoFileUrl);
				} catch (cleanupError) {
					console.error("Error cleaning up video file:", cleanupError);
				}
			}

			if (eventImageUrl) {
				try {
					await VideoUploadService.deleteImage(eventImageUrl);
				} catch (cleanupError) {
					console.error("Error cleaning up image file:", cleanupError);
				}
			}

			res.status(500).json({ message: "Internal server error" });
		}
	}
);

// GET /api/events/:id - Get a specific event
router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const { ObjectId } = require("mongodb");
		const eventsCollection = req.app.get("eventsCollection");
		const eventId = req.params.id;

		// Find the event by _id
		const event = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Check if user has access to this event
		const hasAccess =
			event.organizers.includes(req.user.username) ||
			event.participants.includes(req.user.username) ||
			event.isPublic;

		if (!hasAccess) {
			return res.status(403).json({ message: "Access denied" });
		}

		res.json(event);
	} catch (error) {
		console.error("Error fetching event:", error);
		res.status(500).json({ message: "Internal server error" });
	}
});

// PUT /api/events/:id - Update an event
router.put("/:id", authenticateToken, async (req, res) => {
	try {
		const { ObjectId } = require("mongodb");
		const eventsCollection = req.app.get("eventsCollection");
		const eventId = req.params.id;

		// Find the event by _id
		const event = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Check if user is an organizer
		if (!event.organizers.includes(req.user.username)) {
			return res
				.status(403)
				.json({ message: "Only organizers can update events" });
		}

		// Prepare update data
		const updateData = {
			...req.body,
			updatedAt: new Date(),
		};

		// Remove fields that shouldn't be updated
		delete updateData._id;
		delete updateData.createdBy;
		delete updateData.createdAt;

		// Update the event
		const result = await eventsCollection.updateOne(
			{ _id: new ObjectId(eventId) },
			{ $set: updateData }
		);

		if (result.modifiedCount === 0) {
			return res.status(400).json({ message: "No changes made to the event" });
		}

		// Get the updated event
		const updatedEvent = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		res.json({
			message: "Event updated successfully",
			event: updatedEvent,
		});
	} catch (error) {
		console.error("Error updating event:", error);
		res.status(500).json({ message: "Internal server error" });
	}
});

// DELETE /api/events/:id - Delete an event
router.delete("/:id", authenticateToken, async (req, res) => {
	try {
		const { ObjectId } = require("mongodb");
		const eventsCollection = req.app.get("eventsCollection");
		const eventId = req.params.id;

		// Find the event by _id
		const event = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Check if user is an organizer
		if (!event.organizers.includes(req.user.username)) {
			return res
				.status(403)
				.json({ message: "Only organizers can delete events" });
		}

		// If there's a video file URL, try to delete it from Supabase
		if (event.cctvConfig && event.cctvConfig.videoFileUrl) {
			try {
				await VideoUploadService.deleteVideo(event.cctvConfig.videoFileUrl);
			} catch (deleteError) {
				console.error("Error deleting video from Supabase:", deleteError);
				// Continue with event deletion even if video deletion fails
			}
		}

		// If there's an event image URL, try to delete it from Supabase
		if (event.image) {
			try {
				await VideoUploadService.deleteImage(event.image);
			} catch (deleteError) {
				console.error("Error deleting image from Supabase:", deleteError);
				// Continue with event deletion even if image deletion fails
			}
		}

		// Delete the event
		const result = await eventsCollection.deleteOne({
			_id: new ObjectId(eventId),
		});

		if (result.deletedCount === 0) {
			return res.status(400).json({ message: "Failed to delete event" });
		}

		res.json({ message: "Event deleted successfully" });
	} catch (error) {
		console.error("Error deleting event:", error);
		res.status(500).json({ message: "Internal server error" });
	}
});

// POST /api/events/:id/join - Join an event as a participant
router.post("/:id/join", authenticateToken, async (req, res) => {
	try {
		const { ObjectId } = require("mongodb");
		const eventsCollection = req.app.get("eventsCollection");
		const eventId = req.params.id;

		// Find the event by _id
		const event = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Check if user is already a participant or organizer
		if (
			event.participants.includes(req.user.username) ||
			event.organizers.includes(req.user.username)
		) {
			return res
				.status(400)
				.json({ message: "You are already part of this event" });
		}

		// Add user as participant
		const result = await eventsCollection.updateOne(
			{ _id: new ObjectId(eventId) },
			{
				$push: { participants: req.user.username },
				$inc: { attendees: 1 },
				$set: { updatedAt: new Date() },
			}
		);

		if (result.modifiedCount === 0) {
			return res.status(400).json({ message: "Failed to join event" });
		}

		// Get the updated event
		const updatedEvent = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		res.json({
			message: "Successfully joined the event",
			event: updatedEvent,
		});
	} catch (error) {
		console.error("Error joining event:", error);
		res.status(500).json({ message: "Internal server error" });
	}
});

// POST /api/events/:id/leave - Leave an event
router.post("/:id/leave", authenticateToken, async (req, res) => {
	try {
		const { ObjectId } = require("mongodb");
		const eventsCollection = req.app.get("eventsCollection");
		const eventId = req.params.id;

		// Find the event by _id
		const event = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Check if user is a participant
		if (!event.participants.includes(req.user.username)) {
			return res
				.status(400)
				.json({ message: "You are not a participant of this event" });
		}

		// Remove user from participants
		const result = await eventsCollection.updateOne(
			{ _id: new ObjectId(eventId) },
			{
				$pull: { participants: req.user.username },
				$inc: { attendees: -1 },
				$set: { updatedAt: new Date() },
			}
		);

		if (result.modifiedCount === 0) {
			return res.status(400).json({ message: "Failed to leave event" });
		}

		// Get the updated event
		const updatedEvent = await eventsCollection.findOne({
			_id: new ObjectId(eventId),
		});

		res.json({
			message: "Successfully left the event",
			event: updatedEvent,
		});
	} catch (error) {
		console.error("Error leaving event:", error);
		res.status(500).json({ message: "Internal server error" });
	}
});

// PUT /api/events/:id/cctv-video - Update CCTV video link/file for specific CCTV in an event
router.put(
	"/:id/cctv-video",
	authenticateToken,
	upload.fields([{ name: "videoFile", maxCount: 1 }]),
	async (req, res) => {
		try {
			const { id } = req.params;
			const {
				cctvId,
				videoSource,
				rtspLink,
				videoFileUrl: directVideoUrl,
			} = req.body;

			console.log("🔍 Debug - Request body:", req.body);
			console.log("🔍 Debug - Extracted params:", {
				cctvId,
				videoSource,
				rtspLink,
				directVideoUrl,
			});

			if (!cctvId || !cctvId.trim()) {
				return res.status(400).json({ message: "CCTV ID is required" });
			}

			const { ObjectId } = require("mongodb");
			const eventsCollection = req.app.get("eventsCollection");

			// Validate ObjectId
			if (!ObjectId.isValid(id)) {
				return res.status(400).json({ message: "Invalid event ID" });
			}

			// Find the event
			const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
			if (!event) {
				return res.status(404).json({ message: "Event not found" });
			}

			// Check if user is an organizer of this event
			if (!event.organizers || !event.organizers.includes(req.user.username)) {
				return res
					.status(403)
					.json({ message: "Not authorized to modify this event" });
			}

			let videoFileUrl = directVideoUrl; // Use direct URL if provided

			// Handle video file upload to Supabase (if file is provided)
			if (videoSource === "file" && req.files && req.files.videoFile) {
				const videoFile = req.files.videoFile[0];

				// Validate video file
				const videoValidation = VideoUploadService.validateVideoFile(videoFile);
				if (!videoValidation.valid) {
					return res.status(400).json({ message: videoValidation.error });
				}

				try {
					// Upload video to Supabase
					videoFileUrl = await VideoUploadService.uploadVideo(
						videoFile.buffer,
						`${cctvId}_${Date.now()}_${videoFile.originalname}`,
						videoFile.mimetype
					);
				} catch (uploadError) {
					console.error("Video upload error:", uploadError);
					return res
						.status(500)
						.json({ message: "Failed to upload video file" });
				}
			}

			// Validate video source
			if (videoSource === "rtsp" && (!rtspLink || !rtspLink.trim())) {
				return res
					.status(400)
					.json({ message: "RTSP link is required when using RTSP source" });
			}

			if (videoSource === "file" && !videoFileUrl) {
				return res.status(400).json({
					message:
						"Video file or video file URL is required when using file source",
				});
			}

			// Add validation for videoSource
			if (!videoSource || (videoSource !== "rtsp" && videoSource !== "file")) {
				return res
					.status(400)
					.json({ message: 'Video source must be either "rtsp" or "file"' });
			}

			// Update the specific CCTV configuration in the array
			const updateData = {
				updatedAt: new Date(),
			};

			// Find the CCTV config in the array and update it
			if (event.cctvConfigs && Array.isArray(event.cctvConfigs)) {
				const cctvIndex = event.cctvConfigs.findIndex(
					(config) => config.cctvId === cctvId
				);

				if (cctvIndex === -1) {
					return res
						.status(404)
						.json({ message: "CCTV configuration not found" });
				}

				// Update the specific CCTV config
				if (videoSource === "rtsp") {
					updateData[`cctvConfigs.${cctvIndex}.videoSource`] = "rtsp";
					updateData[`cctvConfigs.${cctvIndex}.rtspLink`] = rtspLink;
					updateData[`cctvConfigs.${cctvIndex}.videoFileUrl`] = null;
				} else if (videoSource === "file") {
					updateData[`cctvConfigs.${cctvIndex}.videoSource`] = "file";
					updateData[`cctvConfigs.${cctvIndex}.videoFileUrl`] = videoFileUrl;
					updateData[`cctvConfigs.${cctvIndex}.rtspLink`] = null;
				}
			} else {
				return res
					.status(400)
					.json({ message: "No CCTV configurations found for this event" });
			}

			const result = await eventsCollection.updateOne(
				{ _id: new ObjectId(id) },
				{ $set: updateData }
			);

			if (result.matchedCount === 0) {
				return res.status(404).json({ message: "Event not found" });
			}

			// Fetch the updated event
			const updatedEvent = await eventsCollection.findOne({
				_id: new ObjectId(id),
			});

			// Automatically trigger CCTV processing after video link update
			try {
				console.log(
					`🎥 Auto-triggering CCTV processing for ${cctvId} after video update...`
				);

				// Use the process-cctv logic here with the updated video source
				const updatedCctvConfig = updatedEvent.cctvConfigs.find(
					(config) => config.cctvId === cctvId
				);

				if (
					updatedCctvConfig &&
					(updatedCctvConfig.rtspLink || updatedCctvConfig.videoFileUrl)
				) {
					// Immediately update the database to indicate processing has started
					await eventsCollection.updateOne(
						{ _id: new ObjectId(id) },
						{
							$set: {
								aiSummary:
									"🔄 AI processing started... This may take a few moments.",
								aiLogs: [
									`Processing started at ${new Date().toISOString()}`,
									`Video source: ${
										updatedCctvConfig.videoFileUrl || updatedCctvConfig.rtspLink
									}`,
									"Extracting frames and running AI analysis...",
								],
								processingStatus: "in_progress",
								lastProcessedAt: new Date(),
								updatedAt: new Date(),
							},
						}
					);

					// Trigger processing in background with enhanced error handling and immediate database updates
					setTimeout(async () => {
						try {
							console.log(
								`🚀 Starting background processing for CCTV ${cctvId}...`
							);

							// Call the processing function
							const result = await processVideoAndGenerateAI(
								updatedEvent,
								cctvId,
								eventsCollection
							);

							console.log(
								`✅ Background processing completed for CCTV ${cctvId}:`,
								result.success ? "SUCCESS" : "FAILED"
							);

							// Ensure processing status is updated
							await eventsCollection.updateOne(
								{ _id: new ObjectId(id) },
								{
									$set: {
										processingStatus: result.success ? "completed" : "failed",
										updatedAt: new Date(),
									},
								}
							);
						} catch (bgError) {
							console.error(
								`❌ Background processing error for CCTV ${cctvId}:`,
								bgError.message
							);

							// Store error in database immediately
							await eventsCollection.updateOne(
								{ _id: new ObjectId(id) },
								{
									$set: {
										aiSummary: `❌ Processing failed: ${bgError.message}`,
										aiLogs: [
											`Processing error at ${new Date().toISOString()}`,
											`Error: ${bgError.message}`,
											"Please try updating the video link again or contact support.",
										],
										processingStatus: "failed",
										lastProcessedAt: new Date(),
										updatedAt: new Date(),
									},
								}
							);
						}
					}, 1000); // Wait 1 second before starting processing to allow response to complete
				} else {
					// Update database to indicate no valid video source
					await eventsCollection.updateOne(
						{ _id: new ObjectId(id) },
						{
							$set: {
								aiSummary:
									"❌ No valid video source configured for automatic processing.",
								aiLogs: [
									`No video source found for CCTV ${cctvId} at ${new Date().toISOString()}`,
									"Please ensure either RTSP link or video file URL is properly configured.",
								],
								processingStatus: "no_source",
								updatedAt: new Date(),
							},
						}
					);
				}
			} catch (autoProcessError) {
				console.error(
					`Auto-processing trigger error for CCTV ${cctvId}:`,
					autoProcessError.message
				);

				// Store trigger error in database
				try {
					await eventsCollection.updateOne(
						{ _id: new ObjectId(id) },
						{
							$set: {
								aiSummary: `❌ Auto-processing trigger failed: ${autoProcessError.message}`,
								aiLogs: [
									`Auto-processing trigger error at ${new Date().toISOString()}`,
									`Error: ${autoProcessError.message}`,
								],
								processingStatus: "trigger_failed",
								updatedAt: new Date(),
							},
						}
					);
				} catch (dbError) {
					console.error(
						"Failed to store trigger error in database:",
						dbError.message
					);
				}
			}

			res.json({
				message: `Video ${
					videoSource === "rtsp" ? "RTSP link" : "file"
				} updated successfully for CCTV ${cctvId}. AI processing has been automatically triggered.`,
				event: updatedEvent,
				processingTriggered: true,
			});
		} catch (error) {
			console.error("Error updating CCTV video:", error);
			res
				.status(500)
				.json({ message: "Internal server error: " + error.message });
		}
	}
);

// PUT /api/events/:id/cctv-link - Update CCTV video link for an event (Legacy endpoint)
router.put("/:id/cctv-link", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const { videoLink, cctvId } = req.body;

		if (!videoLink || !videoLink.trim()) {
			return res.status(400).json({ message: "Video link is required" });
		}

		const { ObjectId } = require("mongodb");
		const eventsCollection = req.app.get("eventsCollection");

		// Validate ObjectId
		if (!ObjectId.isValid(id)) {
			return res.status(400).json({ message: "Invalid event ID" });
		}

		// Find the event
		const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Check if user is an organizer of this event
		if (!event.organizers || !event.organizers.includes(req.user.username)) {
			return res
				.status(403)
				.json({ message: "Not authorized to modify this event" });
		}

		// Update the CCTV configuration with the new video link
		const updateData = {
			"cctvConfig.rtspLink": videoLink,
			updatedAt: new Date(),
		};

		// If CCTV ID is provided, update it as well
		if (cctvId && cctvId.trim()) {
			updateData["cctvConfig.cctvId"] = cctvId.trim();
		}

		const result = await eventsCollection.updateOne(
			{ _id: new ObjectId(id) },
			{ $set: updateData }
		);

		if (result.matchedCount === 0) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Fetch the updated event
		const updatedEvent = await eventsCollection.findOne({
			_id: new ObjectId(id),
		});

		// Automatically trigger CCTV processing after video link update
		try {
			console.log(
				`🎥 Auto-triggering CCTV processing for ${
					cctvId || "default"
				} after video link update...`
			);

			// Extract CCTV ID from legacy cctvConfig or use provided cctvId
			const targetCctvId =
				cctvId || updatedEvent.cctvConfig?.cctvId || "default-cctv";

			if (updatedEvent.cctvConfig && updatedEvent.cctvConfig.rtspLink) {
				// Trigger processing in background (don't wait for completion)
				setImmediate(async () => {
					try {
						await processVideoAndGenerateAI(
							updatedEvent,
							targetCctvId,
							eventsCollection
						);
					} catch (bgError) {
						console.error(
							`Background processing error for CCTV ${targetCctvId}:`,
							bgError.message
						);
					}
				});
			}
		} catch (autoProcessError) {
			console.error(`Auto-processing trigger error:`, autoProcessError.message);
		}

		res.json({
			message:
				"CCTV video link updated successfully. AI processing has been automatically triggered.",
			event: updatedEvent,
			processingTriggered: true,
		});
	} catch (error) {
		console.error("Error updating CCTV video link:", error);
		res
			.status(500)
			.json({ message: "Internal server error: " + error.message });
	}
});

// POST /api/events/:id/process-cctv - Process CCTV data and extract frames
router.post("/:id/process-cctv", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const { cctvId, frameCount = 10, captureSeconds = 30 } = req.body;

		if (!cctvId) {
			return res.status(400).json({ message: "CCTV ID is required" });
		}

		const eventsCollection = req.app.get("eventsCollection");
		const { ObjectId } = require("mongodb");

		// Find the event and specific CCTV configuration
		const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Find the specific CCTV configuration
		let cctvConfig = null;
		if (event.cctvConfigs && Array.isArray(event.cctvConfigs)) {
			cctvConfig = event.cctvConfigs.find((config) => config.cctvId === cctvId);
		} else if (event.cctvConfig && event.cctvConfig.cctvId === cctvId) {
			cctvConfig = event.cctvConfig;
		}

		if (!cctvConfig) {
			return res.status(404).json({ message: "CCTV configuration not found" });
		}

		// Calculate coverage area using improved formula with clamping
		function degreesToRadians(deg) {
			return deg * (Math.PI / 180);
		}

		function calculateCCTVCoverageArea({
			height,
			verticalFOV,
			horizontalFOV,
			tilt,
		}) {
			const theta = degreesToRadians(verticalFOV);
			const phi = degreesToRadians(horizontalFOV);
			const alpha = degreesToRadians(tilt);

			let d1 = height * Math.tan(alpha - theta / 2);
			let d2 = height * Math.tan(alpha + theta / 2);

			// Clamp negative distances to zero and ensure d2 >= d1
			d1 = Math.max(0, d1);
			d2 = Math.max(d1, d2);

			let w1 = 2 * d1 * Math.tan(phi / 2);
			let w2 = 2 * d2 * Math.tan(phi / 2);

			// Clamp negative widths to zero
			w1 = Math.max(0, w1);
			w2 = Math.max(0, w2);

			const area = 0.5 * (w1 + w2) * (d2 - d1);

			return {
				d1: d1.toFixed(2),
				d2: d2.toFixed(2),
				w1: w1.toFixed(2),
				w2: w2.toFixed(2),
				area: parseFloat(area.toFixed(2)),
				areaText: area.toFixed(2) + " m²",
			};
		}

		const coverageData = calculateCCTVCoverageArea({
			height: parseFloat(cctvConfig.mountingHeight) || 0,
			verticalFOV: parseFloat(cctvConfig.verticalFOV) || 0,
			horizontalFOV: parseFloat(cctvConfig.horizontalFOV) || 0,
			tilt: parseFloat(cctvConfig.cameraTilt) || 0,
		});

		// Check if CCTV has video source
		if (
			!cctvConfig.videoSource ||
			(!cctvConfig.rtspLink && !cctvConfig.videoFileUrl)
		) {
			return res.status(400).json({
				message: "No video source configured for this CCTV",
				cctvId: cctvId,
				area: coverageData,
			});
		}

		const videoProcessingService = new VideoProcessingService();
		let aiData = {};

		try {
			// Prepare CCTV metadata for AI processing with accurate calculations
			const cctvMetadata = {
				id: cctvId,
				coverageArea: coverageData.areaText, // Use accurately calculated area
				mountingHeight: parseFloat(cctvConfig.mountingHeight).toFixed(1) + "m",
				verticalFOV: parseFloat(cctvConfig.verticalFOV).toFixed(1) + "°",
				horizontalFOV: parseFloat(cctvConfig.horizontalFOV).toFixed(1) + "°",
				cameraTilt: parseFloat(cctvConfig.cameraTilt).toFixed(1) + "°",
				location: cctvConfig.location || "Unknown location",
				coordinates: cctvConfig.coordinates || null,
				// Include detailed coverage calculation for AI context
				coverageDetails: {
					nearDistance: coverageData.d1 + "m",
					farDistance: coverageData.d2 + "m",
					nearWidth: coverageData.w1 + "m",
					farWidth: coverageData.w2 + "m",
					totalAreaM2: coverageData.area,
				},
			};

			// Extract frames based on video source type with metadata
			if (cctvConfig.videoSource === "rtsp" && cctvConfig.rtspLink) {
				console.log(`Processing RTSP stream for CCTV ${cctvId}...`);
				aiData = await videoProcessingService.extractFramesFromRTSPByInterval(
					cctvConfig.rtspLink,
					0.5, // 0.5 second intervals for balanced precision
					parseInt(captureSeconds),
					cctvMetadata
				);
			} else if (cctvConfig.videoSource === "file" && cctvConfig.videoFileUrl) {
				console.log(`Processing video file for CCTV ${cctvId}...`);
				aiData =
					await videoProcessingService.extractFramesFromSupabaseVideoByInterval(
						cctvConfig.videoFileUrl,
						0.5, // 0.5 second intervals for balanced precision
						cctvMetadata
					);
			}

			// Process each frame with AI models
			const analysisResults = [];

			// Initialize comprehensive safety detector
			const safetyDetector = new ComprehensiveSafetyDetector();

			for (let i = 0; i < aiData.frames.length; i++) {
				const frame = aiData.frames[i];

				try {
					// Convert base64 to buffer for preprocessing
					const base64Data = frame.base64Data.replace(
						/^data:image\/[a-z]+;base64,/,
						""
					);
					const imageBuffer = Buffer.from(base64Data, "base64");

					const { inputTensor, originalWidth, originalHeight } =
						await preprocess(imageBuffer);

					// Run fire detection separately (still needed for inputTensor)
					const { intensity, fireDetected } = await detectFireIntensity(
						inputTensor,
						originalWidth,
						originalHeight
					);

					// Run comprehensive safety detection (crowd + unconscious + stampede)
					const safetyResult = await safetyDetector.detectAllThreats(
						imageBuffer,
						coverageData.area
					);

					const frameResult = {
						frameId: frame.id,
						timestamp: frame.timeInVideo,
						fireDetection: {
							intensity: parseFloat(intensity.toFixed(4)),
							fireDetected: fireDetected,
							riskLevel: fireDetected
								? intensity > 0.3
									? "HIGH"
									: "MEDIUM"
								: "LOW",
						},
						// Comprehensive safety detection results
						crowdDetection: safetyResult.crowd,
						unconsciousDetection: safetyResult.unconscious,
						stampedeDetection: safetyResult.stampede,
						// Overall risk assessment
						overallRisk: safetyResult.overallRisk,
						emergencyPriority: safetyResult.emergencyPriority,
					};

					analysisResults.push(frameResult);

					console.log(
						`Frame ${i + 1}: Fire=${
							fireDetected ? "YES" : "NO"
						} (${intensity.toFixed(4)}), People=${
							safetyResult.crowd.personCount
						}, Overcrowded=${
							safetyResult.crowd.isOvercrowded ? "YES" : "NO"
						}, Density=${safetyResult.crowd.densityPercentage}% (${
							safetyResult.crowd.densityLevel
						}), Unconscious=${safetyResult.unconscious.unconsciousCount} (${
							safetyResult.unconscious.overallRisk
						}), Stampede=${safetyResult.stampede.isStampede ? "YES" : "NO"} (${
							safetyResult.stampede.riskLevel
						}), Overall=${safetyResult.overallRisk.level}`
					);
				} catch (frameError) {
					console.error(`Error processing frame ${i + 1}:`, frameError.message);
					analysisResults.push({
						frameId: frame.id,
						timestamp: frame.timeInVideo,
						error: frameError.message,
					});
				}
			}

			// Calculate summary statistics
			const fireDetectedFrames = analysisResults.filter(
				(r) => r.fireDetection?.fireDetected
			);
			const highRiskFrames = analysisResults.filter(
				(r) => r.fireDetection?.riskLevel === "HIGH"
			);
			const totalPeople = analysisResults.reduce(
				(sum, r) => sum + (r.crowdDetection?.personCount || 0),
				0
			);
			const avgPeople =
				analysisResults.length > 0 ? totalPeople / analysisResults.length : 0;

			// Calculate density-based overcrowding statistics
			const overcrowdedFrames = analysisResults.filter(
				(r) => r.crowdDetection?.isOvercrowded
			);
			const highDensityFrames = analysisResults.filter(
				(r) => r.crowdDetection?.densityLevel === "HIGH"
			);
			const unconsciousDetectedFrames = analysisResults.filter(
				(r) => r.unconsciousDetection?.unconsciousCount > 0
			);
			const stampedeDetectedFrames = analysisResults.filter(
				(r) => r.stampedeDetection?.isStampede
			);

			// Overall risk assessment
			const criticalFrames = analysisResults.filter(
				(r) => r.overallRisk?.level === "CRITICAL"
			);
			const highOverallRiskFrames = analysisResults.filter(
				(r) => r.overallRisk?.level === "HIGH"
			);

			const summary = {
				totalFrames: analysisResults.length,
				fireDetectedFrames: fireDetectedFrames.length,
				highRiskFrames: highRiskFrames.length,
				averagePeoplePerFrame: parseFloat(avgPeople.toFixed(1)),
				overallFireRisk: fireDetectedFrames.length > 0 ? "DETECTED" : "SAFE",
				processingSuccess: analysisResults.filter((r) => !r.error).length,
				// Enhanced safety statistics
				crowdSafety: {
					overcrowdedFrames: overcrowdedFrames.length,
					highDensityFrames: highDensityFrames.length,
					maxDensityPercentage: Math.max(
						...analysisResults.map(
							(r) => r.crowdDetection?.densityPercentage || 0
						)
					),
					avgDensityPercentage: parseFloat(
						(
							analysisResults.reduce(
								(sum, r) => sum + (r.crowdDetection?.densityPercentage || 0),
								0
							) / analysisResults.length
						).toFixed(1)
					),
				},
				unconsciousSafety: {
					framesWithUnconsciousPersons: unconsciousDetectedFrames.length,
					totalUnconsciousDetected: analysisResults.reduce(
						(sum, r) => sum + (r.unconsciousDetection?.unconsciousCount || 0),
						0
					),
					maxUnconsciousInFrame: Math.max(
						...analysisResults.map(
							(r) => r.unconsciousDetection?.unconsciousCount || 0
						)
					),
				},
				stampedeSafety: {
					stampedeDetectedFrames: stampedeDetectedFrames.length,
					highMotionFrames: analysisResults.filter(
						(r) => r.stampedeDetection?.riskLevel === "HIGH"
					).length,
					avgMotionIntensity: parseFloat(
						(
							analysisResults.reduce(
								(sum, r) => sum + (r.stampedeDetection?.motionIntensity || 0),
								0
							) / analysisResults.length
						).toFixed(3)
					),
				},
				overallSafety: {
					criticalFrames: criticalFrames.length,
					highRiskFrames: highOverallRiskFrames.length,
					emergencyPriorityFrames: analysisResults.filter(
						(r) => r.emergencyPriority === "IMMEDIATE"
					).length,
					overallRiskLevel:
						criticalFrames.length > 0
							? "CRITICAL"
							: highOverallRiskFrames.length > 0
							? "HIGH"
							: fireDetectedFrames.length > 0 ||
							  overcrowdedFrames.length > 0 ||
							  unconsciousDetectedFrames.length > 0 ||
							  stampedeDetectedFrames.length > 0
							? "MODERATE"
							: "LOW",
				},
			};

			// Generate AI summary and logs using Gemini
			const geminiService = new GeminiService();
			const aiAnalysis = await geminiService.generateCCTVAnalysisSummary({
				cctvId: cctvId,
				summary: summary,
				detailedResults: analysisResults,
				cctvMetadata: aiData.cctvMetadata,
				videoMetadata: aiData.videoMetadata,
				processedAt: new Date().toISOString(),
			});

			// Store AI analysis results in the event document for later retrieval
			const updateResult = await eventsCollection.updateOne(
				{ _id: new ObjectId(id) },
				{
					$set: {
						aiSummary: aiAnalysis.summary,
						aiLogs: Array.isArray(aiAnalysis.logs)
							? aiAnalysis.logs
							: [aiAnalysis.logs],
						aiAnalysis: aiAnalysis,
						detectionResults: {
							summary: summary,
							detailedResults: analysisResults.slice(0, 10), // Store first 10 frames to avoid document size issues
							cctvMetadata: aiData.cctvMetadata,
							processedAt: new Date().toISOString(),
							cctvId: cctvId,
						},
						lastProcessedAt: new Date(),
						updatedAt: new Date(),
					},
				}
			);

			console.log(
				`AI analysis stored for event ${id}:`,
				updateResult.modifiedCount > 0 ? "SUCCESS" : "FAILED"
			);

			res.json({
				success: true,
				message: `Successfully processed ${
					aiData.frames?.length || 0
				} frames from CCTV ${cctvId} with comprehensive safety detection (fire, crowd, unconscious, stampede)`,
				cctvId: cctvId,
				summary: summary,
				detailedResults: analysisResults,
				cctvMetadata: aiData.cctvMetadata,
				videoMetadata: aiData.videoMetadata,
				processedAt: new Date().toISOString(),
				// AI-generated insights
				aiSummary: aiAnalysis.summary,
				aiLogs: aiAnalysis.logs,
				aiAnalysis: {
					generatedAt: aiAnalysis.generatedAt,
					model: aiAnalysis.model,
					error: aiAnalysis.error || null,
				},
			});

			// aiData now contains: cctvMetadata, videoMetadata, and frames with CCTV info

			// Enhanced response data with AI-ready structure
			// const responseData = {
			//   success: true,
			//   message: `Successfully processed ${aiData.frames?.length || 0} frames from CCTV ${cctvId}`,
			//   processingInfo: {
			//     cctvId: cctvId,
			//     intervalSeconds: 0.5, // Updated to match actual processing interval
			//     totalFrames: aiData.frames?.length || 0,
			//     processedAt: new Date().toISOString()
			//   },
			//   aiReadyData: aiData, // Complete AI-ready data structure
			//   // Legacy compatibility fields
			//   cctvId: cctvId,
			//   area: coverageData,
			//   videoSource: {
			//     type: cctvConfig.videoSource,
			//     url: cctvConfig.videoSource === 'rtsp' ? cctvConfig.rtspLink : cctvConfig.videoFileUrl
			//   },
			//   frames: aiData.frames || [], // AI-ready frames with CCTV metadata
			//   frameCount: aiData.frames?.length || 0,
			//   processedAt: new Date().toISOString(),
			//   event: {
			//     id: event._id,
			//     title: event.title,
			//     startDate: event.startDate,
			//     endDate: event.endDate
			//   }
			// };

			// res.json({
			//   message: 'CCTV data processed successfully',
			//   data: responseData
			// });
		} catch (processingError) {
			console.error("Error processing video:", processingError);
			res.status(500).json({
				message: "Error processing video frames",
				error: processingError.message,
				cctvId: cctvId,
				area: coverageData,
			});
		}
	} catch (error) {
		console.error("Error processing CCTV data:", error);
		res
			.status(500)
			.json({ message: "Internal server error: " + error.message });
	}
});

// GET /api/events/:id/messages - Get chat messages for an event
router.get("/:id/messages", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const { page = 1, limit = 50 } = req.query;

		const { ObjectId } = require("mongodb");
		const eventsCollection = req.app.get("eventsCollection");
		const messagesCollection = req.app.get("messagesCollection");

		// Validate ObjectId
		if (!ObjectId.isValid(id)) {
			return res.status(400).json({ message: "Invalid event ID" });
		}

		// Check if event exists and user has access
		const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
		if (!event) {
			return res.status(404).json({ message: "Event not found" });
		}

		// Check if user has access to this event
		const hasAccess =
			event.organizers.includes(req.user.username) ||
			event.participants.includes(req.user.username) ||
			event.isPublic;

		if (!hasAccess) {
			return res.status(403).json({ message: "Access denied" });
		}

		// Fetch messages with pagination
		const messages = await messagesCollection
			.find({ eventId: id })
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit))
			.toArray();

		// Reverse to show oldest first
		messages.reverse();

		const totalMessages = await messagesCollection.countDocuments({
			eventId: id,
		});

		res.json({
			messages,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total: totalMessages,
				hasMore: parseInt(page) * parseInt(limit) < totalMessages,
			},
		});
	} catch (error) {
		console.error("Error fetching messages:", error);
		res.status(500).json({ message: "Internal server error" });
	}
});

// Get event logs with AI analysis
router.get("/:id/logs", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const eventsCollection = req.app.get("eventsCollection");
		const { ObjectId } = require("mongodb");

		// Find the event with fresh data from database
		const event = await eventsCollection.findOne({
			_id: new ObjectId(id),
		});

		if (!event) {
			return res.status(404).json({
				success: false,
				error: "Event not found",
			});
		}

		// Check if user has access to this event
		const hasAccess =
			event.organizers.includes(req.user.username) ||
			event.participants.includes(req.user.username) ||
			event.isPublic;

		if (!hasAccess) {
			return res.status(403).json({
				success: false,
				error: "Access denied",
			});
		}

		// Determine processing status
		const processingStatus = event.processingStatus || "not_started";
		const hasAIData =
			event.aiSummary &&
			event.aiSummary !==
				"No AI analysis has been performed for this event yet. Process CCTV footage to generate intelligent insights and safety analysis.";

		// Return logs data with AI analysis (always fresh from database)
		const logsData = {
			aiSummary:
				event.aiSummary ||
				"No AI analysis has been performed for this event yet. Process CCTV footage to generate intelligent insights and safety analysis.",
			aiLogs: event.aiLogs || [
				`Event "${event.title}" created on ${new Date(
					event.createdAt
				).toLocaleString()}`,
				"Event monitoring initiated",
				"Awaiting CCTV processing for detailed analysis",
			],
			aiAnalysis:
				event.aiAnalysis ||
				"Comprehensive safety analysis will be available after processing CCTV footage. This includes fire detection, crowd analysis, unconscious person detection, and stampede risk assessment.",
			detectionResults: event.detectionResults || null,
			lastUpdated: event.updatedAt || event.createdAt,
			processingStatus: processingStatus,
			hasAIData: hasAIData,
			lastProcessedAt: event.lastProcessedAt || null,
			// Add debug info
			debugInfo: {
				eventId: id,
				retrievedAt: new Date().toISOString(),
				databaseFields: {
					hasAiSummary: !!event.aiSummary,
					hasAiLogs: !!event.aiLogs,
					hasAiAnalysis: !!event.aiAnalysis,
					hasDetectionResults: !!event.detectionResults,
				},
			},
		};

		// Set cache control headers to prevent caching
		res.set("Cache-Control", "no-cache, no-store, must-revalidate");
		res.set("Pragma", "no-cache");
		res.set("Expires", "0");

		res.json({
			success: true,
			data: logsData,
		});
	} catch (error) {
		console.error("Error fetching event logs:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch event logs",
		});
	}
});

// Helper function to process video and generate AI analysis
async function processVideoAndGenerateAI(event, cctvId, eventsCollection) {
	try {
		const { ObjectId } = require("mongodb");

		// Find the specific CCTV configuration
		let cctvConfig = null;
		if (event.cctvConfigs && Array.isArray(event.cctvConfigs)) {
			cctvConfig = event.cctvConfigs.find((config) => config.cctvId === cctvId);
		} else if (
			event.cctvConfig &&
			(event.cctvConfig.cctvId === cctvId || cctvId === "default-cctv")
		) {
			cctvConfig = event.cctvConfig;
		}

		if (!cctvConfig) {
			console.error(`CCTV configuration not found for ${cctvId}`);
			return;
		}

		// Calculate coverage area
		function degreesToRadians(deg) {
			return deg * (Math.PI / 180);
		}

		function calculateCCTVCoverageArea({
			height,
			verticalFOV,
			horizontalFOV,
			tilt,
		}) {
			const theta = degreesToRadians(verticalFOV);
			const phi = degreesToRadians(horizontalFOV);
			const alpha = degreesToRadians(tilt);

			let d1 = height * Math.tan(alpha - theta / 2);
			let d2 = height * Math.tan(alpha + theta / 2);

			d1 = Math.max(0, d1);
			d2 = Math.max(d1, d2);

			let w1 = 2 * d1 * Math.tan(phi / 2);
			let w2 = 2 * d2 * Math.tan(phi / 2);

			w1 = Math.max(0, w1);
			w2 = Math.max(0, w2);

			const area = 0.5 * (w1 + w2) * (d2 - d1);

			return {
				d1: d1.toFixed(2),
				d2: d2.toFixed(2),
				w1: w1.toFixed(2),
				w2: w2.toFixed(2),
				area: parseFloat(area.toFixed(2)),
				areaText: area.toFixed(2) + " m²",
			};
		}

		const coverageData = calculateCCTVCoverageArea({
			height: parseFloat(cctvConfig.mountingHeight) || 3.0,
			verticalFOV: parseFloat(cctvConfig.verticalFOV) || 60,
			horizontalFOV: parseFloat(cctvConfig.horizontalFOV) || 90,
			tilt: parseFloat(cctvConfig.cameraTilt) || 0,
		});

		// Check if CCTV has video source
		if (
			!cctvConfig.videoSource &&
			!cctvConfig.rtspLink &&
			!cctvConfig.videoFileUrl
		) {
			console.error(`No video source configured for CCTV ${cctvId}`);
			return;
		}

		const videoProcessingService = new VideoProcessingService();
		let aiData = {};

		// Prepare CCTV metadata
		const cctvMetadata = {
			id: cctvId,
			coverageArea: coverageData.areaText,
			mountingHeight:
				parseFloat(cctvConfig.mountingHeight || 3.0).toFixed(1) + "m",
			verticalFOV: parseFloat(cctvConfig.verticalFOV || 60).toFixed(1) + "°",
			horizontalFOV:
				parseFloat(cctvConfig.horizontalFOV || 90).toFixed(1) + "°",
			cameraTilt: parseFloat(cctvConfig.cameraTilt || 0).toFixed(1) + "°",
			location: cctvConfig.location || "Unknown location",
			coordinates: cctvConfig.coordinates || null,
			coverageDetails: {
				nearDistance: coverageData.d1 + "m",
				farDistance: coverageData.d2 + "m",
				nearWidth: coverageData.w1 + "m",
				farWidth: coverageData.w2 + "m",
				totalAreaM2: coverageData.area,
			},
		};

		console.log(`🔄 Processing video for CCTV ${cctvId}...`);

		// Extract frames based on video source type
		if (
			(cctvConfig.videoSource === "rtsp" && cctvConfig.rtspLink) ||
			(!cctvConfig.videoSource && cctvConfig.rtspLink)
		) {
			console.log(`Processing RTSP stream: ${cctvConfig.rtspLink}`);
			aiData = await videoProcessingService.extractFramesFromRTSPByInterval(
				cctvConfig.rtspLink,
				0.5, // 0.5 second intervals
				30, // 30 seconds capture
				cctvMetadata
			);
		} else if (
			(cctvConfig.videoSource === "file" && cctvConfig.videoFileUrl) ||
			(!cctvConfig.videoSource && cctvConfig.videoFileUrl)
		) {
			console.log(`Processing video file: ${cctvConfig.videoFileUrl}`);
			aiData =
				await videoProcessingService.extractFramesFromSupabaseVideoByInterval(
					cctvConfig.videoFileUrl,
					0.5, // 0.5 second intervals
					cctvMetadata
				);
		} else {
			console.error(`No valid video source found for CCTV ${cctvId}`);
			return;
		}

		if (!aiData.frames || aiData.frames.length === 0) {
			console.error(`No frames extracted from video for CCTV ${cctvId}`);
			return;
		}

		console.log(
			`✅ Extracted ${aiData.frames.length} frames, starting AI analysis...`
		);

		// Process frames with AI models
		const analysisResults = [];
		const safetyDetector = new ComprehensiveSafetyDetector();

		for (let i = 0; i < Math.min(aiData.frames.length, 10); i++) {
			// Limit to 10 frames for performance
			const frame = aiData.frames[i];

			try {
				const base64Data = frame.base64Data.replace(
					/^data:image\/[a-z]+;base64,/,
					""
				);
				const imageBuffer = Buffer.from(base64Data, "base64");

				const { inputTensor, originalWidth, originalHeight } = await preprocess(
					imageBuffer
				);

				// Fire detection
				const { intensity, fireDetected } = await detectFireIntensity(
					inputTensor,
					originalWidth,
					originalHeight
				);

				// Comprehensive safety detection
				const safetyResult = await safetyDetector.detectAllThreats(
					imageBuffer,
					coverageData.area
				);

				const frameResult = {
					frameId: frame.id,
					timestamp: frame.timeInVideo,
					fireDetection: {
						intensity: parseFloat(intensity.toFixed(4)),
						fireDetected: fireDetected,
						riskLevel: fireDetected
							? intensity > 0.3
								? "HIGH"
								: "MEDIUM"
							: "LOW",
					},
					crowdDetection: safetyResult.crowd,
					unconsciousDetection: safetyResult.unconscious,
					stampedeDetection: safetyResult.stampede,
					overallRisk: safetyResult.overallRisk,
					emergencyPriority: safetyResult.emergencyPriority,
				};

				analysisResults.push(frameResult);

				console.log(
					`Frame ${i + 1}: Fire=${fireDetected ? "YES" : "NO"}, People=${
						safetyResult.crowd.personCount
					}, Risk=${safetyResult.overallRisk.level}`
				);
			} catch (frameError) {
				console.error(`Error processing frame ${i + 1}:`, frameError.message);
				analysisResults.push({
					frameId: frame.id,
					timestamp: frame.timeInVideo,
					error: frameError.message,
				});
			}
		}

		// Calculate summary statistics
		const fireDetectedFrames = analysisResults.filter(
			(r) => r.fireDetection?.fireDetected
		);
		const overcrowdedFrames = analysisResults.filter(
			(r) => r.crowdDetection?.isOvercrowded
		);
		const unconsciousDetectedFrames = analysisResults.filter(
			(r) => r.unconsciousDetection?.unconsciousCount > 0
		);
		const stampedeDetectedFrames = analysisResults.filter(
			(r) => r.stampedeDetection?.isStampede
		);
		const criticalFrames = analysisResults.filter(
			(r) => r.overallRisk?.level === "CRITICAL"
		);
		const highOverallRiskFrames = analysisResults.filter(
			(r) => r.overallRisk?.level === "HIGH"
		);

		const totalPeople = analysisResults.reduce(
			(sum, r) => sum + (r.crowdDetection?.personCount || 0),
			0
		);
		const avgPeople =
			analysisResults.length > 0 ? totalPeople / analysisResults.length : 0;

		const summary = {
			totalFrames: analysisResults.length,
			fireDetectedFrames: fireDetectedFrames.length,
			averagePeoplePerFrame: parseFloat(avgPeople.toFixed(1)),
			overallFireRisk: fireDetectedFrames.length > 0 ? "DETECTED" : "SAFE",
			processingSuccess: analysisResults.filter((r) => !r.error).length,
			crowdSafety: {
				overcrowdedFrames: overcrowdedFrames.length,
				maxDensityPercentage: Math.max(
					...analysisResults.map(
						(r) => r.crowdDetection?.densityPercentage || 0
					)
				),
				avgDensityPercentage: parseFloat(
					(
						analysisResults.reduce(
							(sum, r) => sum + (r.crowdDetection?.densityPercentage || 0),
							0
						) / analysisResults.length
					).toFixed(1)
				),
			},
			unconsciousSafety: {
				framesWithUnconsciousPersons: unconsciousDetectedFrames.length,
				totalUnconsciousDetected: analysisResults.reduce(
					(sum, r) => sum + (r.unconsciousDetection?.unconsciousCount || 0),
					0
				),
			},
			stampedeSafety: {
				stampedeDetectedFrames: stampedeDetectedFrames.length,
				avgMotionIntensity: parseFloat(
					(
						analysisResults.reduce(
							(sum, r) => sum + (r.stampedeDetection?.motionIntensity || 0),
							0
						) / analysisResults.length
					).toFixed(3)
				),
			},
			overallSafety: {
				criticalFrames: criticalFrames.length,
				highRiskFrames: highOverallRiskFrames.length,
				overallRiskLevel:
					criticalFrames.length > 0
						? "CRITICAL"
						: highOverallRiskFrames.length > 0
						? "HIGH"
						: fireDetectedFrames.length > 0 ||
						  overcrowdedFrames.length > 0 ||
						  unconsciousDetectedFrames.length > 0 ||
						  stampedeDetectedFrames.length > 0
						? "MODERATE"
						: "LOW",
			},
		};

		console.log(`🤖 Generating AI analysis with Gemini...`);

		// Generate AI summary and logs using Gemini
		const geminiService = new GeminiService();
		const aiAnalysis = await geminiService.generateCCTVAnalysisSummary({
			cctvId: cctvId,
			summary: summary,
			detailedResults: analysisResults,
			cctvMetadata: aiData.cctvMetadata,
			videoMetadata: aiData.videoMetadata,
			processedAt: new Date().toISOString(),
		});

		console.log(`💾 Storing AI analysis results in database...`);

		// Store AI analysis results in the event document
		const updateResult = await eventsCollection.updateOne(
			{ _id: new ObjectId(event._id) },
			{
				$set: {
					aiSummary: aiAnalysis.summary,
					aiLogs: Array.isArray(aiAnalysis.logs)
						? aiAnalysis.logs
						: [aiAnalysis.logs],
					aiAnalysis: aiAnalysis,
					detectionResults: {
						summary: summary,
						detailedResults: analysisResults.slice(0, 5), // Store first 5 frames
						cctvMetadata: aiData.cctvMetadata,
						processedAt: new Date().toISOString(),
						cctvId: cctvId,
					},
					lastProcessedAt: new Date(),
					updatedAt: new Date(),
				},
			}
		);

		console.log(
			`✅ AI analysis completed and stored for CCTV ${cctvId}:`,
			updateResult.modifiedCount > 0 ? "SUCCESS" : "FAILED"
		);

		return {
			success: true,
			summary: summary,
			aiAnalysis: aiAnalysis,
		};
	} catch (error) {
		console.error(
			`❌ Error in background processing for CCTV ${cctvId}:`,
			error.message
		);

		// Store error information in the event
		try {
			await eventsCollection.updateOne(
				{ _id: new ObjectId(event._id) },
				{
					$set: {
						aiSummary: `Processing failed: ${error.message}`,
						aiLogs: [
							`Processing error occurred at ${new Date().toISOString()}: ${
								error.message
							}`,
						],
						lastProcessedAt: new Date(),
						updatedAt: new Date(),
					},
				}
			);
		} catch (dbError) {
			console.error(`Failed to store error information:`, dbError.message);
		}

		throw error;
	}
}

module.exports = router;
