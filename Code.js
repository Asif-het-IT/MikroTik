function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 NOC Control")
    .addItem("✅ Init / Fix All Sheets", "initSetup")
    .addItem("⚙ Enterprise Setup", "setupEnterpriseAndShowReport")
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
    .addItem("🖥️ Open Dashboard", "showDashboard")
    .addItem("🧹 Retention Cleanup Now", "retentionCleanupNow")
    .addToUi();
}

function doPost(e) { return ingest_(e); }
function doGet(e) { return ingest_(e); }

function initSetup() {
  // Simplified init: only ensure USER_MONITOR sheet exists.
  const ss = SpreadsheetApp.openById(SS_ID);
  try { ensureAllSheetsEnterprise(); } catch (e) { try { logErr_(ss, 'INIT_SIMPLE', 'ensureAllSheetsEnterprise failed', String(e)); } catch(_){} }
}

// Lightweight initializer to avoid Spreadsheet timeouts on very large docs.
function initSetupSafe() {
  const ss = SpreadsheetApp.openById(SS_ID);
  // Simplified safe init: ensure USER_MONITOR only
  try { ensureAllSheetsEnterprise(); } catch (e) { try { logErr_(ss, 'INIT_SAFE', 'ensureAllSheetsEnterprise failed', String(e)); } catch(_){} }
}

// Phased initializer: run repeatedly until complete to avoid Sheets timeouts.
function initSetupPhased() {
  // Phased initializer no longer creates multiple sheets. Use the single-shot enterprise flow.
  const ss = SpreadsheetApp.openById(SS_ID);
  try { ensureAllSheetsEnterprise(); } catch (e) { try { logErr_(ss, 'INIT_PHASE', 'ensureAllSheetsEnterprise failed', String(e)); } catch(_){} }
}

function resetInitPhase() {
  const ss = SpreadsheetApp.openById(SS_ID);
  setCfgValue_(ss, 'INIT_PHASE', 0);
}

// Lightweight: create missing sheets with minimal RPCs (no header writes).
function quickEnsureSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const name = SHEETS.USER_MONITOR;
  try {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  } catch (e) { try { logErr_(ss, 'QUICK_ENSURE', `insert ${name} failed`, String(e)); } catch(_){} }
}

// Phase 2: apply headers in small batches to avoid timeouts. Run repeatedly until done.
function applyHeadersPhase(batchSize) {
  // Only ensure header for USER_MONITOR.
  const ss = SpreadsheetApp.openById(SS_ID);
  const name = SHEETS.USER_MONITOR;
  const header = DEFAULT_HEADERS.USER_MONITOR;
  if (!header) return;
  try {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const existing = sh.getRange(1, 1, 1, header.length).getValues()[0];
    const same = existing.length === header.length && existing.every((x, i) => String(x) === String(header[i]));
    if (!same) sh.getRange(1, 1, 1, header.length).setValues([header]);
  } catch (e) { try { logErr_(ss, 'INIT_HEADERS', `header ${name} failed`, String(e)); } catch(_){} }
}

function showDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('UI')
    .setTitle('NOC Dashboard')
    .setWidth(600);
  SpreadsheetApp.getUi().showSidebar(html);
}

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
    .addItem("🖥️ Open Dashboard", "showDashboard")
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

function showDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('UI')
    .setTitle('NOC Dashboard')
    .setWidth(600);
  SpreadsheetApp.getUi().showSidebar(html);
}