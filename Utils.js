function hetNowDate_() {
  return new Date();
}

function hetFmt_(d) {
  return Utilities.formatDate(d, HET.cfg().TZ, HET.cfg().DATE_TIME_FMT);
}

function hetFmtDate_(d) {
  return Utilities.formatDate(d, HET.cfg().TZ, HET.cfg().DATE_FMT || 'dd-MMM-yyyy');
}

function hetFmtTime_(d) {
  return Utilities.formatDate(d, HET.cfg().TZ, HET.cfg().TIME_FMT || 'hh:mm a');
}

function hetToInt_(v, defVal) {
  var n = parseInt(v, 10);
  return isNaN(n) ? (defVal || 0) : n;
}

function hetToNum_(v, defVal) {
  var n = Number(v);
  return isNaN(n) ? (defVal || 0) : n;
}

function hetSafeStr_(s, maxLen) {
  var x = (s === null || s === undefined) ? '' : String(s).trim();
  if (!maxLen) return x;
  return x.length > maxLen ? x.slice(0, maxLen) : x;
}

function hetIsYes_(value) {
  return String(value || '').toUpperCase() === 'YES';
}

function hetSafeJsonParse_(text, defVal) {
  if (!text) return defVal;
  try {
    return JSON.parse(text);
  } catch (_) {
    return defVal;
  }
}

