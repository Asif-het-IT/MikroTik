window.NocApi = (function () {
  const cfg = window.NOC_WEB_CONFIG;
  
  // Cache architecture: Dashboard no longer triggers backend syncs
  // Instead, it reads from a centralized cache updated by sync.php
  // This makes the dashboard fast, scalable, and independent of user count
  
  // The cached API endpoint
  const CACHED_API = '/api/cached-api.php';

  /**
   * Fetch the complete cached dashboard state
   * This is much faster than fetching individual views from Apps Script
   * because it reads from a local JSON file, not the Apps Script backend
   */
  async function fetchCachedState() {
    const url = new URL(CACHED_API, window.location.origin);
    
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), cfg.requestTimeoutMs);

    try {
      const res = await fetch(url.toString() + '?v=' + Date.now(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store", // Don't cache responses
        signal: ctrl.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // Validate cache is fresh (not stale)
      if (data.meta && data.meta.cacheAge !== undefined) {
        if (data.meta.cacheAge > 600) { // > 10 minutes
          console.warn(`NOC: Cache is stale (${data.meta.cacheAge}s old)`);
        }
      }
      
      return data;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  /**
   * Fetch status block
   * Extracted from cached state for compatibility
   */
  function fetchStatus() {
    return fetchCachedState().then(cached => {
      if (!cached.status) {
        throw new Error('Status data not in cache');
      }

      const status = cached.status || {};
      return {
        dashboard: status,
        runtimeHealth: status.runtimeHealth || { overall: 'UNKNOWN', cycles: [] },
        triggerIntegrity: status.triggerIntegrity || { ok: false, missing: [] },
        timeFmt: status.timeFmt || null,
        dailyReportTime: status.dailyReportTime || null,
        sheets: status.sheets || {},
        sheetHealth: status.sheetHealth || []
      };
    });
  }

  /**
   * Fetch top users
   * Extracted from cached state for compatibility
   */
  function fetchTopUsers(period, limit) {
    return fetchCachedState().then(cached => {
      if (period === 'daily' && cached.topDaily) {
        return cached.topDaily;
      } else if (period === 'monthly' && cached.topMonthly) {
        return cached.topMonthly;
      } else {
        throw new Error(`Top users (${period}) not in cache`);
      }
    });
  }

  /**
   * Fetch raw cached state (for meta info, debugging)
   */
  function fetchRawCache() {
    return fetchCachedState();
  }

  return {
    fetchStatus,
    fetchTopUsers,
    fetchRawCache,
  };
})();
