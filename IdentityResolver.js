function HET_initIdentitySheets_() {
  var ss = HET.ss();
  var results = {};
  var identitySheetKeys = [
    'DEVICE_SITE_MAPPING',
    'INTERFACE_SITE_MAPPING',
    'IDENTITY_RESOLUTION_LOG',
    'UNKNOWN_DEVICE_TRIAGE',
    'IDENTITY_VALIDATION_REPORTS',
    'STATIC_INVENTORY'
  ];

  identitySheetKeys.forEach(function(key) {
    var name = HET.SHEETS[key];
    var sh = hetGetOrCreateSheet_(ss, name);
    hetEnsureHeader_(sh, HET.HEADERS[name]);
    results[name] = 'ensured';
  });

  // Extend Device_Mapping header if it still has legacy 8-column layout.
  // Using getLastColumn() (fast metadata call) to avoid reading large data ranges.
  var dmSh = ss.getSheetByName(HET.SHEETS.DEVICE_MAPPING);
  if (dmSh) {
    var expected = HET.HEADERS[HET.SHEETS.DEVICE_MAPPING];
    var lastCol = dmSh.getLastColumn();
    if (lastCol < expected.length) {
      for (var col = lastCol; col < expected.length; col++) {
        dmSh.getRange(1, col + 1).setValue(expected[col]);
      }
      results['Device_Mapping'] = 'header extended from ' + lastCol + ' to ' + expected.length + ' cols';
    } else {
      results['Device_Mapping'] = 'header already complete (' + lastCol + ' cols)';
    }
  }

  // Enforce authoritative router interface-site mapping on Google-side table.
  var sync = HET_syncInterfaceSiteMapping_();
  results['Interface_Site_Mapping_seed'] = 'seeded if empty';
  results['Interface_Site_Mapping_sync'] = sync.ok ? 'authoritative mapping synced' : 'sync skipped';

  return { ok: true, sheets: results };
}

function HET_authoritativeInterfaceSiteRows_() {
  return [
    ['ether2', 'UNITY'],
    ['ether3', 'STORE2'],
    ['ether4', 'STORE1'],
    ['ether5', 'BUK']
  ];
}

function HET_identityTrafficMinBytes_() {
  var mb = Math.max(1, hetToInt_(HET.cfg().IDENTITY_TRAFFIC_MIN_MB, 30));
  return mb * 1024 * 1024;
}

function HET_seedInterfaceSiteMapping_() {
  var sh = hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.INTERFACE_SITE_MAPPING);
  var rows = hetGetTopDataRows_(sh, 5, 20);
  if (rows.length) return;

  var now = hetNowDate_();
  var defaults = HET_authoritativeInterfaceSiteRows_().map(function(r) {
    return [r[0], r[1], 'ROUTER_LAYOUT', now, 'Authoritative router interface-site mapping'];
  });
  sh.getRange(2, 1, defaults.length, 5).setValues(defaults);
  sh.getRange(2, 4, defaults.length, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
}

