function HET_topUsageSummaryLegacy_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.USER_DATA_USAGE);
  var map = {};
  var take;
  var rows;
  var arr = [];
  var i;

  if (!sh || sh.getLastRow() < 2) return [];
  take = Math.min(hetToInt_(HET.cfg().TREND_SAMPLES, 180), sh.getLastRow() - 1);
  rows = hetGetTopDataRows_(sh, 7, take);

  rows.forEach(function(r) {
    var ip = hetSafeStr_(r[3], 40) || 'unknown';
    var total = hetToNum_(r[6], 0);
    if (!ip || ip === 'unknown' || ip === 'WAN_TOTAL') return;
    map[ip] = (map[ip] || 0) + total;
  });

  Object.keys(map).forEach(function(ip) {
    arr.push({ ip: ip, total: map[ip] });
  });
  arr.sort(function(a, b) { return b.total - a.total; });

  for (i = 0; i < arr.length; i++) {
    arr[i].label = arr[i].ip + ' (' + arr[i].total.toFixed(0) + ')';
  }
  return arr.slice(0, 5);
}

function HET_topUsageSummary_() {
  // Keep dashboard top users aligned with latest user_usage ingest on every refresh.
  if (typeof HET_writeTopUserSheets_ === 'function') {
    try { HET_writeTopUserSheets_(); } catch (_) {}
  }
  if (typeof HET_getTopUsers_ === 'function') {
    var rows = HET_getTopUsers_(10, 'daily');
    if (rows && rows.length) return rows;
  }
  return HET_topUsageSummaryLegacy_();
}

function HET_recentTrafficDeltaSnapshot_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.RAW_TRAFFIC_LOG);
  var rows = hetGetTopDataRows_(sh, 30, 12);
  var out = { wan: 0, e2: 0, e3: 0, e4: 0, e5: 0 };
  var latest;
  var oldest;

  function delta_(currentValue, previousValue) {
    var d = hetToNum_(currentValue, 0) - hetToNum_(previousValue, 0);
    return d > 0 ? d : 0;
  }

  if (!rows.length) return out;

  latest = rows[0];
  oldest = rows[rows.length - 1];

  out.wan = delta_(latest[6], oldest[6]);
  out.e2 = delta_(latest[10], oldest[10]);
  out.e3 = delta_(latest[14], oldest[14]);
  out.e4 = delta_(latest[18], oldest[18]);
  out.e5 = delta_(latest[22], oldest[22]);

  return out;
}

function HET_activeUsersSnapshot_(site, router) {
  var sh = HET.ss().getSheetByName(HET.SHEETS.CONNECTED_USERS);
  var rows = hetGetTopDataRows_(sh, 8, 400);
  var targetSite = hetSafeStr_(site, 40).toUpperCase();
  var targetRouter = hetSafeStr_(router, 80).toUpperCase();
  var maxAgeMin = hetToInt_(HET.cfg().USERS_SNAPSHOT_MAX_AGE_MIN, 45);
  var firstAt = null;
  var seen = {};
  var count = 0;

  if (!rows.length) return 0;

  rows.forEach(function(r) {
    var stamp = r[0] instanceof Date ? r[0].getTime() : null;
    var rowSite = hetSafeStr_(r[1], 40).toUpperCase();
    var rowRouter = hetSafeStr_(r[2], 80).toUpperCase();
    if (stamp === null) return;
    if (targetSite && rowSite !== targetSite) return;
    if (targetRouter && rowRouter !== targetRouter) return;
    if (firstAt === null || stamp > firstAt) firstAt = stamp;
  });

  if (firstAt === null) return 0;
  if ((Date.now() - firstAt) > (maxAgeMin * 60000)) return 0;

  rows.forEach(function(r) {
    var stamp = r[0] instanceof Date ? r[0].getTime() : null;
    var rowSite = hetSafeStr_(r[1], 40).toUpperCase();
    var rowRouter = hetSafeStr_(r[2], 80).toUpperCase();
    var ip;
    if (targetSite && rowSite !== targetSite) return;
    if (targetRouter && rowRouter !== targetRouter) return;
    if (firstAt !== null && stamp !== null && Math.abs(stamp - firstAt) > 60000) return;
    ip = hetSafeStr_(r[3], 40) || ('row-' + count);
    if (seen[ip]) return;
    seen[ip] = true;
    count++;
  });
  return count;
}

// LAYER 2 — Real Live Users metric (disabled until het_PUSH_LIVE_USERS is deployed on router).
// Enable by setting LIVE_USERS_ENABLE=YES in Script Properties.
// Formula: PPP active + Hotspot active + Unique LAN ARP clients (exclude WAN/local MACs, deduped).
function HET_liveUsersSnapshot_(site, router) {
  if (!hetIsYes_(HET.cfg().LIVE_USERS_ENABLE)) return null;
  var sh = HET.ss().getSheetByName(HET.SHEETS.LIVE_USERS);
  if (!sh || sh.getLastRow() < 2) return null;
  var targetSite = hetSafeStr_(site, 40).toUpperCase();
  var targetRouter = hetSafeStr_(router, 80).toUpperCase();
  var maxAgeMin = hetToInt_(HET.cfg().LIVE_USERS_MAX_AGE_MIN, 15);
  var rows = hetGetTopDataRows_(sh, 8, 20);
  var row = null;
  rows.forEach(function(r) {
    if (row) return;
    if (targetSite && hetSafeStr_(r[1], 40).toUpperCase() !== targetSite) return;
    if (targetRouter && hetSafeStr_(r[2], 80).toUpperCase() !== targetRouter) return;
    row = r;
  });
  if (!row) return null;
  var stamp = row[0] instanceof Date ? row[0].getTime() : null;
  if (!stamp || (Date.now() - stamp) > (maxAgeMin * 60000)) return null;
  return {
    ppp:     hetToInt_(row[3], 0),
    hotspot: hetToInt_(row[4], 0),
    arpLan:  hetToInt_(row[5], 0),
    total:   hetToInt_(row[6], 0),
    entries: hetSafeStr_(row[7], 10000),
    ageMin:  ((Date.now() - stamp) / 60000).toFixed(1)
  };
}

function HET_alertSnapshot_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.ALERTS);
  var rows = hetGetTopDataRows_(sh, 7, 200);
  var limitMs = hetToInt_(HET.cfg().RECENT_WINDOW_HOURS, 24) * 60 * 60 * 1000;
  var nowMs = Date.now();
  var out = { critical: 0, high: 0, medium: 0, recent: [] };
  var recentPool = [];

  function sevRank_(sev) {
    if (sev === 'CRITICAL') return 1;
    if (sev === 'HIGH') return 2;
    if (sev === 'MEDIUM') return 3;
    return 4;
  }

  rows.forEach(function(r) {
    var sev = String(r[1] || '').toUpperCase();
    var when = r[0] instanceof Date ? r[0] : null;
    var ageMin = when ? Math.floor((nowMs - when.getTime()) / 60000) : null;
    if (when && (nowMs - when.getTime()) <= limitMs) {
      if (sev === 'CRITICAL') out.critical++;
      if (sev === 'HIGH') out.high++;
      if (sev === 'MEDIUM') out.medium++;
    }
    recentPool.push({
      time: when ? hetFmt_(when) : 'n/a',
      severity: sev || 'INFO',
      type: hetSafeStr_(r[4], 50),
      router: hetSafeStr_(r[3], 80),
      message: hetSafeStr_(r[5], 250),
      ageMin: ageMin,
      severityRank: sevRank_(sev)
    });
  });

  recentPool.sort(function(a, b) {
    if (a.ageMin === null && b.ageMin === null) return 0;
    if (a.ageMin === null) return 1;
    if (b.ageMin === null) return -1;
    if (a.ageMin !== b.ageMin) return a.ageMin - b.ageMin;
    return a.severityRank - b.severityRank;
  });

  out.recent = recentPool.slice(0, hetToInt_(HET.cfg().DASHBOARD_ALERT_ROWS, 5));

  return out;
}

