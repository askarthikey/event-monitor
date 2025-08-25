import React, { useState, useEffect } from 'react';

const Footer = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      {/* Custom animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        
        @keyframes floatSlow {
          0%, 100% {
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
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
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
      `}</style>

      <footer className="relative overflow-hidden bg-white border-t-2 border-black shadow-2xl">
        {/* Subtle dynamic background gradient that follows mouse */}
        <div 
          className="absolute inset-0 opacity-5 transition-all duration-1000 ease-out pointer-events-none"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.05), transparent 50%)`
          }}
        />

        {/* Minimalist animated background particles */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Floating particles */}
          <div className="absolute top-20 left-10 w-2 h-2 bg-black/10 rounded-full animate-float" style={{animationDelay: '0s'}}></div>
          <div className="absolute top-40 right-20 w-1.5 h-1.5 bg-gray-400/20 rounded-full animate-floatSlow" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-32 left-1/4 w-1 h-1 bg-black/15 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/3 right-1/3 w-2.5 h-2.5 bg-gray-300/15 rounded-full animate-floatSlow" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-20 right-10 w-1.5 h-1.5 bg-black/12 rounded-full animate-float" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute top-2/3 left-1/5 w-1 h-1 bg-gray-400/18 rounded-full animate-floatSlow" style={{animationDelay: '3s'}}></div>

          {/* Subtle twinkling dots */}
          <div className="absolute top-10 left-10 w-1 h-1 bg-black/30 rounded-full animate-twinkle" style={{animationDelay: '0s'}}></div>
          <div className="absolute top-20 right-20 w-0.5 h-0.5 bg-gray-500/40 rounded-full animate-twinkle" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-32 left-1/3 w-1.5 h-1.5 bg-black/25 rounded-full animate-twinkle" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-20 left-1/4 w-0.5 h-0.5 bg-gray-600/35 rounded-full animate-twinkle" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute bottom-40 right-1/3 w-1 h-1 bg-black/20 rounded-full animate-twinkle" style={{animationDelay: '2.5s'}}></div>
        </div>

        {/* Main content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Company Info */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center border-2 border-gray-300 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-black">
                  AI Event Monitor
                </h3>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                Advanced AI-powered monitoring system for large-scale events. 
                Providing real-time insights and intelligent analytics.
              </p>
              <div className="flex items-center space-x-4 text-gray-500 text-sm">
                <div className="flex items-center space-x-2 hover:text-black transition-colors duration-200">
                  <div className="w-2 h-2 bg-black/60 rounded-full animate-pulse"></div>
                  <span>Real-time Monitoring</span>
                </div>
                <div className="flex items-center space-x-2 hover:text-black transition-colors duration-200">
                  <div className="w-2 h-2 bg-gray-500/60 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                  <span>AI Powered</span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-black">Features</h3>
              <ul className="space-y-3 text-gray-600 text-sm">
                <li className="flex items-center space-x-2 hover:text-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-2 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-black/60 rounded-full"></div>
                  <span>Real-time Event Tracking</span>
                </li>
                <li className="flex items-center space-x-2 hover:text-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-2 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-black/60 rounded-full"></div>
                  <span>AI-driven Analytics</span>
                </li>
                <li className="flex items-center space-x-2 hover:text-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-2 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-black/60 rounded-full"></div>
                  <span>Smart Notifications</span>
                </li>
                <li className="flex items-center space-x-2 hover:text-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-2 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-black/60 rounded-full"></div>
                  <span>Secure Access Control</span>
                </li>
              </ul>
            </div>

            {/* Contact & Support */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-black">Support</h3>
              <div className="space-y-3 text-gray-600 text-sm">
                <div className="flex items-center space-x-3 hover:text-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-2 rounded-lg cursor-pointer">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <span>support@aieventmonitor.com</span>
                </div>
                <div className="flex items-center space-x-3 hover:text-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-2 rounded-lg cursor-pointer">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Help Center</span>
                </div>
                <div className="flex items-center space-x-3 hover:text-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-2 rounded-lg cursor-pointer">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Documentation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 pt-8 border-t-2 border-black flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-600 text-sm font-medium">
              © 2025 AI Event Monitor. All rights reserved.
            </div>
            <div className="flex items-center space-x-6 text-gray-600 text-sm">
              <span className="hover:text-black hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 px-3 py-1 rounded-lg">Privacy Policy</span>
              <span className="hover:text-black hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 px-3 py-1 rounded-lg">Terms of Service</span>
              <span className="hover:text-black hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 px-3 py-1 rounded-lg">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