function HET_syncInterfaceSiteMapping_() {
  var ss = HET.ss();
  var sh = hetGetOrCreateSheet_(ss, HET.SHEETS.INTERFACE_SITE_MAPPING);
  var now = hetNowDate_();
  var header = HET.HEADERS[HET.SHEETS.INTERFACE_SITE_MAPPING];
  var rows = hetGetTopDataRows_(sh, 5, 5000);
  var target = {};
  var nonTarget = [];

  HET_authoritativeInterfaceSiteRows_().forEach(function(r) {
    target[String(r[0]).toLowerCase()] = r[1];
  });

  rows.forEach(function(r) {
    var iface = hetSafeStr_(r[0], 40).toLowerCase();
    if (!iface) return;
    if (target[iface]) return;
    nonTarget.push([
      hetSafeStr_(r[0], 40),
      hetSafeStr_(r[1], 40).toUpperCase(),
      hetSafeStr_(r[2], 40),
      r[3] instanceof Date ? r[3] : '',
      hetSafeStr_(r[4], 250)
    ]);
  });

  var authoritativeRows = HET_authoritativeInterfaceSiteRows_().map(function(r) {
    return [r[0], r[1], 'ROUTER_LAYOUT', now, 'Authoritative router interface-site mapping'];
  });
  var out = authoritativeRows.concat(nonTarget);

  sh.clearContents();
  hetEnsureHeader_(sh, header);
  if (out.length) {
    sh.getRange(2, 1, out.length, 5).setValues(out);
    sh.getRange(2, 4, out.length, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
  }

  return {
    ok: true,
    authoritativeCount: authoritativeRows.length,
    preservedNonTargetCount: nonTarget.length
  };
}

function HET_interfaceSiteMap_() {
  HET_seedInterfaceSiteMapping_();
  var sh = HET.ss().getSheetByName(HET.SHEETS.INTERFACE_SITE_MAPPING);
  var rows = hetGetTopDataRows_(sh, 5, 100);
  var map = {};

  rows.forEach(function(r) {
    var iface = hetSafeStr_(r[0], 40).toLowerCase();
    var site = hetSafeStr_(r[1], 40).toUpperCase();
    if (!iface || !site) return;
    map[iface] = site;
  });

  return map;
}

function HET_manualSiteMap_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.DEVICE_SITE_MAPPING);
  var rows = hetGetTopDataRows_(sh, 5, 5000);
  var map = {};

  rows.forEach(function(r) {
    var mac = HET_macKey_(r[0]);
    var site = hetSafeStr_(r[1], 40).toUpperCase();
    if (!mac || !site) return;
    map[mac] = site;
  });

  return map;
}

function HET_staticInventoryMap_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.STATIC_INVENTORY);
  var rows = hetGetTopDataRows_(sh, 5, 5000);
  var map = {};

  rows.forEach(function(r) {
    var mac = HET_macKey_(r[0]);
    if (!mac) return;
    map[mac] = {
      name: hetSafeStr_(r[1], 120),
      site: hetSafeStr_(r[2], 40).toUpperCase(),
      notes: hetSafeStr_(r[3], 250)
    };
  });

  return map;
}

function HET_resolveIdentityRow_(row, maps, payloadSite) {
  var mac = HET_macKey_(row.mac);
  var ip = hetSafeStr_(row.ip, 40);
  var iface = hetSafeStr_(row.iface, 40).toLowerCase();
  var host = hetSafeStr_(row.hostname, 120);
  var comment = hetSafeStr_(row.comment, 120);
  var d = maps.deviceMap[mac] || {};
  var s = maps.staticMap[mac] || {};
  var resolvedName = '';
  var resolvedSite = '';
  var nameSource = 'FALLBACK';
  var siteSource = 'FALLBACK';
  var confidence = 'LOW';

  if (s.name) {
    resolvedName = s.name;
    nameSource = 'MAC_MAP';
  } else if (d.preferredName) {
    resolvedName = d.preferredName;
    nameSource = 'MAC_MAP';
  } else if (d.comment) {
    resolvedName = d.comment;
    nameSource = 'MAC_MAP';
  } else if (comment && comment.toLowerCase() !== 'n/a') {
    resolvedName = comment;
    nameSource = 'HOSTNAME';
  } else if (host && host.toLowerCase() !== 'unknown') {
    resolvedName = host;
    nameSource = 'HOSTNAME';
  } else if (d.hostname) {
    resolvedName = d.hostname;
    nameSource = 'HOSTNAME';
  } else {
    resolvedName = mac || ip || 'Unknown Device';
    nameSource = 'FALLBACK';
  }

  if (maps.manualSiteMap[mac]) {
    resolvedSite = maps.manualSiteMap[mac];
    siteSource = 'MAC_MAP';
  } else if (s.site) {
    resolvedSite = s.site;
    siteSource = 'MAC_MAP';
  } else if (maps.interfaceSiteMap[iface]) {
    resolvedSite = maps.interfaceSiteMap[iface];
    siteSource = 'INTERFACE_MAP';
  } else if (payloadSite) {
    resolvedSite = hetSafeStr_(payloadSite, 40).toUpperCase();
    siteSource = 'FALLBACK';
  } else {
    resolvedSite = 'Site Unresolved';
    siteSource = 'FALLBACK';
  }

  if (nameSource === 'MAC_MAP' && siteSource === 'MAC_MAP') {
    confidence = 'HIGH';
  } else if (nameSource === 'FALLBACK' || siteSource === 'FALLBACK') {
    confidence = 'LOW';
  } else {
    confidence = 'MEDIUM';
  }

  return {
    mac: mac,
    ip: ip,
    iface: iface,
    hostname: host,
    comment: comment,
    resolvedName: resolvedName,
    resolvedSite: resolvedSite,
    nameSource: nameSource,
    siteSource: siteSource,
    confidence: confidence
  };
}

