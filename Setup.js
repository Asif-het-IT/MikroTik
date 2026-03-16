function applyScriptProperties() {
  HET.props().setProperties({
    MONITOR_TOKEN: 'MONITOR_TOKEN_2026',
    SITE_DEFAULT: 'KANO',
    NOC_TITLE: 'het',
    TZ: 'Asia/Dubai',
    DATE_FMT: 'dd-MMM-yyyy',
    TIME_FMT: 'hh:mm a',
    DATE_TIME_FMT: 'dd-MMM-yyyy hh:mm a',
    TG_BOT: '8546997581:AAEEyKvRaR_QzhBrSBCLwseYgHTBHMizSkg',
    TG_CHAT: '-1003786414616',
    TG_DEBUG_ENABLE: 'YES',
    TG_AUTH_STRICT: 'NO',
    TG_STRICT_MENTION: 'NO',
    EMAILS: 'asif@harisheximtrading.com,hetnigeria@harisheximtrading.com',
    DASH_REFRESH_MIN: '5',
    ALERT_REFRESH_MIN: '2',
    DAILY_REPORT_TIME: '11:59',
    CPU_WARN: '70',
    CPU_CRIT: '85',
    MEM_WARN: '80',
    MEM_CRIT: '90',
    STALE_WARN: '15',
    STALE_CRIT: '25',
    TRAFFIC_STALE_WARN: '8',
    TRAFFIC_STALE_CRIT: '20',
    ALERT_STALE_COOLDOWN_MIN: '30',
    ALERT_ROUTERLOG_COOLDOWN_MIN: '30',
    OUTBOX_DROP_AGE_MIN: '10',
    REALTIME_ALERT_ENABLE: 'YES',
    REALTIME_TELEGRAM_ENABLE: 'YES',
    REALTIME_EMAIL_ENABLE: 'NO',
    DAILY_TELEGRAM_ENABLE: 'YES',
    DAILY_EMAIL_ENABLE: 'YES',
    ROUTERLOG_ALERT_ENABLE: 'NO',
    ROUTERLOG_ALERT_KEYWORDS: 'critical,error,fail,down,panic,denied,attack',
    ROUTERLOG_ALERT_BLOCK: 'het_,logged in,logged out,script removed,new script added,install started,install finished',
    TREND_SAMPLES: '180',
    RECENT_WINDOW_HOURS: '24',
    DASHBOARD_ALERT_ROWS: '5',
    USERS_SNAPSHOT_MAX_AGE_MIN: '45',
    LIVE_USERS_ENABLE: 'YES',
    LIVE_USERS_MAX_AGE_MIN: '15',
    RAW_KEEP_ROWS: '2000',
    AUTO_SEND_OUTBOX: 'YES',
    COMMAND_BATCH_LIMIT: '3',
    IDENTITY_ENRICH_ENABLE: 'YES',
    SITE_RESOLVE_ENABLE: 'YES',
    UNKNOWN_TRIAGE_ENABLE: 'YES',
    ENRICHED_OUTPUT_ENABLE: 'NO',
    IDENTITY_TRAFFIC_MIN_MB: '30',
    IDENTITY_VALIDATION_AUTO_TG_ENABLE: 'NO',
    MOBILE_VPN_SITE: 'KANO',
    MOBILE_VPN_SERVICE: 'Mobile VPN',
    MOBILE_VPN_TYPE: 'L2TP/IPsec',
    MOBILE_VPN_POOL_START: '10.20.30.10',
    MOBILE_VPN_POOL_END: '10.20.30.20',
    MOBILE_VPN_FAIL_WARN_THRESHOLD: '3',
    MOBILE_VPN_TRACKED_USERS: 'asif,het2,het3,het4',
    TRAFFIC_WAN_NAME: 'ISP',
    TRAFFIC_E2_NAME: 'Unity Shop',
    TRAFFIC_E3_NAME: 'Store Site-2',
    TRAFFIC_E4_NAME: 'Store Site-1',
    TRAFFIC_E5_NAME: 'BUK Site',
    SS_ID: '1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc'
  }, false);
}

function initAndFormatSheets() {
  hetEnsureAllSheets_();
  HET_dashRefresh();
}

