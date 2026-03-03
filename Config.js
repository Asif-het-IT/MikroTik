const SS_ID = "1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc";

const SHEETS = {
  CFG: "CONFIG",
  USER_MONITOR: "USER_MONITOR",
};

const DEFAULT_HEADERS = {
  USER_MONITOR: ["timestamp","site","router","ip","mac","hostname","rx_total","tx_total","delta_bytes","delta_mbps","date_key"],
};

function ensureAll_(ss) {
  // Simplified: only ensure the single USER_MONITOR sheet exists.
  ensureSheet_(ss, SHEETS.USER_MONITOR, DEFAULT_HEADERS.USER_MONITOR);
}

function getCfg_(ss) {
  const cache = CacheService.getScriptCache();
  const ckey = "NOC_CFG_V8";
  const cached = cache.get(ckey);
  if (cached) return JSON.parse(cached);
  const sh = ss.getSheetByName(SHEETS.CFG);
  if (!sh) {
    // config sheet not present; fallback to Script Properties
    try {
      const props = PropertiesService.getScriptProperties().getProperties();
      cache.put(ckey, JSON.stringify(props), 60);
      return props;
    } catch (e) {
      cache.put(ckey, JSON.stringify({}), 60);
      return {};
    }
  }
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

function setCfgValue_(ss, key, value) {
  const sh = ss.getSheetByName(SHEETS.CFG);
  if (!sh) {
    // CONFIG sheet not present: persist to Script Properties instead to avoid creating sheets.
    try { PropertiesService.getScriptProperties().setProperty(String(key), String(value)); } catch (e) { }
    try { CacheService.getScriptCache().remove('NOC_CFG_V8'); } catch (e) {}
    return;
  }
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0] || "").trim() === String(key)) {
      sh.getRange(i + 1, 2).setValue(String(value));
      try { CacheService.getScriptCache().remove('NOC_CFG_V8'); } catch (e) {}
      return;
    }
  }
  sh.appendRow([String(key), String(value)]);
  try { CacheService.getScriptCache().remove('NOC_CFG_V8'); } catch (e) {}
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
  const cfg = getCfg_(ss);
  // Single-sheet deployment: only install the daily Top-10 job (22:00 by default)
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  const topUsersHour = 22;
  ScriptApp.newTrigger("dailyTop10Job").timeBased().everyDays(1).atHour(topUsersHour).nearMinute(0).create();
}

function ensureSheet_(ss, name, header) {
  // Do not auto-create sheets here. Return the sheet if present, otherwise null.
  const sh = ss.getSheetByName(name);
  if (!sh) return null;

  if (sh.getLastRow() === 0) sh.appendRow(header);

  const existing = sh.getRange(1, 1, 1, header.length).getValues()[0];
  const same = existing.length === header.length && existing.every((x, i) => String(x) === String(header[i]));
  if (!same) sh.getRange(1, 1, 1, header.length).setValues([header]);

  styleSheetHeader_(sh);
  return sh;
}

function ensureConfigDefaults_(ss) {
  // No-op in single-sheet deployment: avoid creating CONFIG sheet or writing defaults.
  return;
}