function HET_recentCommandSnapshot_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.COMMAND_CENTER);
  var rows = hetGetTopDataRows_(sh, 10, 5);
  var out = [];

  rows.forEach(function(r) {
    out.push({
      time: r[0] instanceof Date ? hetFmt_(r[0]) : 'n/a',
      command: hetSafeStr_(r[2], 60),
      status: hetSafeStr_(r[5], 20) || 'UNKNOWN',
      target: hetSafeStr_(r[3], 120),
      result: hetSafeStr_(r[6], 220)
    });
  });

  return out;
}

function HET_recentRouterLogsSnapshot_(site, router, limit) {
  var sh = HET.ss().getSheetByName(HET.SHEETS.ROUTER_LOGS);
  var rows = hetGetTopDataRows_(sh, 7, Math.max(60, (limit || 20) * 4));
  var targetSite = hetSafeStr_(site, 40).toUpperCase();
  var targetRouter = hetSafeStr_(router, 80).toUpperCase();
  var out = [];

  function routerTimeText_(value) {
    if (value instanceof Date) {
      return Utilities.formatDate(value, HET.cfg().TZ, 'HH:mm:ss');
    }
    return hetSafeStr_(value, 40) || 'n/a';
  }

  rows.forEach(function(r) {
    var rowSite = hetSafeStr_(r[1], 40).toUpperCase();
    var rowRouter = hetSafeStr_(r[2], 80).toUpperCase();
    if (targetSite && rowSite && rowSite !== targetSite) return;
    if (targetRouter && rowRouter && rowRouter !== targetRouter) return;
    out.push({
      time: r[0] instanceof Date ? hetFmt_(r[0]) : 'n/a',
      logTime: routerTimeText_(r[3]),
      topics: hetSafeStr_(r[4], 150) || '-',
      severity: (hetSafeStr_(r[5], 20) || 'INFO').toUpperCase(),
      message: hetSafeStr_(r[6], 500) || '-'
    });
  });

  return out.slice(0, limit || 20);
}

function HET_latestTrafficSnapshot_() {
  var cfg = HET.cfg();
  var e2Label = hetSafeStr_(cfg.TRAFFIC_E2_NAME, 60) || 'Unity Shop';
  var e3Label = hetSafeStr_(cfg.TRAFFIC_E3_NAME, 60) || 'Store Site-2';
  var e4Label = hetSafeStr_(cfg.TRAFFIC_E4_NAME, 60) || 'Store Site-1';
  var e5Label = hetSafeStr_(cfg.TRAFFIC_E5_NAME, 60) || 'BUK Site';
  var sh = HET.ss().getSheetByName(HET.SHEETS.RAW_TRAFFIC_LOG);
  var row = hetGetLatestDataRow_(sh, 30);
  var delta = HET_recentTrafficDeltaSnapshot_();
  if (!row) {
    return {
      wanRunning: 'UNKNOWN',
      wanTotalText: 'n/a',
      wanDeltaText: '0',
      e2Label: e2Label,
      e3Label: e3Label,
      e4Label: e4Label,
      e5Label: e5Label,
      e2Text: 'n/a',
      e3Text: 'n/a',
      e4Text: 'n/a',
      e5Text: 'n/a',
      e2DeltaText: '0',
      e3DeltaText: '0',
      e4DeltaText: '0',
      e5DeltaText: '0',
      e2Running: 'UNKNOWN',
      e3Running: 'UNKNOWN',
      e4Running: 'UNKNOWN',
      e5Running: 'UNKNOWN',
      updatedAt: 'n/a'
    };
  }
  return {
    wanRunning: hetSafeStr_(row[7], 10) || 'UNKNOWN',
    wanTotalText: String(hetToNum_(row[6], 0).toFixed(0)),
    wanDeltaText: String(delta.wan.toFixed(0)),
    e2Label: e2Label,
    e3Label: e3Label,
    e4Label: e4Label,
    e5Label: e5Label,
    e2Text: String(hetToNum_(row[10], 0).toFixed(0)),
    e3Text: String(hetToNum_(row[14], 0).toFixed(0)),
    e4Text: String(hetToNum_(row[18], 0).toFixed(0)),
    e5Text: String(hetToNum_(row[22], 0).toFixed(0)),
    e2DeltaText: String(delta.e2.toFixed(0)),
    e3DeltaText: String(delta.e3.toFixed(0)),
    e4DeltaText: String(delta.e4.toFixed(0)),
    e5DeltaText: String(delta.e5.toFixed(0)),
    e2Running: (hetSafeStr_(row[11], 10) || 'UNKNOWN').toUpperCase(),
    e3Running: (hetSafeStr_(row[15], 10) || 'UNKNOWN').toUpperCase(),
    e4Running: (hetSafeStr_(row[19], 10) || 'UNKNOWN').toUpperCase(),
    e5Running: (hetSafeStr_(row[23], 10) || 'UNKNOWN').toUpperCase(),
    updatedAt: row[0] instanceof Date ? hetFmt_(row[0]) : 'n/a'
  };
}

function HET_recentRawTypeMap_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.RAW_LIVE);
  var rows = hetGetTopDataRows_(sh, 5, 500);
  var limitMs = hetToInt_(HET.cfg().RECENT_WINDOW_HOURS, 24) * 60 * 60 * 1000;
  var nowMs = Date.now();
  var map = {};

  rows.forEach(function(r) {
    var when = r[0] instanceof Date ? r[0] : null;
    var t;
    if (!when || (nowMs - when.getTime()) > limitMs) return;
    t = String(r[1] || '').toLowerCase();
    if (!t) return;
    map[t] = (map[t] || 0) + 1;
  });

  return map;
}

