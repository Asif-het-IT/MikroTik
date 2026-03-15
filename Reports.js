function HET_dailyTrafficDeltaSummary_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.RAW_TRAFFIC_LOG);
  var rows = hetGetTopDataRows_(sh, 30, 400);
  var latest;
  var oldest;
  var out = {
    wanDelta: 'n/a',
    e2Delta: 'n/a',
    e3Delta: 'n/a',
    e4Delta: 'n/a',
    e5Delta: 'n/a'
  };

  if (!rows.length) return out;

  latest = rows[0];
  oldest = rows[rows.length - 1];

  function deltaText_(a, b) {
    var d = hetToNum_(a, 0) - hetToNum_(b, 0);
    if (d < 0) d = 0;
    return String(d.toFixed(0));
  }

  out.wanDelta = deltaText_(latest[6], oldest[6]);
  out.e2Delta = deltaText_(latest[10], oldest[10]);
  out.e3Delta = deltaText_(latest[14], oldest[14]);
  out.e4Delta = deltaText_(latest[18], oldest[18]);
  out.e5Delta = deltaText_(latest[22], oldest[22]);
  return out;
}

function HET_dailyDashboardUrl_() {
  var c = HET.cfg();
  var raw = String(c.DASHBOARD_UI_URL || c.WEBAPP_EXEC_URL || '').trim();
  if (!raw) {
    try {
      raw = String(ScriptApp.getService().getUrl() || '').trim();
    } catch (_) {
      raw = '';
    }
  }
  if (!raw) return '';
  return raw.indexOf('?') > -1 ? raw : (raw + '?page=dashboard');
}

function HET_dashboardSnapshotPdfBlob_() {
  var c = HET.cfg();
  var ssId = String(c.SS_ID || '').trim();
  if (!ssId) return null;

  var sh = HET.ss().getSheetByName(HET.SHEETS.DASHBOARD);
  if (!sh) return null;

  var tz = c.TZ || 'Asia/Dubai';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm');
  var url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(ssId) + '/export' +
    '?format=pdf' +
    '&portrait=false' +
    '&fitw=true' +
    '&size=A4' +
    '&sheetnames=false' +
    '&printtitle=false' +
    '&pagenumbers=false' +
    '&gridlines=false' +
    '&fzr=false' +
    '&gid=' + sh.getSheetId();

  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) return null;
  return res.getBlob().setName('het_dashboard_snapshot_' + stamp + '.pdf');
}

function HET_dashboardSnapshotPngBlob_(snap, dashboardUrl) {
  var c = HET.cfg();
  var tz = c.TZ || 'Asia/Dubai';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm');
  var statusText = (snap && snap.live && snap.live.status) ? snap.live.status : 'NO DATA';
  var vpnText = (snap && snap.vpn && snap.vpn.status) ? snap.vpn.status : 'UNKNOWN';
  var cpuText = String((snap && snap.live) ? snap.live.cpu : 0) + '%';
  var memText = String((snap && snap.live) ? snap.live.memory : 0) + '%';
  var usersText = String((snap && snap.users) ? snap.users.active : 0);
  var liveUsersText = HET_reportLiveUsersText_(snap || {});
  var wanText = (snap && snap.traffic && snap.traffic.wanRunning) ? snap.traffic.wanRunning : 'UNKNOWN';
  var updateText = (snap && snap.live && snap.live.updatedAt) ? snap.live.updatedAt : 'n/a';
  var dashText = String(dashboardUrl || HET_dailyDashboardUrl_() || 'n/a');

  var data = Charts.newDataTable()
    .addColumn(Charts.ColumnType.STRING, 'Metric')
    .addColumn(Charts.ColumnType.STRING, 'Value')
    .addRow(['Site', (snap && snap.site) ? snap.site : 'KANO'])
    .addRow(['Router', (snap && snap.router) ? snap.router : 'UNKNOWN'])
    .addRow(['Router Status', statusText])
    .addRow(['VPN', vpnText])
    .addRow(['WAN', wanText])
    .addRow(['CPU / Memory', cpuText + ' / ' + memText])
    .addRow(['DHCP Users (Snapshot)', usersText])
    .addRow(['Live Users (Router)', liveUsersText])
    .addRow(['Last Update', updateText])
    .addRow(['Dashboard', dashText])
    .build();

  var chart = Charts.newTableChart()
    .setDataTable(data)
    .setOption('allowHtml', false)
    .setDimensions(1200, 720)
    .build();

  return chart.getAs('image/png').setName('het_live_summary_' + stamp + '.png');
}