function HET_shadowResolveRows_(opts) {
  var cfg = HET.cfg();
  var now = opts && opts.now ? opts.now : hetNowDate_();
  var site = hetSafeStr_(opts && opts.site, 40) || cfg.SITE_DEFAULT;
  var router = hetSafeStr_(opts && opts.router, 80) || 'UNKNOWN';
  var payloadType = hetSafeStr_(opts && opts.payloadType, 40).toLowerCase();
  var rows = (opts && opts.rows) || [];
  var out = {};

  if (!hetIsYes_(cfg.IDENTITY_ENRICH_ENABLE)) return out;

  var maps = {
    manualSiteMap: hetIsYes_(cfg.SITE_RESOLVE_ENABLE) ? HET_manualSiteMap_() : {},
    interfaceSiteMap: hetIsYes_(cfg.SITE_RESOLVE_ENABLE) ? HET_interfaceSiteMap_() : {},
    staticMap: HET_staticInventoryMap_(),
    deviceMap: HET_deviceMap_()
  };

  var minBytes = HET_identityTrafficMinBytes_();
  var logRows = [];
  var triageRows = [];

  rows.forEach(function(item) {
    var mac = HET_macKey_(item.mac);
    if (!mac && !item.ip) return;

    var isMapped = !!maps.manualSiteMap[mac] || !!maps.staticMap[mac] || !!maps.deviceMap[mac];
    var totalBytes = Math.max(0, hetToNum_(item.totalBytes, 0));
    var usageEligible = true;

    if (payloadType === 'user_usage') {
      usageEligible = totalBytes >= minBytes || isMapped;
      if (!usageEligible) return;
    }

    var resolved = HET_resolveIdentityRow_(item, maps, site);
    logRows.push([
      now,
      resolved.mac,
      resolved.ip,
      resolved.resolvedName,
      resolved.resolvedSite,
      resolved.nameSource,
      resolved.siteSource,
      resolved.confidence,
      router,
      payloadType || 'unknown'
    ]);

    if (hetIsYes_(cfg.UNKNOWN_TRIAGE_ENABLE) && (resolved.nameSource === 'FALLBACK' || resolved.siteSource === 'FALLBACK' || resolved.resolvedSite === 'Site Unresolved')) {
      triageRows.push([
        now,
        resolved.mac,
        resolved.ip,
        resolved.hostname || 'unknown',
        resolved.iface || '',
        hetFmt_(now),
        resolved.resolvedSite === 'Site Unresolved' ? 'Site unresolved' : 'Name fallback',
        'Add MAC mapping in Device_Mapping or Device_Site_Mapping'
      ]);
    }

    out[resolved.mac] = {
      resolvedSite: resolved.resolvedSite,
      nameSource: resolved.nameSource,
      siteSource: resolved.siteSource,
      confidence: resolved.confidence,
      lastSeenInterface: resolved.iface
    };
  });

  if (logRows.length) {
    hetInsertRows_(hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.IDENTITY_RESOLUTION_LOG), logRows);
  }
  if (triageRows.length) {
    hetInsertRows_(hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.UNKNOWN_DEVICE_TRIAGE), triageRows);
  }

  return out;
}

function HET_shadowObservationWindowMs_() {
  var props = HET.props();
  var startMs = hetToInt_(props.getProperty('IDENTITY_SHADOW_START_MS'), 0);
  var endMs = hetToInt_(props.getProperty('IDENTITY_SHADOW_END_MS'), 0);
  var nowMs = Date.now();
  if (startMs > 0 && endMs > startMs) {
    return { startMs: startMs, endMs: endMs, active: nowMs <= endMs };
  }
  return null;
}

