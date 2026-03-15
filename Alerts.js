function HET_alertStateKey_(site, router, type) {
  return 'ALERT_STATE|' + site + '|' + router + '|' + type;
}

function HET_incidentFamilyForType_(type) {
  var t = String(type || '').toUpperCase();
  if (t === 'ROUTER_DOWN') return 'ROUTER_AVAILABILITY';
  if (t === 'STALE_WARN' || t === 'STALE_CRIT') return 'LIVE_FRESHNESS';
  if (t === 'TRAFFIC_STALE_WARN' || t === 'TRAFFIC_STALE_CRIT') return 'TRAFFIC_FRESHNESS';
  if (t === 'VPN_DOWN' || t === 'IPSEC_DOWN') return 'VPN_CONNECTIVITY';
  if (t === 'MOBILE_VPN_DOWN' || t === 'MOBILE_VPN_UP') return 'MOBILE_VPN_SERVICE';
  if (t === 'MOBILE_VPN_FAIL_SPIKE') return 'MOBILE_VPN_AUTH';
  if (t === 'CPU_WARN' || t === 'CPU_CRIT') return 'CPU_PRESSURE';
  if (t === 'MEM_WARN' || t === 'MEM_CRIT') return 'MEMORY_PRESSURE';
  return '';
}

function HET_incidentStateKey_(site, router, family) {
  return 'INCIDENT_STATE|' + site + '|' + router + '|' + family;
}

function HET_incidentTypesForFamily_(family) {
  var f = String(family || '').toUpperCase();
  if (f === 'ROUTER_AVAILABILITY') return ['ROUTER_DOWN'];
  if (f === 'LIVE_FRESHNESS') return ['STALE_WARN', 'STALE_CRIT'];
  if (f === 'TRAFFIC_FRESHNESS') return ['TRAFFIC_STALE_WARN', 'TRAFFIC_STALE_CRIT'];
  if (f === 'VPN_CONNECTIVITY') return ['VPN_DOWN', 'IPSEC_DOWN'];
  if (f === 'MOBILE_VPN_SERVICE') return ['MOBILE_VPN_DOWN', 'MOBILE_VPN_UP'];
  if (f === 'MOBILE_VPN_AUTH') return ['MOBILE_VPN_FAIL_SPIKE'];
  if (f === 'CPU_PRESSURE') return ['CPU_WARN', 'CPU_CRIT'];
  if (f === 'MEMORY_PRESSURE') return ['MEM_WARN', 'MEM_CRIT'];
  return [];
}

function HET_resetAlertStateForFamily_(site, router, family) {
  var props = HET.props();
  HET_incidentTypesForFamily_(family).forEach(function(type) {
    var stateKey = HET_alertStateKey_(site, router, type);
    props.deleteProperty(stateKey);
    props.deleteProperty(stateKey + '|TS');
  });
}

function HET_getIncidentState_(site, router, family) {
  var raw = HET.props().getProperty(HET_incidentStateKey_(site, router, family)) || '';
  return hetSafeJsonParse_(raw, null);
}

function HET_putIncidentState_(site, router, family, state) {
  HET.props().setProperty(HET_incidentStateKey_(site, router, family), JSON.stringify(state || {}));
}

function HET_setIncidentOpen_(severity, site, router, type, message, meta) {
  var family = HET_incidentFamilyForType_(type);
  var nowMs;
  var prev;
  var state;

  if (!family) return;

  nowMs = Date.now();
  prev = HET_getIncidentState_(site, router, family);
  state = {
    family: family,
    site: site,
    router: router,
    open: true,
    lifecycle: prev && prev.open ? 'ACTIVE' : 'OPEN',
    severity: String(severity || 'MEDIUM').toUpperCase(),
    type: String(type || '').toUpperCase(),
    message: hetSafeStr_(message, 250),
    meta: hetSafeStr_(meta, 500),
    openedAtMs: prev && prev.openedAtMs ? prev.openedAtMs : nowMs,
    updatedAtMs: nowMs,
    recoveredAtMs: 0
  };

  HET_putIncidentState_(site, router, family, state);
}

function HET_recoverIncidentFamily_(site, router, family, recoverType, message, meta) {
  var prev = HET_getIncidentState_(site, router, family);
  var nowMs;

  if (!prev || !prev.open) return;

  HET_logAlert_('INFO', site, router, recoverType, message, meta || ('Recovered family=' + family));

  nowMs = Date.now();
  prev.open = false;
  prev.lifecycle = 'RECOVERED';
  prev.updatedAtMs = nowMs;
  prev.recoveredAtMs = nowMs;
  prev.recoveryType = String(recoverType || '').toUpperCase();
  prev.recoveryMessage = hetSafeStr_(message, 250);

  HET_putIncidentState_(site, router, family, prev);
  HET_resetAlertStateForFamily_(site, router, family);
}

