import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [location]);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/signin');
  };

  const handleLogoClick = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/signin');
    }
  };

  return (
    <header className="relative bg-white border-b-2 border-black shadow-lg">
      {/* Subtle dynamic background gradient that follows mouse */}
      <div 
        className="absolute inset-0 opacity-5 transition-all duration-1000 ease-out pointer-events-none"
        style={{
          background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.05), transparent 50%)`
        }}
      />

      {/* Minimalist animated background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-2 left-10 w-1 h-1 bg-black/20 rounded-full animate-twinkle" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-4 right-20 w-0.5 h-0.5 bg-gray-400/30 rounded-full animate-twinkle" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-6 left-1/3 w-1.5 h-1.5 bg-black/15 rounded-full animate-twinkle" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-3 right-1/3 w-1 h-1 bg-gray-500/25 rounded-full animate-twinkle" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div 
            onClick={handleLogoClick}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border-2 border-gray-300 shadow-md group-hover:bg-gray-800 group-hover:shadow-lg transition-all duration-200">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-black group-hover:text-gray-700 transition-all duration-200">
                AI Event Monitor
              </h1>
              <p className="text-xs text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
                Smart Monitoring System
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-6">
            {user ? (
              <>
                {/* Navigation Links */}
                <div className="flex items-center space-x-6">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className={`text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-gray-50 ${
                      location.pathname === '/dashboard' 
                        ? 'text-black bg-gray-100 shadow-sm' 
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/events')}
                    className={`text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-gray-50 ${
                      location.pathname === '/events' 
                        ? 'text-black bg-gray-100 shadow-sm' 
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Events
                  </button>
                </div>

                {/* User Info */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-black">
                      Welcome, {user.username}
                    </p>
                    <p className="text-xs text-gray-600 capitalize">
                      {user.usertype} Access
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center border-2 border-gray-300 shadow-sm">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-black text-white border-2 border-black rounded-lg hover:bg-gray-800 hover:shadow-md transition-all duration-200 text-sm font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/signin')}
                  className="text-black hover:text-gray-700 transition-colors duration-200 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-50 border-2 border-black hover:shadow-md"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="px-4 py-2 bg-black text-white font-medium rounded-lg border-2 border-black hover:bg-gray-800 hover:shadow-md transition-all duration-200 text-sm"
                >
                  Sign Up
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>

      <style jsx>{`
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
        
        .animate-twinkle {
          animation: twinkle 2s ease-in-out infinite;
        }
      `}</style>
    </header>
  );
};

export default Header;
