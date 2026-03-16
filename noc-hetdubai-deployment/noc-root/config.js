window.NOC_WEB_CONFIG = {
  appName: "het NOC Dashboard",
  // API points to cached API, not direct Apps Script
  // This is the key change for the centralized cache architecture
  apiBase: "/api/cached-api.php",
  // Auto-refresh: 5 seconds (reads from cache, very fast, no backend load)
  // The actual data freshness depends on sync.php cron cadence.
  refreshMs: 15000,
  // Request timeout: 5 seconds (cache reads are instant)
  // Apps Script timeout fallback no longer needed for dashboard
  requestTimeoutMs: 5000,
  maxTopUsers: 10,
  bytesDivisor: 1024,
  showIdentityMeta: true,
  appTitle: "het NOC",
  defaultTheme: "auto"
};
