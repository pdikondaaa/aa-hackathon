// ─── Analytics API Service ────────────────────────────────────────────────────
// Fetches real AURA usage analytics from the backend (messages/conversations/
// users tables and related feature tables), scoped to the selected date range.

import httpClient from '../../../services/api';

export const analyticsApi = {
  async getDashboard(dateRange = 'week') {
    return httpClient.get(`/api/analytics/dashboard?range=${encodeURIComponent(dateRange)}`);
  },

  async getUsers() {
    return httpClient.get('/api/analytics/users');
  },

  async getActivities(page = 1, limit = 15) {
    return httpClient.get(`/api/analytics/activities?page=${page}&limit=${limit}`);
  },
};
