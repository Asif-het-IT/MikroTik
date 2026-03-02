const SS_ID = "1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc";

const SHEETS = {
  CFG: "CONFIG",
  RAW: "RAW_EVENTS",
  LOG: "ROUTER_LOGS",
  LOG_DETAIL: "ROUTER_LOG_DETAILS",
  STATE: "STATE_LATEST",
  TREND: "TRAFFIC_TREND_7D",
  DASH: "DASHBOARD",
  USER_LOADS: "USER_LOADS",
  AUDIT: "DATA_AUDIT",
  TG_OUT: "TG_OUTBOX",
  EXEC: "EXEC_REPORT",
  ALERTS: "ALERTS_ACTIVE",
  ALERTS_LOG: "ALERTS_LOG",
  ERR: "ERRORS_LOG",
};

const DEFAULT_HEADERS = {
  RAW: [
    "ts_server", "type", "site", "router", "uptime",
    "cpu", "memfree", "memtotal", "mem_pct",
    "isp", "ipsec", "rdp",
    "hotspot_active", "leases", "wanip",
    "isp_rx", "isp_tx",
    "lan_rx", "lan_tx",
    "unity_rx", "unity_tx",
    "store_rx", "store_tx",
    "buk_rx", "buk_tx",
    "wifi_rx", "wifi_tx",
    "top5_users",
    "queues",
    "payload_json", "ingest_status"
  ],
  LOG: ["ts_server", "type", "site", "router", "msg", "payload_json", "ingest_status"],
  LOG_DETAIL: ["ts_server", "site", "router", "log_time", "log_topics", "log_buffer", "msg", "payload_json", "ingest_status"],
  STATE: [
    "site", "last_seen", "router", "uptime",
    "cpu", "mem_pct",
    "isp", "ipsec", "rdp",
    "hotspot_active", "leases", "wanip",
    "status_grade", "live_state", "stale_minutes",
    "isp_mbps", "lan_mbps", "unity_mbps", "store_mbps", "buk_mbps", "wifi_mbps", "isp_pct",
    "top_group",
    "top5_users"
  ],
  USER_LOADS: ["ts", "site", "user", "bytes", "mb", "pct_of_top5", "category", "raw_snapshot"],
  TREND: ["ts", "site", "isp_mbps", "lan_mbps", "unity_mbps", "store_mbps", "buk_mbps", "wifi_mbps", "isp_pct"],
  AUDIT: ["ts", "field_key", "friendly_name", "coverage_pct", "sample_value", "in_state", "collectable_from_router", "note"],
  TG_OUT: ["ts", "title", "chat_id", "message_html", "status", "result", "attempts"],
  EXEC: [
    "ts",
    "total_sites", "ok", "warn", "crit",
    "live", "stale", "no_data",
    "isp_down", "vpn_down",
    "avg_cpu", "avg_ram", "avg_isp_pct", "max_isp_pct", "avg_health",
    "active_alerts", "raised_24h", "resolved_24h",
    "top_risk_site", "top_risk_reason", "notes"
  ],
  ALERTS: ["fingerprint", "site", "type", "title", "first_seen", "last_seen", "state"],
  ALERTS_LOG: ["ts", "site", "type", "action", "title", "details_json"],
  ERR: ["ts", "module", "error", "payload"],
};

function ensureAll_(ss) {
  ensureSheet_(ss, SHEETS.CFG, ["key", "value"]);
  ensureSheet_(ss, SHEETS.RAW, DEFAULT_HEADERS.RAW);
  ensureSheet_(ss, SHEETS.LOG, DEFAULT_HEADERS.LOG);
  ensureSheet_(ss, SHEETS.LOG_DETAIL, DEFAULT_HEADERS.LOG_DETAIL);
  ensureSheet_(ss, SHEETS.STATE, DEFAULT_HEADERS.STATE);
  ensureSheet_(ss, SHEETS.TREND, DEFAULT_HEADERS.TREND);
  ensureSheet_(ss, SHEETS.USER_LOADS, DEFAULT_HEADERS.USER_LOADS);
  ensureSheet_(ss, SHEETS.DASH, [""]);
  ensureSheet_(ss, SHEETS.AUDIT, DEFAULT_HEADERS.AUDIT);
  ensureSheet_(ss, SHEETS.TG_OUT, DEFAULT_HEADERS.TG_OUT);
  ensureSheet_(ss, SHEETS.EXEC, DEFAULT_HEADERS.EXEC);
  ensureSheet_(ss, SHEETS.ALERTS, DEFAULT_HEADERS.ALERTS);
  ensureSheet_(ss, SHEETS.ALERTS_LOG, DEFAULT_HEADERS.ALERTS_LOG);
  ensureSheet_(ss, SHEETS.ERR, DEFAULT_HEADERS.ERR);
  ensureConfigDefaults_(ss);
}

