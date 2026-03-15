function HET_summaryMeta_(extra) {
  var meta = extra || {};
  meta.site = meta.site || HET.cfg().SITE_DEFAULT;
  meta.title = HET.cfg().NOC_TITLE || 'het';
  meta.engine = 'local';
  return meta;
}

function HET_latestSmartSummary_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.SMART_SUMMARY_LOG);
  var rows = hetGetTopDataRows_(sh, 7, 20);
  var i;

  for (i = 0; i < rows.length; i++) {
    var status = String(rows[i][2] || '').toUpperCase();
    if (status !== 'DONE' && status !== 'LOCAL') continue;
    return {
      status: 'READY',
      summary: hetSafeStr_(rows[i][5], 500) || 'Smart summary is available.',
      updatedAt: rows[i][0] instanceof Date ? hetFmt_(rows[i][0]) : 'n/a',
      model: hetSafeStr_(rows[i][3], 60) || 'local'
    };
  }

  return {
    status: 'IDLE',
    summary: 'Smart summary is not available yet.',
    updatedAt: 'n/a',
    model: 'local'
  };
}

function HET_pendingCommandCount_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.COMMAND_CENTER);
  var rows = hetGetTopDataRows_(sh, 10, 200);
  var count = 0;

  rows.forEach(function(row) {
    var status = String(row[5] || '').toUpperCase();
    if (!status || status === 'PENDING' || status === 'QUEUED' || status === 'RUNNING') count++;
  });
  return count;
}

function HET_opsFacts_() {
  var ss = HET.ss();
  var liveRow = hetGetLatestDataRow_(ss.getSheetByName(HET.SHEETS.ROUTER_STATUS), 11);
  var vpnRow = hetGetLatestDataRow_(ss.getSheetByName(HET.SHEETS.VPN_STATUS), 7);
  var liveState = HET_effectiveLiveState_(liveRow);
  var alerts = HET_alertSnapshot_();
  var topUsage = HET_topUsageSummary_();

  return {
    site: liveRow ? hetSafeStr_(liveRow[1], 40) : HET.cfg().SITE_DEFAULT,
    router: liveRow ? hetSafeStr_(liveRow[2], 80) : 'UNKNOWN',
    liveStatus: liveState.effectiveStatus,
    liveMessage: liveState.effectiveMessage,
    cpu: liveRow ? hetToInt_(liveRow[5], 0) : 0,
    memory: liveRow ? hetToInt_(liveRow[6], 0) : 0,
    uptime: liveRow ? hetSafeStr_(liveRow[7], 80) : 'n/a',
    publicIp: liveRow ? hetSafeStr_(liveRow[8], 80) : 'n/a',
    ipsec: liveRow ? (hetSafeStr_(liveRow[9], 20) || 'UNKNOWN').toUpperCase() : 'UNKNOWN',
    isp: liveRow ? hetSafeStr_(liveRow[10], 30) : 'n/a',
    vpnStatus: vpnRow ? (hetSafeStr_(vpnRow[4], 20) || 'UNKNOWN').toUpperCase() : 'UNKNOWN',
    vpnHost: vpnRow ? hetSafeStr_(vpnRow[3], 120) : 'n/a',
    vpnPing: vpnRow ? hetSafeStr_(vpnRow[5], 20) : 'n/a',
    activeUsers: HET_activeUsersSnapshot_(liveRow ? liveRow[1] : '', liveRow ? liveRow[2] : ''),
    alerts: {
      critical: alerts.critical,
      high: alerts.high,
      medium: alerts.medium,
      recent: alerts.recent
    },
    topUsage: topUsage,
    lastSeen: liveState.lastSeenText,
    commandBacklog: HET_pendingCommandCount_(),
    updatedAt: hetFmt_(hetNowDate_())
  };
}