function HET_fetchPngBlob_(url, fileName) {
  if (!url) return null;
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    var contentType = String(res.getHeaders()['Content-Type'] || '').toLowerCase();
    if (contentType.indexOf('image/png') === -1) return null;
    return res.getBlob().setName(fileName || 'capture.png');
  } catch (err) {
    Logger.log('HET_fetchPngBlob_ failed: ' + err);
    return null;
  }
}

function HET_dashboardWebShots_(dashboardUrl) {
  var out = { viewport: null, fullpage: null };
  var durl = String(dashboardUrl || '').trim();
  var c = HET.cfg();
  var tz = c.TZ || 'Asia/Dubai';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm');
  if (!durl) return out;

  var viewportUrl = 'https://image.thum.io/get/png/noanimate/wait/8/' + durl;
  var fullUrl = 'https://image.thum.io/get/png/fullpage/noanimate/wait/8/' + durl;

  out.viewport = HET_fetchPngBlob_(viewportUrl, 'het_dashboard_view_' + stamp + '.png');
  out.fullpage = HET_fetchPngBlob_(fullUrl, 'het_dashboard_full_' + stamp + '.png');
  return out;
}

function HET_reportBytes_(value) {
  var n = hetToNum_(value, 0);
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB';
  return n.toFixed(0) + ' B';
}

function HET_reportActivityText_(bytes, isSunday) {
  if (hetToNum_(bytes, 0) > 0) return HET_reportBytes_(bytes);
  return isSunday ? 'Closed / No activity' : 'Unexpected inactivity';
}

function HET_reportLiveUsersText_(snap) {
  var lu = snap && snap.users ? snap.users.live : null;
  if (!lu) return 'Disabled';
  return String(hetToInt_(lu.total, 0)) + ' (age ' + lu.ageMin + 'm)';
}

function HET_dailyOpsNote_(snap, isSunday) {
  var parts = [];
  var critical = hetToInt_(snap.alerts.critical, 0);
  var high = hetToInt_(snap.alerts.high, 0);

  if (String(snap.live.status).toUpperCase() === 'ONLINE' && String(snap.vpn.status).toUpperCase() === 'UP' && String(snap.traffic.wanRunning).toUpperCase() === 'UP') {
    parts.push('The router, VPN, and WAN services are operating normally.');
  } else {
    parts.push('One or more core services are degraded and should be reviewed by NOC.');
  }

  parts.push('System resource usage is ' + snap.live.cpu + '% CPU and ' + snap.live.memory + '% memory.');

  if (critical > 0) {
    parts.push('Critical alerts are present and require immediate follow-up.');
  } else if (high > 0) {
    parts.push('High-severity alerts are present and should be tracked closely.');
  } else {
    parts.push('No major alert escalation is active at this time.');
  }

  if (isSunday) {
    parts.push('Closed sites showing no traffic are expected under Sunday schedule.');
  }

  parts.push('Monitoring and alerting remain active.');
  return parts.join(' ');
}

