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
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  rebuildDashboard();
  buildExecReportNow();
  buildDataAuditNow();
}

// Lightweight initializer to avoid Spreadsheet timeouts on very large docs.
function initSetupSafe() {
  const ss = SpreadsheetApp.openById(SS_ID);
  // Create only essential sheets first to reduce RPC load
  const essentials = [SHEETS.CFG, SHEETS.RAW, SHEETS.STATE, SHEETS.TG_OUT, SHEETS.RAW_USER_SNAPSHOTS, SHEETS.DAILY_USER_AGG, SHEETS.DASH];
  essentials.forEach(name => {
    try {
      ensureSheet_(ss, name, DEFAULT_HEADERS[name] || [""]);
    } catch (e) {
      try { logErr_(ss, 'INIT_SAFE', `ensureSheet failed ${name}`, String(e)); } catch (_) {}
    }
    // small pause to avoid hitting Sheets service quotas
    Utilities.sleep(300);
  });
  // Minimal dashboard rebuild
  try { rebuildDashboard(); } catch (e) { try { logErr_(ss, 'INIT_SAFE', 'rebuildDashboard failed', String(e)); } catch(_) {} }
}

// Phased initializer: run repeatedly until complete to avoid Sheets timeouts.
function initSetupPhased() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss); // ensure minimal sets
  const cfg = getCfg_(ss);
  const phase = Number(cfgStr_(cfg, 'INIT_PHASE', 0));

  const groups = [
    [SHEETS.CFG, SHEETS.RAW, SHEETS.LOG, SHEETS.LOG_DETAIL],
    [SHEETS.STATE, SHEETS.TREND, SHEETS.DASH, SHEETS.AUDIT],
    [SHEETS.TG_OUT, SHEETS.EXEC, SHEETS.ALERTS, SHEETS.ALERTS_LOG],
    [SHEETS.ERR, SHEETS.RAW_USER_SNAPSHOTS, SHEETS.DAILY_USER_AGG, SHEETS.USER_LOADS]
  ];

  if (phase >= groups.length) {
    // already complete; run finalizers
    try { rebuildDashboard(); } catch (e) { logErr_(ss, 'INIT_PHASE', 'rebuild failed', String(e)); }
    setCfgValue_(ss, 'INIT_PHASE', 0);
    return;
  }

  const toCreate = groups[phase] || [];
  toCreate.forEach(name => {
    try {
      ensureSheet_(ss, name, DEFAULT_HEADERS[name] || [""]);
    } catch (e) {
      try { logErr_(ss, 'INIT_PHASE', `ensure ${name} failed`, String(e)); } catch(_){}
    }
    Utilities.sleep(300);
  });

  setCfgValue_(ss, 'INIT_PHASE', phase + 1);
}

function resetInitPhase() {
  const ss = SpreadsheetApp.openById(SS_ID);
  setCfgValue_(ss, 'INIT_PHASE', 0);
}

// Lightweight: create missing sheets with minimal RPCs (no header writes).
function quickEnsureSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const existing = ss.getSheets().map(s => s.getName());
  const wanted = Object.keys(SHEETS).map(k => SHEETS[k]);
  wanted.forEach(name => {
    try {
      if (existing.indexOf(name) === -1) {
        ss.insertSheet(name);
      }
    } catch (e) {
      try { logErr_(ss, 'QUICK_ENSURE', `insert ${name} failed`, String(e)); } catch (_) {}
    }
  });
}

// Phase 2: apply headers in small batches to avoid timeouts. Run repeatedly until done.
function applyHeadersPhase(batchSize) {
  batchSize = Number(batchSize || 1);
  const ss = SpreadsheetApp.openById(SS_ID);
  const cfg = getCfg_(ss);
  const phase = Number(cfgStr_(cfg, 'INIT_HEADER_PHASE', 0));

  const allNames = Object.keys(DEFAULT_HEADERS);
  const total = allNames.length;
  const start = phase * batchSize;
  if (start >= total) {
    setCfgValue_(ss, 'INIT_HEADER_PHASE', 0);
    try { rebuildDashboard(); } catch (e) { try { logErr_(ss, 'INIT_HEADERS', 'rebuild failed', String(e)); } catch(_) {} }
    return;
  }

  const slice = allNames.slice(start, start + batchSize);
  slice.forEach(name => {
    try {
      const header = DEFAULT_HEADERS[name];
      if (!header) return;
      const sh = ss.getSheetByName(name);
      if (!sh) return;
      const existing = sh.getRange(1, 1, 1, header.length).getValues()[0];
      const same = existing.length === header.length && existing.every((x, i) => String(x) === String(header[i]));
      if (!same) sh.getRange(1, 1, 1, header.length).setValues([header]);
    } catch (e) {
      try { logErr_(ss, 'INIT_HEADERS', `header ${name} failed`, String(e)); } catch(_) {}
    }
    Utilities.sleep(400);
  });

  setCfgValue_(ss, 'INIT_HEADER_PHASE', phase + 1);
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