function HET_activeIncidentSnapshot_() {
  var props = HET.props().getProperties();
  var out = { total: 0, critical: 0, high: 0, medium: 0, items: [] };

  Object.keys(props).forEach(function(key) {
    var state;
    var sev;
    if (key.indexOf('INCIDENT_STATE|') !== 0) return;
    state = hetSafeJsonParse_(props[key], null);
    if (!state || !state.open) return;

    sev = String(state.severity || 'MEDIUM').toUpperCase();
    if (sev === 'CRITICAL') out.critical++;
    else if (sev === 'HIGH') out.high++;
    else out.medium++;

    out.items.push({
      family: state.family,
      site: state.site,
      router: state.router,
      severity: sev,
      type: state.type,
      lifecycle: state.lifecycle || 'OPEN',
      message: state.message || '',
      openedAt: state.openedAtMs ? hetFmt_(new Date(state.openedAtMs)) : 'n/a',
      ageMin: state.openedAtMs ? Math.floor((Date.now() - state.openedAtMs) / 60000) : null
    });
  });

  out.items.sort(function(a, b) {
    var rank = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, INFO: 4 };
    if ((rank[a.severity] || 9) !== (rank[b.severity] || 9)) {
      return (rank[a.severity] || 9) - (rank[b.severity] || 9);
    }
    return (b.ageMin || 0) - (a.ageMin || 0);
  });
  out.total = out.items.length;

  return out;
}

function HET_alertSubject_(severity, site, router, type) {
  return '[' + severity + '] ' + (HET.cfg().NOC_TITLE || 'het') + ' | ' + site + ' | ' + router + ' | ' + type;
}

function HET_alertMessage_(severity, site, router, type, message, meta, when) {
  var lines = [
    (HET.cfg().NOC_TITLE || 'het') + ' alert update',
    'Date: ' + hetFmtDate_(when),
    'Time: ' + hetFmtTime_(when),
    'Site: ' + site,
    'Router: ' + router,
    'Severity: ' + severity,
    'Issue: ' + type,
    'Summary: ' + message
  ];
  if (meta) lines.push('Details: ' + meta);
  lines.push('Action: Team should review immediately.');
  return lines.join('\n');
}

function HET_logAlert_(severity, site, router, type, message, meta) {
  var cfg = HET.cfg();
  var props = HET.props();
  var stateKey = HET_alertStateKey_(site, router, type);
  severity = (hetSafeStr_(severity, 20) || 'MEDIUM').toUpperCase();
  var stateVal = String(severity) + '|' + String(message);
  if (type === 'STALE_CRIT' || type === 'STALE_WARN' || String(type).indexOf('TRAFFIC_STALE_') === 0) {
    // Prevent minute-by-minute stale spam by keeping state stable while stale condition is active.
    stateVal = String(severity) + '|ACTIVE';
  }
  var prev = props.getProperty(stateKey) || '';
  var when = hetNowDate_();
  var nowMs = when.getTime();

  var cooldownMin = 0;
  if (type === 'STALE_CRIT' || type === 'STALE_WARN' || String(type).indexOf('TRAFFIC_STALE_') === 0) {
    cooldownMin = hetToInt_(HET.cfg().ALERT_STALE_COOLDOWN_MIN, 30);
  } else if (String(type).indexOf('ROUTER_LOG_') === 0) {
    cooldownMin = hetToInt_(HET.cfg().ALERT_ROUTERLOG_COOLDOWN_MIN, 30);
  }

  if (cooldownMin > 0) {
    var tsKey = stateKey + '|TS';
    var prevTs = hetToInt_(props.getProperty(tsKey), 0);
    if (prevTs > 0 && (nowMs - prevTs) < (cooldownMin * 60000)) {
      return;
    }
    props.setProperty(tsKey, String(nowMs));
  }

  // Dedupe by state change.
  if (prev === stateVal) return;
  props.setProperty(stateKey, stateVal);

  var ss = HET.ss();
  hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.ALERTS), [
    when, severity, site, router, type, message, meta || ''
  ]);

  HET_setIncidentOpen_(severity, site, router, type, message, meta);

  var subject = HET_alertSubject_(severity, site, router, type);
  var body = HET_alertMessage_(severity, site, router, type, message, meta, when);

  if (hetIsYes_(cfg.REALTIME_ALERT_ENABLE)) {
    if (hetIsYes_(cfg.REALTIME_TELEGRAM_ENABLE)) {
      HET_enqueueOutbox_('TELEGRAM', subject, body);
    }
    if (hetIsYes_(cfg.REALTIME_EMAIL_ENABLE)) {
      HET_enqueueOutbox_('EMAIL', subject, body);
    }
  }

  if (hetIsYes_(HET.cfg().AUTO_SEND_OUTBOX)) {
    HET_outboxTick_();
  }
}

