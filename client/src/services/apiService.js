/**
 * Centralized API service for handling all HTTP requests
 * Uses environment variables for dynamic URL configuration
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://event-monitoring.onrender.com';

console.log('🌐 API Service initialized with base URL:', API_BASE_URL);

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Get the full API URL with endpoint
   * @param {string} endpoint - API endpoint
   * @returns {string} Full URL
   */
  getURL(endpoint) {
    return `${this.baseURL}${endpoint}`;
  }

  /**
   * Get authorization headers
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  /**
   * Generic fetch wrapper with error handling
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise} Fetch response
   */
  async fetchWithAuth(endpoint, options = {}) {
    const url = this.getURL(endpoint);
    const config = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      return response;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // User Authentication APIs
  async login(credentials) {
    return this.fetchWithAuth('/api/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async register(userData) {
    return this.fetchWithAuth('/api/users/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  // Event APIs
  async getEvents() {
    return this.fetchWithAuth('/api/events');
  }

  async createEvent(formData) {
    const token = localStorage.getItem('token');
    return fetch(this.getURL('/api/events'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
  }

  async getEvent(eventId) {
    return this.fetchWithAuth(`/api/events/${eventId}`);
  }

  async getEventLogs(eventId) {
    return this.fetchWithAuth(`/api/events/${eventId}/logs`);
  }

  async getEventMessages(eventId) {
    return this.fetchWithAuth(`/api/events/${eventId}/messages`);
  }

  async updateCCTVVideo(eventId, formData) {
    const token = localStorage.getItem('token');
    return fetch(this.getURL(`/api/events/${eventId}/cctv-video`), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
  }

  // Notification APIs
  async getRegisteredUsers() {
    return this.fetchWithAuth('/api/notifications/registered-users');
  }

  async generateTestToken() {
    return this.fetchWithAuth('/api/notifications/generate-test-token', {
      method: 'POST'
    });
  }

  async broadcastNotification(notificationData) {
    return this.fetchWithAuth('/api/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
  }

  async sendUserNotification(notificationData) {
    return this.fetchWithAuth('/api/notifications/send-to-user', {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
  }

  async registerForNotifications(registrationData) {
    return this.fetchWithAuth('/api/notifications/register', {
      method: 'POST',
      body: JSON.stringify(registrationData)
    });
  }

  async testNotification(testData) {
    return this.fetchWithAuth('/api/notifications/test', {
      method: 'POST',
      body: JSON.stringify(testData)
    });
  }

  async sendAIDetectionNotification(detectionData) {
    return this.fetchWithAuth('/api/notifications/ai-detection', {
      method: 'POST',
      body: JSON.stringify(detectionData)
    });
  }
}

// Export singleton instance
export default new ApiService();