import httpClient from '../../../services/api';

export const cooAnalyticsApi = {
  async getDashboard(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    return httpClient.get(`/api/coo-analytics/dashboard${qs ? `?${qs}` : ''}`);
  },

  async getFilterOptions() {
    return httpClient.get('/api/coo-analytics/filters');
  },
};
