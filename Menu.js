function onOpen(e) {
  HET_buildCustomMenu_();
}

function onInstall(e) {
  onOpen(e);
}

function HET_buildCustomMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('HET Control')
    .addItem('Open Dashboard UI (Capture)', 'menuOpenDashboardUI')
    .addSeparator()
    .addItem('Refresh Dashboard Now', 'menuRunDashboardRefresh')
    .addItem('Run Alert Cycle Now', 'menuRunAlertCycle')
    .addSeparator()
    .addItem('Send Daily Summary to Telegram', 'menuSendDailyTelegram')
    .addItem('Send Daily Summary to Email', 'menuSendDailyEmail')
    .addItem('Run Daily Report (Scheduled Logic)', 'menuRunDailyReport')
    .addItem('Run Command Cycle Now', 'menuRunCommandCycle')
    .addItem('Run Runtime Health Check', 'menuRunRuntimeHealthCheck')
    .addItem('Run Maintenance Cycle', 'menuRunMaintenanceCycle')
    .addItem('Refresh Top Users', 'menuRefreshTopUsers')
      .addItem('Start Shadow Observation (72h)', 'menuStartShadowObservation')
      .addItem('Identity Validation Report', 'menuIdentityValidationReport')
    .addSeparator()
    .addItem('Drop Pending Outbox', 'menuDropPendingOutbox')
    .addItem('Drop Noisy Outbox', 'menuDropNoisyOutbox')
    .addToUi();
}

function HET_menuToast_(message) {
  SpreadsheetApp.getActive().toast(message, 'HET Control', 5);
}

function HET_escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function HET_getDashboardUrl_() {
  var p = PropertiesService.getScriptProperties();
  var explicit = String(p.getProperty('DASHBOARD_UI_URL') || p.getProperty('WEBAPP_EXEC_URL') || '').trim();
  if (explicit) return explicit.indexOf('?') > -1 ? explicit : (explicit + '?page=dashboard');

  try {
    if (typeof HET !== 'undefined' && HET && typeof HET.cfg === 'function') {
      var cfg = HET.cfg();
      var cfgUrl = String((cfg && (cfg.DASHBOARD_UI_URL || cfg.WEBAPP_EXEC_URL)) || '').trim();
      if (cfgUrl) return cfgUrl.indexOf('?') > -1 ? cfgUrl : (cfgUrl + '?page=dashboard');
    }
  } catch (_) {}

  var base = ScriptApp.getService().getUrl() || '';
  return base ? (base + '?page=dashboard') : '';
}

function menuOpenDashboardUI() {
  var url = HET_getDashboardUrl_();

  if (!url) {
    HET_menuToast_('Dashboard URL unavailable. Redeploy web app and retry.');
    return;
  }

  var safeUrl = HET_escapeHtml_(url);

  var html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><style>',
    'body{font-family:Arial,sans-serif;padding:14px;color:#15324a;}',
    '.title{font-size:14px;font-weight:700;margin-bottom:8px;}',
    '.muted{font-size:12px;color:#4b5563;margin-bottom:10px;line-height:1.45;}',
    '.btn{display:inline-block;background:#0b4a73;color:#fff;text-decoration:none;padding:9px 12px;border-radius:8px;font-size:12px;font-weight:700;border:0;cursor:pointer;}',
    '.url{margin-top:10px;padding:8px;background:#f3f4f6;border-radius:6px;font-size:11px;word-break:break-all;}',
    '</style></head><body>',
    '<div class="title">Open Dashboard UI</div>',
    '<div class="muted">Click the button below to open dashboard in a new tab.</div>',
    '<button class="btn" onclick="window.open(\'' + safeUrl + '\',\'_blank\',\'noopener\');google.script.host.close();">Open Dashboard</button>',
    '<div class="url">' + safeUrl + '</div>',
    '</body></html>'
  ].join('');

  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(html).setTitle('HET Dashboard')
  );
  Logger.log('HET Dashboard URL: ' + url);
  HET_menuToast_('Dashboard opener panel shown.');
}

function menuRunDashboardRefresh() {
  runDashboardRefresh();
  HET_menuToast_('Dashboard refreshed.');
}

function menuRunAlertCycle() {
  runAlertCycle();
  HET_menuToast_('Alert cycle executed.');
}

function menuRunDailyReport() {
  HET_dailyReport();
  HET_menuToast_('Daily report routine executed.');
}

function menuSendDailyTelegram() {
  sendDailySummaryTelegramNow();
  HET_menuToast_('Daily summary sent to Telegram.');
}

function menuSendDailyEmail() {
  sendDailySummaryEmailNow();
  HET_menuToast_('Daily summary sent to Email.');
}

function menuRunCommandCycle() {
  var result = runCommandCycle();
  Logger.log('menuRunCommandCycle result: ' + JSON.stringify(result));
  HET_menuToast_('Command cycle executed.');
}

function menuRunRuntimeHealthCheck() {
  var result = runRuntimeHealthCheck();
  Logger.log('menuRunRuntimeHealthCheck result: ' + JSON.stringify(result));
  HET_menuToast_('Runtime health check executed.');
}

function menuRunMaintenanceCycle() {
  var result = runMaintenanceCycle();
  Logger.log('menuRunMaintenanceCycle result: ' + JSON.stringify(result));
  HET_menuToast_('Maintenance cycle executed.');
}

function menuRefreshTopUsers() {
  var result = (typeof HET_writeTopUserSheets_ === 'function') ? HET_writeTopUserSheets_() : { ok: false, error: 'Top users helper missing' };
  Logger.log('menuRefreshTopUsers result: ' + JSON.stringify(result));
  HET_menuToast_(result.ok ? 'Top users refreshed.' : 'Top users refresh failed.');
}

function menuStartShadowObservation() {
  var result = (typeof HET_startShadowObservation_ === 'function')
    ? HET_startShadowObservation_(72)
    : { ok: false, error: 'Shadow observation helper missing' };
  Logger.log('menuStartShadowObservation result: ' + JSON.stringify(result));
  HET_menuToast_(result.ok ? 'Shadow observation started for 72h.' : 'Shadow observation start failed.');
}

function menuIdentityValidationReport() {
  var result = (typeof HET_identityValidationReport_ === 'function')
    ? HET_identityValidationReport_(72)
    : { ok: false, error: 'Identity validation helper missing' };
  Logger.log('menuIdentityValidationReport result: ' + JSON.stringify(result));
  HET_menuToast_(result.ok ? 'Identity validation report generated (see logs).' : 'Identity validation report failed.');
}

function menuDropPendingOutbox() {
  var result = runDropPendingOutbox_AlertsBridge();
  Logger.log('menuDropPendingOutbox result: ' + JSON.stringify(result));
  HET_menuToast_('Pending outbox cleanup executed.');
}

function menuDropNoisyOutbox() {
  var result = runDropNoisyOutbox_AlertsBridge();
  Logger.log('menuDropNoisyOutbox result: ' + JSON.stringify(result));
  HET_menuToast_('Noisy outbox cleanup executed.');
}