function getCfg_(ss) {
  const cache = CacheService.getScriptCache();
  const ckey = "NOC_CFG_V8";
  const cached = cache.get(ckey);
  if (cached) return JSON.parse(cached);

  const sh = ss.getSheetByName(SHEETS.CFG);
  const v = sh.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < v.length; i++) {
    const k = String(v[i][0] || "").trim();
    const val = String(v[i][1] || "").trim();
    if (k) map[k] = val;
  }
  cache.put(ckey, JSON.stringify(map), 60);
  return map;
}

function cfgStr_(cfg, key, def = "") {
  const v = cfg[key];
  return (v === undefined || v === null || String(v).trim() === "") ? def : String(v).trim();
}

function cfgNum_(cfg, key, def = 0) {
  const n = Number(cfgStr_(cfg, key, ""));
  return isFinite(n) ? n : def;
}

function cfgYes_(cfg, key, def = "NO") {
  const v = cfgStr_(cfg, key, def).toUpperCase();
  return v === "YES" || v === "TRUE" || v === "1";
}

function cfgFmt_(cfg) {
  return cfgStr_(cfg, "DATE_TIME_FMT", "dd-MMM-yyyy hh:mm a");
}

function installTriggers() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);

  const dashMin = normalizeEveryMinutes_(cfgNum_(cfg, "DASH_REFRESH_MIN", 5));
  const alertMin = normalizeEveryMinutes_(cfgNum_(cfg, "ALERT_REFRESH_MIN", 2));
  const dailyHour = Math.max(0, Math.min(23, cfgNum_(cfg, "DAILY_HOUR", 9)));
  const execEveryHours = Math.max(1, Math.min(6, Math.round(cfgNum_(cfg, "EXEC_SNAPSHOT_HOURS", 1))));

  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("smartAlertEngine").timeBased().everyMinutes(alertMin).create();
  ScriptApp.newTrigger("rebuildDashboard").timeBased().everyMinutes(dashMin).create();
  ScriptApp.newTrigger("dailySummary").timeBased().everyDays(1).atHour(dailyHour).nearMinute(0).create();
  ScriptApp.newTrigger("buildExecReportNow").timeBased().everyHours(execEveryHours).create();
  ScriptApp.newTrigger("retentionCleanupNow").timeBased().everyHours(6).create();
}

function ensureSheet_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) sh.appendRow(header);

  const existing = sh.getRange(1, 1, 1, header.length).getValues()[0];
  const same = existing.length === header.length && existing.every((x, i) => String(x) === String(header[i]));
  if (!same) sh.getRange(1, 1, 1, header.length).setValues([header]);

  styleSheetHeader_(sh);
}

function ensureConfigDefaults_(ss) {
  const sh = ss.getSheetByName(SHEETS.CFG);
  if (sh.getLastRow() === 0) sh.appendRow(["key", "value"]);

  const v = sh.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < v.length; i++) {
    const k = String(v[i][0] || "").trim();
    const val = String(v[i][1] || "").trim();
    if (k) map[k] = val;
  }

  const defaults = {
    TOKEN: "MONITOR_TOKEN_2026",
    TOKEN_ALT: "MONITOR_TOKEN_2026",
    TG_BOT: "",
    TG_CHAT: "",
    EMAIL_TO: "",
    EMAILS: "",
    SITE: "KANO",
    RAW_MODE: "TOP",
    DASH_REFRESH_MIN: "5",
    ALERT_REFRESH_MIN: "2",
    DAILY_HOUR: "9",
    CPU_WARN: "70",
    CPU_CRIT: "85",
    MEM_WARN: "80",
    MEM_CRIT: "90",
    LEASES_WARN: "45",
    STALE_WARN: "3",
    STALE_CRIT: "10",
    LIVE_MINUTES: "2",
    TREND_SAMPLES: "180",
    BAR_MAX_SITES: "50",
    DASH_TOP_N: "100",
    RAW_KEEP_ROWS: "2000",
    REPORT_MAX_LINES: "20",
    EXEC_SNAPSHOT_HOURS: "1",
    EXEC_KEEP_ROWS: "1440",
    DATE_TIME_FMT: "dd-MMM-yyyy hh:mm a",
    AUTO_SEND_OUTBOX: "YES",
    ISP_MAX_MBPS: "20",
    ISP_SAT_WARN_PCT: "70",
    ISP_SAT_CRIT_PCT: "90",
    USER_HEAVY_MB: "5",
  };

  Object.keys(defaults).forEach(k => {
    if (map[k] === undefined) sh.appendRow([k, defaults[k]]);
  });
}