function HET_buildDailyReportPayload_() {
  var c = HET.cfg();
  var snap = HET_collectSnapshot_();
  var dayNum = parseInt(Utilities.formatDate(new Date(), c.TZ, 'u'), 10);
  var isSunday = dayNum === 7;
  var wanHealthy = String(snap.traffic.wanRunning).toUpperCase() === 'UP' ? 'HEALTHY' : 'DEGRADED';
  var vpnIpsec = (String(snap.vpn.status).toUpperCase() === 'UP' && String(snap.live.ipsec).toUpperCase() === 'UP') ? 'UP' : 'DEGRADED';
  var topUsers10;
  var topUsers20;
  var topUsersLines;
  var topUsersLabel;
  var msg;

  topUsers10 = typeof HET_getTopUsers_ === 'function' ? HET_getTopUsers_(10, 'daily') : snap.topUsage.slice(0, 10);
  topUsers20 = typeof HET_getTopUsers_ === 'function' ? HET_getTopUsers_(20, 'daily') : snap.topUsage.slice(0, 20);

  topUsersLines = topUsers10.length ? topUsers10.map(function(item, idx) {
    var device = item.preferredName || item.comment || item.hostname || 'unknown';
    return '- ' + (idx + 1) + '. ' + device + ' | IP ' + (item.ip || 'n/a') + ' | MAC ' + (item.mac || 'n/a') + ' | ' + HET_reportBytes_(item.total);
  }) : ['- No recent user usage data received.'];

  topUsersLabel = topUsers20.length ? topUsers20.map(function(item, idx) {
    var device = item.preferredName || item.comment || item.hostname || 'unknown';
    return (idx + 1) + '. ' + device + ' [' + (item.ip || 'n/a') + '] (' + HET_reportBytes_(item.total) + ')';
  }).join(' | ') : 'No recent user usage data received.';

  msg = [
    (c.NOC_TITLE || 'het') + ' • Network Operations Daily Summary',
    '',
    'Site: ' + snap.site,
    'Router: ' + snap.router,
    'Report Time: ' + snap.dateText + ' | ' + snap.timeText,
    '',
    'Network Health',
    '- Router: ' + snap.live.status,
    '- VPN/IPsec: ' + vpnIpsec,
    '- WAN: ' + wanHealthy,
    '- Last Seen: ' + snap.live.lastSeen + ' ago',
    '',
    'System Load',
    '- CPU: ' + snap.live.cpu + '%',
    '- Memory: ' + snap.live.memory + '%',
    '- DHCP Users (Snapshot): ' + snap.users.active,
    '- Live Users (Router): ' + HET_reportLiveUsersText_(snap),
    '- Pending Commands: ' + snap.commandsPending,
    '',
    'Traffic Overview',
    '- WAN Total: ' + HET_reportBytes_(snap.traffic.wanTotalText),
    '- ' + snap.traffic.e2Label + ': ' + HET_reportActivityText_(snap.traffic.e2Text, isSunday),
    '- ' + snap.traffic.e3Label + ': ' + HET_reportActivityText_(snap.traffic.e3Text, isSunday),
    '- ' + snap.traffic.e4Label + ': ' + HET_reportActivityText_(snap.traffic.e4Text, isSunday),
    '- ' + snap.traffic.e5Label + ': ' + HET_reportActivityText_(snap.traffic.e5Text, isSunday),
    '',
    'Alert Summary (Last 24h)',
    '- Critical: ' + snap.alerts.critical,
    '- High: ' + snap.alerts.high,
    '- Medium: ' + snap.alerts.medium,
    '',
    'User Activity',
    '- DHCP Users Snapshot: ' + snap.users.active,
    '- Live Users (Router): ' + HET_reportLiveUsersText_(snap),
    '- Router Last Update: ' + snap.live.updatedAt,
    '',
    'Top Users',
    '- Daily Top 10 (identity-aware)',
    topUsersLines.join('\n'),
    '',
    '- Daily Top 20 prepared in sheet Top_Users_Daily',
    '',
    'Operations Note',
    HET_dailyOpsNote_(snap, isSunday),
    '',
    'Dashboard',
    '- Live View: ' + HET_dailyDashboardUrl_(),
    '',
    (c.NOC_TITLE || 'het') + ' Monitoring Platform'
  ].join('\n');

  return {
    subject: (c.NOC_TITLE || 'het') + ' | Network Operations Daily Summary - ' + snap.site,
    message: msg,
    snap: snap,
    topUsersLabel: topUsersLabel,
    dashboardUrl: HET_dailyDashboardUrl_(),
    topUsers10: topUsers10,
    topUsers20: topUsers20
  };
}

