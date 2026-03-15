(function () {
  const cfg = window.NOC_WEB_CONFIG;
  const state = {
    status: null,
    topDaily: null,
    topMonthly: null,
    timer: null,
    cacheAge: null,
    lastCacheUpdate: null,
  };

  /**
   * Format the cache age for display
   * Shows how old the cached data is (synced by central sync engine, not per-user)
   */
  function formatCacheAge(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
    return `${Math.round(seconds / 3600)}h ago`;
  }

  /**
   * Update footer with cache metadata
   * Shows when the central sync engine last updated the cache
   */
  function updateFooterWithCacheInfo(cacheAge, lastSync) {
    const headerRefreshEl = document.getElementById("lastRefresh");
    if (headerRefreshEl) {
      if (cacheAge !== null && cacheAge !== undefined) {
        headerRefreshEl.textContent = `Last sync: ${formatCacheAge(cacheAge)}`;
      } else {
        headerRefreshEl.textContent = "Last sync: waiting for cache...";
      }
    }

    const updateEl = document.getElementById("lastUpdateTime");
    if (updateEl) {
      if (cacheAge !== null && cacheAge !== undefined) {
        updateEl.textContent = formatCacheAge(cacheAge);
      } else {
        updateEl.textContent = "waiting for cache...";
      }
    }

    const syncEl = document.getElementById("syncStatus");
    if (syncEl) {
      const freshness = cacheAge < 300 ? "● in-sync" : cacheAge < 600 ? "◐ stale" : "◯ very-stale";
      syncEl.innerHTML = freshness;
      
      if (cacheAge < 300) {
        syncEl.style.color = "var(--status-ok)";
      } else if (cacheAge < 600) {
        syncEl.style.color = "var(--status-warn)";
      } else {
        syncEl.style.color = "var(--status-crit)";
      }
    }
  }

  /**
   * Load dashboard data from the central cache (not from Apps Script backend)
   * 
   * This is the key difference from the old architecture:
   * - Old: Each user triggered a backend sync operation
   * - New: Users read from a cache updated by a central sync engine
   */
  async function loadAll() {
    const syncEl = document.getElementById("syncStatus");
    if (syncEl) {
      syncEl.innerHTML = "⟳ refreshing cache...";
      syncEl.style.color = "var(--status-warn)";
    }

    const settled = await Promise.allSettled([
      NocApi.fetchStatus(),
      NocApi.fetchTopUsers("daily", cfg.maxTopUsers),
      NocApi.fetchTopUsers("monthly", cfg.maxTopUsers)
    ]);

    const errors = [];

    if (settled[0].status === "fulfilled") {
      state.status = settled[0].value;
    } else {
      errors.push(`status: ${settled[0].reason && settled[0].reason.message ? settled[0].reason.message : "failed"}`);
    }

    if (settled[1].status === "fulfilled") {
      state.topDaily = settled[1].value;
    } else {
      errors.push(`topusers-daily: ${settled[1].reason && settled[1].reason.message ? settled[1].reason.message : "failed"}`);
    }

    if (settled[2].status === "fulfilled") {
      state.topMonthly = settled[2].value;
    } else {
      errors.push(`topusers-monthly: ${settled[2].reason && settled[2].reason.message ? settled[2].reason.message : "failed"}`);
    }

    // Get cache metadata from raw cache
    try {
      const cached = await NocApi.fetchRawCache();
      if (cached.meta) {
        state.cacheAge = typeof cached.meta.cacheAge === "number" ? cached.meta.cacheAge : null;
        state.lastCacheUpdate = cached.meta.lastSync || null;
      }
    } catch (e) {
      // Ignore - cache meta not critical
    }

    if (state.status || state.topDaily || state.topMonthly) {
      NocRender.renderAll(state);
      NocCharts.renderTopUsers("dailyUsersChart", (state.topDaily && state.topDaily.rows) || []);
      NocCharts.renderTopUsers("monthlyUsersChart", (state.topMonthly && state.topMonthly.rows) || []);
      updateFooterWithCacheInfo(state.cacheAge, state.lastCacheUpdate);
    }

    // Update API health indicator
    const healthEl = document.getElementById("apiHealth");
    if (healthEl) {
      if (errors.length) {
        healthEl.textContent = `cache read failed (${errors.length} error${errors.length > 1 ? 's' : ''})`;
        healthEl.className = "status-indicator error";
      } else {
        healthEl.textContent = "operational";
        healthEl.className = "status-indicator";
      }
    }
  }

  /**
   * Initialize auto-refresh
   * 
   * The dashboard auto-refreshes every 15-30 seconds to reload the cache.
   * This is NOT a backend sync - it's just reading the same cached file.
   * 
   * The actual backend sync happens independently, scheduled by cron jobs.
   * Even if auto-refresh is disabled, data still updates via the sync engine.
   */
  function initAutoRefresh() {
    if (state.timer) window.clearInterval(state.timer);
    // Refresh every 15 seconds (reads cache, very fast, no backend load)
    state.timer = window.setInterval(loadAll, cfg.refreshMs || 15000);
  }

  // Bind refresh button (manual reload of cache)
  document.getElementById("refreshBtn").addEventListener("click", loadAll);

  // Initial load
  loadAll();

  // Start auto-refresh
  initAutoRefresh();
})();
