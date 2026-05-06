import apiConfig, { getApiUrl, getRequestOptions, logApiCall, logApiResponse, logApiError } from '../config/apiConfig';

/**
 * Generic API request handler with error handling and retry logic
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} url - Full API URL
 * @param {object} data - Request body (optional)
 * @param {object} customHeaders - Custom headers to add (optional)
 * @param {number} attempt - Current retry attempt
 * @returns {Promise<any>} Response data
 */
async function apiRequest(method, url, data = null, customHeaders = {}, attempt = 1) {
  const startTime = performance.now();
  const options = {
    method,
    ...getRequestOptions(customHeaders),
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  logApiCall(method, url, data);

  try {
    const response = await Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), apiConfig.timeout)
      ),
    ]);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    const responseData = await response.json();
    const duration = performance.now() - startTime;
    logApiResponse(method, url, responseData, duration);

    return responseData;
  } catch (error) {
    const duration = performance.now() - startTime;
    logApiError(method, url, error);

    // Retry logic for transient errors
    if (attempt < apiConfig.retryAttempts && (error.message === 'Request timeout' || error.status >= 500)) {
      console.warn(`Retrying request (${attempt}/${apiConfig.retryAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, apiConfig.retryDelay * attempt));
      return apiRequest(method, url, data, customHeaders, attempt + 1);
    }

    throw error;
  }
}

/**
 * GET request
 */
export async function apiGet(endpoint, params = {}, customHeaders = {}) {
  const url = getApiUrl(endpoint, params);
  return apiRequest('GET', url, null, customHeaders);
}

/**
 * POST request
 */
export async function apiPost(endpoint, data = {}, customHeaders = {}) {
  const url = getApiUrl(endpoint);
  return apiRequest('POST', url, data, customHeaders);
}

/**
 * PUT request
 */
export async function apiPut(endpoint, data = {}, params = {}, customHeaders = {}) {
  let url = getApiUrl(endpoint, params);
  return apiRequest('PUT', url, data, customHeaders);
}

/**
 * DELETE request
 */
export async function apiDelete(endpoint, params = {}, customHeaders = {}) {
  const url = getApiUrl(endpoint, params);
  return apiRequest('DELETE', url, null, customHeaders);
}

/**
 * PATCH request
 */
export async function apiPatch(endpoint, data = {}, params = {}, customHeaders = {}) {
  const url = getApiUrl(endpoint, params);
  return apiRequest('PATCH', url, data, customHeaders);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to the chat API
 * @param {string} message - User message
 * @param {object} options - Additional options (sessionId, userId, etc.)
 * @returns {Promise<object>} Chat response
 */
export async function askBot(message, options = {}) {
  try {
    const data = {
      message,
      ...options,
    };
    const response = await apiPost(apiConfig.endpoints.chat.ask, data);
    return response.answer || response;
  } catch (error) {
    console.error('Chat API error:', error);
    throw error;
  }
}

/**
 * Stream chat responses
 * @param {string} message - User message
 * @param {Function} onChunk - Callback for each streamed chunk
 * @param {object} options - Additional options
 */
export async function askBotStream(message, onChunk, options = {}) {
  try {
    const url = getApiUrl(apiConfig.endpoints.chat.stream);
    const data = { message, ...options };

    logApiCall('POST', url, data);

    const response = await fetch(url, {
      method: 'POST',
      ...getRequestOptions(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      onChunk(chunk);
    }
  } catch (error) {
    console.error('Chat Stream API error:', error);
    throw error;
  }
}

/**
 * Get chat history
 * @param {object} params - Query parameters (limit, offset, sessionId, etc.)
 * @returns {Promise<object>} Chat history
 */
export async function getChatHistory(params = {}) {
  const response = await apiGet(apiConfig.endpoints.chat.history, params);
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// HR API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function getLeaves() {
  return apiGet(apiConfig.endpoints.hr.leaves);
}

export async function requestLeave(leaveData) {
  return apiPost(apiConfig.endpoints.hr.leaveRequest, leaveData);
}

export async function getPayroll() {
  return apiGet(apiConfig.endpoints.hr.payroll);
}

export async function getBenefits() {
  return apiGet(apiConfig.endpoints.hr.benefits);
}

export async function getHRProfile() {
  return apiGet(apiConfig.endpoints.hr.profile);
}

// ─────────────────────────────────────────────────────────────────────────────
// IT API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function getITTickets() {
  return apiGet(apiConfig.endpoints.it.tickets);
}

export async function getITTicket(id) {
  return apiGet(apiConfig.endpoints.it.getTicket, { id });
}

export async function createITTicket(ticketData) {
  return apiPost(apiConfig.endpoints.it.createTicket, ticketData);
}

export async function updateITTicket(id, ticketData) {
  return apiPut(apiConfig.endpoints.it.updateTicket, ticketData, { id });
}

export async function requestAccess(accessData) {
  return apiPost(apiConfig.endpoints.it.requestAccess, accessData);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function getUsers() {
  return apiGet(apiConfig.endpoints.admin.users);
}

export async function getRoles() {
  return apiGet(apiConfig.endpoints.admin.roles);
}

export async function getAuditLogs() {
  return apiGet(apiConfig.endpoints.admin.audit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Org API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrgStructure() {
  return apiGet(apiConfig.endpoints.org.structure);
}

export async function getDirectory(params = {}) {
  return apiGet(apiConfig.endpoints.org.directory, params);
}

export async function getTeams() {
  return apiGet(apiConfig.endpoints.org.teams);
}

export async function getAnnouncements() {
  return apiGet(apiConfig.endpoints.org.announcements);
}

// ─────────────────────────────────────────────────────────────────────────────
// Document API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function listDocuments() {
  return apiGet(apiConfig.endpoints.documents.list);
}

export async function generateDocument(docData) {
  return apiPost(apiConfig.endpoints.documents.generate, docData);
}

export async function downloadDocument(id) {
  const url = getApiUrl(apiConfig.endpoints.documents.download, { id });
  window.location.href = url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

export async function healthCheck() {
  try {
    const response = await apiGet(apiConfig.endpoints.health);
    return response;
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'offline' };
  }
}

/**
 * Export apiConfig for use in components
 */
export { apiConfig, getApiUrl, getRequestOptions };