function HET_processLiveAlerts_(site, router, rowLive) {
  var c = HET.cfg();
  var liveState = HET_effectiveLiveState_(rowLive);
  var status = liveState.effectiveStatus;
  var cpu = hetToInt_(rowLive[5], 0);
  var mem = hetToInt_(rowLive[6], 0);
  var ipsec = String(rowLive[9] || '').toUpperCase();

  if (status !== 'ONLINE' && status !== 'UP') {
    HET_logAlert_('CRITICAL', site, router, 'ROUTER_DOWN', 'Router status is ' + status, liveState.derivedDown ? 'Derived from stale live feed' : '');
  } else {
    HET_recoverIncidentFamily_(site, router, 'ROUTER_AVAILABILITY', 'ROUTER_RECOVERED', 'Router status returned to ' + status, '');
  }
  if (cpu >= hetToInt_(c.CPU_CRIT, 85)) {
    HET_logAlert_('CRITICAL', site, router, 'CPU_CRIT', 'CPU is ' + cpu + '%', '');
  } else if (cpu >= hetToInt_(c.CPU_WARN, 70)) {
    HET_logAlert_('HIGH', site, router, 'CPU_WARN', 'CPU is ' + cpu + '%', '');
  } else {
    HET_recoverIncidentFamily_(site, router, 'CPU_PRESSURE', 'CPU_RECOVERED', 'CPU returned to normal', 'CPU is ' + cpu + '%');
  }

  if (mem >= hetToInt_(c.MEM_CRIT, 90)) {
    HET_logAlert_('CRITICAL', site, router, 'MEM_CRIT', 'Memory is ' + mem + '%', '');
  } else if (mem >= hetToInt_(c.MEM_WARN, 80)) {
    HET_logAlert_('HIGH', site, router, 'MEM_WARN', 'Memory is ' + mem + '%', '');
  } else {
    HET_recoverIncidentFamily_(site, router, 'MEMORY_PRESSURE', 'MEM_RECOVERED', 'Memory returned to normal', 'Memory is ' + mem + '%');
  }

  if (ipsec === 'DOWN') {
    HET_logAlert_('CRITICAL', site, router, 'IPSEC_DOWN', 'IPsec is DOWN', '');
  } else {
    HET_recoverIncidentFamily_(site, router, 'VPN_CONNECTIVITY', 'IPSEC_RECOVERED', 'IPsec connectivity restored', 'IPsec is ' + ipsec);
  }
}

function HET_enqueueOutbox_(channel, subject, text) {
  var ss = HET.ss();
  hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.OUTBOX), [
    hetNowDate_(),
    channel,
    subject,
    hetSafeStr_(text, 3900),
    'PENDING',
    0,
    ''
  ]);
}

function HET_outboxTick_() {
  var ss = HET.ss();
  var sh = hetGetOrCreateSheet_(ss, HET.SHEETS.OUTBOX);
  var last = sh.getLastRow();
  if (last < 2) return;

  var rng = sh.getRange(2, 1, last - 1, 7);
  var rows = rng.getValues();
  var sent = 0;
  var i;

  for (i = 0; i < rows.length && sent < 20; i++) {
    if (String(rows[i][4]) !== 'PENDING') continue;

    var channel = String(rows[i][1]);
    var subject = String(rows[i][2]);
    var body = String(rows[i][3]);
    var attempts = hetToInt_(rows[i][5], 0);

    try {
      if (channel === 'TELEGRAM') {
        HET_sendTelegram_(body);
      } else if (channel === 'EMAIL') {
        HET_sendEmail_(subject, '<pre>' + body + '</pre>', body);
      }
      rows[i][4] = 'SENT';
      rows[i][5] = attempts + 1;
      rows[i][6] = '';
    } catch (err) {
      rows[i][4] = 'FAILED';
      rows[i][5] = attempts + 1;
      rows[i][6] = hetSafeStr_(String(err), 500);
    }
    sent++;
  }

  rng.setValues(rows);
}

