// Core.js intentionally keeps no doGet/doPost.
// API entrypoint is defined only in Code.js.

function HET_runtimeStateKey_(cycle) {
	return 'RUNTIME_STATE|' + String(cycle || '').trim().toUpperCase();
}

function HET_markRuntimeSuccess_(cycle, meta) {
	var props = HET.props();
	var now = hetNowDate_();
	var state = {
		cycle: String(cycle || '').trim().toUpperCase(),
		ok: true,
		lastSuccessMs: now.getTime(),
		lastFailureMs: hetToInt_(props.getProperty(HET_runtimeStateKey_(cycle) + '|LAST_FAILURE_MS'), 0),
		lastError: props.getProperty(HET_runtimeStateKey_(cycle) + '|LAST_ERROR') || '',
		meta: meta || {}
	};

	props.setProperty(HET_runtimeStateKey_(cycle), JSON.stringify(state));
	props.setProperty(HET_runtimeStateKey_(cycle) + '|LAST_SUCCESS_MS', String(state.lastSuccessMs));
}

function HET_markRuntimeFailure_(cycle, err, meta) {
	var props = HET.props();
	var now = hetNowDate_();
	var state = {
		cycle: String(cycle || '').trim().toUpperCase(),
		ok: false,
		lastSuccessMs: hetToInt_(props.getProperty(HET_runtimeStateKey_(cycle) + '|LAST_SUCCESS_MS'), 0),
		lastFailureMs: now.getTime(),
		lastError: hetSafeStr_(String(err || ''), 1000),
		meta: meta || {}
	};

	props.setProperty(HET_runtimeStateKey_(cycle), JSON.stringify(state));
	props.setProperty(HET_runtimeStateKey_(cycle) + '|LAST_FAILURE_MS', String(state.lastFailureMs));
	props.setProperty(HET_runtimeStateKey_(cycle) + '|LAST_ERROR', state.lastError);
}

function HET_triggerIntegritySnapshot_() {
	var expected = {
		runDashboardRefresh: false,
		runAlertCycle: false,
		runDailyReport: false,
		runCommandCycle: false,
		runRuntimeHealthCheck: false,
		runMaintenanceCycle: false
	};
	var triggers = [];

	ScriptApp.getProjectTriggers().forEach(function(t) {
		var handler = t.getHandlerFunction();
		triggers.push({
			handler: handler,
			type: String(t.getEventType())
		});
		if (expected.hasOwnProperty(handler)) {
			expected[handler] = true;
		}
	});

	return {
		expected: expected,
		missing: Object.keys(expected).filter(function(key) { return !expected[key]; }),
		ok: Object.keys(expected).every(function(key) { return expected[key]; }),
		triggers: triggers
	};
}

function HET_runtimeCyclePolicies_() {
	var cfg = HET.cfg();
	return {
		DASHBOARD_REFRESH: { label: 'Dashboard Refresh', warnMin: Math.max(10, hetToInt_(cfg.DASH_REFRESH_MIN, 5) * 2), critMin: Math.max(20, hetToInt_(cfg.DASH_REFRESH_MIN, 5) * 4) },
		ALERT_CYCLE: { label: 'Alert Cycle', warnMin: Math.max(6, hetToInt_(cfg.ALERT_REFRESH_MIN, 2) * 3), critMin: Math.max(12, hetToInt_(cfg.ALERT_REFRESH_MIN, 2) * 6) },
		COMMAND_CYCLE: { label: 'Command Cycle', warnMin: 10, critMin: 20 },
		TRIGGER_INTEGRITY: { label: 'Trigger Integrity', warnMin: 30, critMin: 90 },
		RUNTIME_HEALTH_CHECK: { label: 'Runtime Health Check', warnMin: 30, critMin: 90 },
		MAINTENANCE_CYCLE: { label: 'Maintenance Cycle', warnMin: 36 * 60, critMin: 72 * 60 }
	};
}

