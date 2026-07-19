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
};

export function useAnalyticsData(dateRange = 'week') {
  const [data,    setData]    = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await analyticsApi.getDashboard(dateRange);
      setData({ ...initialState, ...dashboard });
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