function runAlertCycle_AlertsBridge() {
  var ss = HET.ss();
  var sh = ss.getSheetByName(HET.SHEETS.ROUTER_STATUS);
  var tsh = ss.getSheetByName(HET.SHEETS.RAW_TRAFFIC_LOG);
  var row = hetGetLatestDataRow_(sh, 11);
  var trow = hetGetLatestDataRow_(tsh, 30);
  if (row) {
    var lastAt = row[0];
    var site = String(row[1] || HET.cfg().SITE_DEFAULT);
    var router = String(row[2] || 'UNKNOWN');
    var liveState = HET_effectiveLiveState_(row);

    if (lastAt instanceof Date) {
      var mins = Math.floor((Date.now() - lastAt.getTime()) / 60000);
      if (mins >= hetToInt_(HET.cfg().STALE_CRIT, 10)) {
          HET_logAlert_('CRITICAL', site, router, 'STALE_CRIT', 'Live data stale (critical)', 'No live data for ' + mins + ' min');
          HET_logAlert_('CRITICAL', site, router, 'ROUTER_DOWN', liveState.alertMessage, 'Last live data ' + mins + ' min ago');
          if (String(row[3] || '').toUpperCase() !== 'DOWN' || String(row[4] || '') !== liveState.effectiveMessage) {
            sh.getRange(2, 4, 1, 2).setValues([['DOWN', liveState.effectiveMessage]]);
          }
      } else if (mins >= hetToInt_(HET.cfg().STALE_WARN, 3)) {
          HET_logAlert_('MEDIUM', site, router, 'STALE_WARN', 'Live data stale (warning)', 'Live update delayed by ' + mins + ' min');
        } else {
          HET_recoverIncidentFamily_(site, router, 'LIVE_FRESHNESS', 'LIVE_RECOVERED', 'Live data freshness restored', 'Live delay back within threshold');
      }
    }
  }

  if (trow) {
    var tLastAt = trow[0];
    var tRouter = String(trow[1] || 'UNKNOWN');
    var tSite = String(trow[2] || HET.cfg().SITE_DEFAULT);

    if (tLastAt instanceof Date) {
      var tMins = Math.floor((Date.now() - tLastAt.getTime()) / 60000);
      if (tMins >= hetToInt_(HET.cfg().TRAFFIC_STALE_CRIT, 20)) {
        HET_logAlert_('CRITICAL', tSite, tRouter, 'TRAFFIC_STALE_CRIT', 'Traffic data stale (critical)', 'No traffic data for ' + tMins + ' min');
      } else if (tMins >= hetToInt_(HET.cfg().TRAFFIC_STALE_WARN, 8)) {
        HET_logAlert_('MEDIUM', tSite, tRouter, 'TRAFFIC_STALE_WARN', 'Traffic data stale (warning)', 'Traffic update delayed by ' + tMins + ' min');
      } else {
        HET_recoverIncidentFamily_(tSite, tRouter, 'TRAFFIC_FRESHNESS', 'TRAFFIC_RECOVERED', 'Traffic freshness restored', 'Traffic delay back within threshold');
      }
    }
  }

  HET_outboxTick_();
}

function runDropNoisyOutbox_AlertsBridge() {
  var ss = HET.ss();
  var sh = hetGetOrCreateSheet_(ss, HET.SHEETS.OUTBOX);
  var last = sh.getLastRow();
  if (last < 2) return 'NO_OUTBOX_ROWS';

  var rng = sh.getRange(2, 1, last - 1, 7);
  var rows = rng.getValues();
  var dropped = 0;
  var now = Date.now();
  var minAgeMs = hetToInt_(HET.cfg().OUTBOX_DROP_AGE_MIN, 10) * 60000;

  rows.forEach(function(r) {
    var status = String(r[4] || '');
    if (status !== 'PENDING' && status !== 'FAILED') return;

    var subject = String(r[2] || '');
    var isNoisy = subject.indexOf('ROUTER_LOG_') >= 0 || subject.indexOf('STALE_') >= 0;
    if (!isNoisy) return;

    var t = r[0] instanceof Date ? r[0].getTime() : 0;
    if (t > 0 && (now - t) < minAgeMs) return;

    r[4] = 'DROPPED';
    r[6] = 'auto-drop noisy backlog';
    dropped++;
  });

  rng.setValues(rows);
  return 'DROPPED=' + dropped;
}

function runDropPendingOutbox_AlertsBridge() {
  var ss = HET.ss();
  var sh = hetGetOrCreateSheet_(ss, HET.SHEETS.OUTBOX);
  var last = sh.getLastRow();
  if (last < 2) return 'NO_OUTBOX_ROWS';

  var rng = sh.getRange(2, 1, last - 1, 7);
  var rows = rng.getValues();
  var dropped = 0;

  rows.forEach(function(r) {
    var status = String(r[4] || '');
    if (status === 'PENDING' || status === 'FAILED') {
      r[4] = 'DROPPED';
      r[6] = 'manual drop realtime queue';
      dropped++;
    }
  });

  rng.setValues(rows);
  return 'DROPPED=' + dropped;
}