function HET_getRuntimeHealth_() {
	var props = HET.props().getProperties();
	var policies = HET_runtimeCyclePolicies_();
	var nowMs = Date.now();
	var cycles = [];
	var overall = 'HEALTHY';
	var triggerIntegrity = HET_triggerIntegritySnapshot_();

	Object.keys(policies).forEach(function(key) {
		var raw = props[HET_runtimeStateKey_(key)] || '';
		var state = hetSafeJsonParse_(raw, {}) || {};
		var lastSuccessMs = hetToInt_(state.lastSuccessMs || props[HET_runtimeStateKey_(key) + '|LAST_SUCCESS_MS'], 0);
		var ageMin = lastSuccessMs > 0 ? Math.floor((nowMs - lastSuccessMs) / 60000) : null;
		var status = 'UNKNOWN';

		if (ageMin === null) {
			status = 'NO_RUN';
		} else if (ageMin > policies[key].critMin) {
			status = 'CRITICAL';
		} else if (ageMin > policies[key].warnMin) {
			status = 'WARNING';
		} else {
			status = 'HEALTHY';
		}

		if (status === 'CRITICAL') overall = 'CRITICAL';
		else if (status === 'WARNING' && overall !== 'CRITICAL') overall = 'WARNING';

		cycles.push({
			key: key,
			label: policies[key].label,
			status: status,
			ageMin: ageMin,
			lastSuccess: lastSuccessMs > 0 ? hetFmt_(new Date(lastSuccessMs)) : 'n/a',
			lastFailure: state.lastFailureMs ? hetFmt_(new Date(state.lastFailureMs)) : 'n/a',
			lastError: hetSafeStr_(state.lastError || '', 240),
			meta: state.meta || {}
		});
	});

	if (!triggerIntegrity.ok) overall = 'CRITICAL';

	cycles.sort(function(a, b) {
		var rank = { CRITICAL: 1, WARNING: 2, NO_RUN: 3, UNKNOWN: 4, HEALTHY: 5 };
		return (rank[a.status] || 9) - (rank[b.status] || 9);
	});

	return {
		overall: overall,
		cycles: cycles,
		triggerIntegrity: triggerIntegrity
	};
}

