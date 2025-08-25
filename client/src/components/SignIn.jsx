import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SignIn = () => {
	const [formData, setFormData] = useState({
		username: "",
		usertype: "user",
		password: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [errors, setErrors] = useState({});
	const [isVisible, setIsVisible] = useState(false);
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
	const navigate = useNavigate();

	useEffect(() => {
		setIsVisible(true);

		const handleMouseMove = (e) => {
			setMousePosition({ x: e.clientX, y: e.clientY });
		};

		window.addEventListener("mousemove", handleMouseMove);
		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, []);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		// Clear error when user starts typing
		if (error) setError("");
		if (errors[name]) {
			setErrors((prev) => ({
				...prev,
				[name]: "",
			}));
		}
	};

	const validate = () => {
		const newErrors = {};
		if (!formData.username) newErrors.username = "Username is required";
		if (!formData.password) newErrors.password = "Password is required";
		return newErrors;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const newErrors = validate();
		if (Object.keys(newErrors).length === 0) {
			setIsLoading(true);
			setError("");
			setErrors({});

			try {
				const response = await fetch("http://localhost:4000/api/users/login", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						username: formData.username,
						password: formData.password,
						usertype: formData.usertype,
					}),
				});

				const data = await response.json();

				if (data.message === "success") {
					// Store token and user data
					localStorage.setItem("token", data.payload.token);
					localStorage.setItem("user", JSON.stringify(data.payload.user));

					// Navigate to dashboard
					navigate("/dashboard");
				} else {
					setError(data.payload || "Login failed");
				}
			} catch (err) {
				setError("Connection error. Please try again.");
			} finally {
				setIsLoading(false);
			}
		} else {
			setErrors(newErrors);
		}
	};

	return (
		<>
			{/* Custom animations */}
			<style jsx>{`
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

				@keyframes drift {
					0% {
						transform: translateX(-100px) translateY(0px);
					}
					100% {
						transform: translateX(calc(100vw + 100px)) translateY(-50px);
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

				@keyframes orbit {
					from {
						transform: rotate(0deg) translateX(100px) rotate(0deg);
					}
					to {
						transform: rotate(360deg) translateX(100px) rotate(-360deg);
					}
				}

				@keyframes morphing {
					0%,
					100% {
						border-radius: 50%;
						transform: rotate(0deg) scale(1);
					}
					25% {
						border-radius: 0%;
						transform: rotate(90deg) scale(1.2);
					}
					50% {
						border-radius: 30%;
						transform: rotate(180deg) scale(0.8);
					}
					75% {
						border-radius: 10%;
						transform: rotate(270deg) scale(1.1);
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

				.animate-drift {
					animation: drift 25s linear infinite;
				}

				.animate-twinkle {
					animation: twinkle 2s ease-in-out infinite;
				}

				.animate-orbit {
					animation: orbit 20s linear infinite;
				}

				.animate-morphing {
					animation: morphing 8s ease-in-out infinite;
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
				<div className="relative z-10 flex justify-center items-center min-h-screen px-4 py-8">
					<div
						className={`w-full max-w-md transition-all duration-700 ${
							isVisible ? "animate-fadeInUp" : "opacity-0"
						}`}>
						{/* Classic white card with black accents */}
						<div className="bg-white rounded-2xl p-8 border-2 border-black shadow-2xl hover:shadow-3xl transition-all duration-300 relative overflow-hidden">
							{/* Header */}
							<div className="text-center mb-8 relative z-10">
								<div className="flex justify-center mb-4">
									<div className="w-16 h-16 bg-black rounded-full flex items-center justify-center border-2 border-gray-300 shadow-lg">
										<svg
											className="w-8 h-8 text-white"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
											/>
										</svg>
									</div>
								</div>
								<h2 className="text-3xl font-bold text-black mb-2">
									AI Event Monitor
								</h2>
								<p className="text-gray-600">
									Smart monitoring for large-scale events
								</p>
							</div>

							{/* Error Message display */}
							{error && (
								<div className="p-4 rounded-xl mb-6 border-2 animate-fadeInUp bg-red-50 text-red-800 border-red-300 shadow-md">
									<div className="flex items-center space-x-2">
										<svg
											className="w-5 h-5"
											fill="currentColor"
											viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
												clipRule="evenodd"
											/>
										</svg>
										<span>{error}</span>
									</div>
								</div>
							)}

							{/* Form */}
							<form onSubmit={handleSubmit} className="space-y-6 relative z-10">
								<div>
									<label
										htmlFor="username"
										className="block text-sm font-medium text-black mb-2">
										Username
									</label>
									<div className="relative">
										<input
											type="text"
											id="username"
											name="username"
											value={formData.username}
											onChange={handleChange}
											className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-black placeholder-gray-500 focus:outline-none transition-all duration-200 shadow-md hover:shadow-lg hover:bg-gray-50 hover:-translate-y-0.5 ${
												errors.username ? "border-red-400" : "border-black"
											}`}
											placeholder="Enter your username"
										/>
									</div>
									{errors.username && (
										<p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
											<svg
												className="w-4 h-4"
												fill="currentColor"
												viewBox="0 0 20 20">
												<path
													fillRule="evenodd"
													d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
													clipRule="evenodd"
												/>
											</svg>
											<span>{errors.username}</span>
										</p>
									)}
								</div>

								<div>
									<label
										htmlFor="password"
										className="block text-sm font-medium text-black mb-2">
										Password
									</label>
									<div className="relative">
										<input
											type="password"
											id="password"
											name="password"
											value={formData.password}
											onChange={handleChange}
											className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-black placeholder-gray-500 focus:outline-none transition-all duration-200 shadow-md hover:shadow-lg hover:bg-gray-50 hover:-translate-y-0.5 ${
												errors.password ? "border-red-400" : "border-black"
											}`}
											placeholder="Enter your password"
										/>
									</div>
									{errors.password && (
										<p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
											<svg
												className="w-4 h-4"
												fill="currentColor"
												viewBox="0 0 20 20">
												<path
													fillRule="evenodd"
													d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
													clipRule="evenodd"
												/>
											</svg>
											<span>{errors.password}</span>
										</p>
									)}
								</div>

								{/* User Type Radio Buttons */}
								<div>
									<label className="block text-sm font-medium text-black mb-3">
										Access Level
									</label>
									<div className="flex space-x-6">
										<label className="flex items-center cursor-pointer group hover:bg-gray-50 rounded-lg p-2 transition-all duration-200">
											<input
												type="radio"
												name="usertype"
												value="user"
												checked={formData.usertype === "user"}
												onChange={handleChange}
												className="w-4 h-4 text-black bg-white border-2 border-black focus:outline-none rounded-full shadow-sm hover:shadow-md"
											/>
											<span className="ml-2 text-black group-hover:text-gray-700 transition-colors duration-200">
												User
											</span>
										</label>
										<label className="flex items-center cursor-pointer group hover:bg-gray-50 rounded-lg p-2 transition-all duration-200">
											<input
												type="radio"
												name="usertype"
												value="admin"
												checked={formData.usertype === "admin"}
												onChange={handleChange}
												className="w-4 h-4 text-black bg-white border-2 border-black focus:outline-none rounded-full shadow-sm hover:shadow-md"
											/>
											<span className="ml-2 text-black group-hover:text-gray-700 transition-colors duration-200">
												Admin
											</span>
										</label>
									</div>
								</div>

								<button
									type="submit"
									disabled={isLoading}
									className={`relative w-full py-4 bg-black text-white font-semibold rounded-xl shadow-lg border-2 border-black transition-all duration-200 transform overflow-hidden ${
										isLoading
											? "opacity-70 cursor-not-allowed"
											: "hover:bg-gray-800 hover:scale-[1.02] hover:shadow-xl hover:border-gray-800"
									}`}>
									<span className="relative z-10 flex items-center justify-center space-x-2">
										{isLoading ? (
											<>
												<svg
													className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
													xmlns="http://www.w3.org/2000/svg"
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
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
												<span>Signing In...</span>
											</>
										) : (
											<>
												<span>Sign In</span>
												<svg
													className="w-5 h-5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M13 7l5 5m0 0l-5 5m5-5H6"
													/>
												</svg>
											</>
										)}
									</span>
								</button>
							</form>

							{/* Footer */}
							<div className="mt-8 text-center">
								<p className="text-gray-600">
									Don't have an account?{" "}
									<button
										onClick={() => navigate("/signup")}
										className="font-medium text-black hover:text-gray-600 transition-all duration-200 hover:underline hover:bg-gray-50 px-2 py-1 rounded cursor-pointer border-none bg-transparent">
										Register for access
									</button>
								</p>
								<div className="flex items-center justify-center mt-6 space-x-6 text-gray-500 text-sm">
									<div className="flex items-center space-x-2">
										<div className="w-2 h-2 bg-black/60 rounded-full animate-pulse"></div>
										<span>Secure Login</span>
									</div>
									<div className="flex items-center space-x-2">
										<div
											className="w-2 h-2 bg-gray-400/60 rounded-full animate-pulse"
											style={{ animationDelay: "0.5s" }}></div>
										<span>AI Powered</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default SignIn;
