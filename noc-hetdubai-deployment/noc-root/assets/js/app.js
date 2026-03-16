 (function () {
  const cfg = window.NOC_WEB_CONFIG;
  const state = {
    status: null,
    topDaily: null,
    topMonthly: null,
    rawCache: null,
    timer: null,
    cacheAge: null,
    lastCacheUpdate: null,
    selectedSite: "ALL",
    deferredInstallPrompt: null,
  };

  const STORAGE_KEYS = {
    theme: "noc_theme",
    selectedSite: "noc_selected_site"
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

  function resolveTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === "dark" || saved === "light") return saved;
    if ((cfg.defaultTheme || "auto") === "dark") return "dark";
    if ((cfg.defaultTheme || "auto") === "light") return "light";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme(theme) {
    document.body.classList.toggle("light-mode", theme === "light");
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = theme === "light" ? "DARK" : "LIGHT";
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }

  function toggleTheme() {
    const isLight = document.body.classList.contains("light-mode");
    applyTheme(isLight ? "dark" : "light");
  }

  function getSiteFromRow(row) {
    if (!row) return "";
    return String(row.resolvedSite || row.site || row.branch || "").trim().toUpperCase();
  }

  function detectSitesFromState(cache, topDaily, topMonthly) {
    const set = new Set();
    if (cache && cache.status && cache.status.site) set.add(String(cache.status.site).toUpperCase());
    ((topDaily && topDaily.rows) || []).forEach((r) => {
      const s = getSiteFromRow(r);
      if (s) set.add(s);
    });
    ((topMonthly && topMonthly.rows) || []).forEach((r) => {
      const s = getSiteFromRow(r);
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }

  function populateSiteSelector(sites) {
    const select = document.getElementById("siteSelector");
    if (!select) return;

    const prev = localStorage.getItem(STORAGE_KEYS.selectedSite) || "ALL";
    const options = ["ALL"].concat(sites || []);
    select.innerHTML = options
      .map((s) => `<option value="${s}">${s === "ALL" ? "All Sites" : s}</option>`)
      .join("");

    state.selectedSite = options.indexOf(prev) >= 0 ? prev : "ALL";
    select.value = state.selectedSite;
  }

  function filterRowsBySite(rows, selectedSite) {
    if (!rows || !rows.length || selectedSite === "ALL") return rows || [];
    return rows.filter((r) => getSiteFromRow(r) === selectedSite);
  }

  function pickStatusForSite(cache, selectedSite) {
    if (!cache || !cache.status) return null;
    if (!selectedSite || selectedSite === "ALL") return cache.status;

    const root = cache.status;
    if (root.statusBySite && root.statusBySite[selectedSite]) return root.statusBySite[selectedSite];
    if (root.sites && root.sites[selectedSite]) return root.sites[selectedSite];
    if (Array.isArray(root.statuses)) {
      const m = root.statuses.find((x) => String(x.site || "").toUpperCase() === selectedSite);
      if (m) return m;
    }
    return root;
  }

  function buildRenderState(cache, topDaily, topMonthly) {
    const selected = state.selectedSite || "ALL";
    const status = pickStatusForSite(cache, selected);
    const dailyRows = filterRowsBySite((topDaily && topDaily.rows) || [], selected);
    const monthlyRows = filterRowsBySite((topMonthly && topMonthly.rows) || [], selected);

    return {
      status: {
        ...(status || {}),
      },
      topDaily: {
        ...(topDaily || {}),
        rows: dailyRows,
      },
      topMonthly: {
        ...(topMonthly || {}),
        rows: monthlyRows,
      }
    };
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

  function updateHeaderContext(status) {
    const s = (status && status.dashboard) || {};
    const title = document.getElementById("siteName");
    const router = document.getElementById("routerName");

    if (title) {
      const labelSite = state.selectedSite && state.selectedSite !== "ALL"
        ? state.selectedSite
        : (s.site || "NETWORK OPERATIONS CENTER");
      title.textContent = String(labelSite);
    }
    if (router) {
      router.textContent = String(s.router || "Live Monitoring Dashboard");
    }
  }

  function hideSplash() {
    const splash = document.getElementById("appSplash");
    if (!splash) return;
    splash.classList.add("hidden");
    window.setTimeout(() => splash.remove(), 300);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function setupInstallPrompt() {
    const btn = document.getElementById("installBtn");
    if (!btn) return;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      btn.hidden = false;
    });

    btn.addEventListener("click", async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      try {
        await state.deferredInstallPrompt.userChoice;
      } catch (_) {}
      state.deferredInstallPrompt = null;
      btn.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
      btn.hidden = true;
      state.deferredInstallPrompt = null;
    });
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
      NocApi.fetchRawCache(),
      NocApi.fetchTopUsers("daily", cfg.maxTopUsers),
      NocApi.fetchTopUsers("monthly", cfg.maxTopUsers)
    ]);

    const errors = [];

    if (settled[0].status === "fulfilled") {
      state.rawCache = settled[0].value;
      state.status = {
        dashboard: (state.rawCache && state.rawCache.status) || {},
        runtimeHealth: (state.rawCache && state.rawCache.status && state.rawCache.status.runtimeHealth) || { overall: "UNKNOWN", cycles: [] },
        triggerIntegrity: (state.rawCache && state.rawCache.status && state.rawCache.status.triggerIntegrity) || { ok: false, missing: [] },
        timeFmt: (state.rawCache && state.rawCache.status && state.rawCache.status.timeFmt) || null,
        dailyReportTime: (state.rawCache && state.rawCache.status && state.rawCache.status.dailyReportTime) || null,
        sheets: (state.rawCache && state.rawCache.status && state.rawCache.status.sheets) || {},
        sheetHealth: (state.rawCache && state.rawCache.status && state.rawCache.status.sheetHealth) || []
      };
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

    if (state.rawCache && state.rawCache.meta) {
      state.cacheAge = typeof state.rawCache.meta.cacheAge === "number" ? state.rawCache.meta.cacheAge : null;
      state.lastCacheUpdate = state.rawCache.meta.lastSync || null;
    }

    if (state.status || state.topDaily || state.topMonthly) {
      const sites = detectSitesFromState(state.rawCache, state.topDaily, state.topMonthly);
      populateSiteSelector(sites);
      const renderState = buildRenderState(state.rawCache, state.topDaily, state.topMonthly);

      NocRender.renderAll(renderState);
      NocCharts.renderTopUsers("dailyUsersChart", (renderState.topDaily && renderState.topDaily.rows) || []);
      NocCharts.renderTopUsers("monthlyUsersChart", (renderState.topMonthly && renderState.topMonthly.rows) || []);
      updateHeaderContext(renderState.status || {});
      updateFooterWithCacheInfo(state.cacheAge, state.lastCacheUpdate);
      hideSplash();
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
    // Safe mobile refresh interval: defaults to 15 seconds from config.
    state.timer = window.setInterval(loadAll, cfg.refreshMs || 15000);
  }

  function bindControls() {
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", loadAll);

    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    const siteSelector = document.getElementById("siteSelector");
    if (siteSelector) {
      siteSelector.addEventListener("change", (e) => {
        const v = String((e.target && e.target.value) || "ALL");
        state.selectedSite = v;
        localStorage.setItem(STORAGE_KEYS.selectedSite, v);
        const renderState = buildRenderState(state.rawCache, state.topDaily, state.topMonthly);
        NocRender.renderAll(renderState);
        NocCharts.renderTopUsers("dailyUsersChart", (renderState.topDaily && renderState.topDaily.rows) || []);
        NocCharts.renderTopUsers("monthlyUsersChart", (renderState.topMonthly && renderState.topMonthly.rows) || []);
        updateHeaderContext(renderState.status || {});
      });
    }
  }

  applyTheme(resolveTheme());
  bindControls();
  setupInstallPrompt();
  registerServiceWorker();

  // Initial load
  loadAll();

  // Start auto-refresh
  initAutoRefresh();
})();