function HET_mobileVpnSnapshot_() {
  var ss = HET.ss();
  var sumRow = hetGetLatestDataRow_(ss.getSheetByName(HET.SHEETS.MOBILE_VPN_SUMMARY), 21);
  var activeRows = hetGetTopDataRows_(ss.getSheetByName(HET.SHEETS.MOBILE_VPN_ACTIVE), 9, 30);
  var connectedUsers = [];
  var assignedIps = [];
  var sourceIps = [];

  activeRows.forEach(function(r) {
    var u = hetSafeStr_(r[4], 60);
    var vip = hetSafeStr_(r[5], 40);
    var sip = hetSafeStr_(r[6], 60);
    if (u) connectedUsers.push(u);
    if (vip) assignedIps.push(vip);
    if (sip) sourceIps.push(sip);
  });

  if (!sumRow) {
    return {
      site: HET.cfg().MOBILE_VPN_SITE || HET.cfg().SITE_DEFAULT,
      service: HET.cfg().MOBILE_VPN_SERVICE || 'Mobile VPN',
      vpnType: HET.cfg().MOBILE_VPN_TYPE || 'L2TP/IPsec',
      status: 'UNKNOWN',
      l2tpServer: 'UNKNOWN',
      health: 'UNKNOWN',
      activeCount: 0,
      connectedUsers: connectedUsers,
      assignedIps: assignedIps,
      sourceIps: sourceIps,
      lastEvent: 'none',
      lastConnectionTime: 'n/a',
      failedToday: 0,
      totalConnectsToday: 0,
      totalDisconnectsToday: 0,
      lastConnectedUser: '-',
      lastDisconnectedUser: '-',
      pool: (HET.cfg().MOBILE_VPN_POOL_START || '') + '-' + (HET.cfg().MOBILE_VPN_POOL_END || ''),
      poolUsage: '0',
      notes: 'No Mobile VPN summary yet.'
    };
  }

  return {
    site: hetSafeStr_(sumRow[1], 40),
    service: hetSafeStr_(sumRow[2], 60),
    vpnType: hetSafeStr_(sumRow[3], 40),
    status: (hetSafeStr_(sumRow[4], 20) || 'UNKNOWN').toUpperCase(),
    l2tpServer: (hetSafeStr_(sumRow[5], 20) || 'UNKNOWN').toUpperCase(),
    health: (hetSafeStr_(sumRow[6], 20) || 'UNKNOWN').toUpperCase(),
    activeCount: hetToInt_(sumRow[7], 0),
    connectedUsers: connectedUsers.length ? connectedUsers : String(sumRow[8] || '').split(',').map(function(x) { return String(x).trim(); }).filter(function(x) { return !!x && x !== '-'; }),
    assignedIps: assignedIps.length ? assignedIps : String(sumRow[9] || '').split(',').map(function(x) { return String(x).trim(); }).filter(function(x) { return !!x && x !== '-'; }),
    sourceIps: sourceIps.length ? sourceIps : String(sumRow[10] || '').split(',').map(function(x) { return String(x).trim(); }).filter(function(x) { return !!x && x !== '-'; }),
    lastEvent: hetSafeStr_(sumRow[11], 120) || 'none',
    lastConnectionTime: hetSafeStr_(sumRow[12], 40) || 'n/a',
    failedToday: hetToInt_(sumRow[13], 0),
    totalConnectsToday: hetToInt_(sumRow[14], 0),
    totalDisconnectsToday: hetToInt_(sumRow[15], 0),
    lastConnectedUser: hetSafeStr_(sumRow[16], 60) || '-',
    lastDisconnectedUser: hetSafeStr_(sumRow[17], 60) || '-',
    pool: hetSafeStr_(sumRow[18], 60),
    poolUsage: hetSafeStr_(sumRow[19], 30),
    notes: hetSafeStr_(sumRow[20], 200)
  };
}

function HET_sheetPolicies_() {
  var cfg = HET.cfg();
  var policies = {};

  policies[HET.SHEETS.ROUTER_STATUS] = { className: 'REALTIME', warnMin: Math.max(1, hetToInt_(cfg.STALE_WARN, 15)), critMin: Math.max(1, hetToInt_(cfg.STALE_CRIT, 25)), payloadType: 'live', affectsBanner: true };
  policies[HET.SHEETS.RAW_TRAFFIC_LOG] = { className: 'REALTIME', warnMin: Math.max(1, hetToInt_(cfg.TRAFFIC_STALE_WARN, 8)), critMin: Math.max(1, hetToInt_(cfg.TRAFFIC_STALE_CRIT, 20)), payloadType: 'traffic', affectsBanner: true };
  policies[HET.SHEETS.VPN_STATUS] = { className: 'REALTIME', warnMin: Math.max(1, hetToInt_(cfg.STALE_CRIT, 25)), critMin: Math.max(1, hetToInt_(cfg.STALE_CRIT, 25)) + 15, payloadType: 'vpn', affectsBanner: true };
  policies[HET.SHEETS.CONNECTED_USERS] = { className: 'PERIODIC', warnMin: Math.max(1, hetToInt_(cfg.USERS_SNAPSHOT_MAX_AGE_MIN, 45)), critMin: Math.max(1, hetToInt_(cfg.USERS_SNAPSHOT_MAX_AGE_MIN, 45)) * 2, payloadType: 'users', affectsBanner: false };
  policies[HET.SHEETS.LIVE_USERS] = { className: 'REALTIME', warnMin: Math.max(1, hetToInt_(cfg.LIVE_USERS_MAX_AGE_MIN, 15)), critMin: Math.max(1, hetToInt_(cfg.LIVE_USERS_MAX_AGE_MIN, 15)) + 10, payloadType: 'live_users', affectsBanner: false };
  policies[HET.SHEETS.MOBILE_VPN_EVENTS] = { className: 'REALTIME', warnMin: 20, critMin: 40, payloadType: 'mobile_vpn', affectsBanner: true };
  policies[HET.SHEETS.MOBILE_VPN_ACTIVE] = { className: 'REALTIME', warnMin: 20, critMin: 40, payloadType: 'mobile_vpn', affectsBanner: false };
  policies[HET.SHEETS.MOBILE_VPN_SUMMARY] = { className: 'REALTIME', warnMin: 20, critMin: 40, payloadType: 'mobile_vpn', affectsBanner: true };
  policies[HET.SHEETS.USER_DATA_USAGE] = { className: 'PERIODIC', warnMin: 90, critMin: 180, payloadType: 'usage', affectsBanner: false };
  policies[HET.SHEETS.ROUTER_CHANGES] = { className: 'PERIODIC', warnMin: 180, critMin: 720, payloadType: 'change', affectsBanner: false };
  policies[HET.SHEETS.ALERTS] = { className: 'EVENT_DRIVEN', affectsBanner: false };
  policies[HET.SHEETS.ROUTER_LOGS] = { className: 'EVENT_DRIVEN', affectsBanner: false };
  policies[HET.SHEETS.RDP_LOGS] = { className: 'EVENT_DRIVEN', affectsBanner: false };
  policies[HET.SHEETS.DAILY_REPORTS] = { className: 'DAILY', affectsBanner: false };
  policies[HET.SHEETS.SMART_SUMMARY_LOG] = { className: 'OPTIONAL', affectsBanner: false };
  policies[HET.SHEETS.COMMAND_CENTER] = { className: 'OPTIONAL', affectsBanner: false };
  policies[HET.SHEETS.OUTBOX] = { className: 'OPTIONAL', affectsBanner: false };
  policies[HET.SHEETS.RAW_LIVE] = { className: 'MANUAL', affectsBanner: false };
  policies[HET.SHEETS.RAW_EVENTS] = { className: 'MANUAL', affectsBanner: false };

  return policies;
}

