import { msalInstance } from '../utils/authService';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

let API_URL = import.meta.env.VITE_API_URL || '/aura-api';
if (import.meta.env.DEV) {
  API_URL = '/aura-api';
}

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
        let detail = response.statusText;
        try {
          const errBody = await response.clone().json();
          if (errBody.detail) detail = errBody.detail;
        } catch (_) { /* non-JSON error body */ }
        throw new Error(detail);
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

  patch(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // Binary responses (e.g. profile photos) — bypasses response.json()
  async getBlob(endpoint, options = {}) {
    let config = { method: 'GET', headers: {}, ...options };
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config, endpoint);
    }
    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
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
    let tokenResponse;
    try {
      tokenResponse = await msalInstance.acquireTokenSilent({ scopes, account });
    } catch (silentError) {
      if (silentError instanceof InteractionRequiredAuthError) {
        tokenResponse = await msalInstance.acquireTokenPopup({ scopes, account });
      } else {
        throw silentError;
      }
    }

    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${tokenResponse.accessToken}`;
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

// ── Email Agent API ────────────────────────────────────────────────────────

export async function refineEmail({ to, cc, subject, body }) {
  return httpClient.post('/api/email-agent/refine', { to, cc, subject, body });
}

export async function draftEmailFromChat(message) {
  return httpClient.post('/api/email-agent/from-chat', { message });
}

export async function saveEmailDraft(conversationId, { to, subject, body }) {
  return httpClient.post(`/api/conversations/${conversationId}/email-draft`, { to, subject, body });
}

export async function draftITTicketEmail({ employeeName, issueType, description, urgency, stepsTried }) {
  return httpClient.post('/api/email-agent/it-ticket', {
    employee_name:   employeeName,
    issue_type:      issueType,
    description,
    urgency,
    steps_tried:     stepsTried || '',
    submission_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  });
}

export async function sendEmail({ to, subject, body }) {
  return httpClient.post('/api/email-agent/send', { to, subject, body });
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

export async function deleteConversation(conversationId) {
  return httpClient.delete(`/api/conversations/${conversationId}`);
}

// ── Messages API ───────────────────────────────────────────────────────────

export async function postMessage(conversationId, content, signal) {
  return httpClient.post(`/api/conversations/${conversationId}/messages`, { content }, { signal });
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

// ── Product Feedback API (Share Feedback / Feedback Review) ────────────────

export async function submitProductFeedback(payload) {
  return httpClient.post('/api/product-feedback', payload);
}

export async function listMyProductFeedback() {
  return httpClient.get('/api/product-feedback');
}

export async function listProductFeedbackAdmin(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return httpClient.get(`/api/admin/product-feedback${qs ? `?${qs}` : ''}`);
}

export async function updateProductFeedback(id, patch) {
  return httpClient.patch(`/api/admin/product-feedback/${id}`, patch);
}

export async function deleteProductFeedback(id) {
  return httpClient.delete(`/api/admin/product-feedback/${id}`);
}

// ── Allocation Board API ───────────────────────────────────────────────────

export async function getAllocationBoard(params = {}) {
  const query = new URLSearchParams();
  if (params.date_from) query.set('date_from', params.date_from);
  if (params.date_to) query.set('date_to', params.date_to);
  const qs = query.toString();
  return httpClient.get(`/api/allocation/board${qs ? `?${qs}` : ''}`);
}

export async function getAllocationFilterOptions() {
  return httpClient.get('/api/allocation/filters');
}

export async function getEmployeeDetail(employeeId) {
  return httpClient.get(`/api/allocation/employee/${employeeId}`);
}

export async function getAllocationRole() {
  return httpClient.get('/api/allocation/my-role');
}

export async function getMyTeamAllocation() {
  return httpClient.get('/api/allocation/my-team');
}

export async function askAllocationAura(question) {
  return httpClient.post('/api/allocation/ask', { question });
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

export async function getTeamAttendance() {
  return httpClient.get('/api/attendance/team');
}

// ── Birthdays API ──────────────────────────────────────────────────────────

export async function getTodaysBirthdays() {
  return httpClient.get('/api/users/birthdays/today');
}

// ── Documents API ──────────────────────────────────────────────────────────

export async function listDocuments(page = 1, limit = 50, search, category) {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  return httpClient.get(`/api/documents?${params}`);
}

// ── Skills Analytics API ───────────────────────────────────────────────────

export async function getSkillsAnalytics() {
  return httpClient.get('/api/skills/analytics');
}

// ── Employee Directory API ─────────────────────────────────────────────────

export async function getEmployeeDirectory() {
  return httpClient.get('/api/employees/directory');
}

export async function getEmployeePhotoBlob(email) {
  return httpClient.getBlob(`/api/employees/photo/${encodeURIComponent(email)}`);
}

// ── Microsoft Forms API ──────────────────────────────────────────────────

/**
 * Acquires a Microsoft Graph access token with the Forms.ReadWrite scope.
 * Uses MSAL's acquireTokenSilent, falling back to an interactive popup if needed.
 * The token is then sent to the backend alongside the form payload so the
 * backend can call the Graph API on behalf of the user.
 */
export async function acquireFormsToken() {
  const FORMS_SCOPE = [
    import.meta.env.VITE_MS_FORMS_SCOPE ||
    'https://forms.office.com/Forms.ReadWrite',
  ];
  const account = msalInstance.getActiveAccount();
  if (!account) throw new Error('No active account. Please sign in again.');

  let tokenRes;
  try {
    tokenRes = await msalInstance.acquireTokenSilent({ scopes: FORMS_SCOPE, account });
  } catch {
    try {
      tokenRes = await msalInstance.acquireTokenPopup({ scopes: FORMS_SCOPE, account, prompt: 'consent' });
    } catch {
      throw new Error('Unable to obtain Microsoft Forms permission. Please ask your Azure AD admin to grant the Forms.ReadWrite permission.');
    }
  }

  return {
    access_token: tokenRes.accessToken,
    tenant_id:    account.tenantId,
    user_oid:     account.localAccountId,
  };
}

/**
 * Creates a Microsoft Form on behalf of the logged-in user.
 * @param {{ title: string, description: string|null, questions: Array, graph_access_token: string }} payload
 */
export async function createMicrosoftForm(payload) {
  return httpClient.post('/api/ms-forms/create', payload);
}

// ── Work Anniversaries API ─────────────────────────────────────────────────

export async function getTodaysAnniversaries() {
  return httpClient.get('/api/users/anniversaries/today');
}

// ── Graph — Shared Mailbox Calendar ───────────────────────────────────────

export async function getSharedCalendarEvents() {
  try {
    return await httpClient.get('/api/communications/shared-calendar');
  } catch (_) {
    return [];
  }
}

// ── Communications — Announcements ─────────────────────────────────────────

export async function getActiveAnnouncements() {
  return httpClient.get('/api/communications/announcements/active');
}

export async function dismissAnnouncement(id) {
  return httpClient.post(`/api/communications/announcements/${id}/dismiss`, {});
}

export async function adminListAnnouncements(page = 1, limit = 50, status) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  return httpClient.get(`/api/admin/communications/announcements?${params}`);
}

export async function adminCreateAnnouncement(payload) {
  return httpClient.post('/api/admin/communications/announcements', payload);
}

export async function adminUpdateAnnouncement(id, payload) {
  return httpClient.request(`/api/admin/communications/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteAnnouncement(id) {
  return httpClient.delete(`/api/admin/communications/announcements/${id}`);
}

// ── Communications — Events ────────────────────────────────────────────────

export async function listPublicEvents(page = 1, limit = 50, status) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  return httpClient.get(`/api/communications/events?${params}`);
}

export async function submitEventRsvp(eventId, payload) {
  return httpClient.post(`/api/communications/events/${eventId}/rsvp`, payload);
}

export async function adminListEvents(page = 1, limit = 50, status, publishStatus) {
  const params = new URLSearchParams({ page, limit });
  if (status)        params.set('status', status);
  if (publishStatus) params.set('publish_status', publishStatus);
  return httpClient.get(`/api/admin/communications/events?${params}`);
}

export async function adminCreateEvent(payload) {
  return httpClient.post('/api/admin/communications/events', payload);
}

export async function adminUpdateEvent(id, payload) {
  return httpClient.request(`/api/admin/communications/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteEvent(id) {
  return httpClient.delete(`/api/admin/communications/events/${id}`);
}

export default httpClient;