function hetEscapeHtml_(s) {
  return hetSafeStr_(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hetText_(text) {
  return ContentService.createTextOutput(String(text));
}

function hetJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hetRequireToken_(e) {
  var token = hetSafeStr_(e && e.parameter ? e.parameter.token : '', 200);
  if (!token || token !== HET.cfg().MONITOR_TOKEN) {
    throw new Error('Unauthorized: invalid token');
  }
}

function hetGetOrCreateSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (name !== HET.SHEETS.DASHBOARD && HET.HEADERS[name]) {
    hetEnsureHeader_(sh, HET.HEADERS[name]);
  }
  return sh;
}

function hetEnsureHeader_(sh, header) {
  var cur = sh.getRange(1, 1, 1, header.length).getDisplayValues()[0];
  if (cur.join('||') !== header.join('||')) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
}

function hetSetDateTimeFormatAll_(sh, col) {
  var c = col || 1;
  var last = sh.getLastRow();
  if (last < 2) return;
  sh.getRange(2, c, last - 1, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
}

function hetInsertRows_(sh, rows) {
  if (!rows || !rows.length) return;
  sh.insertRowsBefore(2, rows.length);
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(2, 1, rows.length, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
}

function hetAppendRow_(sh, row) {
  hetInsertRows_(sh, [row]);
}

function hetTrimToLimit_(sh, keepRows) {
  var max = keepRows || HET.cfg().RAW_KEEP_ROWS;
  var last = sh.getLastRow();
  if (last <= max + 1) return;
  sh.deleteRows(max + 2, last - (max + 1));
}

function hetGetLatestDataRow_(sh, width) {
  if (!sh || sh.getLastRow() < 2) return null;
  return sh.getRange(2, 1, 1, width).getValues()[0];
}

function hetGetTopDataRows_(sh, width, limit) {
  if (!sh || sh.getLastRow() < 2) return [];
  var take = Math.min(limit || 1, sh.getLastRow() - 1);
  if (take <= 0) return [];
  return sh.getRange(2, 1, take, width).getValues();
}

function HET_effectiveLiveState_(liveRow) {
  var cfg = HET.cfg();
  var rawStatus = liveRow ? (hetSafeStr_(liveRow[3], 20) || 'UNKNOWN').toUpperCase() : 'NO DATA';
  var rawMessage = liveRow ? (hetSafeStr_(liveRow[4], 250) || 'No live update received yet.') : 'No live update received yet.';
  var lastAt = liveRow && liveRow[0] instanceof Date ? liveRow[0] : null;
  var ageMinutes = lastAt ? ((Date.now() - lastAt.getTime()) / 60000) : null;
  var ageMinutesFloor = ageMinutes === null ? null : Math.max(0, Math.floor(ageMinutes));
  var warnMin = Math.max(1, hetToInt_(cfg.STALE_WARN, 15));
  var critMin = Math.max(warnMin, hetToInt_(cfg.STALE_CRIT, 25));
  var isUp = rawStatus === 'ONLINE' || rawStatus === 'UP';
  var freshness = lastAt ? 'FRESH' : 'NO_DATA';
  var effectiveStatus = rawStatus;
  var effectiveMessage = rawMessage;
  var alertMessage = rawMessage;
  var derivedDown = false;

  if (!lastAt) {
    return {
      rawStatus: rawStatus,
      rawMessage: rawMessage,
      effectiveStatus: effectiveStatus,
      effectiveMessage: effectiveMessage,
      alertMessage: alertMessage,
      freshness: freshness,
      ageMin: ageMinutes,
      ageMinFloor: ageMinutesFloor,
      lastSeenText: 'n/a',
      lastAt: null,
      derivedDown: derivedDown,
      isUp: isUp,
      warnMin: warnMin,
      critMin: critMin
    };
  }

  if (ageMinutes >= critMin) {
    freshness = 'CRIT';
    if (isUp) {
      effectiveStatus = 'DOWN';
      effectiveMessage = 'No live data for ' + ageMinutesFloor + ' min';
      alertMessage = 'Router unreachable: live heartbeat missing';
      derivedDown = true;
    }
  } else if (ageMinutes >= warnMin) {
    freshness = 'WARN';
    if (isUp) {
      effectiveMessage = 'Live data delayed by ' + ageMinutesFloor + ' min';
      alertMessage = effectiveMessage;
    }
  }

  return {
    rawStatus: rawStatus,
    rawMessage: rawMessage,
    effectiveStatus: effectiveStatus,
    effectiveMessage: effectiveMessage,
    alertMessage: alertMessage,
    freshness: freshness,
    ageMin: ageMinutes,
    ageMinFloor: ageMinutesFloor,
    lastSeenText: ageMinutes === null ? 'n/a' : ageMinutes.toFixed(1) + ' min',
    lastAt: lastAt,
    derivedDown: derivedDown,
    isUp: isUp,
    warnMin: warnMin,
    critMin: critMin
  };
}

function hetEnsureRuntimeReady_() {
  var props = HET.props();
  var now = Date.now();
  var last = hetToInt_(props.getProperty('LAST_SHEET_ENSURE_MS'), 0);
  if (last && (now - last) < 6 * 60 * 60 * 1000) return;
  hetEnsureAllSheets_();
  props.setProperty('LAST_SHEET_ENSURE_MS', String(now));
}

function hetEnsureAllSheets_() {
  var ss = HET.ss();
  var keys = Object.keys(HET.SHEETS);
  var i;
  for (i = 0; i < keys.length; i++) {
    var name = HET.SHEETS[keys[i]];
    var sh = hetGetOrCreateSheet_(ss, name);
    if (name !== HET.SHEETS.DASHBOARD) {
      hetEnsureHeader_(sh, HET.HEADERS[name]);
    }
    try {
      if (name !== HET.SHEETS.DASHBOARD) {
        hetSetDateTimeFormatAll_(sh, 1);
        if (name === HET.SHEETS.COMMAND_CENTER) {
          hetSetDateTimeFormatAll_(sh, 9);
        }
      }
    } catch (err) {
      // Keep setup resilient on large sheets; formatting can be retried later.
    }
  }
}

function hetAppendRaw_(isError, type, site, router, payloadObj) {
  var ss = HET.ss();
  var name = isError ? HET.SHEETS.RAW_EVENTS : HET.SHEETS.RAW_LIVE;
  var sh = hetGetOrCreateSheet_(ss, name);
  hetAppendRow_(sh, [
    hetNowDate_(),
    hetSafeStr_(type, 60),
    hetSafeStr_(site, 40),
    hetSafeStr_(router, 80),
    hetSafeStr_(JSON.stringify(payloadObj || {}), 48000)
  ]);
  hetTrimToLimit_(sh, HET.cfg().RAW_KEEP_ROWS);
}