function HET_sheetActivityRows_(rawTypeMap) {
  var ss = HET.ss();
  var names = Object.keys(HET.SHEETS).map(function(key) { return HET.SHEETS[key]; });
  var nowMs = Date.now();
  var rows = [];
  var policies = HET_sheetPolicies_();

  names.forEach(function(name) {
    var sh;
    var policy = policies[name] || { className: 'MANUAL', affectsBanner: false };
    var lastDataAt = null;
    var ageMin = 'n/a';
    var status = 'NO_DATA';
    var notes = 'No data rows yet.';
    var dataRows = 0;
    var ageNum = null;
    var todayKey;
    var lastKey;

    if (name === HET.SHEETS.DASHBOARD || name === HET.SHEETS.SHEET_HEALTH || name === HET.SHEETS.INTERFACE_TRAFFIC) return;
    sh = ss.getSheetByName(name);
    if (!sh) {
      rows.push({ sheet: name, className: policy.className, lastDataTime: 'missing', ageMin: 'n/a', dataRows: 0, status: 'MISSING', notes: 'Sheet does not exist.', affectsBanner: !!policy.affectsBanner });
      return;
    }

    dataRows = Math.max(0, sh.getLastRow() - 1);
    if (dataRows > 0) {
      lastDataAt = sh.getRange(2, 1).getValue();
      if (lastDataAt instanceof Date) {
        ageNum = (nowMs - lastDataAt.getTime()) / 60000;
        ageMin = ageNum.toFixed(1);

        if (policy.className === 'REALTIME' || policy.className === 'PERIODIC') {
          if (ageNum <= policy.warnMin) {
            status = 'FRESH';
            notes = 'Within expected ' + policy.className.toLowerCase() + ' freshness window.';
          } else if (ageNum <= policy.critMin) {
            status = 'WARN';
            notes = 'Beyond warning window for ' + policy.className.toLowerCase() + ' sheet.';
          } else {
            status = 'CRIT';
            notes = 'Beyond critical freshness window for ' + policy.className.toLowerCase() + ' sheet.';
          }
        } else if (policy.className === 'EVENT_DRIVEN') {
          status = 'EVENT_DRIVEN';
          notes = 'Event-driven sheet. Older last-write times are normal when no new events occur.';
        } else if (policy.className === 'DAILY') {
          todayKey = Utilities.formatDate(new Date(), HET.cfg().TZ, 'yyyy-MM-dd');
          lastKey = Utilities.formatDate(lastDataAt, HET.cfg().TZ, 'yyyy-MM-dd');
          if (todayKey === lastKey) {
            status = 'TODAY';
            notes = 'Daily job completed for today.';
          } else {
            var parts = String(HET.cfg().DAILY_REPORT_TIME || '11:59').split(':');
            var dueHour = parseInt(parts[0], 10);
            var dueMinute = parseInt(parts[1], 10);
            var nowLocal = new Date();
            var nowHour = parseInt(Utilities.formatDate(nowLocal, HET.cfg().TZ, 'H'), 10);
            var nowMinute = parseInt(Utilities.formatDate(nowLocal, HET.cfg().TZ, 'm'), 10);
            var nowTotal = nowHour * 60 + nowMinute;
            var dueTotal = dueHour * 60 + dueMinute;
            if (nowTotal < dueTotal) {
              status = 'PENDING';
              notes = 'Daily report window not reached yet (' + HET.cfg().DAILY_REPORT_TIME + ').';
            } else {
              status = 'MISSED';
              notes = 'Daily report window passed and no row exists for today.';
            }
          }
        } else if (policy.className === 'OPTIONAL') {
          status = 'OPTIONAL';
          notes = 'Optional service sheet. Staleness is advisory only.';
        } else {
          status = 'INFO';
          notes = 'Derived or manual sheet.';
        }
      } else {
        lastDataAt = null;
        status = 'NO_TIME';
        notes = 'Top row has no datetime value in column A.';
      }
    }

    if (dataRows === 0 && policy.payloadType) {
      if (!rawTypeMap[policy.payloadType]) {
        status = 'NOT_SENT';
        notes = 'No recent payload with type=' + policy.payloadType + ' received.';
      } else {
        status = 'NO_DATA';
        notes = 'Payload type=' + policy.payloadType + ' exists, but no rows were written.';
      }
    }

    if (dataRows > 0 && policy.payloadType && !rawTypeMap[policy.payloadType] && (policy.className === 'REALTIME' || policy.className === 'PERIODIC')) {
      notes = 'Historical rows exist, but no recent type=' + policy.payloadType + ' payload.';
    }

    rows.push({
      sheet: name,
      className: policy.className,
      lastDataTime: lastDataAt ? hetFmt_(lastDataAt) : 'n/a',
      ageMin: ageMin,
      dataRows: dataRows,
      status: status,
      notes: notes,
      affectsBanner: !!policy.affectsBanner
    });
  });

  return rows;
}

function HET_refreshSheetHealth_(sheetRows) {
  var sh = hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.SHEET_HEALTH);
  var rows = (sheetRows || []).map(function(item) {
    return [
      hetNowDate_(),
      item.sheet,
      item.lastDataTime,
      item.ageMin,
      item.dataRows,
      item.status,
      item.notes
    ];
  });

  sh.clearContents();
  hetEnsureHeader_(sh, HET.HEADERS[HET.SHEETS.SHEET_HEALTH]);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 7).setValues(rows);
    sh.getRange(2, 1, rows.length, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
    sh.getRange(2, 1, rows.length, 7).setWrap(true).setVerticalAlignment('top');
  }
}