function createOrResetTriggers() {
  var all = ScriptApp.getProjectTriggers();
  all.forEach(function(t) { ScriptApp.deleteTrigger(t); });

  var c = HET.cfg();

  ScriptApp.newTrigger('runDashboardRefresh')
    .timeBased()
    .everyMinutes(hetToInt_(c.DASH_REFRESH_MIN, 5))
    .create();

  ScriptApp.newTrigger('runAlertCycle')
    .timeBased()
    .everyMinutes(1)
    .create();

  ScriptApp.newTrigger('runDailyReport')
    .timeBased()
    .everyMinutes(1)
    .create();

  ScriptApp.newTrigger('runCommandCycle')
    .timeBased()
    .everyMinutes(1)
    .create();

  ScriptApp.newTrigger('runRuntimeHealthCheck')
    .timeBased()
    .everyMinutes(15)
    .create();

  ScriptApp.newTrigger('runMaintenanceCycle')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
}

function runDashboardRefresh() {
  try {
    HET_dashRefresh();
    if (typeof HET_markRuntimeSuccess_ === 'function') {
      HET_markRuntimeSuccess_('DASHBOARD_REFRESH', { status: 'ok' });
    }
  } catch (err) {
    if (typeof HET_markRuntimeFailure_ === 'function') {
      HET_markRuntimeFailure_('DASHBOARD_REFRESH', err, {});
    }
    throw err;
  }
}

function runAlertCycle() {
  var c = HET.cfg();
  var minGapMs = Math.max(1, hetToInt_(c.ALERT_REFRESH_MIN, 2)) * 60 * 1000;
  var props = HET.props();
  var last = hetToInt_(props.getProperty('ALERT_LAST_RUN_MS'), 0);
  var now = Date.now();
  if (now - last < minGapMs) {
    if (typeof HET_markRuntimeSuccess_ === 'function') {
      HET_markRuntimeSuccess_('ALERT_CYCLE', { skipped: true, minGapMs: minGapMs });
    }
    return { ok: true, skipped: true };
  }

  try {
    props.setProperty('ALERT_LAST_RUN_MS', String(now));
    if (typeof runAlertCycle_AlertsBridge === 'function') {
      runAlertCycle_AlertsBridge();
    }
    if (typeof HET_markRuntimeSuccess_ === 'function') {
      HET_markRuntimeSuccess_('ALERT_CYCLE', { skipped: false });
    }
    return { ok: true, skipped: false };
  } catch (err) {
    if (typeof HET_markRuntimeFailure_ === 'function') {
      HET_markRuntimeFailure_('ALERT_CYCLE', err, {});
    }
    throw err;
  }
}