function HET_buildSmartSummary_(facts, command, prompt, target) {
  var lines = [];
  lines.push('Date: ' + hetFmtDate_(hetNowDate_()));
  lines.push('Time: ' + hetFmtTime_(hetNowDate_()));
  lines.push('Status update: At site ' + facts.site + ', router ' + facts.router + ' is currently ' + facts.liveStatus + '.');
  lines.push('CPU is ' + facts.cpu + '% and memory is ' + facts.memory + '%, while VPN status is ' + facts.vpnStatus + '.');
  lines.push('DHCP users snapshot: ' + facts.activeUsers + '. Recent alerts: critical ' + facts.alerts.critical + ', high ' + facts.alerts.high + ', medium ' + facts.alerts.medium + '.');
  if (facts.commandBacklog > 0) {
    lines.push('Command queue has ' + facts.commandBacklog + ' pending item(s) that should be processed.');
  }
  if (facts.alerts.critical > 0 || facts.liveStatus === 'DOWN' || facts.vpnStatus === 'DOWN') {
    lines.push('Priority: investigate critical/down conditions immediately.');
  } else {
    lines.push('No major issue detected right now; continue regular monitoring.');
  }
  if (prompt) lines.push('Extra focus: ' + hetSafeStr_(prompt, 240));
  if (target) lines.push('Target: ' + hetSafeStr_(target, 120));
  if (command) lines.push('Command: ' + hetSafeStr_(command, 60));
  return lines.join('\n');
}

function HET_logSmartSummary_(command, status, engine, prompt, response, meta) {
  var sh = hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.SMART_SUMMARY_LOG);
  hetAppendRow_(sh, [
    hetNowDate_(),
    hetSafeStr_(command, 60),
    hetSafeStr_(status, 20),
    hetSafeStr_(engine || 'local', 40),
    hetSafeStr_(prompt, 5000),
    hetSafeStr_(response, 5000),
    hetSafeStr_(JSON.stringify(meta || {}), 5000)
  ]);
  hetTrimToLimit_(sh, HET.cfg().RAW_KEEP_ROWS);
}

function HET_generateSmartSummary_(command, prompt, target) {
  var facts = HET_opsFacts_();
  var text = HET_buildSmartSummary_(facts, command, prompt, target);
  HET_logSmartSummary_(command, 'LOCAL', 'local', prompt, text, HET_summaryMeta_({ target: target }));
  return { text: text, mode: 'local', model: 'local' };
}

function HET_commandResultSubject_(command) {
  return (HET.cfg().NOC_TITLE || 'het') + ' smart summary result | ' + command;
}

function HET_dispatchCommandResult_(channel, command, text) {
  var mode = String(channel || '').toUpperCase();
  if (!mode || mode === 'NONE') return;
  if (mode === 'TELEGRAM') {
    HET_sendTelegram_(text);
    return;
  }
  if (mode === 'EMAIL') {
    HET_sendEmail_(HET_commandResultSubject_(command), '', text);
    return;
  }
  if (mode === 'BOTH') {
    HET_sendTelegram_(text);
    HET_sendEmail_(HET_commandResultSubject_(command), '', text);
  }
}

function HET_executeCommand_(command, target, prompt, outputChannel, metaText) {
  var cmd = String(command || '').toUpperCase().replace(/^\/+/, '').trim();
  var result;

  if (cmd === 'REFRESH_DASHBOARD') {
    HET_dashRefresh();
    return 'Dashboard refresh completed.';
  }
  if (cmd === 'RUN_DAILY_REPORT') {
    HET_dailyReport();
    return 'Daily report run completed, or it has already been sent for today.';
  }
  if (cmd === 'RUN_ALERT_CYCLE') {
    runAlertCycle_AlertsBridge();
    return 'Alert cycle executed.';
  }
  if (cmd === 'SUMMARIZE_STATUS' || cmd === 'EXPLAIN_ALERTS' || cmd === 'SMART_SUMMARY') {
    result = HET_generateSmartSummary_(cmd, prompt, target || metaText);
    HET_dispatchCommandResult_(outputChannel, cmd, result.text);
    return result.text;
  }
  if (cmd === 'SEND_SMART_SUMMARY') {
    result = HET_generateSmartSummary_(cmd, prompt || 'Provide a concise smart operations summary.', target);
    HET_dispatchCommandResult_(outputChannel || 'BOTH', cmd, result.text);
    return result.text;
  }
  if (cmd === 'REPORT' || cmd === 'LIVE_REPORT' || cmd === 'SEND_LIVE_REPORT') {
    result = sendLiveSummaryTelegramNow();
    return 'Live report sent to Telegram (' + (result && result.mode ? result.mode : 'LIVE') + ').';
  }

  throw new Error('Unsupported command: ' + cmd);
}

