// ─── AURA API Configuration ────────────────────────────────────────────────────
// Centralized API endpoint configuration for all environments
// Supports development, staging, and production deployments

const ENV = process.env.NODE_ENV || 'development';

// ─── Base API URLs by environment ──────────────────────────────────────────────
// These can be overridden by environment variables
const API_BASE_URLS = {
  development: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  staging: process.env.REACT_APP_API_URL || 'https://api-staging.aligned.com',
  production: process.env.REACT_APP_API_URL || 'https://api.aligned.com',
};

const API_BASE_URL = API_BASE_URLS[ENV];

// ─── API Configuration ────────────────────────────────────────────────────────
export const apiConfig = {
  // Base URL for all API calls
  baseUrl: API_BASE_URL,

  // Environment indicator
  environment: ENV,

  // ─── Timeout settings (in milliseconds) ────────────────────────────────────
  timeout: 30000,  // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000,  // 1 second

  // ─── API Endpoints ────────────────────────────────────────────────────────
  endpoints: {
    // Chat & AI Assistant
    chat: {
      ask: '/api/chat',
      stream: '/api/chat/stream',
      history: '/api/chat/history',
      sessions: '/api/chat/sessions',
    },

    // HR Agent
    hr: {
      leaves: '/api/hr/leaves',
      leaveRequest: '/api/hr/leaves/request',
      payroll: '/api/hr/payroll',
      benefits: '/api/hr/benefits',
      profile: '/api/hr/profile',
    },

    // IT Agent
    it: {
      tickets: '/api/it/tickets',
      createTicket: '/api/it/tickets/create',
      getTicket: '/api/it/tickets/:id',
      updateTicket: '/api/it/tickets/:id',
      access: '/api/it/access',
      requestAccess: '/api/it/access/request',
    },

    // Admin Agent
    admin: {
      users: '/api/admin/users',
      roles: '/api/admin/roles',
      permissions: '/api/admin/permissions',
      audit: '/api/admin/audit-logs',
    },

    // Org Agent
    org: {
      structure: '/api/org/structure',
      directory: '/api/org/directory',
      teams: '/api/org/teams',
      announcements: '/api/org/announcements',
    },

    // Documents
    documents: {
      list: '/api/documents',
      generate: '/api/documents/generate',
      download: '/api/documents/:id/download',
    },

    // Health Check
    health: '/api/health',
  },

  // ─── Default headers for all requests ──────────────────────────────────────
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },

  // ─── Log API calls in development ──────────────────────────────────────────
  debug: ENV === 'development',
};

/**
 * Get full API URL for an endpoint
 * @param {string} endpoint - The endpoint path from apiConfig.endpoints
 * @param {object} params - URL parameters to replace (e.g., { id: '123' })
 * @returns {string} Full API URL
 */
export function getApiUrl(endpoint, params = {}) {
  let url = `${apiConfig.baseUrl}${endpoint}`;
  
  // Replace URL parameters
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, value);
  });
  
  return url;
}

/**
 * Build request options with headers and credentials
 * @returns {object} Fetch request options
 */
export function getRequestOptions(customHeaders = {}) {
  return {
    headers: {
      ...apiConfig.defaultHeaders,
      ...customHeaders,
    },
    credentials: 'include', // Include cookies for authenticated requests
  };
}

/**
 * Log API calls in development
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object} data - Request body
 */
export function logApiCall(method, url, data) {
  if (apiConfig.debug) {
    console.group(`🔗 API Call — ${method.toUpperCase()}`);
    console.log('URL:', url);
    if (data) console.log('Data:', data);
    console.groupEnd();
  }
}

/**
 * Log API response
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object} response - Response data
 * @param {number} duration - Request duration in ms
 */
export function logApiResponse(method, url, response, duration) {
  if (apiConfig.debug) {
    console.group(`✅ API Response — ${method.toUpperCase()}`);
    console.log('URL:', url);
    console.log('Response:', response);
    console.log(`Duration: ${duration}ms`);
    console.groupEnd();
  }
}

/**
 * Log API error
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Error} error - Error object
 */
export function logApiError(method, url, error) {
  if (apiConfig.debug) {
    console.group(`❌ API Error — ${method.toUpperCase()}`);
    console.error('URL:', url);
    console.error('Error:', error);
    console.groupEnd();
  }
}

export default apiConfig;