function HET_retentionPolicies_() {
	return [
		{ sheet: HET.SHEETS.ROUTER_STATUS, keepRows: 5000, archive: true, archiveSheet: 'Archive - Router Status' },
		{ sheet: HET.SHEETS.RAW_TRAFFIC_LOG, keepRows: 5000, archive: true, archiveSheet: 'Archive - Raw Traffic Log' },
		{ sheet: HET.SHEETS.VPN_STATUS, keepRows: 3000, archive: true, archiveSheet: 'Archive - VPN Status' },
		{ sheet: HET.SHEETS.CONNECTED_USERS, keepRows: 3000, archive: false },
		{ sheet: HET.SHEETS.USER_DATA_USAGE, keepRows: 3000, archive: true, archiveSheet: 'Archive - User Data Usage' },
		{ sheet: HET.SHEETS.ROUTER_LOGS, keepRows: 2000, archive: true, archiveSheet: 'Archive - Router Logs' },
		{ sheet: HET.SHEETS.ROUTER_CHANGES, keepRows: 2000, archive: true, archiveSheet: 'Archive - Router Changes' },
		{ sheet: HET.SHEETS.ALERTS, keepRows: 2000, archive: true, archiveSheet: 'Archive - Alerts' },
		{ sheet: HET.SHEETS.OUTBOX, keepRows: 1500, archive: false },
		{ sheet: HET.SHEETS.COMMAND_CENTER, keepRows: 1000, archive: false },
		{ sheet: HET.SHEETS.SMART_SUMMARY_LOG, keepRows: 2000, archive: true, archiveSheet: 'Archive - Smart Summary Log' },
		{ sheet: HET.SHEETS.DAILY_REPORTS, keepRows: 400, archive: true, archiveSheet: 'Archive - Daily Reports' },
		{ sheet: HET.SHEETS.RAW_USER_USAGE, keepRows: 8000, archive: true, archiveSheet: 'Archive - Raw User Usage' },
		{ sheet: HET.SHEETS.DEVICE_MAPPING, keepRows: 3000, archive: false },
		{ sheet: HET.SHEETS.DAILY_USER_SUMMARY, keepRows: 3000, archive: true, archiveSheet: 'Archive - Daily User Summary' },
		{ sheet: HET.SHEETS.MONTHLY_USER_SUMMARY, keepRows: 1200, archive: true, archiveSheet: 'Archive - Monthly User Summary' },
		{ sheet: HET.SHEETS.TOP_USERS_DAILY, keepRows: 1000, archive: true, archiveSheet: 'Archive - Top Users Daily' },
		{ sheet: HET.SHEETS.TOP_USERS_MONTHLY, keepRows: 1000, archive: true, archiveSheet: 'Archive - Top Users Monthly' },
		{ sheet: HET.SHEETS.REPORTS_OUTPUT, keepRows: 3000, archive: true, archiveSheet: 'Archive - Reports Output' },
		{ sheet: HET.SHEETS.MOBILE_VPN_EVENTS, keepRows: 6000, archive: true, archiveSheet: 'Archive - Mobile VPN Events' },
		{ sheet: HET.SHEETS.MOBILE_VPN_ACTIVE, keepRows: 500, archive: false },
		{ sheet: HET.SHEETS.MOBILE_VPN_SUMMARY, keepRows: 3000, archive: true, archiveSheet: 'Archive - Mobile VPN Summary' },
		{ sheet: HET.SHEETS.RAW_LIVE, keepRows: hetToInt_(HET.cfg().RAW_KEEP_ROWS, 2000), archive: false },
		{ sheet: HET.SHEETS.RAW_EVENTS, keepRows: hetToInt_(HET.cfg().RAW_KEEP_ROWS, 2000), archive: false }
	];
}

function HET_getArchiveSheet_(archiveName, sourceHeader) {
	var ss = HET.ss();
	var sh = ss.getSheetByName(archiveName);
	if (!sh) sh = ss.insertSheet(archiveName);
	if (sourceHeader && sourceHeader.length) {
		hetEnsureHeader_(sh, sourceHeader);
	}
	return sh;
}

function HET_archiveOverflowRows_(policy) {
	var ss = HET.ss();
	var sh = ss.getSheetByName(policy.sheet);
	var last;
	var keepRows;
	var overflow;
	var width;
	var rows;
	var archive;
	var startRow;

	if (!sh) {
		return { sheet: policy.sheet, archived: 0, deleted: 0, skipped: true, reason: 'missing sheet' };
	}

	last = sh.getLastRow();
	keepRows = Math.max(0, hetToInt_(policy.keepRows, 0));
	overflow = last - (keepRows + 1);

	if (overflow <= 0) {
		return { sheet: policy.sheet, archived: 0, deleted: 0, skipped: true, reason: 'within limit' };
	}

	width = sh.getLastColumn();
	rows = sh.getRange(keepRows + 2, 1, overflow, width).getValues();

	if (policy.archive && rows.length) {
		archive = HET_getArchiveSheet_(policy.archiveSheet, HET.HEADERS[policy.sheet] || sh.getRange(1, 1, 1, width).getValues()[0]);
		startRow = Math.max(archive.getLastRow(), 1) + 1;
		archive.getRange(startRow, 1, rows.length, width).setValues(rows);
	}

	sh.deleteRows(keepRows + 2, overflow);

	return {
		sheet: policy.sheet,
		archived: policy.archive ? rows.length : 0,
		deleted: overflow,
		archiveSheet: policy.archive ? policy.archiveSheet : ''
	};
}

function HET_runRetentionCycle_() {
	var results = HET_retentionPolicies_().map(HET_archiveOverflowRows_);
	return {
		ok: true,
		checkedAt: hetFmt_(hetNowDate_()),
		results: results
	};
}
