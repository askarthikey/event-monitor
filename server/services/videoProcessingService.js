const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { spawn } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

class VideoProcessingService {
	constructor() {
		this.supabase = createClient(
			process.env.SUPABASE_URL,
			process.env.SUPABASE_ANON_KEY
		);
	}

	/**
	 * Extract frames from a video file stored in Supabase at specified intervals with CCTV metadata
	 * @param {string} videoUrl - The Supabase URL of the video
	 * @param {number} intervalSeconds - Time interval between frames in seconds (default: 0.5)
	 * @param {Object} cctvMetadata - CCTV information (id, area, etc.)
	 * @returns {Promise<Object>} Object containing frames and CCTV metadata for AI processing
	 */
	async extractFramesFromSupabaseVideoByInterval(
		videoUrl,
		intervalSeconds = 0.5,
		cctvMetadata = {}
	) {
		return new Promise(async (resolve, reject) => {
			try {
				// Download video from Supabase to temporary location
				const tempVideoPath = path.join(
					__dirname,
					"../temp",
					`video_${Date.now()}.mp4`
				);
				const tempFramesDir = path.join(
					__dirname,
					"../temp",
					`frames_${Date.now()}`
				);

				// Ensure temp directories exist
				await this.ensureDirectoryExists(path.dirname(tempVideoPath));
				await this.ensureDirectoryExists(tempFramesDir);

				// Download video using curl (more reliable than Node.js HTTP client)
				const downloadVideo = (url, filePath) => {
					return new Promise((downloadResolve, downloadReject) => {
						const { spawn } = require("child_process");
						const curl = spawn("curl", ["-L", "-o", filePath, url]);

						curl.on("close", (code) => {
							if (code !== 0) {
								downloadReject(new Error(`Curl exited with code ${code}`));
								return;
							}

							if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
								console.log(
									`✅ Video downloaded successfully: ${(
										fs.statSync(filePath).size /
										1024 /
										1024
									).toFixed(2)} MB`
								);
								downloadResolve();
							} else {
								downloadReject(
									new Error("Downloaded file is empty or does not exist")
								);
							}
						});

						curl.on("error", (err) => {
							downloadReject(err);
						});
					});
				};

				// Download the video
				await downloadVideo(videoUrl, tempVideoPath);

				// Verify the file exists and has content
				if (
					!fs.existsSync(tempVideoPath) ||
					fs.statSync(tempVideoPath).size === 0
				) {
					throw new Error("Downloaded video file is empty or corrupted");
				}

				// Get video duration first
				ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
					if (err) {
						this.cleanup([tempVideoPath, tempFramesDir]);
						return reject(err);
					}

					const duration = metadata.format.duration;
					const frameCount = Math.floor(duration / intervalSeconds);
					console.log(
						`📹 Video duration: ${duration.toFixed(
							2
						)}s, extracting ${frameCount} frames every ${intervalSeconds}s`
					);

					// Extract all frames at once using fps filter
					const fps = 1 / intervalSeconds; // Convert interval to fps

					ffmpeg(tempVideoPath)
						.outputOptions([`-vf fps=${fps}`, "-y"])
						.output(path.join(tempFramesDir, "frame_%03d.jpg"))
						.on("start", (commandLine) => {
							console.log(`FFmpeg command: ${commandLine}`);
						})
						.on("progress", (progress) => {
							if (progress.percent && progress.percent % 20 === 0) {
								console.log(
									`Extraction progress: ${Math.round(progress.percent)}%`
								);
							}
						})
						.on("end", () => {
							// All frames extracted, convert to base64 and cleanup
							this.convertFramesToBase64(tempFramesDir)
								.then((base64Frames) => {
									this.cleanup([tempVideoPath, tempFramesDir]);

									// Prepare AI-ready data structure with CCTV metadata
									const aiReadyData = {
										cctvMetadata: {
											id: cctvMetadata.id || "UNKNOWN_CCTV",
											coverageArea: cctvMetadata.coverageArea || "Unknown area",
											mountingHeight:
												cctvMetadata.mountingHeight || "Unknown height",
											verticalFOV: cctvMetadata.verticalFOV || "Unknown FOV",
											horizontalFOV:
												cctvMetadata.horizontalFOV || "Unknown FOV",
											cameraTilt: cctvMetadata.cameraTilt || "Unknown tilt",
											location: cctvMetadata.location || "Unknown location",
											coordinates: cctvMetadata.coordinates || null,
											coverageDetails: cctvMetadata.coverageDetails || {},
										},
										videoMetadata: {
											source: "supabase",
											url: videoUrl,
											duration: duration.toFixed(2),
											frameCount: base64Frames.length,
											intervalSeconds: intervalSeconds,
											processedAt: new Date().toISOString(),
										},
										frames: base64Frames.map((frame, index) => ({
											id: index + 1,
											filename: frame.filename,
											timestamp: frame.timestamp,
											timeInVideo: index * intervalSeconds,
											base64Data: frame.data,
											dataSize: Math.round(frame.data.length / 1024) + "KB",
											cctvId: cctvMetadata.id || "UNKNOWN_CCTV",
											cctvArea: cctvMetadata.coverageArea || "Unknown area",
										})),
									};

									resolve(aiReadyData);
								})
								.catch((error) => {
									this.cleanup([tempVideoPath, tempFramesDir]);
									reject(error);
								});
						})
						.on("error", (err) => {
							console.error(`FFmpeg error:`, err.message);
							this.cleanup([tempVideoPath, tempFramesDir]);
							reject(err);
						})
						.run();
				});
			} catch (error) {
				this.cleanup([tempVideoPath, tempFramesDir]);
				reject(error);
			}
		});
	}

	/**
	 * Extract frames from a video file stored in Supabase
	 * @param {string} videoUrl - The Supabase URL of the video
	 * @param {number} frameCount - Number of frames to extract (default: 10)
	 * @returns {Promise<Array>} Array of base64 encoded frames
	 */
	async extractFramesFromSupabaseVideo(videoUrl, frameCount = 10) {
		return new Promise(async (resolve, reject) => {
			try {
				// Download video from Supabase to temporary location
				const response = await fetch(videoUrl);
				if (!response.ok) {
					throw new Error(`Failed to download video: ${response.statusText}`);
				}

				const videoBuffer = await response.arrayBuffer();
				const tempVideoPath = path.join(
					__dirname,
					"../temp",
					`video_${Date.now()}.mp4`
				);
				const tempFramesDir = path.join(
					__dirname,
					"../temp",
					`frames_${Date.now()}`
				);

				// Ensure temp directories exist
				await this.ensureDirectoryExists(path.dirname(tempVideoPath));
				await this.ensureDirectoryExists(tempFramesDir);

				// Write video buffer to temporary file
				fs.writeFileSync(tempVideoPath, Buffer.from(videoBuffer));

				// Get video duration first
				ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
					if (err) {
						this.cleanup([tempVideoPath, tempFramesDir]);
						return reject(err);
					}

					const duration = metadata.format.duration;
					const interval = duration / frameCount;
					const frames = [];

					// Extract frames at calculated intervals
					const extractFrame = (index) => {
						if (index >= frameCount) {
							// All frames extracted, convert to base64 and cleanup
							this.convertFramesToBase64(tempFramesDir)
								.then((base64Frames) => {
									this.cleanup([tempVideoPath, tempFramesDir]);
									resolve(base64Frames);
								})
								.catch((error) => {
									this.cleanup([tempVideoPath, tempFramesDir]);
									reject(error);
								});
							return;
						}

						const timestamp = index * interval;
						const outputPath = path.join(
							tempFramesDir,
							`frame_${index.toString().padStart(3, "0")}.jpg`
						);

						ffmpeg(tempVideoPath)
							.seekInput(timestamp)
							.frames(1)
							.output(outputPath)
							.on("end", () => {
								extractFrame(index + 1);
							})
							.on("error", (err) => {
								this.cleanup([tempVideoPath, tempFramesDir]);
								reject(err);
							})
							.run();
					};

					extractFrame(0);
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Extract frames from RTSP stream at specified intervals with CCTV metadata
	 * @param {string} rtspUrl - The RTSP stream URL
	 * @param {number} intervalSeconds - Time interval between frames in seconds (default: 0.2)
	 * @param {number} totalDuration - Total duration to capture frames from (in seconds, default: 30)
	 * @param {Object} cctvMetadata - CCTV information (id, area, etc.)
	 * @returns {Promise<Object>} Object containing frames and CCTV metadata for AI processing
	 */
	async extractFramesFromRTSPByInterval(
		rtspUrl,
		intervalSeconds = 0.2,
		totalDuration = 30,
		cctvMetadata = {}
	) {
		return new Promise(async (resolve, reject) => {
			try {
				const tempFramesDir = path.join(
					__dirname,
					"../temp",
					`rtsp_frames_${Date.now()}`
				);
				await this.ensureDirectoryExists(tempFramesDir);

				const frameCount = Math.floor(totalDuration / intervalSeconds);
				console.log(
					`📹 RTSP capture: ${totalDuration}s duration, extracting ${frameCount} frames every ${intervalSeconds}s`
				);

				const extractFrame = (index) => {
					if (index >= frameCount) {
						// All frames extracted, convert to base64 and cleanup
						this.convertFramesToBase64(tempFramesDir)
							.then((base64Frames) => {
								this.cleanup([tempFramesDir]);

								// Prepare AI-ready data structure with CCTV metadata
								const aiReadyData = {
									cctvMetadata: {
										id: cctvMetadata.id || "UNKNOWN_CCTV",
										coverageArea: cctvMetadata.coverageArea || "Unknown area",
										mountingHeight:
											cctvMetadata.mountingHeight || "Unknown height",
										fieldOfView: cctvMetadata.fieldOfView || "Unknown FOV",
										location: cctvMetadata.location || "Unknown location",
										coordinates: cctvMetadata.coordinates || null,
									},
									videoMetadata: {
										source: "rtsp",
										url: rtspUrl,
										duration: totalDuration.toFixed(2),
										frameCount: base64Frames.length,
										intervalSeconds: intervalSeconds,
										processedAt: new Date().toISOString(),
									},
									frames: base64Frames.map((frame, index) => ({
										id: index + 1,
										filename: frame.filename,
										timestamp: frame.timestamp,
										timeInVideo: (index * intervalSeconds).toFixed(2),
										base64Data: frame.data,
										dataSize: Math.round(frame.data.length / 1024) + "KB",
										cctvId: cctvMetadata.id || "UNKNOWN_CCTV",
										cctvArea: cctvMetadata.coverageArea || "Unknown area",
									})),
								};

								resolve(aiReadyData);
							})
							.catch((error) => {
								this.cleanup([tempFramesDir]);
								reject(error);
							});
						return;
					}

					const timestamp = index * intervalSeconds;
					const outputPath = path.join(
						tempFramesDir,
						`rtsp_frame_${index.toString().padStart(3, "0")}.jpg`
					);

					ffmpeg(rtspUrl)
						.inputOptions([
							"-rtsp_transport",
							"tcp",
							"-ss",
							timestamp.toString(),
						])
						.frames(1)
						.output(outputPath)
						.on("end", () => {
							extractFrame(index + 1);
						})
						.on("error", (err) => {
							this.cleanup([tempFramesDir]);
							reject(err);
						})
						.run();
				};

				extractFrame(0);
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Extract frames from RTSP stream
	 * @param {string} rtspUrl - The RTSP stream URL
	 * @param {number} frameCount - Number of frames to extract
	 * @param {number} duration - Duration to capture frames from (in seconds)
	 * @returns {Promise<Array>} Array of base64 encoded frames
	 */
	async extractFramesFromRTSP(rtspUrl, frameCount = 10, duration = 30) {
		return new Promise(async (resolve, reject) => {
			try {
				const tempFramesDir = path.join(
					__dirname,
					"../temp",
					`rtsp_frames_${Date.now()}`
				);
				await this.ensureDirectoryExists(tempFramesDir);

				const interval = duration / frameCount;
				const frames = [];

				const extractFrame = (index) => {
					if (index >= frameCount) {
						// All frames extracted, convert to base64 and cleanup
						this.convertFramesToBase64(tempFramesDir)
							.then((base64Frames) => {
								this.cleanup([tempFramesDir]);
								resolve(base64Frames);
							})
							.catch((error) => {
								this.cleanup([tempFramesDir]);
								reject(error);
							});
						return;
					}

					const timestamp = index * interval;
					const outputPath = path.join(
						tempFramesDir,
						`rtsp_frame_${index.toString().padStart(3, "0")}.jpg`
					);

					ffmpeg(rtspUrl)
						.inputOptions([
							"-rtsp_transport",
							"tcp",
							"-ss",
							timestamp.toString(),
						])
						.frames(1)
						.output(outputPath)
						.on("end", () => {
							extractFrame(index + 1);
						})
						.on("error", (err) => {
							this.cleanup([tempFramesDir]);
							reject(err);
						})
						.run();
				};

				extractFrame(0);
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Convert frame images to base64
	 * @param {string} framesDir - Directory containing frame images
	 * @returns {Promise<Array>} Array of base64 encoded frames
	 */
	async convertFramesToBase64(framesDir) {
		return new Promise((resolve, reject) => {
			try {
				const files = fs
					.readdirSync(framesDir)
					.filter((file) => file.endsWith(".jpg") || file.endsWith(".png"))
					.sort();

				const base64Frames = files.map((file) => {
					const filePath = path.join(framesDir, file);
					const imageBuffer = fs.readFileSync(filePath);
					return {
						filename: file,
						data: `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
						timestamp: this.extractTimestampFromFilename(file),
					};
				});

				resolve(base64Frames);
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Extract timestamp from filename (for ordering)
	 * @param {string} filename
	 * @returns {number}
	 */
	extractTimestampFromFilename(filename) {
		const match = filename.match(/(\d+)/);
		return match ? parseInt(match[1]) : 0;
	}

	/**
	 * Ensure directory exists
	 * @param {string} dirPath
	 */
	async ensureDirectoryExists(dirPath) {
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}
	}

	/**
	 * Clean up temporary files and directories
	 * @param {Array} paths - Array of file/directory paths to clean up
	 */
	cleanup(paths) {
		paths.forEach((filePath) => {
			try {
				if (fs.existsSync(filePath)) {
					const stats = fs.statSync(filePath);
					if (stats.isDirectory()) {
						fs.rmSync(filePath, { recursive: true, force: true });
					} else {
						fs.unlinkSync(filePath);
					}
				}
			} catch (error) {
				console.error(`Error cleaning up ${filePath}:`, error);
			}
		});
	}
}

module.exports = VideoProcessingService;