function HET_dailySummaryAttachments_(snap, dashboardUrl) {
  var out = { attachments: [], snapshotPdf: null, snapshotPng: null, tgPhotos: [] };
  try {
    var pdfBlob = HET_dashboardSnapshotPdfBlob_();
    if (pdfBlob) {
      out.snapshotPdf = pdfBlob;
      out.attachments.push(pdfBlob);
    }
  } catch (err) {
    Logger.log('HET_dailySummaryAttachments_ skipped PDF snapshot: ' + err);
  }

  try {
    var pngBlob = HET_dashboardSnapshotPngBlob_(snap, dashboardUrl);
    if (pngBlob) {
      out.snapshotPng = pngBlob;
      out.tgPhotos.push(pngBlob);
    }
  } catch (err) {
    Logger.log('HET_dailySummaryAttachments_ skipped PNG snapshot: ' + err);
  }

  try {
    var shots = HET_dashboardWebShots_(dashboardUrl);
    if (!out.tgPhotos.length && shots.fullpage) {
      out.tgPhotos.push(shots.fullpage);
    } else if (!out.tgPhotos.length && shots.viewport) {
      out.tgPhotos.push(shots.viewport);
    }
  } catch (err) {
    Logger.log('HET_dailySummaryAttachments_ skipped web shots: ' + err);
  }
  return out;
}

function HET_dailyReport() {
  var c = HET.cfg();
  var props = HET.props();
  var dayKey = Utilities.formatDate(new Date(), c.TZ, 'yyyy-MM-dd');
  var payload;
  var dailyAttach;

  if (props.getProperty('LAST_DAILY_REPORT') === dayKey) return;
  payload = HET_buildDailyReportPayload_();
  dailyAttach = HET_dailySummaryAttachments_(payload.snap, payload.dashboardUrl);

  hetAppendRow_(hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.DAILY_REPORTS), [
    hetNowDate_(),
    payload.snap.site,
    payload.snap.router,
    payload.snap.live.status,
    payload.snap.vpn.status,
    payload.snap.live.cpu,
    payload.snap.live.memory,
    payload.snap.users.active,
    payload.snap.alerts.critical,
    payload.snap.alerts.high,
    payload.snap.alerts.medium,
    payload.topUsersLabel
  ]);

  if (typeof HET_writeReportsOutputTopUsers_ === 'function') {
    HET_writeReportsOutputTopUsers_('DAILY_TOP10', payload.snap.dateText, payload.topUsers10 || []);
    HET_writeReportsOutputTopUsers_('DAILY_TOP20', payload.snap.dateText, payload.topUsers20 || []);
  }

  if (hetIsYes_(c.DAILY_TELEGRAM_ENABLE)) {
    HET_sendTelegram_(payload.message, {
      photoBlobs: dailyAttach.tgPhotos,
      photoCaption: (c.NOC_TITLE || 'het') + ' Dashboard Snapshot'
    });
  }
  if (hetIsYes_(c.DAILY_EMAIL_ENABLE)) {
    HET_sendEmail_(payload.subject, '', payload.message, {
      attachments: dailyAttach.attachments
    });
  }
  props.setProperty('LAST_DAILY_REPORT', dayKey);
  props.setProperty('LAST_DAILY_REPORT_SENT_AT_MS', String(Date.now()));
}

function sendDailySummaryTelegramNow() {
  var payload = HET_buildDailyReportPayload_();
  var attach = HET_dailySummaryAttachments_(payload.snap, payload.dashboardUrl);
  HET_sendTelegram_(payload.message, {
    photoBlobs: attach.tgPhotos,
    photoCaption: 'Dashboard Snapshot'
  });
  return { ok: true, channel: 'TELEGRAM', subject: payload.subject };
}

