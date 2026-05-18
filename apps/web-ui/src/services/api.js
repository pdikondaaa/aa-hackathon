import { msalInstance } from '../utils/authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class HTTPClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  addRequestInterceptor(callback) {
    this.requestInterceptors.push(callback);
  }

  addResponseInterceptor(callback) {
    this.responseInterceptors.push(callback);
  }

  async request(endpoint, options = {}) {
    let config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config, endpoint);
    }

    const url = `${this.baseURL}${endpoint}`;
    try {
      const response = await fetch(url, config);

      let result = { status: response.status, ok: response.ok, response };
      for (const interceptor of this.responseInterceptors) {
        result = await interceptor(result);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null;
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

const httpClient = new HTTPClient(API_URL);

// Inject Azure AD Bearer token — no cookies needed, just the Authorization header
httpClient.addRequestInterceptor(async (config, endpoint) => {
  if (endpoint.includes('/health') || endpoint.includes('/ping')) {
    return config;
  }

  try {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      console.warn('No active account - cannot acquire token');
      return config;
    }

    const scopes = [`${import.meta.env.VITE_AZURE_CLIENT_ID}/.default`];
    const response = await msalInstance.acquireTokenSilent({ scopes, account });

    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${response.accessToken}`;
  } catch (error) {
    console.error('Failed to acquire token:', error);
    throw new Error('Authentication failed');
  }

  return config;
});

httpClient.addResponseInterceptor(async (result) => {
  if (result.status === 401) {
    console.error('Unauthorized - token may be expired');
  }
  return result;
});

export async function checkHealth() {
  try {
    return await httpClient.get('/health');
  } catch (error) {
    console.error('Health check failed:', error);
    return null;
  }
}

export async function askBot(message) {
  try {
    const response = await httpClient.post('/api/chat', { message });
    return {
      answer: response.answer,
      sources: response.sources || [],
      user_email: response.user_email,
      user_id: response.user_id,
    };
  } catch (error) {
    console.error('Chat request failed:', error);
    throw error;
  }
}

// ── Conversations API ──────────────────────────────────────────────────────

export async function createConversation(title) {
  return httpClient.post('/api/conversations', { title: title || null });
}

export async function listConversations(page = 1, limit = 20, search) {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set('search', search);
  return httpClient.get(`/api/conversations?${params}`);
}

export async function getConversation(conversationId) {
  return httpClient.get(`/api/conversations/${conversationId}`);
}

// ── Messages API ───────────────────────────────────────────────────────────

export async function postMessage(conversationId, content) {
  return httpClient.post(`/api/conversations/${conversationId}/messages`, { content });
}

export async function listMessages(conversationId, page = 1, limit = 50) {
  return httpClient.get(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
}

export async function getMessageCitations(messageId) {
  return httpClient.get(`/api/messages/${messageId}/citations`);
}

// ── Feedback API ───────────────────────────────────────────────────────────

export async function submitFeedback(messageId, rating, category, comment) {
  return httpClient.post(`/api/messages/${messageId}/feedback`, { rating, category, comment });
}

export async function deleteFeedback(feedbackId) {
  return httpClient.delete(`/api/feedback/${feedbackId}`);
}

export async function getConversationFeedback(conversationId) {
  return httpClient.get(`/api/conversations/${conversationId}/feedback`);
}

// ── Escalations API ────────────────────────────────────────────────────────

export async function submitEscalation(payload) {
  return httpClient.post('/api/escalations', {
    ...payload,
    escalation_type: payload.escalation_type?.toLowerCase(),
    priority: payload.priority?.toLowerCase(),
  });
}

export async function listMyEscalations(page = 1, limit = 10, status) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  return httpClient.get(`/api/escalations?${params}`);
}

// ── User Profile API (Zoho source of truth) ────────────────────────────────

export async function getMyProfile() {
  return httpClient.get('/api/users/me');
}

// ── Attendance API ─────────────────────────────────────────────────────────

export async function getMyAttendance() {
  return httpClient.get('/api/attendance/me');
}

// ── Birthdays API ──────────────────────────────────────────────────────────

export async function getTodaysBirthdays() {
  return httpClient.get('/api/users/birthdays/today');
}

// ── Work Anniversaries API ─────────────────────────────────────────────────

export async function getTodaysAnniversaries() {
  return httpClient.get('/api/users/anniversaries/today');
}

export default httpClient;
