function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("ðŸš€ NOC Control")
    .addItem("âœ… Init / Fix All Sheets", "initSetup")
    .addSeparator()
    .addItem("ðŸ“¥ Test Ingest (Live)", "testIngestLive")
    .addItem("ðŸ§¾ Test Ingest (Log)", "testIngestLog")
    .addSeparator()
    .addItem("ðŸ“Š Rebuild Dashboard", "rebuildDashboard")
    .addItem("ðŸ“‹ Build Data Audit", "buildDataAuditNow")
    .addItem("ðŸš¨ Run Smart Alerts", "smartAlertEngine")
    .addItem("ðŸ“¨ Process TG Outbox", "processOutboxNow")
    .addItem("ðŸ“¤ Send Daily Summary", "dailySummary")
    .addItem("ðŸ“¡ Send Full Status", "sendFullStatusNow")
    .addItem("ðŸ“˜ Build Exec Report", "buildExecReportNow")
    .addSeparator()
    .addItem("âš™ Install Triggers", "installTriggers")
    .addItem("ðŸ–¥ï¸ Open Dashboard", "showDashboard")
    .addItem("ðŸ§¹ Retention Cleanup Now", "retentionCleanupNow")
    .addToUi();
}

function doPost(e) { return ingest_(e); }
function doGet(e) { return ingest_(e); }

function initSetup() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  rebuildDashboard();
  buildExecReportNow();
  buildDataAuditNow();
}

function showDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('UI')
    .setTitle('NOC Dashboard')
    .setWidth(600);
  SpreadsheetApp.getUi().showSidebar(html);
}
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("ðŸš€ NOC Control")
    .addItem("âœ… Init / Fix All Sheets", "initSetup")
    .addSeparator()
    .addItem("ðŸ“¥ Test Ingest (Live)", "testIngestLive")
    .addItem("ðŸ§¾ Test Ingest (Log)", "testIngestLog")
    .addSeparator()
    .addItem("ðŸ“Š Rebuild Dashboard", "rebuildDashboard")
    .addItem("ðŸ“‹ Build Data Audit", "buildDataAuditNow")
    .addItem("ðŸš¨ Run Smart Alerts", "smartAlertEngine")
    .addItem("ðŸ“¨ Process TG Outbox", "processOutboxNow")
    .addItem("ðŸ“¤ Send Daily Summary", "dailySummary")
    .addItem("ðŸ“¡ Send Full Status", "sendFullStatusNow")
    .addItem("ðŸ“˜ Build Exec Report", "buildExecReportNow")
    .addSeparator()
    .addItem("âš™ Install Triggers", "installTriggers")
    .addItem("ðŸ–¥ï¸ Open Dashboard", "showDashboard")
    .addItem("ðŸ§¹ Retention Cleanup Now", "retentionCleanupNow")
    .addToUi();
}

function doPost(e) { return ingest_(e); }
function doGet(e) { return ingest_(e); }

function initSetup() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  rebuildDashboard();
  buildExecReportNow();
  buildDataAuditNow();
}

function showDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('UI')
    .setTitle('NOC Dashboard')
    .setWidth(600);
  SpreadsheetApp.getUi().showSidebar(html);
}
