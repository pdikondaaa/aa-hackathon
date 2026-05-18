// ─── Analytics API Service ────────────────────────────────────────────────────
// All functions return static mock data now.
// To connect a real backend, replace each function body with an API call.
// Example: return httpClient.get('/api/analytics/overview') from services/api.js

import {
  OVERVIEW_STATS,
  MOST_USED_TABS,
  DAILY_USAGE,
  QUERY_CATEGORIES,
  ACTIVE_USERS_TREND,
  PEAK_USAGE_HOURS,
  TOP_QUERIES,
  SUCCESS_VS_FAILED,
  RECENT_ACTIVITIES,
} from '../constants/analyticsData';

// Simulates network latency for realistic UX during development
const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export const analyticsApi = {
  async getOverviewStats(/* dateRange */) {
    await delay(300);
    return OVERVIEW_STATS;
  },

  async getMostUsedTabs(/* dateRange */) {
    await delay(350);
    return MOST_USED_TABS;
  },

  async getDailyUsage(/* dateRange */) {
    await delay(400);
    return DAILY_USAGE;
  },

  async getQueryCategories(/* dateRange */) {
    await delay(320);
    return QUERY_CATEGORIES;
  },

  async getActiveUsersTrend(/* dateRange */) {
    await delay(380);
    return ACTIVE_USERS_TREND;
  },

  async getPeakUsageHours(/* dateRange */) {
    await delay(360);
    return PEAK_USAGE_HOURS;
  },

  async getTopQueries(/* dateRange, page, limit */) {
    await delay(420);
    return TOP_QUERIES;
  },

  async getSuccessVsFailed(/* dateRange */) {
    await delay(340);
    return SUCCESS_VS_FAILED;
  },

  async getRecentActivities(/* limit */) {
    await delay(280);
    return RECENT_ACTIVITIES;
  },
};
