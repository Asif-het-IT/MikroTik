// Enterprise setup helpers moved out of Code.js for clarity.
// Provides a single-shot, auditable, timeout-safe enterprise setup flow.

// Simplified enterprise setup: single-sheet architecture (USER_MONITOR)
function _headerForSheetName(sheetName) {
  if (sheetName === SHEETS.USER_MONITOR) return DEFAULT_HEADERS.USER_MONITOR;
  return null;
}

function _buildMasterSheetList() {
  return [SHEETS.USER_MONITOR];
}

function ensureAllSheetsEnterprise() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const master = _buildMasterSheetList();
  const total = master.length;
  let ok = 0;
  const details = [];

  for (let i = 0; i < master.length; i++) {
    const name = master[i];
    try {
      const sh = ss.getSheetByName(name);
      const expected = _headerForSheetName(name);
      if (!sh) {
        details.push({sheet: name, exists: false});
        continue;
      }
      if (expected && expected.length) {
        const lastRow = sh.getLastRow();
        const existing = sh.getRange(1, 1, 1, expected.length).getValues()[0];
        const same = existing.length === expected.length && existing.every((x, idx) => String(x) === String(expected[idx]));
        details.push({sheet: name, exists: true, header_ok: same, hadData: lastRow > 1});
        if (same) ok++;
      } else {
        details.push({sheet: name, exists: true});
        ok++;
      }
    } catch (e) {
      try { logErr_(ss, 'ENSURE_ENTERPRISE', `sheet ${name} failed`, String(e)); } catch (_) {}
      details.push({sheet: name, error: String(e)});
    }
  }

  const summary = `${ok}/${total} sheets OK`;
  return {total: total, ok: ok, details: details, summary: summary};
}

function createUserMonitorSheet() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const name = SHEETS.USER_MONITOR;
  const header = _headerForSheetName(name) || DEFAULT_HEADERS.USER_MONITOR;
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  if (sh.getLastRow() === 0) sh.appendRow(header);
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  styleSheetHeader_(sh);
  return {sheet: name, created: true};
}

function validateAllHeaders(autoFix) {
  autoFix = !!autoFix;
  const ss = SpreadsheetApp.openById(SS_ID);
  const master = _buildMasterSheetList();
  const results = [];

  for (let i = 0; i < master.length; i++) {
    const name = master[i];
    try {
      const sh = ss.getSheetByName(name);
      if (!sh) {
        results.push({sheet: name, exists: false});
        continue;
      }
      const expected = _headerForSheetName(name);
      if (!expected) {
        results.push({sheet: name, exists: true, header: 'none'});
        continue;
      }
      const existing = sh.getRange(1, 1, 1, expected.length).getValues()[0];
      const same = existing.length === expected.length && existing.every((x, idx) => String(x) === String(expected[idx]));
      if (same) {
        results.push({sheet: name, exists: true, header_ok: true});
      } else {
        results.push({sheet: name, exists: true, header_ok: false, existing: existing});
        if (autoFix) {
          sh.getRange(1, 1, 1, expected.length).setValues([expected]);
          styleSheetHeader_(sh);
        }
      }
    } catch (e) {
      try { logErr_(ss, 'VALIDATE_HEADERS', `validate ${name} failed`, String(e)); } catch (_) {}
      results.push({sheet: name, error: String(e)});
    }
    Utilities.sleep(80);
  }

  return results;
}

function getSetupStatusReport() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const master = _buildMasterSheetList();
  let ok = 0;
  const details = [];

  for (let i = 0; i < master.length; i++) {
    const name = master[i];
    try {
      const sh = ss.getSheetByName(name);
      if (!sh) {
        details.push({sheet: name, exists: false});
        continue;
      }
      const expected = _headerForSheetName(name);
      if (!expected) {
        details.push({sheet: name, exists: true, header: 'none'});
        ok++;
        continue;
      }
      const existing = sh.getRange(1, 1, 1, expected.length).getValues()[0];
      const same = existing.length === expected.length && existing.every((x, idx) => String(x) === String(expected[idx]));
      details.push({sheet: name, exists: true, header_ok: same});
      if (same) ok++;
    } catch (e) {
      try { logErr_(ss, 'SETUP_REPORT', `report ${name} failed`, String(e)); } catch (_) {}
      details.push({sheet: name, error: String(e)});
    }
  }

  const summary = `${ok}/${master.length} sheets OK`;
  return {summary: summary, total: master.length, ok: ok, details: details};
}

// Run enterprise setup once and present a concise UI summary to the user.
function setupEnterpriseAndShowReport() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const result = ensureAllSheetsEnterprise();
  // If any required sheets are missing, create USER_MONITOR explicitly.
  const missing = (result && result.details) ? result.details.filter(d => d.exists === false).map(d=>d.sheet) : [];
  if (missing.length > 0) {
    try { createUserMonitorSheet(); } catch (e) { try { logErr_(ss, 'SETUP_ENTERPRISE', 'createUserMonitorSheet failed', String(e)); } catch(_){} }
  }

  const final = ensureAllSheetsEnterprise();
  const summary = final && final.summary ? final.summary : `${final.ok}/${final.total} sheets OK`;
  // persist a brief exec summary into Script Properties instead of creating sheets
  try {
    PropertiesService.getScriptProperties().setProperty('SETUP_ENTERPRISE_LAST', JSON.stringify({ts: new Date().toISOString(), summary: summary, ok: result.ok, total: result.total}));
  } catch (e) {
    try { logErr_(ss, 'SETUP_ENTERPRISE_LOG', 'failed to write script property', String(e)); } catch (_) {}
  }

  try { ss.toast(summary, 'Setup Summary', 8); } catch (e) {}
  try { Logger.log('Enterprise setup: %s', summary); } catch (e) {}
  return final;
}