function HET_runCommandCycle_() {
  var sh;
  var last;
  var processed = 0;
  var failed = 0;
  var limit = hetToInt_(HET.cfg().COMMAND_BATCH_LIMIT, 3);
  var rows;
  var i;
  var errors = [];

  try {
    sh = hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.COMMAND_CENTER);
    last = sh.getLastRow();

    if (last < 2) {
      return { ok: true, processed: 0, failed: 0, message: 'No command rows available.' };
    }

    rows = sh.getRange(2, 1, last - 1, 10).getValues();

    for (i = 0; i < rows.length && processed < limit; i++) {
      var status = String(rows[i][5] || '').toUpperCase();
      var rowIndex = i + 2;
      var now = hetNowDate_();
      var command;
      var target;
      var prompt;
      var outputChannel;
      var metaText;
      var resultText;

      if (status && status !== 'PENDING' && status !== 'QUEUED' && status !== 'RUNNING') continue;

      command = hetSafeStr_(rows[i][2], 60);
      target = hetSafeStr_(rows[i][3], 120);
      prompt = hetSafeStr_(rows[i][4], 5000);
      outputChannel = hetSafeStr_(rows[i][7], 20);
      metaText = hetSafeStr_(rows[i][9], 1000);

      try {
        sh.getRange(rowIndex, 6, 1, 4).setValues([['RUNNING', rows[i][6], outputChannel, now]]);
        sh.getRange(rowIndex, 9, 1, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
        resultText = HET_executeCommand_(command, target, prompt, outputChannel, metaText);
        sh.getRange(rowIndex, 6, 1, 4).setValues([['DONE', hetSafeStr_(resultText, 5000), outputChannel, now]]);
        sh.getRange(rowIndex, 9, 1, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
        processed++;
      } catch (err) {
        sh.getRange(rowIndex, 6, 1, 4).setValues([['FAILED', hetSafeStr_(String(err), 5000), outputChannel, now]]);
        sh.getRange(rowIndex, 9, 1, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
        processed++;
        failed++;
        errors.push({ row: rowIndex, command: command, error: String(err) });
      }
    }

    return {
      ok: failed === 0,
      processed: processed,
      failed: failed,
      remaining: HET_pendingCommandCount_(),
      errors: errors
    };
  } catch (errOuter) {
    return {
      ok: false,
      processed: processed,
      failed: failed + 1,
      remaining: 0,
      errors: errors.concat([{ row: 0, command: 'SYSTEM', error: String(errOuter) }])
    };
  }
}

function HET_adminSmartSummary_(p) {
  var result = HET_generateSmartSummary_('ADMIN_SUMMARY', p.prompt || 'Summarize current operations.', p.target || 'admin');
  return {
    ok: true,
    mode: result.mode,
    model: result.model,
    text: result.text
  };
}

function HET_enqueueCommand_(requestedBy, command, target, prompt, outputChannel, meta) {
  var sh = hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.COMMAND_CENTER);
  hetAppendRow_(sh, [
    hetNowDate_(),
    hetSafeStr_(requestedBy || 'system', 120),
    hetSafeStr_(command, 60),
    hetSafeStr_(target, 120),
    hetSafeStr_(prompt, 5000),
    'PENDING',
    '',
    hetSafeStr_(outputChannel || 'NONE', 20),
    hetNowDate_(),
    hetSafeStr_(meta || '', 1000)
  ]);
  sh.getRange(2, 9, 1, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
}

function HET_seedCommandTests_() {
  HET_enqueueCommand_('admin-test', 'SUMMARIZE_STATUS', 'dashboard', 'Provide a short English summary of current router health.', 'NONE', 'seed-test');
  HET_enqueueCommand_('admin-test', 'SMART_SUMMARY', 'router-health', 'Provide an English smart summary of current router health.', 'NONE', 'seed-test');
  HET_enqueueCommand_('admin-test', 'SEND_SMART_SUMMARY', 'management', 'Provide a concise English operations brief for management.', 'NONE', 'seed-test');
  return {
    ok: true,
    seeded: 3,
    pending: HET_pendingCommandCount_()
  };
}