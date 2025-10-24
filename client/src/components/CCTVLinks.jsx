import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import apiService from "../services/apiService";

const CCTVLinks = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { event } = location.state || {};

	const [cctvData, setCctvData] = useState(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedCctv, setSelectedCctv] = useState(null);
	const [videoSource, setVideoSource] = useState("rtsp"); // 'rtsp' or 'file'
	const [rtspLink, setRtspLink] = useState("");
	const [videoFile, setVideoFile] = useState(null);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadMessage, setUploadMessage] = useState("");

	// Helper functions for area calculation
	const degreesToRadians = (degrees) => {
		return degrees * (Math.PI / 180);
	};

	const calculateCCTVCoverageArea = ({
		height,
		verticalFOV,
		horizontalFOV,
		tilt,
	}) => {
		// Convert angles to radians
		const theta = degreesToRadians(verticalFOV);
		const phi = degreesToRadians(horizontalFOV);
		const alpha = degreesToRadians(tilt);

		// Calculate near and far distances (d1 and d2)
		const d1 = height * Math.tan(alpha - theta / 2);
		const d2 = height * Math.tan(alpha + theta / 2);

		// Calculate near and far widths (w1 and w2)
		const w1 = 2 * d1 * Math.tan(phi / 2);
		const w2 = 2 * d2 * Math.tan(phi / 2);

		// Calculate trapezoidal ground area
		const area = 0.5 * (w1 + w2) * (d2 - d1);

		return {
			d1: d1.toFixed(2),
			d2: d2.toFixed(2),
			w1: w1.toFixed(2),
			w2: w2.toFixed(2),
			area: area.toFixed(2) + " m²",
		};
	};

	useEffect(() => {
		// If no event data, redirect back
		if (!event) {
			navigate("/events");
			return;
		}

		// Initialize CCTV data from the event
		if (event.cctvConfigs && Array.isArray(event.cctvConfigs)) {
			setCctvData(event.cctvConfigs);
		} else if (event.cctvConfig) {
			// Handle legacy single CCTV config
			setCctvData([event.cctvConfig]);
		}
	}, [event, navigate]);

	const handleBack = () => {
		navigate("/events");
	};

	const handleUploadClick = (cctvConfig) => {
		setSelectedCctv(cctvConfig);
		setIsModalOpen(true);
		setUploadMessage("");

		// Pre-populate form with existing data if available
		if (cctvConfig.videoSource) {
			setVideoSource(cctvConfig.videoSource);
			if (cctvConfig.videoSource === "rtsp" && cctvConfig.rtspLink) {
				setRtspLink(cctvConfig.rtspLink);
			}
		} else {
			setVideoSource("rtsp");
			setRtspLink("");
		}

		setVideoFile(null);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setSelectedCctv(null);
		setUploadMessage("");
		setVideoSource("rtsp");
		setRtspLink("");
		setVideoFile(null);
	};

	const handleSubmitVideo = async () => {
		if (!selectedCctv) return;

		if (videoSource === "rtsp" && !rtspLink.trim()) {
			setUploadMessage("Please enter a valid RTSP link");
			return;
		}

		if (videoSource === "file" && !videoFile) {
			setUploadMessage("Please select a video file");
			return;
		}

		setIsUploading(true);
		setUploadMessage("");

		try {
			const token = localStorage.getItem("token");
			if (!token) {
				setUploadMessage("Authentication required");
				setIsUploading(false);
				return;
			}

			const formData = new FormData();
			formData.append("cctvId", selectedCctv.cctvId);
			formData.append("videoSource", videoSource);

			if (videoSource === "rtsp") {
				formData.append("rtspLink", rtspLink);
			} else if (videoSource === "file" && videoFile) {
				formData.append("videoFile", videoFile);
			}

			const response = await apiService.updateCCTVVideo(event._id, formData);

			if (response.ok) {
				const updatedEvent = await response.json();
				// Update local state with new data
				if (updatedEvent.event.cctvConfigs) {
					setCctvData(updatedEvent.event.cctvConfigs);
				}
				setUploadMessage(
					`Video link updated successfully for CCTV ${selectedCctv.cctvId}!`
				);

				// Close modal after 2 seconds
				setTimeout(() => {
					handleCloseModal();
				}, 2000);
			} else {
				const error = await response.json();
				setUploadMessage(
					"Error: " + (error.message || "Failed to update video")
				);
			}
		} catch (error) {
			console.error("Error updating video:", error);
			setUploadMessage("Error: Failed to update video");
		} finally {
			setIsUploading(false);
		}
	};

	if (!event) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center">
				<div className="text-center">
					<h2 className="text-2xl font-bold text-white mb-4">No Event Data</h2>
					<button
						onClick={handleBack}
						className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
						Back to Events
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-900">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Header */}
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<div>
							<button
								onClick={handleBack}
								className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-4">
								<svg
									className="w-5 h-5"
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
								<span>Back to Events</span>
							</button>

							<h1 className="text-3xl font-bold text-white mb-2">
								CCTV Configuration
							</h1>
							<p className="text-gray-400">
								Manage video links and configuration for:{" "}
								<span className="text-white font-medium">{event.title}</span>
							</p>
						</div>
					</div>
				</div>

				{/* Event Info Card */}
				<div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-8">
					<h2 className="text-xl font-semibold text-white mb-4">
						Event Information
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
						<div>
							<span className="text-gray-400">Event Title:</span>
							<p className="text-white font-medium">{event.title}</p>
						</div>
						<div>
							<span className="text-gray-400">Start Date:</span>
							<p className="text-white font-medium">
								{event.startDate
									? new Date(event.startDate).toLocaleDateString()
									: "N/A"}
							</p>
						</div>
						<div>
							<span className="text-gray-400">End Date:</span>
							<p className="text-white font-medium">
								{event.endDate
									? new Date(event.endDate).toLocaleDateString()
									: "N/A"}
							</p>
						</div>
					</div>
				</div>

				{/* CCTV Details Table */}
				{cctvData && cctvData.length > 0 ? (
					<div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
						<div className="p-6 border-b border-white/10">
							<h2 className="text-xl font-semibold text-white">
								CCTV Coverage Details
							</h2>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-white/5">
									<tr>
										<th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
											CCTV ID
										</th>
										<th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
											Coverage Area
										</th>
										<th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
											Video Source
										</th>
										<th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/10">
									{cctvData.map((config, index) => {
										const coverage = calculateCCTVCoverageArea({
											height: parseFloat(config.mountingHeight) || 0,
											verticalFOV: parseFloat(config.verticalFOV) || 0,
											horizontalFOV: parseFloat(config.horizontalFOV) || 0,
											tilt: parseFloat(config.cameraTilt) || 0,
										});

										// Check if CCTV has existing video source
										const hasVideoSource =
											config.videoSource &&
											(config.rtspLink || config.videoFileUrl);
										const videoSourceDisplay = () => {
											if (config.videoSource === "rtsp" && config.rtspLink) {
												return (
													<div className="flex flex-col space-y-1">
														<span className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-medium w-fit">
															RTSP Stream
														</span>
														<span
															className="text-xs text-gray-400 truncate max-w-[200px]"
															title={config.rtspLink}>
															{config.rtspLink}
														</span>
													</div>
												);
											} else if (
												config.videoSource === "file" &&
												config.videoFileUrl
											) {
												return (
													<div className="flex flex-col space-y-1">
														<span className="px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-medium w-fit">
															Video File
														</span>
														<a
															href={config.videoFileUrl}
															target="_blank"
															rel="noopener noreferrer"
															className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[200px]"
															title={config.videoFileUrl}>
															View Video
														</a>
													</div>
												);
											} else {
												return (
													<span className="px-2 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-full text-xs font-medium">
														No Source
													</span>
												);
											}
										};

										return (
											<tr
												key={config.cctvId || index}
												className="hover:bg-white/5 transition-colors">
												<td className="px-6 py-4 text-sm font-medium text-white">
													{config.cctvId || "N/A"}
												</td>
												<td className="px-6 py-4 text-sm text-gray-300">
													{coverage.area}
												</td>
												<td className="px-6 py-4">{videoSourceDisplay()}</td>
												<td className="px-6 py-4">
													<button
														onClick={() => handleUploadClick(config)}
														className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
														<svg
															className="w-4 h-4"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24">
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d={
																	hasVideoSource
																		? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
																		: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
																}
															/>
														</svg>
														<span>
															{hasVideoSource ? "Update Video" : "Upload Video"}
														</span>
													</button>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				) : (
					<div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
						<p className="text-gray-400">
							No CCTV configuration data available for this event.
						</p>
					</div>
				)}
			</div>

			{/* Video Upload Modal */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					{/* Backdrop */}
					<div
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						onClick={handleCloseModal}
					/>

					{/* Modal */}
					<div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
						{/* Header */}
						<div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-white/10 p-6">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-white">
									{selectedCctv?.videoSource ? "Update" : "Upload"} Video for
									CCTV {selectedCctv?.cctvId}
								</h2>
								<button
									onClick={handleCloseModal}
									className="p-2 text-gray-400 hover:text-white transition-colors">
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
						</div>

						{/* Form */}
						<div className="p-6 space-y-6">
							{/* Current Video Source Display (when updating) */}
							{selectedCctv?.videoSource && (
								<div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
									<h3 className="text-lg font-medium text-white mb-3">
										Current Video Source
									</h3>
									{selectedCctv.videoSource === "rtsp" &&
									selectedCctv.rtspLink ? (
										<div className="space-y-2">
											<div className="flex items-center space-x-2">
												<span className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-medium">
													RTSP Stream
												</span>
											</div>
											<div className="bg-black/20 border border-white/10 rounded-lg p-3">
												<p className="text-gray-300 break-all text-sm">
													{selectedCctv.rtspLink}
												</p>
											</div>
										</div>
									) : selectedCctv.videoSource === "file" &&
									  selectedCctv.videoFileUrl ? (
										<div className="space-y-2">
											<div className="flex items-center space-x-2">
												<span className="px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-medium">
													Video File
												</span>
											</div>
											<div className="bg-black/20 border border-white/10 rounded-lg p-3">
												<a
													href={selectedCctv.videoFileUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-400 hover:text-blue-300 text-sm break-all">
													{selectedCctv.videoFileUrl}
												</a>
											</div>
										</div>
									) : (
										<p className="text-gray-400 text-sm">
											No video source currently configured
										</p>
									)}
								</div>
							)}

							{/* Video Source Selection */}
							<div className="space-y-4">
								<label className="block text-sm font-medium text-gray-300">
									Video Source Type
								</label>

								<div className="flex space-x-6">
									<label className="flex items-center">
										<input
											type="radio"
											name="videoSource"
											value="rtsp"
											checked={videoSource === "rtsp"}
											onChange={(e) => setVideoSource(e.target.value)}
											className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
										/>
										<span className="ml-2 text-gray-300">RTSP Stream</span>
									</label>

									<label className="flex items-center">
										<input
											type="radio"
											name="videoSource"
											value="file"
											checked={videoSource === "file"}
											onChange={(e) => setVideoSource(e.target.value)}
											className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
										/>
										<span className="ml-2 text-gray-300">Video File</span>
									</label>
								</div>
							</div>

							{/* RTSP Link Input */}
							{videoSource === "rtsp" && (
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										RTSP Stream URL
									</label>
									<input
										type="url"
										value={rtspLink}
										onChange={(e) => setRtspLink(e.target.value)}
										className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors"
										placeholder="rtsp://example.com:554/stream"
									/>
								</div>
							)}

							{/* Video File Upload */}
							{videoSource === "file" && (
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Video File
									</label>
									<div className="flex items-center space-x-4">
										<input
											type="file"
											onChange={(e) => setVideoFile(e.target.files[0])}
											accept="video/*"
											className="hidden"
											id="videoFileInput"
										/>
										<label
											htmlFor="videoFileInput"
											className="flex items-center px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer">
											<svg
												className="w-5 h-5 mr-2"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24">
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
												/>
											</svg>
											Choose Video File
										</label>
										{videoFile && (
											<span className="text-sm text-gray-400">
												{videoFile.name}
											</span>
										)}
									</div>
									<p className="text-gray-500 text-xs mt-1">
										Supported formats: MP4, AVI, MOV, WebM (Max 100MB)
									</p>
								</div>
							)}

							{/* Status Message */}
							{uploadMessage && (
								<div
									className={`p-4 rounded-lg ${
										uploadMessage.includes("Error")
											? "bg-red-500/20 text-red-300 border border-red-500/30"
											: "bg-green-500/20 text-green-300 border border-green-500/30"
									}`}>
									{uploadMessage}
								</div>
							)}

							{/* Form Actions */}
							<div className="flex items-center justify-end space-x-4 pt-6 border-t border-white/10">
								<button
									type="button"
									onClick={handleCloseModal}
									disabled={isUploading}
									className="px-6 py-3 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
									Cancel
								</button>

								<button
									onClick={handleSubmitVideo}
									disabled={isUploading}
									className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
									{isUploading ? (
										<span className="flex items-center space-x-2">
											<svg
												className="animate-spin -ml-1 mr-2 h-4 w-4"
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
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											<span>
												{selectedCctv?.videoSource
													? "Updating..."
													: "Uploading..."}
											</span>
										</span>
									) : selectedCctv?.videoSource ? (
										"Update Video"
									) : (
										"Upload Video"
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CCTVLinks;
