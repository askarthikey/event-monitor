import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SignUp = () => {
	const [formData, setFormData] = useState({
		username: "",
		usertype: "user",
		password: "",
		confirmPassword: "",
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
		else if (formData.password.length < 6)
			newErrors.password = "Password must be at least 6 characters";
		if (!formData.confirmPassword)
			newErrors.confirmPassword = "Confirm password is required";
		else if (formData.password !== formData.confirmPassword)
			newErrors.confirmPassword = "Passwords do not match";
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
				const response = await fetch(
					"http://localhost:4000/api/users/register",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							username: formData.username,
							password: formData.password,
						}),
					}
				);

				const data = await response.json();

				if (data.message === "success") {
					// Redirect to signin page instead of auto-login
					navigate("/signin");
				} else {
					setError(data.payload || "Registration failed");
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
												d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
											/>
										</svg>
									</div>
								</div>
								<h2 className="text-3xl font-bold text-black mb-2">
									Join AI Event Monitor
								</h2>
								<p className="text-gray-600">
									Create your account for event monitoring access
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

								{/* <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-white/5 backdrop-blur-sm border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-200 hover:bg-white/8 ${
                        errors.email ? "border-red-500/50" : "border-white/20"
                      }`}
                      placeholder="Enter your email"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div> */}

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

								<div>
									<label
										htmlFor="confirmPassword"
										className="block text-sm font-medium text-black mb-2">
										Confirm Password
									</label>
									<div className="relative">
										<input
											type="password"
											id="confirmPassword"
											name="confirmPassword"
											value={formData.confirmPassword}
											onChange={handleChange}
											className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-black placeholder-gray-500 focus:outline-none transition-all duration-200 shadow-md hover:shadow-lg hover:bg-gray-50 hover:-translate-y-0.5 ${
												errors.confirmPassword
													? "border-red-400"
													: "border-black"
											}`}
											placeholder="Confirm your password"
										/>
									</div>
									{errors.confirmPassword && (
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
											<span>{errors.confirmPassword}</span>
										</p>
									)}
								</div>

								{/* User Type Radio Buttons */}
								{/* <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Account Type</label>
                  <div className="flex space-x-6">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="usertype"
                        value="user"
                        checked={formData.usertype === 'user'}
                        onChange={handleChange}
                        className="w-4 h-4 text-white bg-white/10 border-white/30 focus:ring-white/50 focus:ring-2"
                      />
                      <span className="ml-2 text-gray-300 group-hover:text-white transition-colors duration-200">User</span>
                    </label>
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="usertype"
                        value="admin"
                        checked={formData.usertype === 'admin'}
                        onChange={handleChange}
                        className="w-4 h-4 text-white bg-white/10 border-white/30 focus:ring-white/50 focus:ring-2"
                      />
                      <span className="ml-2 text-gray-300 group-hover:text-white transition-colors duration-200">Admin</span>
                    </label>
                  </div>
                </div> */}

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
												<span>Creating Account...</span>
											</>
										) : (
											<>
												<span>Create Account</span>
												<svg
													className="w-5 h-5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
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
									Already have an account?{" "}
									<button
										onClick={() => navigate("/signin")}
										className="font-medium text-black hover:text-gray-600 transition-all duration-200 hover:underline hover:bg-gray-50 px-2 py-1 rounded cursor-pointer border-none bg-transparent">
										Sign in here
									</button>
								</p>
								<div className="flex items-center justify-center mt-6 space-x-6 text-gray-500 text-sm">
									<div className="flex items-center space-x-2">
										<div className="w-2 h-2 bg-black/60 rounded-full animate-pulse"></div>
										<span>Secure Registration</span>
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

export default SignUp;
