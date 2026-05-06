import { msalInstance } from '../utils/authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * HTTP Client with interceptor support
 * Automatically injects token for all requests except health endpoints
 */
class HTTPClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(callback) {
    this.requestInterceptors.push(callback);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(callback) {
    this.responseInterceptors.push(callback);
  }

  /**
   * Make HTTP request with interceptors
   */
  async request(endpoint, options = {}) {
    let config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Run request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config, endpoint);
    }

    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, config);

      // Run response interceptors
      let result = { status: response.status, ok: response.ok, response };
      for (const interceptor of this.responseInterceptors) {
        result = await interceptor(result);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

/**
 * Create HTTP client instance
 */
const httpClient = new HTTPClient(API_URL);

/**
 * Request interceptor: Inject token for non-health endpoints
 */
httpClient.addRequestInterceptor(async (config, endpoint) => {
  // Skip token injection for health endpoints
  if (endpoint.includes('/health') || endpoint.includes('/ping')) {
    return config;
  }

  try {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      console.warn('No active account - cannot acquire token');
      return config;
    }

    // For development: use User.Read scope
    // For production: use specific API scope like `api://<backend-app-id>/.default`
    const scopes = ['User.Read']; // Change to your API scope in production
    
    const response = await msalInstance.acquireTokenSilent({
      scopes,
      account,
    });

    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${response.accessToken}`;
  } catch (error) {
    console.error('Failed to acquire token:', error);
    throw new Error('Authentication failed');
  }

  return config;
});

/**
 * Response interceptor: Handle errors
 */
httpClient.addResponseInterceptor(async (result) => {
  if (result.status === 401) {
    console.error('Unauthorized - token may be expired');
    // Could trigger re-login here
  }
  return result;
});

/**
 * Public API functions
 */

/**
 * Check API health (no auth required)
 */
export async function checkHealth() {
  try {
    return await httpClient.get('/health');
  } catch (error) {
    console.error('Health check failed:', error);
    return null;
  }
}

/**
 * Send message to chat API (authenticated - token auto-injected)
 */
export async function askBot(message) {
  try {
    const response = await httpClient.post('/api/chat', { message });
    return {
      answer: response.answer,
      user_email: response.user_email,
      user_id: response.user_id,
    };
  } catch (error) {
    console.error('Chat request failed:', error);
    throw error;
  }
}

export default httpClient;