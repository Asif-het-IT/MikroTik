function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 NOC Control")
    .addItem("✅ Init / Fix All Sheets", "initSetup")
    .addSeparator()
    .addItem("📥 Test Ingest (Live)", "testIngestLive")
    .addItem("🧾 Test Ingest (Log)", "testIngestLog")
    .addSeparator()
    .addItem("📊 Rebuild Dashboard", "rebuildDashboard")
    .addItem("📋 Build Data Audit", "buildDataAuditNow")
    .addItem("🚨 Run Smart Alerts", "smartAlertEngine")
    .addItem("📨 Process TG Outbox", "processOutboxNow")
    .addItem("📤 Send Daily Summary", "dailySummary")
    .addItem("📡 Send Full Status", "sendFullStatusNow")
    .addItem("📘 Build Exec Report", "buildExecReportNow")
    .addSeparator()
    .addItem("⚙ Install Triggers", "installTriggers")
    .addItem("🧹 Retention Cleanup Now", "retentionCleanupNow")
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