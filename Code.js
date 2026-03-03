function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 NOC Control")
    .addItem("✅ Init / Fix All Sheets", "initSetup")
    .addItem("⚙ Enterprise Setup", "setupEnterpriseAndShowReport")
    .addSeparator()
    .addItem("🧪 Test Ingest (User Monitor)", "testIngestUserMonitor")
    .addSeparator()
    .addItem("⚙ Install Triggers", "installTriggers")
    .addToUi();
}

function doPost(e) { return ingestUserSnapshotToMonitor(e); }
function doGet(e) { return ingestUserSnapshotToMonitor(e); }

function initSetup() {
  const ss = SpreadsheetApp.openById(SS_ID);
  try { ensureAllSheetsEnterprise(); } catch (e) { try { logErr_(ss, 'INIT_SIMPLE', 'ensureAllSheetsEnterprise failed', String(e)); } catch(_){} }
}

function initSetupSafe() { initSetup(); }
function initSetupPhased() { initSetup(); }

function quickEnsureSheets() {
  // Intentionally avoid auto-creating sheets; prefer explicit initSetup()
  const ss = SpreadsheetApp.openById(SS_ID);
  const name = SHEETS.USER_MONITOR;
  try { if (!ss.getSheetByName(name)) { /* no auto-create */ } } catch (e) { try { logErr_(ss, 'QUICK_ENSURE', `check ${name} failed`, String(e)); } catch(_){} }
}