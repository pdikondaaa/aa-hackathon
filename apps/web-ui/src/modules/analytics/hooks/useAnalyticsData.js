import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../services/analyticsApi';

const initialState = {
  overviewStats:    [],
  mostUsedTabs:     [],
  dailyUsage:       [],
  queryCategories:  [],
  activeUsersTrend: [],
  peakUsageHours:   [],
  topQueries:       [],
  successVsFailed:  [],
  recentActivities: [],
};

export function useAnalyticsData(dateRange = 'week') {
  const [data,    setData]    = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        overviewStats,
        mostUsedTabs,
        dailyUsage,
        queryCategories,
        activeUsersTrend,
        peakUsageHours,
        topQueries,
        successVsFailed,
        recentActivities,
      ] = await Promise.all([
        analyticsApi.getOverviewStats(dateRange),
        analyticsApi.getMostUsedTabs(dateRange),
        analyticsApi.getDailyUsage(dateRange),
        analyticsApi.getQueryCategories(dateRange),
        analyticsApi.getActiveUsersTrend(dateRange),
        analyticsApi.getPeakUsageHours(dateRange),
        analyticsApi.getTopQueries(dateRange),
        analyticsApi.getSuccessVsFailed(dateRange),
        analyticsApi.getRecentActivities(),
      ]);

      setData({
        overviewStats,
        mostUsedTabs,
        dailyUsage,
        queryCategories,
        activeUsersTrend,
        peakUsageHours,
        topQueries,
        successVsFailed,
        recentActivities,
      });
    } catch (err) {
      setError(err.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