function HET_collectSnapshot_() {
  var ss = HET.ss();
  var now = hetNowDate_();
  var liveRow = hetGetLatestDataRow_(ss.getSheetByName(HET.SHEETS.ROUTER_STATUS), 11);
  var vpnRow = hetGetLatestDataRow_(ss.getSheetByName(HET.SHEETS.VPN_STATUS), 7);
  var liveState = HET_effectiveLiveState_(liveRow);
  var mobileVpn = HET_mobileVpnSnapshot_();
  var alerts = HET_alertSnapshot_();
  var topUsage = HET_topUsageSummary_();
  var traffic = HET_latestTrafficSnapshot_();
  var rawTypeMap = HET_recentRawTypeMap_();

  return {
    title: HET.cfg().NOC_TITLE || 'het',
    subtitle: 'operations dashboard / daily summary',
    site: liveRow ? hetSafeStr_(liveRow[1], 40) : HET.cfg().SITE_DEFAULT,
    router: liveRow ? hetSafeStr_(liveRow[2], 80) : 'UNKNOWN',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(String(HET.cfg().SS_ID || '').trim()),
    updatedAt: hetFmt_(now),
    dateText: hetFmtDate_(now),
    timeText: hetFmtTime_(now),
    live: {
      status: liveState.effectiveStatus,
      rawStatus: liveState.rawStatus,
      message: liveState.effectiveMessage,
      cpu: liveRow ? hetToInt_(liveRow[5], 0) : 0,
      memory: liveRow ? hetToInt_(liveRow[6], 0) : 0,
      uptime: liveRow ? hetSafeStr_(liveRow[7], 80) : 'n/a',
      publicIp: liveRow ? hetSafeStr_(liveRow[8], 80) : 'n/a',
      ipsec: liveRow ? (hetSafeStr_(liveRow[9], 20) || 'UNKNOWN').toUpperCase() : 'UNKNOWN',
      isp: liveRow ? hetSafeStr_(liveRow[10], 30) : 'n/a',
      lastSeen: liveState.lastSeenText,
      freshness: liveState.freshness,
      updatedAt: liveRow && liveRow[0] instanceof Date ? hetFmt_(liveRow[0]) : 'n/a'
    },
    vpn: {
      status: vpnRow ? (hetSafeStr_(vpnRow[4], 20) || 'UNKNOWN').toUpperCase() : 'UNKNOWN',
      host: vpnRow ? hetSafeStr_(vpnRow[3], 120) : 'n/a',
      ping: vpnRow ? hetSafeStr_(vpnRow[5], 20) : 'n/a',
      message: vpnRow ? hetSafeStr_(vpnRow[6], 250) : 'No VPN check recorded yet.'
    },
    mobileVpn: mobileVpn,
    users: {
      active: HET_activeUsersSnapshot_(liveRow ? liveRow[1] : '', liveRow ? liveRow[2] : ''),
      live: HET_liveUsersSnapshot_(liveRow ? liveRow[1] : '', liveRow ? liveRow[2] : '')
    },
    alerts: alerts,
    activeIncidents: typeof HET_activeIncidentSnapshot_ === 'function' ? HET_activeIncidentSnapshot_() : { total: 0, critical: 0, high: 0, medium: 0, items: [] },
    traffic: traffic,
    routerLogs: HET_recentRouterLogsSnapshot_(liveRow ? liveRow[1] : '', liveRow ? liveRow[2] : '', 20),
    sheetHealth: HET_sheetActivityRows_(rawTypeMap),
    topUsage: topUsage,
    smartSummary: typeof HET_latestSmartSummary_ === 'function' ? HET_latestSmartSummary_() : { status: 'IDLE', summary: 'Smart summary is not available yet.', updatedAt: 'n/a' },
    commandsPending: typeof HET_pendingCommandCount_ === 'function' ? HET_pendingCommandCount_() : 0,
    recentCommands: HET_recentCommandSnapshot_(),
    runtimeHealth: typeof HET_getRuntimeHealth_ === 'function' ? HET_getRuntimeHealth_() : { overall: 'UNKNOWN', cycles: [] }
  };
}

function HET_liveUsersText_(liveUsers) {
  if (!liveUsers) return 'Disabled';
  return String(hetToInt_(liveUsers.total, 0)) + ' (age ' + liveUsers.ageMin + 'm)';
}

function HET_dashboardStateColor_(value) {
  var v = String(value || '').toUpperCase();
  if (v === 'ONLINE' || v === 'UP' || v === 'WORKING') return '#d9ead3';
  if (v === 'DOWN' || v === 'CRITICAL' || v === 'NO DATA') return '#f4cccc';
  if (v === 'WARN' || v === 'WARNING' || v === 'HIGH') return '#fce5cd';
  return '#dce6f1';
}

function HET_formatBytes_(value) {
  var n = hetToNum_(value, 0);
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n.toFixed(0) + ' B';
}

function HET_sheetStatusColor_(status) {
  var s = String(status || '').toUpperCase();
  if (s === 'FRESH') return '#2e7d32';
  if (s === 'OLD') return '#f57c00';
  if (s === 'STALE') return '#c62828';
  if (s === 'NOT_SENT' || s === 'NO_DATA' || s === 'MISSING') return '#6b7280';
  return '#455a64';
}

function HET_severityColor_(severity) {
  var s = String(severity || '').toUpperCase();
  if (s === 'CRITICAL') return '#c62828';
  if (s === 'HIGH') return '#ef6c00';
  if (s === 'MEDIUM') return '#f9a825';
  return '#607d8b';
}

function HET_sheetHealthCounts_(sheetRows) {
  var counts = { fresh: 0, warning: 0, stale: 0, total: 0 };

  (sheetRows || []).forEach(function(r) {
    var s = String(r.status || '').toUpperCase();
    if (!r.affectsBanner) return;
    counts.total++;
    if (s === 'FRESH') {
      counts.fresh++;
    } else if (s === 'WARN') {
      counts.warning++;
    } else {
      counts.stale++;
    }
  });
  return counts;
}

