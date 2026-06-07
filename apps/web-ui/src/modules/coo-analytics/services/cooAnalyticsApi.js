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

  async getRawRecords(filters = {}, groupKey = null, groupValue = null, allocationFilter = null) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    if (groupKey)         params.set('group_key',         groupKey);
    if (groupValue)       params.set('group_value',       groupValue);
    if (allocationFilter) params.set('allocation_filter', allocationFilter);
    return httpClient.get(`/api/coo-analytics/raw-records?${params.toString()}`);
  },
};
