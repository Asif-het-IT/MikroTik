this.HET = this.HET || {};

(function(ns) {
  if (ns.Utils) return;

  function cfg_() {
    return ns.Config.get();
  }

  function safeString(value, fallback) {
    if (value === null || value === undefined) return fallback || '';
    var s = String(value).trim();
    return s === '' ? (fallback || '') : s;
  }

  function toInt(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? (fallback || 0) : n;
  }

  function toNum(value, fallback) {
    var n = Number(value);
    return isNaN(n) ? (fallback || 0) : n;
  }

  function nowDate() {
    return new Date();
  }

  function nowText() {
    var c = cfg_();
    return Utilities.formatDate(new Date(), c.TZ || 'Asia/Dubai', c.DATE_TIME_FMT || 'dd-MMM-yyyy hh:mm a');
  }

  function trimToLimit(text, maxLen) {
    var s = safeString(text, '');
    var lim = toInt(maxLen, 0);
    if (!lim || s.length <= lim) return s;
    return s.substring(0, lim);
  }

  function getOrCreateSheet(name) {
    var ss = ns.Config.getSpreadsheet();
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    return sh;
  }

  function ensureHeaders(name, headers) {
    var sh = getOrCreateSheet(name);
    var width = headers.length;
    var rng = sh.getRange(1, 1, 1, width);
    var cur = rng.getValues()[0];
    var need = cur.join('|') !== headers.join('|');
    if (need) {
      rng.setValues([headers]);
      sh.setFrozenRows(1);
    }
  }

  function setDateTimeFormat() {
    var c = cfg_();
    var fmt = c.DATE_TIME_FMT || 'dd-MMM-yyyy hh:mm a';
    var keys = Object.keys(ns.Config.SHEETS);
    var i;

    for (i = 0; i < keys.length; i++) {
      var def = ns.Config.SHEETS[keys[i]];
      var sh = getOrCreateSheet(def.name);
      ensureHeaders(def.name, def.headers);
      var rows = Math.max(sh.getMaxRows(), 2);
      sh.getRange(2, 1, rows - 1, 1).setNumberFormat(fmt);
    }
  }

  function ensureAllSheets() {
    var keys = Object.keys(ns.Config.SHEETS);
    var i;
    for (i = 0; i < keys.length; i++) {
      var def = ns.Config.SHEETS[keys[i]];
      ensureHeaders(def.name, def.headers);
    }
    setDateTimeFormat();
  }

  function appendRow(sheetName, row) {
    var sh = getOrCreateSheet(sheetName);
    sh.appendRow(row);
    var lr = sh.getLastRow();
    if (lr >= 2) {
      var c = cfg_();
      sh.getRange(lr, 1, 1, 1).setNumberFormat(c.DATE_TIME_FMT || 'dd-MMM-yyyy hh:mm a');
    }
  }

  function compactSheetByRows(sheetName, keepRows) {
    var sh = getOrCreateSheet(sheetName);
    var limit = toInt(keepRows, 2000);
    var total = sh.getLastRow();
    if (total <= limit + 1) return;
    var remove = total - (limit + 1);
    sh.deleteRows(2, remove);
  }

  function splitRecords(value, rowSep, colSep) {
    var raw = safeString(value, '');
    if (!raw) return [];
    var rows = raw.split(rowSep || ';');
    var out = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var line = safeString(rows[i], '');
      if (!line) continue;
      out.push(line.split(colSep || '|'));
    }
    return out;
  }

  function dedupeSeen(scope, key, ttlSec) {
    var cache = CacheService.getScriptCache();
    var ttl = toInt(ttlSec, 300);
    var cacheKey = 'DEDUPE:' + scope + ':' + key;
    if (cache.get(cacheKey)) return true;
    cache.put(cacheKey, '1', ttl);
    return false;
  }

  function compareAndSetState(scope, key, value) {
    var sp = PropertiesService.getScriptProperties();
    var stateKey = 'STATE:' + scope + ':' + key;
    var prev = sp.getProperty(stateKey);
    var next = safeString(value, '');
    if (prev === next) return false;
    sp.setProperty(stateKey, next);
    return true;
  }

  function isRateLimited(site, router, type) {
    var cache = CacheService.getScriptCache();
    var c = cfg_();
    var key = 'RL:' + safeString(site, c.SITE) + ':' + safeString(router, 'RTR') + ':' + safeString(type, 'na');
    var ttl = 2;
    if (cache.get(key)) return true;
    cache.put(key, '1', ttl);
    return false;
  }

  function withScriptLock(fn) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  function textOk() {
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  }

  function appendRaw(type, site, router, payload, isError) {
    var target = isError ? ns.Config.SHEETS.RAW_EVENTS.name : ns.Config.SHEETS.RAW_LIVE.name;
    appendRow(target, [
      nowDate(),
      safeString(type, ''),
      safeString(site, cfg_().SITE),
      safeString(router, ''),
      trimToLimit(JSON.stringify(payload || {}), 48000)
    ]);
  }

  ns.Utils = {
    safeString: safeString,
    toInt: toInt,
    toNum: toNum,
    nowDate: nowDate,
    nowText: nowText,
    appendRow: appendRow,
    getOrCreateSheet: getOrCreateSheet,
    ensureHeaders: ensureHeaders,
    setDateTimeFormat: setDateTimeFormat,
    trimToLimit: trimToLimit,
    splitRecords: splitRecords,
    dedupeSeen: dedupeSeen,
    compareAndSetState: compareAndSetState,
    isRateLimited: isRateLimited,
    withScriptLock: withScriptLock,
    ensureAllSheets: ensureAllSheets,
    compactSheetByRows: compactSheetByRows,
    textOk: textOk,
    appendRaw: appendRaw
  };
})(this.HET);