function HET_scheduleIdentityValidationTrigger_(endMs) {
  var runAt = new Date(Math.max(Date.now() + 60 * 1000, Number(endMs || 0) + 2 * 60 * 1000));
  var handlers = ['HET_runIdentityValidationAuto_'];

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (handlers.indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('HET_runIdentityValidationAuto_')
    .timeBased()
    .at(runAt)
    .create();

  HET.props().setProperty('IDENTITY_VALIDATION_SCHEDULED_AT_MS', String(runAt.getTime()));
  return { ok: true, runAt: hetFmt_(runAt) };
}

function HET_identityValidationSummaryText_(report) {
  var m = report && report.metrics ? report.metrics : {};
  var win = report && report.observationWindow ? report.observationWindow : {};
  return [
    'Identity validation summary (shadow mode)',
    'Window: ' + (win.start || '-') + ' -> ' + (win.end || '-'),
    'Total devices detected: ' + (m.totalDevicesDetected || 0),
    'Unknown device ratio: ' + (m.unknownDeviceRatio || 0) + '%',
    'Successful site resolution rate: ' + (m.successfulSiteResolutionRate || 0) + '%',
    'Misclassified devices: ' + (m.misclassifiedDevicesCount || 0),
    'Identity rows: ' + (m.identityResolutionRows || 0),
    'Unknown triage rows: ' + (m.unknownTriageRows || 0),
    'Device mapping updates: ' + (m.deviceMappingUpdates || 0),
    'Ingestion failures: ' + (m.ingestionFailures || 0)
  ].join('\n');
}

function HET_writeIdentityValidationSummary_(report, telegramSent) {
  var sh = hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.IDENTITY_VALIDATION_REPORTS);
  var m = report && report.metrics ? report.metrics : {};
  var win = report && report.observationWindow ? report.observationWindow : {};
  var startMs = Date.parse(String(win.start || ''));
  var endMs = Date.parse(String(win.end || ''));
  var hours = (isNaN(startMs) || isNaN(endMs)) ? '' : Number(((endMs - startMs) / (60 * 60 * 1000)).toFixed(2));
  var summary = HET_identityValidationSummaryText_(report);

  hetInsertRows_(sh, [[
    hetNowDate_(),
    win.start || '',
    win.end || '',
    hours,
    m.totalDevicesDetected || 0,
    m.unknownDeviceRatio || 0,
    m.successfulSiteResolutionRate || 0,
    m.misclassifiedDevicesCount || 0,
    m.identityResolutionRows || 0,
    m.unknownTriageRows || 0,
    m.deviceMappingUpdates || 0,
    m.ingestionFailures || 0,
    telegramSent ? 'YES' : 'NO',
    summary,
    hetSafeStr_(JSON.stringify({ flags: report.flags || {}, mode: report.mode || 'shadow' }), 45000)
  ]]);

  return { ok: true, summary: summary };
}

function HET_runIdentityValidationAuto_() {
  var props = HET.props();
  var cfg = HET.cfg();
  var win = HET_shadowObservationWindowMs_();
  if (!win) return { ok: false, error: 'Shadow observation window not found' };

  var runKey = String(win.endMs);
  if (props.getProperty('IDENTITY_VALIDATION_LAST_RUN_KEY') === runKey) {
    return { ok: true, skipped: true, reason: 'already_run_for_window' };
  }

  var hours = Math.max(1, Math.round((win.endMs - win.startMs) / (60 * 60 * 1000)));
  var report = HET_identityValidationReport_(hours);
  var tgSent = false;
  var summaryText = HET_identityValidationSummaryText_(report);

  if (hetIsYes_(cfg.IDENTITY_VALIDATION_AUTO_TG_ENABLE) && typeof HET_sendTelegramMessageToChat_ === 'function') {
    try {
      HET_sendTelegramMessageToChat_(cfg.TG_CHAT, summaryText);
      tgSent = true;
    } catch (err) {
      tgSent = false;
      try {
        hetAppendRaw_(true, 'identity_validation_auto_telegram_exception', cfg.SITE_DEFAULT || '', '', { message: String(err) });
      } catch (_) {}
    }
  }

  HET_writeIdentityValidationSummary_(report, tgSent);

  props.setProperty('IDENTITY_VALIDATION_LAST_RUN_KEY', runKey);
  props.setProperty('IDENTITY_VALIDATION_LAST_RUN_AT', String(Date.now()));

  return {
    ok: true,
    mode: 'shadow',
    auto: true,
    windowEnd: hetFmt_(new Date(win.endMs)),
    telegramSent: tgSent,
    metrics: report.metrics
  };
}