function verifyPlannedTriggers() {
  var out = [];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    out.push({ handler: t.getHandlerFunction(), type: String(t.getEventType()) });
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function verifyTriggers() {
  var c = HET.cfg();
  var expected = {
    runDashboardRefresh: false,
    runAlertCycle: false,
    runDailyReport: false,
    runCommandCycle: false,
    runRuntimeHealthCheck: false,
    runMaintenanceCycle: false
  };
  var created = [];

  ScriptApp.getProjectTriggers().forEach(function(t) {
    var handler = t.getHandlerFunction();
    if (expected.hasOwnProperty(handler)) {
      expected[handler] = true;
    }
  });

  if (!expected.runDashboardRefresh) {
    ScriptApp.newTrigger('runDashboardRefresh')
      .timeBased()
      .everyMinutes(hetToInt_(c.DASH_REFRESH_MIN, 5))
      .create();
    created.push('runDashboardRefresh');
  }

  if (!expected.runAlertCycle) {
    ScriptApp.newTrigger('runAlertCycle')
      .timeBased()
      .everyMinutes(1)
      .create();
    created.push('runAlertCycle');
  }

  if (!expected.runDailyReport) {
    ScriptApp.newTrigger('runDailyReport')
      .timeBased()
      .everyMinutes(1)
      .create();
    created.push('runDailyReport');
  }

  if (!expected.runCommandCycle) {
    ScriptApp.newTrigger('runCommandCycle')
      .timeBased()
      .everyMinutes(1)
      .create();
    created.push('runCommandCycle');
  }

  if (!expected.runRuntimeHealthCheck) {
    ScriptApp.newTrigger('runRuntimeHealthCheck')
      .timeBased()
      .everyMinutes(15)
      .create();
    created.push('runRuntimeHealthCheck');
  }

  if (!expected.runMaintenanceCycle) {
    ScriptApp.newTrigger('runMaintenanceCycle')
      .timeBased()
      .everyDays(1)
      .atHour(1)
      .create();
    created.push('runMaintenanceCycle');
  }

  return {
    ok: true,
    created: created,
    handlers: expected
  };
}

function runCommandCycle() {
  var result;
  try {
    if (typeof HET_pollTelegramUpdates_ === 'function') {
      try {
        HET_pollTelegramUpdates_();
      } catch (errPoll) {
        Logger.log('runCommandCycle telegram poll error: ' + errPoll);
      }
    }

    if (typeof HET_runCommandCycle_ === 'function') {
      result = HET_runCommandCycle_();
      if (typeof HET_markRuntimeSuccess_ === 'function') {
        HET_markRuntimeSuccess_('COMMAND_CYCLE', result || {});
      }
      return result;
    }
    result = { ok: false, processed: 0, message: 'Command engine missing' };
    if (typeof HET_markRuntimeFailure_ === 'function') {
      HET_markRuntimeFailure_('COMMAND_CYCLE', result.message, result);
    }
    return result;
  } catch (err) {
    if (typeof HET_markRuntimeFailure_ === 'function') {
      HET_markRuntimeFailure_('COMMAND_CYCLE', err, {});
    }
    return { ok: false, processed: 0, message: String(err) };
  }
}

function runRuntimeHealthCheck() {
  try {
    var verify = verifyTriggers();
    if (typeof HET_markRuntimeSuccess_ === 'function') {
      HET_markRuntimeSuccess_('TRIGGER_INTEGRITY', verify);
    }
    if (typeof HET_markRuntimeSuccess_ === 'function') {
      HET_markRuntimeSuccess_('RUNTIME_HEALTH_CHECK', {
        missingTriggers: verify.created.length ? verify.created : []
      });
    }
    return {
      ok: true,
      verify: verify,
      runtime: typeof HET_getRuntimeHealth_ === 'function' ? HET_getRuntimeHealth_() : { overall: 'UNKNOWN', cycles: [] }
    };
  } catch (err) {
    if (typeof HET_markRuntimeFailure_ === 'function') {
      HET_markRuntimeFailure_('RUNTIME_HEALTH_CHECK', err, {});
      HET_markRuntimeFailure_('TRIGGER_INTEGRITY', err, {});
    }
    return { ok: false, error: String(err) };
  }
}

function runMaintenanceCycle() {
  try {
    var retentionResult = typeof HET_runRetentionCycle_ === 'function'
      ? HET_runRetentionCycle_()
      : { ok: false, error: 'Retention engine missing' };
    var topUsersResult = typeof HET_writeTopUserSheets_ === 'function'
      ? HET_writeTopUserSheets_()
      : { ok: false, error: 'Top users engine missing' };
    var result = {
      ok: !!(retentionResult && retentionResult.ok) && !!(topUsersResult && topUsersResult.ok),
      retention: retentionResult,
      topUsers: topUsersResult
    };
    if (typeof HET_markRuntimeSuccess_ === 'function') {
      HET_markRuntimeSuccess_('MAINTENANCE_CYCLE', result);
    }
    return result;
  } catch (err) {
    if (typeof HET_markRuntimeFailure_ === 'function') {
      HET_markRuntimeFailure_('MAINTENANCE_CYCLE', err, {});
    }
    return { ok: false, error: String(err) };
  }
}

function HET_sheetState_(ss, name) {
  var sh = ss.getSheetByName(name);
  var header = HET.HEADERS[name] || [];
  var topRow = null;
  var topRows = [];
  var numberFormat = '';
  if (!sh) {
    return { exists: false, name: name };
  }
  if (sh.getLastRow() >= 2) {
    topRow = sh.getRange(2, 1, 1, Math.max(1, header.length)).getDisplayValues()[0];
    topRows = sh.getRange(2, 1, Math.min(3, sh.getLastRow() - 1), Math.max(1, header.length)).getDisplayValues();
    numberFormat = sh.getRange(2, 1, 1, 1).getNumberFormat();
  }
  return {
    exists: true,
    name: name,
    headerOk: name === HET.SHEETS.DASHBOARD ? true : sh.getRange(1, 1, 1, header.length).getDisplayValues()[0].join('||') === header.join('||'),
    header: header,
    lastRow: sh.getLastRow(),
    topRow: topRow,
    topRows: topRows,
    firstCellFormat: numberFormat
  };
}

function HET_adminSetup_() {
  initAndFormatSheets();
  createOrResetTriggers();
  return {
    ok: true,
    message: 'Production setup complete without overwriting script properties',
    status: HET_adminStatus_()
  };
}

function HET_adminStatus_() {
  var ss = HET.ss();
  var names = Object.keys(HET.SHEETS).map(function(key) { return HET.SHEETS[key]; });
  var sheets = {};
  var triggers = [];

  names.forEach(function(name) {
    sheets[name] = HET_sheetState_(ss, name);
  });

  ScriptApp.getProjectTriggers().forEach(function(t) {
    triggers.push({
      handler: t.getHandlerFunction(),
      type: String(t.getEventType())
    });
  });

  return {
    ok: true,
    title: HET.cfg().NOC_TITLE || 'het',
    site: HET.cfg().SITE_DEFAULT,
    dateFmt: HET.cfg().DATE_FMT,
    timeFmt: HET.cfg().TIME_FMT,
    dateTimeFmt: HET.cfg().DATE_TIME_FMT,
    dailyReportTime: HET.cfg().DAILY_REPORT_TIME,
    summaryEngine: 'local',
    sampleDate: hetFmtDate_(new Date('2025-07-06T08:59:00Z')),
    sampleTime: hetFmtTime_(new Date('2025-07-06T08:59:00Z')),
    dashboard: HET_collectSnapshot_(),
    identityShadow: typeof HET_identityShadowHealth_ === 'function' ? HET_identityShadowHealth_() : { ok: false, error: 'Identity shadow helper missing' },
    runtimeHealth: typeof HET_getRuntimeHealth_ === 'function' ? HET_getRuntimeHealth_() : { overall: 'UNKNOWN', cycles: [] },
    triggerIntegrity: typeof HET_triggerIntegritySnapshot_ === 'function' ? HET_triggerIntegritySnapshot_() : { ok: false, missing: ['helper missing'] },
    sheets: sheets,
    triggers: triggers
  };
}

function HET_adminCleanupLegacyProps_() {
  var props = HET.props();
  var legacyKeys = [
    'AI_ENABLE',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_TEMPERATURE',
    'OPENAI_MAX_TOKENS'
  ];
  var removed = [];
  var kept = [];
  var i;

  for (i = 0; i < legacyKeys.length; i++) {
    if (props.getProperty(legacyKeys[i]) !== null) {
      props.deleteProperty(legacyKeys[i]);
      removed.push(legacyKeys[i]);
    } else {
      kept.push(legacyKeys[i]);
    }
  }

  return {
    ok: true,
    removed: removed,
    alreadyMissing: kept,
    summaryEngine: 'local'
  };
}

function HET_toEnglishText_(input) {
  var text = String(input || '');
  if (!text) return text;

  text = text.replace(/\bTareekh:/g, 'Date:');
  text = text.replace(/\bWaqt:/g, 'Time:');
  text = text.replace(/\bMaqam:/g, 'Site:');
  text = text.replace(/\bShiddat:/g, 'Severity:');
  text = text.replace(/\bMasla:/g, 'Issue:');
  text = text.replace(/\bKhulasa:/g, 'Summary:');
  text = text.replace(/\bTafseel:/g, 'Details:');
  text = text.replace(/\bKarwai:/g, 'Action:');
  text = text.replace(/\bAkhri Tazaa Kari:/g, 'Last Refresh:');
  text = text.replace(/\bAkhri Dafa Nazar Aya:/g, 'Last Seen:');
  text = text.replace(/\bSargarm Users:/g, 'Active Users:');
  text = text.replace(/\bAmliya Halat\b/g, 'Operational Status');
  text = text.replace(/\bRouter Ki Halat:/g, 'Router Status:');
  text = text.replace(/\bVPN Ki Halat:/g, 'VPN Status:');
  text = text.replace(/\bMemory Istemaal:/g, 'Memory Use:');
  text = text.replace(/\bAkhri 24 Ghantay Ke Alerts\b/g, 'Alerts in Last 24h');
  text = text.replace(/\bZyada Istemaal Karne Walay\b/g, 'Top Users');
  text = text.replace(/\bSmart Khulasa\b/g, 'Smart Summary');
  text = text.replace(/\brozana khulasa\b/gi, 'daily summary');
  text = text.replace(/\bsmart khulasa natija\b/gi, 'smart summary result');
  text = text.replace(/\balert ittila\b/gi, 'alert update');
  text = text.replace(/Abhi usage rows capture nahin hui\./g, 'No usage rows captured yet.');
  text = text.replace(/Abhi tak live update nahin ayi\./g, 'No live update yet.');
  text = text.replace(/(\d+(?:\.\d+)?) min se live data nahin ayi/g, 'No live data for $1 min');
  text = text.replace(/Live data (\d+(?:\.\d+)?) min se dair se ayi/g, 'Live delayed by $1 min');
  text = text.replace(/Router ki halat ([A-Z_]+) hai/g, 'Router status is $1');
  text = text.replace(/CPU (\d+%) hai/g, 'CPU is $1');
  text = text.replace(/Memory (\d+%) hai/g, 'Memory is $1');
  text = text.replace(/Tarjeeh yeh hai/g, 'Priority');
  text = text.replace(/Mazeed Tawajjoh:/g, 'Extra focus:');
  text = text.replace(/Nishana:/g, 'Target:');
  text = text.replace(/Yaad Dehani:/g, 'Note:');
  return text;
}

function HET_migrateEnglishSheetText_() {
  var ss = HET.ss();
  var result = { alerts: 0, outboxSubjects: 0, outboxBodies: 0, dailyReports: 0, routerStatusMessages: 0, smartSummaries: 0 };
  var sh;
  var rows;
  var i;
  var before;
  var after;

  sh = ss.getSheetByName(HET.SHEETS.ALERTS);
  if (sh && sh.getLastRow() >= 2) {
    rows = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
    for (i = 0; i < rows.length; i++) {
      before = String(rows[i][0] || '');
      after = HET_toEnglishText_(before);
      if (after !== before) {
        rows[i][0] = after;
        result.alerts++;
      }
    }
    sh.getRange(2, 6, rows.length, 1).setValues(rows);
  }

  sh = ss.getSheetByName(HET.SHEETS.OUTBOX);
  if (sh && sh.getLastRow() >= 2) {
    rows = sh.getRange(2, 3, sh.getLastRow() - 1, 2).getValues();
    for (i = 0; i < rows.length; i++) {
      before = String(rows[i][0] || '');
      after = HET_toEnglishText_(before);
      if (after !== before) {
        rows[i][0] = after;
        result.outboxSubjects++;
      }

      before = String(rows[i][1] || '');
      after = HET_toEnglishText_(before);
      if (after !== before) {
        rows[i][1] = after;
        result.outboxBodies++;
      }
    }
    sh.getRange(2, 3, rows.length, 2).setValues(rows);
  }

  sh = ss.getSheetByName(HET.SHEETS.DAILY_REPORTS);
  if (sh && sh.getLastRow() >= 2) {
    rows = sh.getRange(2, 12, sh.getLastRow() - 1, 1).getValues();
    for (i = 0; i < rows.length; i++) {
      before = String(rows[i][0] || '');
      after = HET_toEnglishText_(before);
      if (after !== before) {
        rows[i][0] = after;
        result.dailyReports++;
      }
    }
    sh.getRange(2, 12, rows.length, 1).setValues(rows);
  }

  sh = ss.getSheetByName(HET.SHEETS.ROUTER_STATUS);
  if (sh && sh.getLastRow() >= 2) {
    rows = sh.getRange(2, 5, sh.getLastRow() - 1, 1).getValues();
    for (i = 0; i < rows.length; i++) {
      before = String(rows[i][0] || '');
      after = HET_toEnglishText_(before);
      if (after !== before) {
        rows[i][0] = after;
        result.routerStatusMessages++;
      }
    }
    sh.getRange(2, 5, rows.length, 1).setValues(rows);
  }

  sh = ss.getSheetByName(HET.SHEETS.SMART_SUMMARY_LOG);
  if (sh && sh.getLastRow() >= 2) {
    rows = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
    for (i = 0; i < rows.length; i++) {
      before = String(rows[i][0] || '');
      after = HET_toEnglishText_(before);
      if (after !== before) {
        rows[i][0] = after;
        result.smartSummaries++;
      }
    }
    sh.getRange(2, 6, rows.length, 1).setValues(rows);
  }

  return result;
}

function HET_adminMigrateRomanUrdu_() {
  return {
    ok: true,
    migrated: HET_migrateEnglishSheetText_(),
    status: HET_adminStatus_()
  };
}

function HET_adminMigrateEnglish_() {
  return {
    ok: true,
    migrated: HET_migrateEnglishSheetText_(),
    status: HET_adminStatus_()
  };
}