function HET_dashRefresh() {
  var ss = HET.ss();
  var dash = hetGetOrCreateSheet_(ss, HET.SHEETS.DASHBOARD);
  var snap = HET_collectSnapshot_();
  var cmdRows = snap.recentCommands.length ? snap.recentCommands : [{ time: 'n/a', command: 'NO_COMMANDS', status: 'IDLE', target: '-', result: 'No recent rows in Command Center.' }];
  var sheetRows = snap.sheetHealth.length ? snap.sheetHealth : [{ sheet: 'n/a', lastDataTime: 'n/a', ageMin: 'n/a', dataRows: 0, status: 'NO_DATA', notes: 'No sheet status available.' }];
  var alertRows = snap.alerts.recent.length ? snap.alerts.recent : [{ time: 'n/a', severity: 'INFO', type: 'NO_ALERTS', router: snap.router, message: 'No recent alerts recorded.', ageMin: null }];
  var usageRows = snap.topUsage.length ? snap.topUsage : [];
  var counts = HET_sheetHealthCounts_(sheetRows);
  var overall = 'HEALTHY';
  var overallColor = '#2e7d32';
  var dayNum = parseInt(Utilities.formatDate(new Date(), HET.cfg().TZ, 'u'), 10);
  var isSunday = dayNum === 7;
  var trafficSites;
  var trafficTotal;
  var trafficMax;
  var USED_ROWS = 41;
  var USED_COLS = 24;
  var r;
  var criticalAlerts;

  function activityText_(site) {
    var recentBytes = hetToNum_(site && site.recentBytes, 0);
    var running = String(site && site.running || 'UNKNOWN').toUpperCase();
    if (site && site.isWan) return 'Backbone';
    if (running === 'DOWN') return recentBytes > 0 ? 'Link down (was active)' : 'Not connected';
    if (running === 'DISABLED') return 'Disabled';
    if (recentBytes > 0) return 'Active';
    if (isSunday) return 'Closed / No activity';
    if (running === 'UP') return 'No recent traffic';
    return 'Idle';
  }

  function activityStyle_(activity) {
    var a = String(activity || '').toLowerCase();
    if (a === 'active' || a === 'backbone') return { bg: '#dcfce7', fg: '#166534' };
    if (a === 'no recent traffic' || a === 'idle') return { bg: '#f1f5f9', fg: '#475569' };
    if (a === 'closed / no activity') return { bg: '#f8fafc', fg: '#64748b' };
    if (a === 'not connected' || a === 'disabled' || a === 'link down' || a === 'link down (was active)') return { bg: '#ffedd5', fg: '#9a3412' };
    return { bg: '#f1f5f9', fg: '#475569' };
  }

  function textBar_(value, maxValue) {
    var slots = 14;
    var filled = 0;
    if (maxValue > 0) {
      filled = Math.max(0, Math.min(slots, Math.round((value * slots) / maxValue)));
    }
    return '[' + Array(filled + 1).join('=') + Array((slots - filled) + 1).join('.') + ']';
  }

  function statusBadge_(status) {
    var s = String(status || '').toUpperCase();
    if (s === 'FRESH') return 'fresh';
    if (s === 'WARN') return 'warn';
    if (s === 'CRIT') return 'critical';
    if (s === 'TODAY') return 'today';
    if (s === 'PENDING') return 'pending';
    if (s === 'MISSED') return 'missed';
    if (s === 'OPTIONAL') return 'optional';
    if (s === 'EVENT_DRIVEN') return 'event-driven';
    if (s === 'NOT_SENT' || s === 'NO_DATA' || s === 'MISSING') return 'not received';
    return s.toLowerCase();
  }

  function statusColorByText_(label) {
    var t = String(label || '').toLowerCase();
    if (t === 'fresh') return '#2e7d32';
    if (t === 'warn' || t === 'today') return '#ef6c00';
    if (t === 'pending') return '#0284c7';
    if (t === 'critical' || t === 'missed') return '#c62828';
    if (t === 'event-driven' || t === 'daily' || t === 'optional') return '#455a64';
    if (t === 'today') return '#2e7d32';
    if (t === 'not run') return '#c62828';
    if (t === 'no alerts') return '#2e7d32';
    if (t === 'not received') return '#6b7280';
    return '#607d8b';
  }

  function pipelineBadge_(name, state) {
    return statusBadge_(state && state.status);
  }

  function pipelineNotes_(name, state) {
    return String((state && state.notes) || '');
  }

  function findSheetHealth_(name) {
    var i;
    for (i = 0; i < sheetRows.length; i++) {
      if (String(sheetRows[i].sheet) === name) return sheetRows[i];
    }
    return { status: 'NO_DATA', ageMin: 'n/a' };
  }

  function setCardStyle_(r1, c1, r2, c2, bandColor) {
    dash.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1)
      .setBackground('#ffffff')
      .setBorder(true, true, true, true, false, false, '#d7dde5', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    dash.getRange(r1, c1, 1, c2 - c1 + 1).setBackground(bandColor || '#e2e8f0');
    // Shadow illusion for card depth.
    dash.getRange(r2, c1, 1, c2 - c1 + 1).setBorder(false, false, true, false, false, false, '#c5ced8', SpreadsheetApp.BorderStyle.SOLID_THICK);
    dash.getRange(r1, c2, r2 - r1 + 1, 1).setBorder(false, false, false, true, false, false, '#c5ced8', SpreadsheetApp.BorderStyle.SOLID_THICK);
  }

  function setPanelStyle_(r1, c1, r2, c2, headColor) {
    dash.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1)
      .setBackground('#ffffff')
      .setBorder(true, true, true, true, false, false, '#d7dde5', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    dash.getRange(r1, c1, 1, c2 - c1 + 1)
      .setBackground(headColor)
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }

  if (String(snap.live.status).toUpperCase() !== 'ONLINE' || String(snap.mobileVpn.status).toUpperCase() !== 'UP' || String(snap.traffic.wanRunning).toUpperCase() !== 'UP' || snap.activeIncidents.critical > 0 || counts.stale > 0) {
    overall = 'CRITICAL';
    overallColor = '#c62828';
  } else if (snap.activeIncidents.high > 0 || snap.activeIncidents.medium > 0 || counts.warning > 0) {
    overall = 'WARNING';
    overallColor = '#ef6c00';
  }

  trafficSites = [
    { label: 'ISP Internet', iface: 'ether1', bytes: hetToNum_(snap.traffic.wanDeltaText, 0), recentBytes: hetToNum_(snap.traffic.wanDeltaText, 0), running: String(snap.traffic.wanRunning || 'UNKNOWN').toUpperCase(), isWan: true },
    { label: snap.traffic.e2Label, iface: 'ether2', bytes: hetToNum_(snap.traffic.e2DeltaText, 0), recentBytes: hetToNum_(snap.traffic.e2DeltaText, 0), running: String(snap.traffic.e2Running || 'UNKNOWN').toUpperCase() },
    { label: snap.traffic.e3Label, iface: 'ether3', bytes: hetToNum_(snap.traffic.e3DeltaText, 0), recentBytes: hetToNum_(snap.traffic.e3DeltaText, 0), running: String(snap.traffic.e3Running || 'UNKNOWN').toUpperCase() },
    { label: snap.traffic.e4Label, iface: 'ether4', bytes: hetToNum_(snap.traffic.e4DeltaText, 0), recentBytes: hetToNum_(snap.traffic.e4DeltaText, 0), running: String(snap.traffic.e4Running || 'UNKNOWN').toUpperCase() },
    { label: snap.traffic.e5Label, iface: 'ether5', bytes: hetToNum_(snap.traffic.e5DeltaText, 0), recentBytes: hetToNum_(snap.traffic.e5DeltaText, 0), running: String(snap.traffic.e5Running || 'UNKNOWN').toUpperCase() }
  ];
  trafficTotal = trafficSites.slice(1).reduce(function(sum, item) { return sum + item.bytes; }, 0);
  trafficMax = trafficSites.reduce(function(m, x) { return Math.max(m, hetToNum_(x.bytes, 0)); }, 0);

  dash.getRange(1, 1, dash.getMaxRows(), dash.getMaxColumns()).breakApart();
  dash.clear();
  dash.clearFormats();
  dash.setHiddenGridlines(true);

  dash.getRange(1, 1, USED_ROWS, USED_COLS)
    .setFontFamily('Segoe UI')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setBackground('#f3f6fb')
    .setBorder(false, false, false, false, false, false);

  dash.setRowHeights(1, USED_ROWS, 22);
  dash.setRowHeight(1, 28);
  dash.setRowHeight(2, 28);
  dash.setRowHeight(3, 28);
  dash.setRowHeight(7, 24);
  dash.setRowHeight(8, 28);
  dash.setRowHeight(9, 24);
  dash.setRowHeight(10, 20);
  dash.setRowHeight(12, 26);
  dash.setRowHeight(24, 26);
  dash.setRowHeight(36, 24);
  dash.setRowHeight(41, 24);

  dash.setColumnWidths(1, USED_COLS, 54);

  dash.getRange('A1:X1').setBackground('#041e3a');
  dash.getRange('A2:X2').setBackground('#0b2f4a');
  dash.getRange('A3:X3').setBackground('#0f5132');

  dash.getRange('A1:C3').merge().setValue('het').setFontSize(24).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  dash.getRange('D1:J3').merge().setValue('Network Operations Dashboard').setFontSize(14).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('left');

  dash.getRange('K1:N3').merge().setValue('Site: ' + snap.site + '   v').setBackground('#115e59').setFontColor('#ecfeff').setHorizontalAlignment('left').setVerticalAlignment('middle').setBorder(true, true, true, true, false, false, '#2a7a74', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  dash.getRange('O1:R3').merge().setValue('Router: ' + snap.router + '   v').setBackground('#115e59').setFontColor('#ecfeff').setHorizontalAlignment('left').setVerticalAlignment('middle').setBorder(true, true, true, true, false, false, '#2a7a74', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  dash.getRange('S1:V3').merge().setValue('Last refresh time:\n' + snap.updatedAt).setBackground('#14532d').setFontColor('#eafff3').setWrap(true).setHorizontalAlignment('center');
  dash.getRange('W1:X3').merge().setValue('Healthy\n' + overall).setBackground(overallColor).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

  var kpiCards = [
    { t: 'Router Status', v: snap.live.status, m: 'Last seen ' + snap.live.lastSeen, c: HET_dashboardStateColor_(snap.live.status) },
    { t: 'Mobile VPN', v: snap.mobileVpn.status, m: 'Active ' + snap.mobileVpn.activeCount + ' | Failed ' + snap.mobileVpn.failedToday, c: HET_dashboardStateColor_(snap.mobileVpn.health || snap.mobileVpn.status) },
    { t: 'WAN Status', v: snap.traffic.wanRunning, m: 'Updated ' + snap.traffic.updatedAt, c: HET_dashboardStateColor_(snap.traffic.wanRunning) },
    { t: 'CPU Load', v: snap.live.cpu + '%', m: 'Target < 70%', c: snap.live.cpu >= 85 ? '#f4cccc' : (snap.live.cpu >= 70 ? '#fce5cd' : '#d9ead3') },
    { t: 'Memory Usage', v: snap.live.memory + '%', m: 'Target < 80%', c: snap.live.memory >= 90 ? '#f4cccc' : (snap.live.memory >= 80 ? '#fce5cd' : '#d9ead3') },
    { t: 'DHCP Users', v: String(snap.users.active), m: 'Latest DHCP snapshot', c: '#e2e8f0' },
    { t: 'Active Incidents', v: String(snap.activeIncidents.total), m: snap.activeIncidents.total > 0 ? 'Current open issues' : 'No open incidents', c: snap.activeIncidents.critical > 0 ? '#f4cccc' : (snap.activeIncidents.high > 0 ? '#fce5cd' : '#d9ead3') },
    { t: 'Public IP', v: snap.live.publicIp, m: 'ISP ' + snap.live.isp, c: '#e2e8f0' }
  ];

  for (r = 0; r < kpiCards.length; r++) {
    var cs = 1 + (r * 3);
    var ce = cs + 2;
    var card = kpiCards[r];
    setCardStyle_(5, cs, 10, ce, card.c);
    dash.getRange(6, cs, 1, 3).merge().setValue(card.t).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setBackground('#ffffff');
    dash.getRange(7, cs, 2, 3).merge().setValue(card.v).setFontWeight('bold').setFontSize(18).setHorizontalAlignment('center').setBackground('#ffffff');
    dash.getRange(9, cs, 2, 3).merge().setValue(card.m).setFontSize(8).setFontColor('#64748b').setHorizontalAlignment('center').setBackground('#ffffff').setWrap(true);
  }

  setPanelStyle_(12, 1, 22, 9, '#0f766e');
  setPanelStyle_(12, 10, 22, 16, '#155e75');
  setPanelStyle_(12, 17, 22, 24, '#7f1d1d');

  dash.getRange('A12:I12').merge().setValue('Traffic and Site Usage');
  dash.getRange('J12:P12').merge().setValue('Network Connectivity');
  dash.getRange('Q12:X12').merge().setValue('Alerts');

  for (r = 0; r < trafficSites.length; r++) {
    var tr = 13 + r;
    var site = trafficSites[r];
    var share = site.isWan ? '100%' : (trafficTotal > 0 ? ((site.bytes * 100) / trafficTotal).toFixed(1) + '%' : '0%');
    var activity = activityText_(site);
    var activityStyle = activityStyle_(activity);
    dash.getRange(tr, 1, 1, 2).merge().setValue(site.label).setBackground('#ffffff');
    dash.getRange(tr, 3).setValue(site.iface).setFontColor('#64748b').setBackground('#ffffff');
    dash.getRange(tr, 4, 1, 3).merge().setValue(textBar_(site.bytes, site.isWan ? site.bytes : trafficMax)).setFontFamily('Consolas').setBackground('#ffffff');
    dash.getRange(tr, 7).setValue(share).setHorizontalAlignment('right').setBackground('#ffffff');
    dash.getRange(tr, 8).setValue(HET_formatBytes_(site.bytes)).setHorizontalAlignment('right').setBackground('#ffffff');
    dash.getRange(tr, 9).setValue(activity).setBackground(activityStyle.bg).setFontColor(activityStyle.fg).setHorizontalAlignment('center');
  }

  var connRows = [
    ['WAN Running', snap.traffic.wanRunning],
    ['Mobile VPN', snap.mobileVpn.status + ' | ' + snap.mobileVpn.health],
    ['Live Users (Router)', HET_liveUsersText_(snap.users.live)],
    ['Mobile VPN Active', String(snap.mobileVpn.activeCount)],
    ['Last Seen', snap.live.lastSeen],
    ['Router Last Update', snap.live.updatedAt],
    ['Mobile VPN Last Event', snap.mobileVpn.lastEvent],
    ['ISP Information', snap.live.isp]
  ];

  for (r = 0; r < connRows.length; r++) {
    var cr = 13 + r;
    dash.getRange(cr, 10, 1, 3).merge().setValue(connRows[r][0]).setFontWeight('bold').setBackground('#ffffff');
    dash.getRange(cr, 13, 1, 4).merge().setValue(connRows[r][1]).setBackground('#ffffff');
  }

  dash.getRange('Q13:R13').merge().setValue('Active Open').setBackground('#fee2e2').setFontColor('#b91c1c').setFontWeight('bold').setHorizontalAlignment('center');
  dash.getRange('S13').setValue(snap.activeIncidents.total).setBackground('#fee2e2').setFontWeight('bold');
  dash.getRange('Q14:R14').merge().setValue('Critical 24h').setBackground('#fee2e2').setFontColor('#b91c1c').setFontWeight('bold').setHorizontalAlignment('center');
  dash.getRange('S14').setValue(snap.alerts.critical).setBackground('#fee2e2').setFontWeight('bold');
  dash.getRange('Q15:R15').merge().setValue('High 24h').setBackground('#ffedd5').setFontColor('#c2410c').setFontWeight('bold').setHorizontalAlignment('center');
  dash.getRange('S15').setValue(snap.alerts.high).setBackground('#ffedd5').setFontWeight('bold');
  dash.getRange('Q16:R16').merge().setValue('Medium 24h').setBackground('#fef9c3').setFontColor('#a16207').setFontWeight('bold').setHorizontalAlignment('center');
  dash.getRange('S16').setValue(snap.alerts.medium).setBackground('#fef9c3').setFontWeight('bold');

  criticalAlerts = alertRows.filter(function(a) { return String(a.severity || '').toUpperCase() === 'CRITICAL'; });
  var topAlerts = criticalAlerts.slice(0, 4);
  for (r = 0; r < 4; r++) {
    var ar = 17 + r;
    var a = topAlerts[r];
    if (!a) {
      dash.getRange(ar, 17, 1, 8).merge().setValue(r === 0 ? 'No critical incidents in latest feed.' : '').setBackground('#ffffff').setFontColor('#64748b');
      continue;
    }
    dash.getRange(ar, 17, 1, 2).merge().setValue(a.severity).setBackground(HET_severityColor_(a.severity)).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    dash.getRange(ar, 19, 1, 5).merge().setValue(a.type + ': ' + a.message).setBackground('#ffffff').setWrap(true);
    dash.getRange(ar, 24).setValue((typeof a.ageMin === 'number' ? (a.ageMin + 'm') : 'n/a')).setBackground('#ffffff').setFontColor('#64748b').setHorizontalAlignment('right');
    dash.getRange(ar, 17, 1, 8).setBorder(false, false, true, false, false, false, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);
  }

  setPanelStyle_(24, 1, 34, 16, '#3f6212');
  setPanelStyle_(24, 17, 34, 24, '#334155');
  dash.getRange('A24:P24').merge().setValue('Data Pipeline Health');
  dash.getRange('Q24:X24').merge().setValue('Top 10 Users Aaj');

  dash.getRange('A25:D25').merge().setValue('Fresh Pipelines: ' + counts.fresh).setBackground('#dcfce7').setFontWeight('bold');
  dash.getRange('E25:H25').merge().setValue('Warning Pipelines: ' + counts.warning).setBackground('#ffedd5').setFontWeight('bold');
  dash.getRange('I25:L25').merge().setValue('Stale Pipelines: ' + counts.stale).setBackground('#fee2e2').setFontWeight('bold');

  var pipeSystems = [
    { n: 'Router Status', s: findSheetHealth_(HET.SHEETS.ROUTER_STATUS) },
    { n: 'Traffic Logs', s: findSheetHealth_(HET.SHEETS.RAW_TRAFFIC_LOG) },
    { n: 'Mobile VPN Events', s: findSheetHealth_(HET.SHEETS.MOBILE_VPN_EVENTS) },
    { n: 'Alerts', s: findSheetHealth_(HET.SHEETS.ALERTS) },
    { n: 'Reports', s: findSheetHealth_(HET.SHEETS.DAILY_REPORTS) }
  ];

  for (r = 0; r < pipeSystems.length; r++) {
    var pr = 27 + r;
    var badge = pipelineBadge_(pipeSystems[r].n, pipeSystems[r].s);
    dash.getRange(pr, 1, 1, 4).merge().setValue(pipeSystems[r].n).setBackground('#ffffff');
    dash.getRange(pr, 5, 1, 3).merge().setValue(badge).setBackground(statusColorByText_(badge)).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    dash.getRange(pr, 8, 1, 3).merge().setValue('age ' + pipeSystems[r].s.ageMin + ' min').setBackground('#ffffff').setFontColor('#64748b');
    dash.getRange(pr, 11, 1, 6).merge().setValue(pipelineNotes_(pipeSystems[r].n, pipeSystems[r].s)).setBackground('#ffffff').setFontColor('#64748b').setWrap(true);
  }

  dash.getRange('Q25:R25').merge().setValue('IP').setBackground('#e2e8f0').setFontWeight('bold');
  dash.getRange('S25:T25').merge().setValue('MAC').setBackground('#e2e8f0').setFontWeight('bold');
  dash.getRange('U25:V25').merge().setValue('Device Naam').setBackground('#e2e8f0').setFontWeight('bold');
  dash.getRange('W25:X25').merge().setValue('Istemaal').setBackground('#e2e8f0').setFontWeight('bold').setHorizontalAlignment('center');

  if (!usageRows.length) {
    dash.getRange('Q26:X26').merge().setValue('Top 10: user usage abhi available nahi ya trusted rows receive nahi huin').setBackground('#ffffff').setFontColor('#64748b');
  } else {
    for (r = 0; r < Math.min(10, usageRows.length); r++) {
      var ur = 26 + r;
      var topItem = usageRows[r];
      var deviceName = topItem.preferredName || topItem.comment || topItem.hostname || 'unknown';
      dash.getRange(ur, 17, 1, 2).merge().setValue(topItem.ip || 'n/a').setBackground('#ffffff');
      dash.getRange(ur, 19, 1, 2).merge().setValue(topItem.mac || 'n/a').setBackground('#ffffff');
      dash.getRange(ur, 21, 1, 2).merge().setValue(deviceName).setBackground('#ffffff');
      dash.getRange(ur, 23, 1, 2).merge().setValue(HET_formatBytes_(topItem.total)).setBackground('#ffffff').setHorizontalAlignment('center');
    }
  }

  setPanelStyle_(36, 1, 40, 24, '#1e3a8a');
  dash.getRange('A36:X36').merge().setValue('Secondary Details (Smart Summary)');
  dash.getRange('A37:D37').merge().setValue('Core Health').setBackground('#dbeafe').setFontWeight('bold');
  dash.getRange('E37:X37').merge().setValue(snap.live.status + ' / Mobile VPN ' + snap.mobileVpn.status + ' / WAN ' + snap.traffic.wanRunning).setBackground('#ffffff');
  dash.getRange('A38:D38').merge().setValue('Incident State').setBackground('#dbeafe').setFontWeight('bold');
  dash.getRange('E38:X38').merge().setValue(snap.activeIncidents.total > 0 ? ('Open ' + snap.activeIncidents.total + ' | Critical ' + snap.activeIncidents.critical + ' | High ' + snap.activeIncidents.high + ' | Medium ' + snap.activeIncidents.medium) : 'No open incidents').setBackground('#ffffff');
  dash.getRange('A39:D39').merge().setValue('Optional Services').setBackground('#dbeafe').setFontWeight('bold');
  dash.getRange('E39:X39').merge().setValue('Smart Summary ' + snap.smartSummary.status + ' | Pending Commands ' + snap.commandsPending + ' | Top Users ' + (usageRows.length ? 'active' : 'abhi trusted data nahi')).setBackground('#ffffff').setWrap(true);
  dash.getRange('A40:D40').merge().setValue('Runtime Health').setBackground('#dbeafe').setFontWeight('bold');
  dash.getRange('E40:X40').merge().setValue('Runtime ' + snap.runtimeHealth.overall + ' | Trigger integrity ' + (snap.runtimeHealth.triggerIntegrity && snap.runtimeHealth.triggerIntegrity.ok ? 'OK' : 'CHECK REQUIRED') + ' | Smart Summary note: ' + hetSafeStr_(snap.smartSummary.summary, 120)).setBackground('#ffffff').setWrap(true);

  dash.getRange('A41:X41').merge().setBackground('#0b2f4a').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setValue(
    'Router: ' + snap.live.status + ' | Mobile VPN: ' + snap.mobileVpn.status + ' (' + snap.mobileVpn.activeCount + ' active) | WAN: ' + snap.traffic.wanRunning + ' | Active Incidents: ' + snap.activeIncidents.total + ' | 24h Alerts: C' + snap.alerts.critical + '/H' + snap.alerts.high + '/M' + snap.alerts.medium + ' | Realtime Pipelines: ' + counts.fresh + '/' + counts.total + ' healthy | Last Refresh: ' + snap.updatedAt
  );

  dash.getRange(1, 1, USED_ROWS, USED_COLS).setBorder(false, false, false, false, false, false);
  dash.getRange(1, 1, USED_ROWS, USED_COLS).setHorizontalAlignment('left');
  dash.getRange('A1:X3').setHorizontalAlignment('left');
  dash.getRange('W1:X3').setHorizontalAlignment('center');
  dash.setFrozenRows(4);

  HET_refreshSheetHealth_(sheetRows);
}

function HET_renderDashboardPage_() {
  var tpl = HtmlService.createTemplateFromFile('UI');
  tpl.model = HET_collectSnapshot_();
  return tpl.evaluate().setTitle(HET.cfg().NOC_TITLE || 'het');
}