function sendLiveSummaryTelegramNow() {
  var payload = HET_buildDailyReportPayload_();
  var attach = HET_dailySummaryAttachments_(payload.snap, payload.dashboardUrl);
  var liveMsg = '[LIVE REPORT]\n\n' + payload.message;
  HET_sendTelegram_(liveMsg, {
    photoBlobs: attach.tgPhotos,
    photoCaption: 'Live Summary Snapshot'
  });
  return { ok: true, channel: 'TELEGRAM', mode: 'LIVE', subject: payload.subject };
}

function sendDailySummaryEmailNow() {
  var payload = HET_buildDailyReportPayload_();
  var attach = HET_dailySummaryAttachments_(payload.snap, payload.dashboardUrl);
  HET_sendEmail_(payload.subject, '', payload.message, {
    attachments: attach.attachments
  });
  return { ok: true, channel: 'EMAIL', subject: payload.subject };
}

function HET_monthlyTopUsersReport_() {
  var c = HET.cfg();
  var monthKey = Utilities.formatDate(new Date(), c.TZ, 'yyyy-MM');
  var top10 = (typeof HET_getTopUsers_ === 'function') ? HET_getTopUsers_(10, 'monthly') : [];
  var top20 = (typeof HET_getTopUsers_ === 'function') ? HET_getTopUsers_(20, 'monthly') : [];
  var lines10;
  var lines20;
  var message;

  lines10 = top10.length ? top10.map(function(item, idx) {
    var name = item.preferredName || item.comment || item.hostname || 'unknown';
    return (idx + 1) + '. ' + name + ' | IP ' + (item.ip || 'n/a') + ' | MAC ' + (item.mac || 'n/a') + ' | ' + HET_reportBytes_(item.total);
  }) : ['No monthly user usage rows available yet.'];

  lines20 = top20.length ? top20.map(function(item, idx) {
    var name = item.preferredName || item.comment || item.hostname || 'unknown';
    return (idx + 1) + '. ' + name + ' [' + (item.ip || 'n/a') + '] ' + HET_reportBytes_(item.total);
  }) : ['No monthly user usage rows available yet.'];

  if (typeof HET_writeReportsOutputTopUsers_ === 'function') {
    HET_writeReportsOutputTopUsers_('MONTHLY_TOP10', monthKey, top10);
    HET_writeReportsOutputTopUsers_('MONTHLY_TOP20', monthKey, top20);
  }

  message = [
    (c.NOC_TITLE || 'het') + ' Monthly Top Users (' + monthKey + ')',
    '',
    'Top 10',
    lines10.join('\n'),
    '',
    'Top 20',
    lines20.join('\n')
  ].join('\n');

  return {
    ok: true,
    month: monthKey,
    top10: top10.length,
    top20: top20.length,
    message: message
  };
}

function runDailyReport() {
  var c = HET.cfg();
  var parts = String(c.DAILY_REPORT_TIME || '11:59').split(':');
  var now = new Date();
  var hour = parseInt(parts[0], 10);
  var minute = parseInt(parts[1], 10);
  var nowHour = parseInt(Utilities.formatDate(now, c.TZ, 'H'), 10);
  var nowMinute = parseInt(Utilities.formatDate(now, c.TZ, 'm'), 10);
  var targetTotal = (hour * 60) + minute;
  var nowTotal = (nowHour * 60) + nowMinute;

  try {
    if (Math.abs(nowTotal - targetTotal) > 2) {
      if (typeof HET_markRuntimeSuccess_ === 'function') {
        HET_markRuntimeSuccess_('DAILY_REPORT', { skipped: true, reason: 'outside execution window' });
      }
      return;
    }
    HET_dailyReport();
    if (typeof HET_markRuntimeSuccess_ === 'function') {
      HET_markRuntimeSuccess_('DAILY_REPORT', { skipped: false, sentAtMs: Date.now() });
    }
  } catch (err) {
    if (typeof HET_markRuntimeFailure_ === 'function') {
      HET_markRuntimeFailure_('DAILY_REPORT', err, {});
    }
    throw err;
  }
}