function HET_startShadowObservation_(hours) {
  var props = HET.props();
  var nowMs = Date.now();
  var h = Math.max(1, Math.min(168, hetToInt_(hours, 72)));
  var endMs = nowMs + (h * 60 * 60 * 1000);

  props.setProperty('IDENTITY_SHADOW_START_MS', String(nowMs));
  props.setProperty('IDENTITY_SHADOW_END_MS', String(endMs));
  props.setProperty('IDENTITY_ENRICH_ENABLE', 'YES');
  props.setProperty('SITE_RESOLVE_ENABLE', 'YES');
  props.setProperty('UNKNOWN_TRIAGE_ENABLE', 'YES');
  props.setProperty('ENRICHED_OUTPUT_ENABLE', 'NO');
  props.deleteProperty('IDENTITY_VALIDATION_LAST_RUN_KEY');

  var schedule = HET_scheduleIdentityValidationTrigger_(endMs);

  return {
    ok: true,
    mode: 'shadow',
    startedAt: hetFmt_(new Date(nowMs)),
    endsAt: hetFmt_(new Date(endMs)),
    hours: h,
    autoValidation: schedule,
    flags: {
      IDENTITY_ENRICH_ENABLE: 'YES',
      SITE_RESOLVE_ENABLE: 'YES',
      UNKNOWN_TRIAGE_ENABLE: 'YES',
      ENRICHED_OUTPUT_ENABLE: 'NO'
    }
  };
}

function HET_identityValidationReport_(hours) {
  var ss = HET.ss();
  var cfg = HET.cfg();
  var nowMs = Date.now();
  var win = HET_shadowObservationWindowMs_();
  var fallbackHours = Math.max(1, Math.min(168, hetToInt_(hours, 72)));
  var startMs = win ? win.startMs : (nowMs - fallbackHours * 60 * 60 * 1000);
  var endMs = win ? Math.min(win.endMs, nowMs) : nowMs;

  function inWindow_(d) {
    if (!(d instanceof Date)) return false;
    var ms = d.getTime();
    return ms >= startMs && ms <= endMs;
  }

  var idSh = ss.getSheetByName(HET.SHEETS.IDENTITY_RESOLUTION_LOG);
  var idRows = hetGetTopDataRows_(idSh, 10, 20000).filter(function(r) { return inWindow_(r[0]); });

  var triageSh = ss.getSheetByName(HET.SHEETS.UNKNOWN_DEVICE_TRIAGE);
  var triageRows = hetGetTopDataRows_(triageSh, 8, 20000).filter(function(r) { return inWindow_(r[0]); });

  var mapSh = ss.getSheetByName(HET.SHEETS.DEVICE_MAPPING);
  var mapRows = hetGetTopDataRows_(mapSh, (HET.HEADERS[HET.SHEETS.DEVICE_MAPPING] || []).length || 13, 10000);
  var mappingUpdated = mapRows.filter(function(r) { return inWindow_(r[7]); }).length;

  var macSeen = {};
  var unknownCount = 0;
  var resolvedSiteCount = 0;
  var siteClass = {};
  var nameClass = {};

  idRows.forEach(function(r) {
    var mac = HET_macKey_(r[1]);
    var name = hetSafeStr_(r[3], 120);
    var site = hetSafeStr_(r[4], 40);
    if (mac) {
      macSeen[mac] = true;
      if (!siteClass[mac]) siteClass[mac] = {};
      if (!nameClass[mac]) nameClass[mac] = {};
      if (site && site !== 'Site Unresolved') siteClass[mac][site] = true;
      if (name && name !== 'Unknown Device') nameClass[mac][name] = true;
    }

    if (!name || name === 'Unknown Device' || site === 'Site Unresolved') {
      unknownCount++;
    }
    if (site && site !== 'Site Unresolved') {
      resolvedSiteCount++;
    }
  });

  var totalDevices = Object.keys(macSeen).length;
  var unknownRatio = totalDevices > 0 ? (unknownCount / Math.max(1, idRows.length)) : 0;
  var siteResolutionRate = idRows.length > 0 ? (resolvedSiteCount / idRows.length) : 0;

  var misclassified = [];
  Object.keys(siteClass).forEach(function(mac) {
    var sites = Object.keys(siteClass[mac]);
    var names = Object.keys(nameClass[mac] || {});
    if (sites.length > 1 || names.length > 1) {
      misclassified.push({
        mac: mac,
        sites: sites,
        names: names
      });
    }
  });

  var rawEventsSh = ss.getSheetByName(HET.SHEETS.RAW_EVENTS);
  var rawEventsRows = hetGetTopDataRows_(rawEventsSh, 5, 5000).filter(function(r) { return inWindow_(r[0]); });
  var ingestFailures = rawEventsRows.filter(function(r) {
    var t = String(r[1] || '').toLowerCase();
    return t.indexOf('exception') >= 0 || t.indexOf('unknown') >= 0;
  }).length;

  return {
    ok: true,
    mode: 'shadow',
    observationWindow: {
      start: hetFmt_(new Date(startMs)),
      end: hetFmt_(new Date(endMs)),
      active: win ? win.active : false
    },
    flags: {
      IDENTITY_ENRICH_ENABLE: cfg.IDENTITY_ENRICH_ENABLE,
      SITE_RESOLVE_ENABLE: cfg.SITE_RESOLVE_ENABLE,
      UNKNOWN_TRIAGE_ENABLE: cfg.UNKNOWN_TRIAGE_ENABLE,
      ENRICHED_OUTPUT_ENABLE: cfg.ENRICHED_OUTPUT_ENABLE
    },
    metrics: {
      totalDevicesDetected: totalDevices,
      unknownDeviceRatio: Number((unknownRatio * 100).toFixed(2)),
      successfulSiteResolutionRate: Number((siteResolutionRate * 100).toFixed(2)),
      misclassifiedDevicesCount: misclassified.length,
      identityResolutionRows: idRows.length,
      unknownTriageRows: triageRows.length,
      deviceMappingUpdates: mappingUpdated,
      ingestionFailures: ingestFailures
    },
    misclassifiedDevices: misclassified.slice(0, 50),
    notes: [
      'unknownDeviceRatio is based on Identity_Resolution_Log rows in window.',
      'misclassifiedDevices are inferred where same MAC resolved to multiple names/sites during window.',
      'Router load remains unchanged by this phase because no router scripts were modified.'
    ]
  };
}

function HET_identityShadowHealth_() {
  var cfg = HET.cfg();
  var props = HET.props();
  var win = HET_shadowObservationWindowMs_();
  var quick = HET_identityValidationReport_(24);
  var scheduledAtMs = hetToInt_(props.getProperty('IDENTITY_VALIDATION_SCHEDULED_AT_MS'), 0);

  return {
    ok: true,
    mode: 'shadow',
    observationWindow: win ? {
      start: hetFmt_(new Date(win.startMs)),
      end: hetFmt_(new Date(win.endMs)),
      active: !!win.active
    } : null,
    flags: {
      IDENTITY_ENRICH_ENABLE: cfg.IDENTITY_ENRICH_ENABLE,
      SITE_RESOLVE_ENABLE: cfg.SITE_RESOLVE_ENABLE,
      UNKNOWN_TRIAGE_ENABLE: cfg.UNKNOWN_TRIAGE_ENABLE,
      ENRICHED_OUTPUT_ENABLE: cfg.ENRICHED_OUTPUT_ENABLE
    },
    guardrails: {
      enrichedOutputDisabled: String(cfg.ENRICHED_OUTPUT_ENABLE || '').toUpperCase() !== 'YES',
      routerSideUnchanged: true
    },
    autoValidation: {
      scheduledAt: scheduledAtMs > 0 ? hetFmt_(new Date(scheduledAtMs)) : '',
      telegramEnable: cfg.IDENTITY_VALIDATION_AUTO_TG_ENABLE
    },
    quick24h: quick.metrics
  };
}
