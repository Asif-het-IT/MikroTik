function ingest_(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return ContentService.createTextOutput("LOCK_BUSY");
  
  let ss = null;
  try {
    ss = SpreadsheetApp.openById(SS_ID);
    ensureAll_(ss);
  
    const cfg = getCfg_(ss);
    const p = (e && e.parameter) ? e.parameter : {};
  
    const inToken = String(p.token || "").trim();
    const t1 = String(cfgStr_(cfg, "TOKEN", "")).trim();
    const t2 = String(cfgStr_(cfg, "TOKEN_ALT", "")).trim();
    const knownTokens = [
      t1,
      t2,
      "MONITOR_TOKEN_2026",
      "HET_MONITOR_TOKEN_2026",
    ].filter(Boolean);
    const validToken = inToken && knownTokens.indexOf(inToken) !== -1;
  
    if (!validToken) {
      logErr_(
        ss,
        "AUTH_FAIL",
        `Invalid token (recv=${inToken.slice(0, 8)}..., cfg=${t1.slice(0, 8)}..., alt=${t2.slice(0, 8)}...)`,
        JSON.stringify(p).slice(0, 1500)
      );
      return ContentService.createTextOutput("AUTH_FAIL");
    }
  
    const now = new Date();
    const type = safeText_(p.type || "live", 16).toLowerCase();
  
    if (type === "log" || type === "rlog") {
      const logMsg = safeText_(p.msg || "", 800);
      const logObj = {
        ts_server: now,
        type: (type === "rlog" ? "rlog" : "log"),
        site: safeText_(p.site || cfgStr_(cfg, "SITE", "UNKNOWN"), 32),
        router: safeText_(p.router || "", 64),
        msg: logMsg,
        payload_json: JSON.stringify(p).slice(0, 4500),
        ingest_status: "OK",
      };
  
      if (type === "rlog") {
        const detailObj = {
          ts_server: now,
          site: logObj.site,
          router: logObj.router,
          log_time: safeText_(p.log_time || "", 32),
          log_topics: safeText_(p.log_topics || "", 128),
          log_buffer: safeText_(p.log_buffer || "", 32),
          msg: logMsg,
          payload_json: logObj.payload_json,
          ingest_status: "OK",
        };
        writeLogDetailTop_(ss, cfg, detailObj);
        if (detailObj.log_topics) {
          logObj.msg = `[${detailObj.log_topics}] ${detailObj.msg}`.slice(0, 800);
        }
      }
  
      writeLogTop_(ss, cfg, logObj);
      upsertStateFromLog_(ss, cfg, logObj);
      maybeAutoOutbox_(ss, cfg);
      return ContentService.createTextOutput("OK");
    }
  
    const hotspotActive = (p.hotspot_active === undefined || p.hotspot_active === null || String(p.hotspot_active).trim() === "")
      ? 0 : safeNum_(p.hotspot_active);
  
    const rowObj = {
      ts_server: now,
      type: "live",
      site: safeText_(p.site || cfgStr_(cfg, "SITE", "UNKNOWN"), 32),
      router: safeText_(p.router || "", 64),
      uptime: safeText_(p.uptime || "", 48),
      cpu: safeNum_(p.cpu),
      memfree: safeNum_(p.memfree),
      memtotal: safeNum_(p.memtotal),
      mem_pct: "",
      isp: safeEnum_(p.isp, ["UP", "DOWN", ""], ""),
      ipsec: safeEnum_(p.ipsec, ["UP", "DOWN", ""], ""),
      rdp: safeEnum_(p.rdp, ["UP", "DOWN", ""], ""),
      hotspot_active: hotspotActive,
      leases: safeNum_(p.leases),
      wanip: safeText_(p.wanip || "", 64),
      isp_rx: safeNum_(p.isp_rx),
      isp_tx: safeNum_(p.isp_tx),
      lan_rx: safeNum_(p.lan_rx),
      lan_tx: safeNum_(p.lan_tx),
      unity_rx: safeNum_(p.unity_rx),
      unity_tx: safeNum_(p.unity_tx),
      store_rx: safeNum_(p.store_rx),
      store_tx: safeNum_(p.store_tx),
      buk_rx: safeNum_(p.buk_rx),
      buk_tx: safeNum_(p.buk_tx),
      wifi_rx: safeNum_(p.wifi_rx),
      wifi_tx: safeNum_(p.wifi_tx),
      top5_users: safeText_(p.top5_users || "", 1800),
      queues: safeText_(p.queues || "", 4500),
      payload_json: JSON.stringify(p).slice(0, 4500),
      ingest_status: "OK",
    };
  
    rowObj.mem_pct = calcMemPct_(rowObj.memfree, rowObj.memtotal);
  
    writeRaw_(ss, cfg, rowObj);
    enforceRawRetention_(ss, cfg);
    upsertState_(ss, cfg, rowObj);
    trafficAnalyticsForSite_(ss, cfg, rowObj.site);
    maybeRunEngines_(ss, cfg);
    maybeAutoOutbox_(ss, cfg);
  
    return ContentService.createTextOutput("OK");
  } catch (err) {
    try {
      if (!ss) ss = SpreadsheetApp.openById(SS_ID);
      logErr_(ss, "INGEST", String(err), safeText_(JSON.stringify(e || {}), 1500));
    } catch (_) {}
    return ContentService.createTextOutput("ERROR");
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// Ingest user snapshot into single-sheet USER_MONITOR.
function ingestUserSnapshotToMonitor(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return ContentService.createTextOutput('LOCK_BUSY');
  let ss = null;
  try {
    ss = SpreadsheetApp.openById(SS_ID);
    ensureAllSheetsEnterprise();

    const cfg = getCfg_(ss);
    const pRaw = (e && e.parameter) ? e.parameter : (e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {});

    const inToken = String(pRaw.token || '').trim();
    const t1 = String(cfgStr_(cfg, 'TOKEN', '')).trim();
    const t2 = String(cfgStr_(cfg, 'TOKEN_ALT', '')).trim();
    const knownTokens = [t1, t2, 'MONITOR_TOKEN_2026', 'HET_MONITOR_TOKEN_2026'].filter(Boolean);
    if (!inToken || knownTokens.indexOf(inToken) === -1) {
      try { logErr_(ss, 'AUTH_FAIL_USER_MON', 'invalid token', JSON.stringify(pRaw).slice(0,500)); } catch(_) {}
      return ContentService.createTextOutput('AUTH_FAIL');
    }

    const ts = pRaw.ts ? new Date(pRaw.ts) : new Date();
    const site = safeText_(pRaw.site || cfgStr_(cfg, 'SITE', 'UNKNOWN'), 32);
    const router = safeText_(pRaw.router || '', 64);
    const ip = safeText_(pRaw.ip || pRaw.IP || '', 64);
    const mac = safeText_(pRaw.mac || '', 32);
    const hostname = safeText_(pRaw.host || pRaw.hostname || '', 128);
    const rx_total = safeNum_(pRaw.rx_total || pRaw.rx || 0);
    const tx_total = safeNum_(pRaw.tx_total || pRaw.tx || 0);
    const interval_sec = Math.max(1, Number(pRaw.interval_sec || pRaw.interval || 60));

    const total_bytes = Number(rx_total) + Number(tx_total);

    // find previous row for same ip+router (scan from bottom)
    const sh = ss.getSheetByName(SHEETS.USER_MONITOR);
    if (!sh) {
      try { ss.insertSheet(SHEETS.USER_MONITOR); } catch (e) { try { logErr_(ss, 'INGEST_USER_MON', 'create sheet failed', String(e)); } catch(_){} }
    }

    let prev_total = null;
    try {
      const lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        const vals = sh.getRange(2, 1, lastRow - 1, 11).getValues();
        for (let i = vals.length - 1; i >= 0; i--) {
          const r = vals[i];
          const rRouter = String(r[2] || '');
          const rIp = String(r[3] || '');
          if (rRouter === router && rIp === ip) {
            const rRx = Number(r[6] || 0);
            const rTx = Number(r[7] || 0);
            prev_total = rRx + rTx;
            break;
          }
        }
      }
    } catch (e) {
      try { logErr_(ss, 'INGEST_USER_MON', 'prev lookup failed', String(e)); } catch(_){}
    }

    const delta_bytes = (prev_total === null) ? 0 : Math.max(0, total_bytes - prev_total);
    const delta_mbps = interval_sec > 0 ? Number(((delta_bytes * 8) / interval_sec / 1e6).toFixed(3)) : 0;
    const date_key = Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // append row: timestamp, site, router, ip, mac, hostname, rx_total, tx_total, delta_bytes, delta_mbps, date_key
    try {
      sh.appendRow([ts, site, router, ip, mac, hostname, rx_total, tx_total, delta_bytes, delta_mbps, date_key]);
    } catch (e) {
      try { logErr_(ss, 'INGEST_USER_MON', 'append failed', String(e)); } catch(_){}
      return ContentService.createTextOutput('ERROR');
    }

    return ContentService.createTextOutput('OK');
  } catch (err) {
    try { if (!ss) ss = SpreadsheetApp.openById(SS_ID); logErr_(ss, 'INGEST_USER_MON', String(err), ''); } catch(_){}
    return ContentService.createTextOutput('ERROR');
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// Generate Top N users for a given date (defaults to today) from USER_MONITOR sheet.
function generateTop10FromUserMonitor(dateKey, topN) {
  topN = topN || 10;
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SHEETS.USER_MONITOR);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const vals = sh.getRange(2, 1, lastRow - 1, 11).getValues();
  const tz = Session.getScriptTimeZone();
  const key = dateKey || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const map = {}; // ip -> {ip, mac, hostname, bytes}
  for (let i = 0; i < vals.length; i++) {
    const r = vals[i];
    const rDate = String(r[10] || '');
    if (rDate !== key) continue;
    const ip = String(r[3] || '');
    const mac = String(r[4] || '');
    const host = String(r[5] || '');
    const delta = Number(r[8] || 0);
    if (!map[ip]) map[ip] = {ip: ip, mac: mac, host: host, bytes: 0};
    map[ip].bytes += delta;
  }

  const arr = Object.keys(map).map(k => map[k]);
  arr.sort((a,b) => b.bytes - a.bytes);
  return arr.slice(0, topN).map((x, idx) => ({rank: idx+1, ip: x.ip, mac: x.mac, host: x.host, bytes: x.bytes, mb: Number((x.bytes/1e6).toFixed(3))}));
}

function ingest_(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return ContentService.createTextOutput("LOCK_BUSY");

  let ss = null;
  try {
    ss = SpreadsheetApp.openById(SS_ID);
    ensureAll_(ss);

    const cfg = getCfg_(ss);
    const p = (e && e.parameter) ? e.parameter : {};

    const inToken = String(p.token || "").trim();
    const t1 = String(cfgStr_(cfg, "TOKEN", "")).trim();
    const t2 = String(cfgStr_(cfg, "TOKEN_ALT", "")).trim();
    const knownTokens = [
      t1,
      t2,
      "MONITOR_TOKEN_2026",
      "HET_MONITOR_TOKEN_2026",
    ].filter(Boolean);
    const validToken = inToken && knownTokens.indexOf(inToken) !== -1;

    if (!validToken) {
      logErr_(
        ss,
        "AUTH_FAIL",
        `Invalid token (recv=${inToken.slice(0, 8)}..., cfg=${t1.slice(0, 8)}..., alt=${t2.slice(0, 8)}...)`,
        JSON.stringify(p).slice(0, 1500)
      );
      return ContentService.createTextOutput("AUTH_FAIL");
    }

    const now = new Date();
    const type = safeText_(p.type || "live", 16).toLowerCase();

    if (type === "log" || type === "rlog") {
      const logMsg = safeText_(p.msg || "", 800);
      const logObj = {
        ts_server: now,
        type: (type === "rlog" ? "rlog" : "log"),
        site: safeText_(p.site || cfgStr_(cfg, "SITE", "UNKNOWN"), 32),
        router: safeText_(p.router || "", 64),
        msg: logMsg,
        payload_json: JSON.stringify(p).slice(0, 4500),
        ingest_status: "OK",
      };

      if (type === "rlog") {
        const detailObj = {
          ts_server: now,
          site: logObj.site,
          router: logObj.router,
          log_time: safeText_(p.log_time || "", 32),
          log_topics: safeText_(p.log_topics || "", 128),
          log_buffer: safeText_(p.log_buffer || "", 32),
          msg: logMsg,
          payload_json: logObj.payload_json,
          ingest_status: "OK",
        };
        writeLogDetailTop_(ss, cfg, detailObj);
        if (detailObj.log_topics) {
          logObj.msg = `[${detailObj.log_topics}] ${detailObj.msg}`.slice(0, 800);
        }
      }

      writeLogTop_(ss, cfg, logObj);
      upsertStateFromLog_(ss, cfg, logObj);
      maybeAutoOutbox_(ss, cfg);
      return ContentService.createTextOutput("OK");
    }

    const hotspotActive = (p.hotspot_active === undefined || p.hotspot_active === null || String(p.hotspot_active).trim() === "")
      ? 0 : safeNum_(p.hotspot_active);

    const rowObj = {
      ts_server: now,
      type: "live",
      site: safeText_(p.site || cfgStr_(cfg, "SITE", "UNKNOWN"), 32),
      router: safeText_(p.router || "", 64),
      uptime: safeText_(p.uptime || "", 48),
      cpu: safeNum_(p.cpu),
      memfree: safeNum_(p.memfree),
      memtotal: safeNum_(p.memtotal),
      mem_pct: "",
      isp: safeEnum_(p.isp, ["UP", "DOWN", ""], ""),
      ipsec: safeEnum_(p.ipsec, ["UP", "DOWN", ""], ""),
      rdp: safeEnum_(p.rdp, ["UP", "DOWN", ""], ""),
      hotspot_active: hotspotActive,
      leases: safeNum_(p.leases),
      wanip: safeText_(p.wanip || "", 64),
      isp_rx: safeNum_(p.isp_rx),
      isp_tx: safeNum_(p.isp_tx),
      lan_rx: safeNum_(p.lan_rx),
      lan_tx: safeNum_(p.lan_tx),
      unity_rx: safeNum_(p.unity_rx),
      unity_tx: safeNum_(p.unity_tx),
      store_rx: safeNum_(p.store_rx),
      store_tx: safeNum_(p.store_tx),
      buk_rx: safeNum_(p.buk_rx),
      buk_tx: safeNum_(p.buk_tx),
      wifi_rx: safeNum_(p.wifi_rx),
      wifi_tx: safeNum_(p.wifi_tx),
      top5_users: safeText_(p.top5_users || "", 1800),
      queues: safeText_(p.queues || "", 4500),
      payload_json: JSON.stringify(p).slice(0, 4500),
      ingest_status: "OK",
    };

    rowObj.mem_pct = calcMemPct_(rowObj.memfree, rowObj.memtotal);

    writeRaw_(ss, cfg, rowObj);
    enforceRawRetention_(ss, cfg);
    upsertState_(ss, cfg, rowObj);
    trafficAnalyticsForSite_(ss, cfg, rowObj.site);
    maybeRunEngines_(ss, cfg);
    maybeAutoOutbox_(ss, cfg);

    return ContentService.createTextOutput("OK");
  } catch (err) {
    try {
      if (!ss) ss = SpreadsheetApp.openById(SS_ID);
      logErr_(ss, "INGEST", String(err), safeText_(JSON.stringify(e || {}), 1500));
    } catch (_) {}
    return ContentService.createTextOutput("ERROR");
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function writeRaw_(ss, cfg, r) {
  const sh = ss.getSheetByName(SHEETS.RAW);
  const mode = cfgStr_(cfg, "RAW_MODE", "TOP").toUpperCase();
  const fmt = cfgFmt_(cfg);

  const values = [[
    r.ts_server, r.type, r.site,
    r.router, r.uptime,
    r.cpu, r.memfree, r.memtotal, r.mem_pct,
    r.isp, r.ipsec, r.rdp,
    r.hotspot_active, r.leases,
    r.wanip,
    r.isp_rx, r.isp_tx,
    r.lan_rx, r.lan_tx,
    r.unity_rx, r.unity_tx,
    r.store_rx, r.store_tx,
    r.buk_rx, r.buk_tx,
    r.wifi_rx, r.wifi_tx,
    r.top5_users,
    r.queues,
    r.payload_json,
    r.ingest_status
  ]];

  let rowNum;
  if (mode === "TOP") {
    sh.insertRowBefore(2);
    rowNum = 2;
    sh.getRange(rowNum, 1, 1, values[0].length).setValues(values);
  } else {
    sh.appendRow(values[0]);
    rowNum = sh.getLastRow();
  }

  styleSheetHeader_(sh);
  styleNewRow_(sh, rowNum, values[0].length, fmt);
}

function writeLogTop_(ss, cfg, r) {
  const sh = ss.getSheetByName(SHEETS.LOG);
  const fmt = cfgFmt_(cfg);

  sh.insertRowBefore(2);
  const rowNum = 2;

  const values = [[
    r.ts_server, r.type, r.site, r.router, r.msg, r.payload_json, r.ingest_status
  ]];

  sh.getRange(rowNum, 1, 1, values[0].length).setValues(values);
  styleSheetHeader_(sh);
  styleNewRow_(sh, rowNum, values[0].length, fmt);
}

function writeLogDetailTop_(ss, cfg, r) {
  const sh = ss.getSheetByName(SHEETS.LOG_DETAIL);
  const fmt = cfgFmt_(cfg);

  sh.insertRowBefore(2);
  const rowNum = 2;

  const values = [[
    r.ts_server,
    r.site,
    r.router,
    r.log_time,
    r.log_topics,
    r.log_buffer,
    r.msg,
    r.payload_json,
    r.ingest_status,
  ]];

  sh.getRange(rowNum, 1, 1, values[0].length).setValues(values);
  styleSheetHeader_(sh);
  styleNewRow_(sh, rowNum, values[0].length, fmt);
}

function upsertState_(ss, cfg, r) {
  const sh = ss.getSheetByName(SHEETS.STATE);
  const data = sh.getDataRange().getValues();
  const idx = idxState_(data[0]);

  const now = new Date();
  const liveInfo = calcLive_(r.ts_server, now, cfg);
  const grade = calcGrade_(r, cfg);
  const top5 = safeText_(r.top5_users || parseTop5Users_(r.queues), 1800);

  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.site]) === String(r.site)) {
      rowNum = i + 1;
      break;
    }
  }

  const record = [[
    r.site,
    r.ts_server,
    r.router,
    r.uptime,
    r.cpu,
    r.mem_pct,
    r.isp,
    r.ipsec,
    r.rdp,
    r.hotspot_active,
    r.leases,
    r.wanip,
    grade,
    liveInfo.live_state,
    liveInfo.stale_minutes,
    "", "", "", "", "", "", "",
    "",
    top5
  ]];

  // Ensure newest state records are always at the top (row 2). If a record for this site
  // already exists, remove it and insert the new one at the top so latest data is first.
  if (rowNum !== -1) {
    try { sh.deleteRow(rowNum); } catch (e) {}
  }
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, record[0].length).setValues(record);
  const finalRow = 2;
  styleSheetHeader_(sh);
  sh.getRange(finalRow, idx.last_seen + 1).setNumberFormat(cfgFmt_(cfg));
}

function upsertStateFromLog_(ss, cfg, rlog) {
  const sh = ss.getSheetByName(SHEETS.STATE);
  const data = sh.getDataRange().getValues();
  const idx = idxState_(data[0]);
  const now = new Date();
  const liveInfo = calcLive_(rlog.ts_server, now, cfg);

  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.site]) === String(rlog.site)) {
      rowNum = i + 1;
      break;
    }
  }

  // Always insert/update the state record at the top (row 2).
  if (rowNum !== -1) {
    try { sh.deleteRow(rowNum); } catch (e) {}
  }

  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, 23).setValues([[
    rlog.site, rlog.ts_server, rlog.router, "",
    "", "", "", "", "",
    0, "", "",
    "OK", liveInfo.live_state, liveInfo.stale_minutes,
    "", "", "", "", "", "", "",
    "", ""
  ]]);
  styleSheetHeader_(sh);
  sh.getRange(2, idx.last_seen + 1).setNumberFormat(cfgFmt_(cfg));
}

function calcGrade_(r, cfg) {
  const CPU_WARN = cfgNum_(cfg, "CPU_WARN", 70);
  const CPU_CRIT = cfgNum_(cfg, "CPU_CRIT", 85);
  const MEM_WARN = cfgNum_(cfg, "MEM_WARN", 80);
  const MEM_CRIT = cfgNum_(cfg, "MEM_CRIT", 90);
  const LEASES_WARN = cfgNum_(cfg, "LEASES_WARN", 45);

  if (r.isp === "DOWN" || r.ipsec === "DOWN") return "CRIT";
  if (r.rdp === "DOWN") return "WARN";
  if (isFiniteNum_(r.cpu) && r.cpu >= CPU_CRIT) return "CRIT";
  if (isFiniteNum_(r.mem_pct) && r.mem_pct >= MEM_CRIT) return "CRIT";
  if (isFiniteNum_(r.cpu) && r.cpu >= CPU_WARN) return "WARN";
  if (isFiniteNum_(r.mem_pct) && r.mem_pct >= MEM_WARN) return "WARN";
  if (isFiniteNum_(r.leases) && r.leases >= LEASES_WARN) return "WARN";
  return "OK";
}

function calcLive_(lastSeen, now, cfg) {
  const STALE_WARN = cfgNum_(cfg, "STALE_WARN", 3);
  const STALE_CRIT = cfgNum_(cfg, "STALE_CRIT", 10);
  const LIVE_MINUTES = cfgNum_(cfg, "LIVE_MINUTES", 2);

  if (!(lastSeen instanceof Date)) return { live_state: "NO_DATA", stale_minutes: 999 };

  const staleMin = (now - lastSeen) / 60000;

  let state = "STALE";
  if (staleMin <= LIVE_MINUTES) state = "LIVE";
  else if (staleMin >= STALE_CRIT) state = "NO_DATA";
  else if (staleMin >= STALE_WARN) state = "STALE";
  else state = "STALE";

  return { live_state: state, stale_minutes: Math.round(staleMin * 10) / 10 };
}

function trafficAnalyticsForSite_(ss, cfg, site) {
  const raw = ss.getSheetByName(SHEETS.RAW);
  const data = raw.getDataRange().getValues();
  if (data.length < 3) return;

  const idx = idxRaw_(data[0]);
  let curRow = null;
  let prevRow = null;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.site]) === String(site)) {
      curRow = data[i];
      break;
    }
  }
  if (!curRow) return;

  let seen = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.site]) !== String(site)) continue;
    if (!seen) {
      seen = true;
      continue;
    }
    prevRow = data[i];
    break;
  }
  if (!prevRow) return;

  const t1 = curRow[idx.ts_server];
  const t0 = prevRow[idx.ts_server];
  if (!(t1 instanceof Date) || !(t0 instanceof Date)) return;
  const deltaSec = Math.max(1, (t1 - t0) / 1000);

  const mbps = (rx1, tx1, rx0, tx0) => {
    const a1 = Number(rx1), b1 = Number(tx1), a0 = Number(rx0), b0 = Number(tx0);
    if (!isFinite(a1) || !isFinite(b1) || !isFinite(a0) || !isFinite(b0)) return "";
    const d = (a1 + b1) - (a0 + b0);
    if (d <= 0) return 0;
    return Math.round(((d * 8) / deltaSec / 1e6) * 100) / 100;
  };

  const isp_mbps = mbps(curRow[idx.isp_rx], curRow[idx.isp_tx], prevRow[idx.isp_rx], prevRow[idx.isp_tx]);
  const lan_mbps = mbps(curRow[idx.lan_rx], curRow[idx.lan_tx], prevRow[idx.lan_rx], prevRow[idx.lan_tx]);
  const unity_mbps = mbps(curRow[idx.unity_rx], curRow[idx.unity_tx], prevRow[idx.unity_rx], prevRow[idx.unity_tx]);
  const store_mbps = mbps(curRow[idx.store_rx], curRow[idx.store_tx], prevRow[idx.store_rx], prevRow[idx.store_tx]);
  const buk_mbps = mbps(curRow[idx.buk_rx], curRow[idx.buk_tx], prevRow[idx.buk_rx], prevRow[idx.buk_tx]);
  const wifi_mbps = mbps(curRow[idx.wifi_rx], curRow[idx.wifi_tx], prevRow[idx.wifi_rx], prevRow[idx.wifi_tx]);

  const ISP_MAX = cfgNum_(cfg, "ISP_MAX_MBPS", 20);
  let isp_pct = "";
  if (isp_mbps === "" || ISP_MAX <= 0) {
    isp_pct = "";
  } else {
    isp_pct = Math.round((Number(isp_mbps) / ISP_MAX) * 100);
    // If calculated pct is unreasonably large, cap at 100 and record audit so config can be fixed
    if (isp_pct > 100) {
      isp_pct = 100;
      try { logErr_(ss, 'TRAFFIC', `ISP_MAX_MBPS may be misconfigured for site ${site}`, `isp_mbps=${isp_mbps} ISP_MAX=${ISP_MAX}`); } catch (e) {}
    }
  }

  const groups = [
    { k: "LAN", v: Number(lan_mbps) || 0 },
    { k: "UNITY", v: Number(unity_mbps) || 0 },
    { k: "STORE", v: Number(store_mbps) || 0 },
    { k: "BUK", v: Number(buk_mbps) || 0 },
    { k: "WIFI", v: Number(wifi_mbps) || 0 },
  ].sort((a, b) => b.v - a.v);

  const top_group = groups[0] ? `${groups[0].k} (${groups[0].v} Mbps)` : "";

  const st = ss.getSheetByName(SHEETS.STATE);
  const sdata = st.getDataRange().getValues();
  if (sdata.length < 2) return;

  const sidx = idxState_(sdata[0]);
  for (let i = 1; i < sdata.length; i++) {
    if (String(sdata[i][sidx.site]) === String(site)) {
      const rowNum = i + 1;
      st.getRange(rowNum, sidx.isp_mbps + 1, 1, 8).setValues([[
        isp_mbps, lan_mbps, unity_mbps, store_mbps, buk_mbps, wifi_mbps, isp_pct, top_group
      ]]);
      // Write per-user breakdown into USER_LOADS sheet
      try {
        const rawSh = ss.getSheetByName(SHEETS.RAW);
        const rawData = rawSh.getDataRange().getValues();
        const ridx = idxRaw_(rawData[0]);
        let topSnapshot = "";
        for (let r = 1; r < rawData.length; r++) {
          if (String(rawData[r][ridx.site]) === String(site)) {
            topSnapshot = String(rawData[r][ridx.top5_users] || rawData[r][ridx.queues] || "");
            // fallback: try to extract from payload_json
            if (!topSnapshot && rawData[r][ridx.payload_json]) {
              try { topSnapshot = extractTop5FromPayload_(rawData[r][ridx.payload_json]); } catch (e) { topSnapshot = ""; }
            }
            break;
          }
        }
        trafficUserBreakdownForSite_(ss, cfg, site, topSnapshot, isp_mbps);
      } catch (e) { /* ignore user breakdown errors */ }
      break;
    }
  }

  updateTrend_(ss, cfg, t1, site, isp_mbps, lan_mbps, unity_mbps, store_mbps, buk_mbps, wifi_mbps, isp_pct);
}

function updateTrend_(ss, cfg, ts, site, isp, lan, unity, store, buk, wifi, ispPct) {
  const sh = ss.getSheetByName(SHEETS.TREND);
  sh.appendRow([ts, site, isp, lan, unity, store, buk, wifi, ispPct]);

  styleSheetHeader_(sh);
  sh.getRange(sh.getLastRow(), 1).setNumberFormat(cfgFmt_(cfg));

  const keep = Math.max(50, cfgNum_(cfg, "TREND_SAMPLES", 180));
  const last = sh.getLastRow();
  if (last > keep + 1) {
    sh.deleteRows(keep + 2, last - (keep + 1));
  }
}

/* ---------- User snapshot ingestion & daily aggregation ---------- */

function ingestUserSnapshot(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return ContentService.createTextOutput("LOCK_BUSY");
  let ss = null;
  try {
    ss = SpreadsheetApp.openById(SS_ID);
    ensureAll_(ss);
    const cfg = getCfg_(ss);

    // Accept postData JSON or parameter.payload
    let payload = null;
    try {
      if (e && e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);
      else if (e && e.parameter && e.parameter.payload) payload = JSON.parse(e.parameter.payload);
      else payload = e && e.parameter ? e.parameter : {};
    } catch (err) { payload = {} }

    const inToken = String(payload.token || payload.t || "").trim();
    const t1 = String(cfgStr_(cfg, "TOKEN", "")).trim();
    const t2 = String(cfgStr_(cfg, "TOKEN_ALT", "")).trim();
    const knownTokens = [t1, t2].filter(Boolean);
    if (!inToken || knownTokens.indexOf(inToken) === -1) {
      logErr_(ss, "AUTH_FAIL", `Invalid token user snapshot`, JSON.stringify(payload).slice(0, 1500));
      return ContentService.createTextOutput("AUTH_FAIL");
    }

    const ts = payload.ts ? new Date(payload.ts) : new Date();
    const site = safeText_(payload.site || cfgStr_(cfg, "SITE", "UNKNOWN"), 64);
    const router = safeText_(payload.router || "", 64);
    const users = Array.isArray(payload.hotspot_active) ? payload.hotspot_active : (Array.isArray(payload.top_users) ? payload.top_users : (Array.isArray(payload.top_users_snapshot) ? payload.top_users_snapshot : []));
    const snapshotInterval = Number(payload.interval_sec || payload.interval || 600);

    const rawSh = ss.getSheetByName(SHEETS.RAW_USER_SNAPSHOTS);
    const rawVals = rawSh.getDataRange().getValues();

    // Build map of last snapshot by site|ip (latest first because sheet is TOP mode)
    const lastMap = {};
    for (let i = 1; i < rawVals.length; i++) {
      const rsite = String(rawVals[i][1] || rawVals[i][0] || "");
      const rip = String(rawVals[i][3] || "");
      const key = `${rsite}|${rip}`;
      if (!lastMap[key]) lastMap[key] = rawVals[i];
    }

    const rows = [];
    const aggUpdates = [];
    if (Array.isArray(users) && users.length) {
      users.slice(0, 200).forEach(u => {
        const ip = safeText_(u.ip || u.address || u.host || "", 64);
        const mac = safeText_(u.mac || u.hardware || u.hw || "", 64);
        const host = safeText_(u.host || u.hostname || u.name || "", 128);
        const rx = safeNum_(u.rx || u.rx_bytes || u.rx_total || 0);
        const tx = safeNum_(u.tx || u.tx_bytes || u.tx_total || 0);
        const total = Number(rx || 0) + Number(tx || 0);
        const iface = safeText_(u.iface || u.iface_name || "", 32);
        rows.push([ts, site, router, ip, mac, host, rx, tx, total, iface, snapshotInterval, JSON.stringify(u).slice(0, 2000)]);

        // compute delta against lastMap
        const key = `${site}|${ip}`;
        const prev = lastMap[key];
        let delta = null, deltaSec = snapshotInterval;
        if (prev) {
          try {
            const prevTotal = Number(prev[8] || 0);
            delta = total - prevTotal;
            const prevTs = prev[0] instanceof Date ? prev[0] : new Date(prev[0]);
            deltaSec = Math.max(1, (ts - prevTs) / 1000);
            if (!isFinite(delta) || delta < 0) delta = null; // reset detection
          } catch (e) { delta = null }
        }

        aggUpdates.push({date: Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd'), site, ip, mac, host, deltaBytes: delta, deltaSec, iface});
      });
    }

    // Insert rows at top in batch
    if (rows.length) {
      rawSh.insertRowsBefore(2, rows.length);
      rawSh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      styleSheetHeader_(rawSh);
    }

    // Apply aggregation updates
    aggUpdates.forEach(u => {
      if (!u.ip) return;
      upsertDailyUserAgg_(ss, cfg, u);
    });

    return ContentService.createTextOutput("OK");
  } catch (err) {
    try { if (!ss) ss = SpreadsheetApp.openById(SS_ID); logErr_(ss, 'INGEST_USER', String(err), JSON.stringify(e || {})); } catch (_) {}
    return ContentService.createTextOutput('ERROR');
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function upsertDailyUserAgg_(ss, cfg, u) {
  if (!u || !u.ip) return;
  const sh = ss.getSheetByName(SHEETS.DAILY_USER_AGG);
  const v = sh.getDataRange().getValues();
  const date = String(u.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  // find row for date+site+ip
  let found = -1;
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) === date && String(v[i][1]) === u.site && String(v[i][2]) === u.ip) { found = i + 1; break; }
  }

  const addBytes = Number(u.deltaBytes || 0);
  const addSec = Number(u.deltaSec || 0);
  if (found === -1) {
    const avg = (addSec > 0 && addBytes > 0) ? Math.round((addBytes * 8 / addSec / 1e6) * 100) / 100 : 0;
    const mb = Math.round((addBytes / 1024 / 1024) * 100) / 100;
    sh.appendRow([date, u.site, u.ip, u.mac || '', u.host || '', addBytes, mb, addSec, avg, addBytes < 0 ? 1 : 0, JSON.stringify({[u.iface]: addBytes})]);
  } else {
    // update existing
    const curBytes = Number(v[found - 1][5] || 0);
    const curSec = Number(v[found - 1][7] || 0);
    const newBytes = curBytes + (addBytes > 0 ? addBytes : 0);
    const newSec = curSec + (addSec > 0 ? addSec : 0);
    const mb = Math.round((newBytes / 1024 / 1024) * 100) / 100;
    const avg = (newSec > 0 && newBytes > 0) ? Math.round((newBytes * 8 / newSec / 1e6) * 100) / 100 : 0;
    const resets = Number(v[found - 1][9] || 0) + (addBytes === null ? 1 : 0);
    const ifaceMap = v[found - 1][10] ? (() => { try { return JSON.parse(String(v[found - 1][10] || '{}')); } catch(e){return {}} })() : {};
    ifaceMap[u.iface || 'unknown'] = (Number(ifaceMap[u.iface || 'unknown'] || 0) + Math.max(0, addBytes));
    sh.getRange(found, 6).setValue(newBytes);
    sh.getRange(found, 7).setValue(mb);
    sh.getRange(found, 8).setValue(newSec);
    sh.getRange(found, 9).setValue(avg);
    sh.getRange(found, 10).setValue(resets);
    sh.getRange(found, 11).setValue(JSON.stringify(ifaceMap));
  }
}

function generateTopUsersReport() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const sh = ss.getSheetByName(SHEETS.DAILY_USER_AGG);
  const v = sh.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) !== today) continue;
    rows.push({site: v[i][1], ip: v[i][2], mac: v[i][3], host: v[i][4], total_bytes: Number(v[i][5]||0), total_seconds: Number(v[i][7]||0)});
  }
  if (!rows.length) return;
  rows.sort((a,b) => b.total_bytes - a.total_bytes);
  const top = rows.slice(0, Math.max(5, cfgNum_(cfg, 'TOP_USERS_N', 10)));

  const lines = [];
  lines.push(`<b>Daily Top Users (${today})</b>`);
  lines.push('━━━━━━━━━━━━━━━━━━');
  top.forEach((r, idx) => {
    const mb = (r.total_bytes/1024/1024).toFixed(2);
    const avg = (r.total_seconds>0) ? (Math.round((r.total_bytes*8/r.total_seconds/1e6)*100)/100) : 0;
    lines.push(`${idx+1}. ${escapeHtml_(r.ip)} • ${escapeHtml_(r.mac||'-')} • ${escapeHtml_(r.host||'-')} • ${mb}MB • ${avg} Mbps`);
  });
  lines.push('━━━━━━━━━━━━━━━━━━');
  const msg = lines.join('\n');
  queueTelegram_(ss, cfg, `Top Users • ${today}`, msg);
  queueEmail_(ss, cfg, `Top Users ${today}`, msg, true);
  processOutboxNow();
}

function trafficUserBreakdownForSite_(ss, cfg, site, queuesSnapshot, isp_mbps) {
  if (!queuesSnapshot) return;
  const sh = ss.getSheetByName(SHEETS.USER_LOADS);
  const now = new Date();
  const arr = parseTop5UsersArray_(queuesSnapshot);
  if (!arr || !arr.length) return;

  // sum top bytes to compute pct per user
  const totalTop = arr.reduce((s, x) => s + (Number(x.bytes) || 0), 0) || 1;
  const rows = arr.map(u => {
    const bytes = Number(u.bytes) || 0;
    const mb = Math.round((bytes / 1024 / 1024) * 100) / 100;
    const pct = Math.round((bytes / totalTop) * 1000) / 10; // one decimal pct
    const category = mb >= cfgNum_(cfg, "USER_HEAVY_MB", 5) ? "HEAVY" : "LIGHT";
    return [now, site, u.name, bytes, mb, pct, category, String(queuesSnapshot).slice(0, 1000)];
  });

  // Append rows (keep recent first behavior)
  for (let i = rows.length - 1; i >= 0; i--) {
    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, rows[i].length).setValues([rows[i]]);
  }
  styleSheetHeader_(sh);
}

function rebuildDashboard() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);

  let dash = ss.getSheetByName(SHEETS.DASH);
  if (!dash) dash = ss.insertSheet(SHEETS.DASH);

  dash.clear();
  dash.getCharts().forEach(c => dash.removeChart(c));
  dash.setFrozenRows(4);
  try { dash.setHiddenGridlines(true); } catch (_) {}
  dash.getRange(1, 1, 500, 60).setBackground("#f3f4f6").setFontColor("#111827");
  dash.setColumnWidths(1, 32, 95);
  applyDashboardGeometry_(dash);

  const now = new Date();
  dash.getRange("A1:AF1").merge()
    .setValue("NOC Live Dashboard (Team Friendly View)")
    .setFontSize(14)
    .setFontWeight("bold")
    .setBackground("#1f2937")
    .setFontColor("#f9fafb");
  dash.getRange("A2:AF2").merge()
    .setValue(`Aaj ka Overview • Last Update: ${formatDateTime_(now, cfg)} • Auto Refresh ${cfgNum_(cfg, "DASH_REFRESH_MIN", 5)}m`)
    .setBackground("#e5e7eb")
    .setFontColor("#374151")
    .setFontSize(10);

  const stVals = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
  if (stVals.length < 2) {
    dash.getRange("A5").setValue("NO DATA YET – Router pushes ka wait karein…");
    return;
  }

  const idx = idxState_(stVals[0]);
  const activeAlerts = Math.max(0, ss.getSheetByName(SHEETS.ALERTS).getLastRow() - 1);
  const alertLogVals = ss.getSheetByName(SHEETS.ALERTS_LOG).getDataRange().getValues();
  const logVals = ss.getSheetByName(SHEETS.LOG).getDataRange().getValues();
  const toNum = v => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };

  let ok = 0, warn = 0, crit = 0, live = 0, stale = 0, nodata = 0;
  let ispDown = 0, vpnDown = 0;
  let cpuTotal = 0, ramTotal = 0, cntCpu = 0, cntRam = 0;
  const rowsData = [];
  const alarmsBySite = {};

  const activeVals = ss.getSheetByName(SHEETS.ALERTS).getDataRange().getValues();
  for (let i = 1; i < activeVals.length; i++) {
    const s = String(activeVals[i][1] || "");
    if (!s) continue;
    alarmsBySite[s] = (alarmsBySite[s] || 0) + 1;
  }

  for (let i = 1; i < stVals.length; i++) {
    const g = String(stVals[i][idx.status_grade] || "OK");
    if (g === "CRIT") crit++; else if (g === "WARN") warn++; else ok++;

    const ls = String(stVals[i][idx.live_state] || "");
    if (ls === "LIVE") live++;
    else if (ls === "NO_DATA") nodata++;
    else stale++;

    const isp = String(stVals[i][idx.isp] || "-");
    const vpn = String(stVals[i][idx.ipsec] || "-");
    if (isp === "DOWN") ispDown++;
    if (vpn === "DOWN") vpnDown++;

    const cpu = Number(stVals[i][idx.cpu]);
    const ram = Number(stVals[i][idx.mem_pct]);
    if (isFinite(cpu)) { cpuTotal += cpu; cntCpu++; }
    if (isFinite(ram)) { ramTotal += ram; cntRam++; }

    const ispPct = Number(stVals[i][idx.isp_pct]);
    const health = calcHealthScore_(g, ls, isp, vpn, ispPct, cpu, ram);
    const attention = attentionLabel_(g, ls, isp, vpn, ispPct);
    const site = String(stVals[i][idx.site] || "-");

    rowsData.push({
      site,
      live_state: ls,
      stale_minutes: stVals[i][idx.stale_minutes],
      last_seen: stVals[i][idx.last_seen],
      router: stVals[i][idx.router],
      isp,
      ipsec: vpn,
      rdp: stVals[i][idx.rdp],
      cpu: stVals[i][idx.cpu],
      mem_pct: stVals[i][idx.mem_pct],
      hotspot_active: stVals[i][idx.hotspot_active],
      leases: stVals[i][idx.leases],
      isp_mbps: stVals[i][idx.isp_mbps],
      lan_mbps: stVals[i][idx.lan_mbps],
      unity_mbps: stVals[i][idx.unity_mbps],
      store_mbps: stVals[i][idx.store_mbps],
      buk_mbps: stVals[i][idx.buk_mbps],
      wifi_mbps: stVals[i][idx.wifi_mbps],
      isp_pct: stVals[i][idx.isp_pct],
      top_group: stVals[i][idx.top_group],
      top5_users: stVals[i][idx.top5_users],
      grade: g,
      health,
      attention,
      alarms: Number(alarmsBySite[site] || 0),
      sortKey: statusPriority_(g, ls, isp, vpn, ispPct)
    });
  }

  rowsData.sort((a, b) => b.sortKey - a.sortKey || Number(b.isp_pct || 0) - Number(a.isp_pct || 0));

  const hasIspUtilData = rowsData.some(r => toNum(r.isp_pct) > 0);
  const hasTrafficData = rowsData.some(r =>
    toNum(r.isp_mbps) > 0 || toNum(r.lan_mbps) > 0 || toNum(r.unity_mbps) > 0 ||
    toNum(r.store_mbps) > 0 || toNum(r.buk_mbps) > 0 || toNum(r.wifi_mbps) > 0
  );

  const avgCpu = cntCpu ? Math.round((cpuTotal / cntCpu) * 10) / 10 : 0;
  const avgRam = cntRam ? Math.round((ramTotal / cntRam) * 10) / 10 : 0;
  const totalSites = rowsData.length;
  const availabilityPct = totalSites ? Math.round((live / totalSites) * 100) : 0;

  drawKpiChip_(dash, "A3:D3", `OK ${ok}`, "#dcfce7");
  drawKpiChip_(dash, "E3:H3", `WARN ${warn}`, "#fef3c7");
  drawKpiChip_(dash, "I3:L3", `CRIT ${crit}`, "#fee2e2");
  drawKpiChip_(dash, "M3:P3", `LIVE ${live}`, "#dbeafe");
  drawKpiChip_(dash, "Q3:T3", `STALE ${stale}`, "#fde68a");
  drawKpiChip_(dash, "U3:X3", `NO DATA ${nodata}`, "#fecaca");
  drawKpiChip_(dash, "Y3:AB3", `ISP DOWN ${ispDown}`, "#fee2e2");
  drawKpiChip_(dash, "AC3:AF3", `VPN DOWN ${vpnDown}`, "#fee2e2");

  drawDashPanel_(dash, 5, 1, 18, 8, "Health Snapshot");
  drawDashPanel_(dash, 5, 9, 18, 16, "Live Availability Summary");
  drawDashPanel_(dash, 5, 17, 24, 26, "Site Health Snapshot");
  drawDashPanel_(dash, 5, 27, 24, 32, "Recent Alerts");

  drawDashPanel_(dash, 19, 1, 31, 8, "Top RAM Usage Sites");
  drawDashPanel_(dash, 19, 9, 31, 16, "Top CPU Usage Sites");
  drawDashPanel_(dash, 25, 17, 37, 26, "Interface Errors & Drops");
  drawDashPanel_(dash, 25, 27, 37, 32, hasIspUtilData ? "Top WAN Load" : "CPU Load Overview");

  drawDashPanel_(dash, 38, 1, 50, 16, hasTrafficData ? "Traffic by Site" : "CPU / RAM by Site");
  drawDashPanel_(dash, 38, 17, 50, 32, hasTrafficData ? "WAN Trend" : "Alert Timeline (Raised/Resolved)");

  const infraRows = [["Name", "Alarms", "Devices", "Problematic"]];
  rowsData.slice(0, 14).forEach(r => {
    const problematic = (r.grade !== "OK" || r.live_state !== "LIVE") ? 1 : 0;
    infraRows.push([r.site, r.alarms, 1, problematic]);
  });
  const infraRange = dash.getRange(7, 17, infraRows.length, 4);
  infraRange.setValues(infraRows);
  infraRange.setFontSize(9);
  dash.getRange(7, 17, 1, 4).setFontWeight("bold").setBackground("#e5e7eb");
  styleDataTable_(dash, 7, 17, infraRows.length, 4);

  const utilRows = [["Site", hasIspUtilData ? "Utilization(%)" : "CPU(%)", "Status"]];
  rowsData
    .slice()
    .sort((a, b) => hasIspUtilData ? Number(b.isp_pct || 0) - Number(a.isp_pct || 0) : Number(b.cpu || 0) - Number(a.cpu || 0))
    .slice(0, 10)
    .forEach(r => {
      const metric = hasIspUtilData ? toNum(r.isp_pct) : toNum(r.cpu);
      utilRows.push([r.site, metric, metric >= 90 ? "CRIT" : (metric >= 70 ? "WARN" : "OK")]);
  });
  dash.getRange(27, 27, utilRows.length, 3).setValues(utilRows);
  dash.getRange(27, 27, 1, 3).setFontWeight("bold").setBackground("#e5e7eb");
  dash.getRange(28, 28, Math.max(1, utilRows.length - 1), 1).setNumberFormat("0");
  styleDataTable_(dash, 27, 27, utilRows.length, 3);

  const memRows = [["Device Name", "Avg", "Status"]];
  rowsData.slice().sort((a, b) => Number(b.mem_pct || 0) - Number(a.mem_pct || 0)).slice(0, 10).forEach(r => {
    const m = toNum(r.mem_pct);
    memRows.push([r.site, m, m >= 90 ? "CRIT" : (m >= 80 ? "WARN" : "OK")]);
  });
  dash.getRange(21, 1, memRows.length, 3).setValues(memRows);
  dash.getRange(21, 1, 1, 3).setFontWeight("bold").setBackground("#e5e7eb");
  dash.getRange(22, 2, Math.max(1, memRows.length - 1), 1).setNumberFormat("0");
  styleDataTable_(dash, 21, 1, memRows.length, 3);

  const cpuRows = [["Device Name", "Avg", "Status"]];
  rowsData.slice().sort((a, b) => Number(b.cpu || 0) - Number(a.cpu || 0)).slice(0, 8).forEach(r => {
    const c = toNum(r.cpu);
    cpuRows.push([r.site, c, c >= 85 ? "CRIT" : (c >= 70 ? "WARN" : "OK")]);
  });
  dash.getRange(21, 9, cpuRows.length, 3).setValues(cpuRows);
  dash.getRange(21, 9, 1, 3).setFontWeight("bold").setBackground("#e5e7eb");
  dash.getRange(22, 10, Math.max(1, cpuRows.length - 1), 1).setNumberFormat("0");
  styleDataTable_(dash, 21, 9, cpuRows.length, 3);

  const ifaceRows = [["Interface/Router", "Errors/Discards"]];
  const ifaceMap = {};
  if (logVals.length > 1) {
    for (let i = 1; i < logVals.length; i++) {
      const site = String(logVals[i][2] || "");
      const router = String(logVals[i][3] || "");
      const msg = String(logVals[i][4] || "");
      if (!site && !router) continue;
      if (!/(error|discard|drop|timeout)/i.test(msg)) continue;
      const k = (router || site || "Unknown").slice(0, 24);
      ifaceMap[k] = (ifaceMap[k] || 0) + 1;
    }
  }
  Object.keys(ifaceMap).map(k => ({ k, v: ifaceMap[k] })).sort((a, b) => b.v - a.v).slice(0, 8).forEach(x => ifaceRows.push([x.k, x.v]));
  if (ifaceRows.length === 1) ifaceRows.push(["No interface issues", 0]);
  dash.getRange(27, 17, ifaceRows.length, 2).setValues(ifaceRows);
  dash.getRange(27, 17, 1, 2).setFontWeight("bold").setBackground("#e5e7eb");
  styleDataTable_(dash, 27, 17, ifaceRows.length, 2);

  const recentRows = [["Time", "Device", "Alarm", "Title"]];
  for (let i = alertLogVals.length - 1; i >= 1 && recentRows.length <= 12; i--) {
    recentRows.push([
      alertLogVals[i][0],
      alertLogVals[i][1],
      alertLogVals[i][3],
      String(alertLogVals[i][4] || "").slice(0, 26)
    ]);
  }
  if (recentRows.length === 1) {
    recentRows.push([new Date(), "-", "INFO", "No recent alarms"]);
  }
  dash.getRange(7, 27, recentRows.length, 4).setValues(recentRows);
  dash.getRange(7, 27, 1, 4).setFontWeight("bold").setBackground("#e5e7eb");
  if (recentRows.length > 1) dash.getRange(8, 27, recentRows.length - 1, 1).setNumberFormat(cfgFmt_(cfg));
  styleDataTable_(dash, 7, 27, recentRows.length, 4);

  dash.getRange("K7").setValue(totalSites).setFontSize(28).setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("K8").setValue("Total Sites").setHorizontalAlignment("center").setFontColor("#6b7280");
  dash.getRange("K10").setValue(live).setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setFontColor("#065f46");
  dash.getRange("K11").setValue("LIVE").setHorizontalAlignment("center").setFontColor("#6b7280");
  dash.getRange("K13").setValue(`${availabilityPct}%`).setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("K14").setValue("Availability").setHorizontalAlignment("center").setFontColor("#6b7280");
  dash.getRange("L7").setValue(`Avg CPU: ${avgCpu}%`).setFontWeight("bold");
  dash.getRange("L9").setValue(`Avg RAM: ${avgRam}%`).setFontWeight("bold");
  dash.getRange("L11").setValue(`Active Alarms: ${activeAlerts}`).setFontWeight("bold");
  dash.getRange("L13").setValue(`ISP Down: ${ispDown} | VPN Down: ${vpnDown}`).setFontWeight("bold");

  const detailHeader = [
    "Site", "Live Status", "Last Update", "Internet", "VPN", "CPU %", "RAM %", "Active Users",
    "WAN Mbps", "WAN Load %", "Health Grade", "Need Attention"
  ];
  const detailOut = [detailHeader];
  rowsData.slice(0, Math.max(10, cfgNum_(cfg, "DASH_TOP_N", 100))).forEach(r => {
    detailOut.push([
      r.site, r.live_state, r.last_seen, r.isp, r.ipsec, r.cpu, r.mem_pct, r.leases,
      r.isp_mbps, r.isp_pct, r.grade, r.attention
    ]);
  });

  const tableTop = 52;
  dash.getRange(tableTop - 1, 1).setValue("Detailed Live Status (Team View)").setFontWeight("bold").setFontSize(11);
  dash.getRange(tableTop, 1, detailOut.length, detailOut[0].length).setValues(detailOut);
  dash.getRange(tableTop, 1, 1, detailOut[0].length).setFontWeight("bold").setBackground("#e5e7eb");
  const detailRows = Math.max(1, detailOut.length - 1);
  dash.getRange(tableTop + 1, 3, detailRows, 1).setNumberFormat(cfgFmt_(cfg));
  dash.getRange(tableTop + 1, 6, detailRows, 2).setNumberFormat("0");
  dash.getRange(tableTop + 1, 9, detailRows, 1).setNumberFormat("0.00");
  dash.getRange(tableTop + 1, 10, detailRows, 1).setNumberFormat("0");
  applyDashFormatting_(dash, tableTop, detailOut.length);
  styleDataTable_(dash, tableTop, 1, detailOut.length, detailOut[0].length);

  const chartCol = 45;
  dash.getRange(1, chartCol, 1000, 16).clearContent();

  const heatData = [["Status", "Count"], ["Clear", ok], ["Attention", warn + stale], ["Critical", crit], ["No Data", nodata]];
  dash.getRange(1, chartCol, heatData.length, 2).setValues(heatData);
  const heatChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dash.getRange(1, chartCol, heatData.length, 2))
    .setOption("pieHole", 0.62)
    .setOption("legend", { position: "right" })
    .setOption("colors", ["#6abf89", "#f5c64d", "#e86f6b", "#9ca3af"])
    .setOption("title", "")
    .setOption("backgroundColor", "#ffffff")
    .setOption("chartArea", { width: "78%", height: "78%" })
    .setPosition(7, 2, 0, 0)
    .build();
  dash.insertChart(heatChart);

  const alarmData = [["Type", "Count"], ["Active", activeAlerts], ["Clear", Math.max(0, totalSites - activeAlerts)]];
  dash.getRange(8, chartCol, alarmData.length, 2).setValues(alarmData);
  const alarmChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dash.getRange(8, chartCol, alarmData.length, 2))
    .setOption("pieHole", 0.7)
    .setOption("legend", { position: "none" })
    .setOption("colors", ["#e86f6b", "#d1d5db"])
    .setOption("backgroundColor", "#ffffff")
    .setOption("chartArea", { width: "78%", height: "78%" })
    .setPosition(7, 27, 0, 0)
    .build();
  dash.insertChart(alarmChart);

  dash.getRange(15, 30).setValue(String(activeAlerts)).setFontSize(24).setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange(16, 30).setValue("Active Alarms").setHorizontalAlignment("center").setFontColor("#6b7280");

  if (hasTrafficData) {
    const traffic = [["Site", "ISP", "LAN", "UNITY", "STORE", "BUK", "WIFI"]];
    rowsData.slice(0, Math.min(10, rowsData.length)).forEach(r => {
      traffic.push([
        String(r.site), toNum(r.isp_mbps), toNum(r.lan_mbps), toNum(r.unity_mbps),
        toNum(r.store_mbps), toNum(r.buk_mbps), toNum(r.wifi_mbps),
      ]);
    });
    dash.getRange(14, chartCol, traffic.length, 7).setValues(traffic);
    const trafficChart = dash.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(dash.getRange(14, chartCol, traffic.length, 7))
      .setOption("title", "Traffic by Site")
      .setOption("legend", { position: "bottom" })
      .setOption("isStacked", true)
      .setOption("series", {
        0: { color: "#4e79a7" },
        1: { color: "#59a14f" },
        2: { color: "#9c755f" },
        3: { color: "#f28e2b" },
        4: { color: "#e15759" },
        5: { color: "#76b7b2" }
      })
      .setOption("hAxis", { textStyle: { fontSize: 9 }, slantedText: true, slantedTextAngle: 35 })
      .setOption("vAxis", { title: "Mbps", minValue: 0 })
      .setOption("chartArea", { width: "72%", height: "62%" })
      .setPosition(40, 2, 0, 0)
      .build();
    dash.insertChart(trafficChart);
  } else {
    const perf = [["Site", "CPU", "RAM"]];
    rowsData.slice(0, Math.min(10, rowsData.length)).forEach(r => {
      perf.push([String(r.site), toNum(r.cpu), toNum(r.mem_pct)]);
    });
    dash.getRange(14, chartCol, perf.length, 3).setValues(perf);
    const perfChart = dash.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(dash.getRange(14, chartCol, perf.length, 3))
      .setOption("title", "CPU / RAM by Site")
      .setOption("legend", { position: "bottom" })
      .setOption("series", { 0: { color: "#4e79a7" }, 1: { color: "#e15759" } })
      .setOption("hAxis", { textStyle: { fontSize: 9 } })
      .setOption("vAxis", { title: "%", minValue: 0, maxValue: 100 })
      .setOption("chartArea", { width: "72%", height: "62%" })
      .setPosition(40, 2, 0, 0)
      .build();
    dash.insertChart(perfChart);
  }

  const trendSh = ss.getSheetByName(SHEETS.TREND);
  const tLast = trendSh.getLastRow();
  const hasTrend = hasTrafficData && tLast >= 3;
  if (hasTrend) {
    const line = dash.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(trendSh.getRange(1, 1, Math.min(tLast, 1200), 3))
      .setOption("title", "ISP Trend")
      .setOption("legend", { position: "bottom" })
      .setOption("curveType", "function")
      .setOption("lineWidth", 3)
      .setOption("pointSize", 2)
      .setOption("vAxis", { title: "Mbps", minValue: 0 })
      .setOption("chartArea", { width: "72%", height: "62%" })
      .setPosition(40, 18, 0, 0)
      .build();
    dash.insertChart(line);
  } else {
    const timelineMap = {};
    const nowMs = now.getTime();
    const minTs = nowMs - (24 * 60 * 60 * 1000);

    for (let i = 1; i < alertLogVals.length; i++) {
      const ts = alertLogVals[i][0];
      const action = String(alertLogVals[i][3] || "");
      if (!(ts instanceof Date)) continue;
      if (ts.getTime() < minTs) continue;
      const key = Utilities.formatDate(ts, Session.getScriptTimeZone(), "MM-dd HH:00");
      if (!timelineMap[key]) timelineMap[key] = { raised: 0, resolved: 0 };
      if (action === "RAISED") timelineMap[key].raised++;
      if (action === "RESOLVED") timelineMap[key].resolved++;
    }

    const keys = Object.keys(timelineMap).sort();
    const timeline = [["Hour", "Raised", "Resolved"]];
    if (keys.length === 0) {
      timeline.push([Utilities.formatDate(now, Session.getScriptTimeZone(), "MM-dd HH:00"), 0, 0]);
    } else {
      keys.slice(-24).forEach(k => timeline.push([k, timelineMap[k].raised, timelineMap[k].resolved]));
    }

    dash.getRange(30, chartCol, timeline.length, 3).setValues(timeline);
    const alertTimelineChart = dash.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(dash.getRange(30, chartCol, timeline.length, 3))
      .setOption("title", "Alert Timeline (24h)")
      .setOption("legend", { position: "bottom" })
      .setOption("series", { 0: { color: "#e15759" }, 1: { color: "#59a14f" } })
      .setOption("lineWidth", 2)
      .setOption("pointSize", 3)
      .setOption("chartArea", { width: "72%", height: "62%" })
      .setPosition(40, 18, 0, 0)
      .build();
    dash.insertChart(alertTimelineChart);
  }

  paintStatusColumn_(dash, 28, 29, utilRows.length - 1);
  paintStatusColumn_(dash, 20, 3, memRows.length - 1);
  paintStatusColumn_(dash, 22, 11, cpuRows.length - 1);

  dash.autoResizeColumns(1, 30);
}

function drawDashPanel_(dash, r1, c1, r2, c2, title) {
  const rows = r2 - r1 + 1;
  const cols = c2 - c1 + 1;
  dash.getRange(r1, c1, rows, cols)
    .setBackground("#ffffff")
    .setBorder(true, true, true, true, true, true, "#d1d5db", SpreadsheetApp.BorderStyle.SOLID);
  const hdr = dash.getRange(r1, c1, 1, cols);
  if (cols > 1) {
    hdr.merge();
  }
  hdr
    .setValue(title)
    .setFontWeight("bold")
    .setBackground("#f3f4f6")
    .setFontColor("#111827")
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");
}

function drawKpiChip_(dash, a1Range, text, bg) {
  dash.getRange(a1Range)
    .merge()
    .setValue(text)
    .setBackground(bg)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
}

function applyDashboardGeometry_(dash) {
  dash.setRowHeights(1, 2, 30);
  dash.setRowHeight(3, 24);
  for (let r = 4; r <= 43; r++) dash.setRowHeight(r, 22);
  for (let r = 44; r <= 120; r++) dash.setRowHeight(r, 20);

  dash.getRange("A1:AD2").setHorizontalAlignment("left").setVerticalAlignment("middle");
  dash.getRange("A3:AF3").setHorizontalAlignment("center").setVerticalAlignment("middle");
}

function styleDataTable_(dash, startRow, startCol, rowCount, colCount) {
  if (rowCount <= 1) return;
  const bodyRows = rowCount - 1;
  const body = dash.getRange(startRow + 1, startCol, bodyRows, colCount);
  body.setFontSize(9).setVerticalAlignment("middle");

  for (let i = 0; i < bodyRows; i++) {
    const rowRange = dash.getRange(startRow + 1 + i, startCol, 1, colCount);
    rowRange.setBackground(i % 2 === 0 ? "#ffffff" : "#f9fafb");
  }

  dash.getRange(startRow, startCol, rowCount, colCount)
    .setBorder(true, true, true, true, true, true, "#d1d5db", SpreadsheetApp.BorderStyle.SOLID);
}

function paintStatusColumn_(dash, startRow, col, count) {
  if (count <= 0) return;
  for (let i = 0; i < count; i++) {
    const cell = dash.getRange(startRow + i, col);
    const val = String(cell.getValue() || "");
    if (val === "CRIT") cell.setBackground("#fee2e2").setFontColor("#991b1b");
    else if (val === "WARN") cell.setBackground("#fef3c7").setFontColor("#92400e");
    else if (val === "OK") cell.setBackground("#dcfce7").setFontColor("#065f46");
  }
}

function drawKpi_(dash, cellA1, title, val) {
  const r = dash.getRange(cellA1);
  r.setValue(title)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBackground("#30343b")
    .setFontColor("#cfd8dc");
  const v = r.offset(1, 0);
  v.setValue(Number(val) || 0)
    .setFontSize(16)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBackground("#1f2329")
    .setFontColor("#ffffff");
  r.offset(0, 0, 2, 2).setBorder(true, true, true, true, true, true, "#3b3f46", SpreadsheetApp.BorderStyle.SOLID);
  v.setNumberFormat("0");
}

function applyDashFormatting_(dash, tableTop, totalRows) {
  const rows = Math.max(1, totalRows - 1);
  const rules = [];

  const liveRange = dash.getRange(tableTop + 1, 2, rows, 1);
  const ispPctRange = dash.getRange(tableTop + 1, 10, rows, 1);
  const gradeRange = dash.getRange(tableTop + 1, 11, rows, 1);
  const attentionRange = dash.getRange(tableTop + 1, 12, rows, 1);

  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("LIVE").setBackground("#1f4f3b").setFontColor("#d7ffe8").setRanges([liveRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("STALE").setBackground("#5e4a1f").setFontColor("#ffeab5").setRanges([liveRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("NO_DATA").setBackground("#5b2b2b").setFontColor("#ffdede").setRanges([liveRange]).build());

  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("CRIT").setBackground("#7a1f1f").setFontColor("#ffe3e3").setRanges([gradeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("WARN").setBackground("#6b541e").setFontColor("#fff2cc").setRanges([gradeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("OK").setBackground("#24573a").setFontColor("#ddffe8").setRanges([gradeRange]).build());

  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(90).setBackground("#7a1f1f").setFontColor("#ffe3e3").setRanges([ispPctRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(70).setBackground("#6b541e").setFontColor("#fff2cc").setRanges([ispPctRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Immediate").setBackground("#7a1f1f").setFontColor("#ffe3e3").setRanges([attentionRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Monitor").setBackground("#6b541e").setFontColor("#fff2cc").setRanges([attentionRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Stable").setBackground("#24573a").setFontColor("#ddffe8").setRanges([attentionRange]).build());

  dash.setConditionalFormatRules(rules);
}

function calcHealthScore_(grade, live, isp, vpn, ispPct, cpu, ram) {
  let score = 100;
  if (grade === "CRIT") score -= 35;
  else if (grade === "WARN") score -= 18;

  if (live === "NO_DATA") score -= 35;
  else if (live === "STALE") score -= 12;

  if (isp === "DOWN") score -= 30;
  if (vpn === "DOWN") score -= 22;

  const ispUtil = Number(ispPct);
  if (isFinite(ispUtil) && ispUtil >= 90) score -= 10;
  else if (isFinite(ispUtil) && ispUtil >= 70) score -= 5;

  const cpuVal = Number(cpu);
  if (isFinite(cpuVal) && cpuVal >= 85) score -= 8;
  else if (isFinite(cpuVal) && cpuVal >= 70) score -= 4;

  const ramVal = Number(ram);
  if (isFinite(ramVal) && ramVal >= 90) score -= 8;
  else if (isFinite(ramVal) && ramVal >= 80) score -= 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function attentionLabel_(grade, live, isp, vpn, ispPct) {
  if (grade === "CRIT" || live === "NO_DATA" || isp === "DOWN" || vpn === "DOWN") return "🚨 Immediate";
  const ispUtil = Number(ispPct);
  if (grade === "WARN" || live === "STALE" || (isFinite(ispUtil) && ispUtil >= 70)) return "⚠️ Monitor";
  return "✅ Stable";
}

function statusPriority_(grade, live, isp, vpn, ispPct) {
  let p = 0;
  if (grade === "CRIT") p += 300;
  else if (grade === "WARN") p += 150;
  if (live === "NO_DATA") p += 250;
  else if (live === "STALE") p += 100;
  if (isp === "DOWN") p += 200;
  if (vpn === "DOWN") p += 130;
  const util = Number(ispPct);
  if (isFinite(util)) p += Math.min(100, Math.round(util / 2));
  return p;
}

function smartAlertEngine() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);

  const st = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
  if (st.length < 2) return;

  const idx = idxState_(st[0]);
  const CPU_WARN = cfgNum_(cfg, "CPU_WARN", 70);
  const CPU_CRIT = cfgNum_(cfg, "CPU_CRIT", 85);
  const LEASES_WARN = cfgNum_(cfg, "LEASES_WARN", 45);
  const ISP_MAX = cfgNum_(cfg, "ISP_MAX_MBPS", 20);
  const SAT_WARN = cfgNum_(cfg, "ISP_SAT_WARN_PCT", 70);
  const SAT_CRIT = cfgNum_(cfg, "ISP_SAT_CRIT_PCT", 90);

  for (let i = 1; i < st.length; i++) {
    const site = String(st[i][idx.site] || "");
    if (!site) continue;

    const cpu = Number(st[i][idx.cpu] || 0);
    const isp = String(st[i][idx.isp] || "");
    const vpn = String(st[i][idx.ipsec] || "");
    const leases = Number(st[i][idx.leases] || 0);
    const live = String(st[i][idx.live_state] || "");
    const grade = String(st[i][idx.status_grade] || "OK");
    const isp_mbps = Number(st[i][idx.isp_mbps] || 0);
    const isp_pct = (ISP_MAX > 0) ? Math.round((isp_mbps / ISP_MAX) * 100) : 0;

    processAlert_(ss, cfg, site, "VPN_DOWN", vpn === "DOWN", "🚨 VPN DOWN", { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    processAlert_(ss, cfg, site, "ISP_DOWN", isp === "DOWN", "🔻 Internet Down", { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    processAlert_(ss, cfg, site, "VPN_DOWN", vpn === "DOWN", "🔐 VPN Down", { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    processAlert_(ss, cfg, site, "NO_DATA", live === "NO_DATA", "❌ Data receive nahi ho raha", { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    processAlert_(ss, cfg, site, "CPU_CRIT", cpu >= CPU_CRIT, `🔥 CPU bohat high ${cpu}%`, { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    if (cpu < CPU_CRIT) processAlert_(ss, cfg, site, "CPU_WARN", cpu >= CPU_WARN, `⚠️ CPU high ${cpu}%`, { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    processAlert_(ss, cfg, site, "DEVICE_HIGH", leases >= LEASES_WARN, `⚠️ Active users zyada ${leases}`, { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    processAlert_(ss, cfg, site, "ISP_SAT_CRIT", isp_pct >= SAT_CRIT, `🚨 WAN load bohat high ${isp_pct}%`, { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
    if (isp_pct < SAT_CRIT) processAlert_(ss, cfg, site, "ISP_SAT_WARN", isp_pct >= SAT_WARN, `⚠️ WAN load high ${isp_pct}%`, { cpu, isp, vpn, leases, live, grade, isp_mbps, isp_pct });
  }

  processOutboxNow();
}

function processAlert_(ss, cfg, site, type, condition, title, data) {
  const sh = ss.getSheetByName(SHEETS.ALERTS);
  const logSh = ss.getSheetByName(SHEETS.ALERTS_LOG);
  const v = sh.getDataRange().getValues();
  const fingerprint = `${site}_${type}`;

  let row = -1;
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) === fingerprint) {
      row = i + 1;
      break;
    }
  }

  if (condition) {
    if (row === -1) {
      const now = new Date();
      sh.appendRow([fingerprint, site, type, title, now, now, "ACTIVE"]);
      logSh.appendRow([now, site, type, "RAISED", title, JSON.stringify(data).slice(0, 4500)]);
      // Enrich alert payload with top5 users (if available) so Telegram shows per-user usage
      let top5Str = "";
      try {
        const svals = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
        if (svals.length > 1) {
          const sidx = idxState_(svals[0]);
          for (let j = 1; j < svals.length; j++) {
            if (String(svals[j][sidx.site]) === String(site)) {
              top5Str = String(svals[j][sidx.top5_users] || "");
              break;
            }
          }
        }
      } catch (e) { top5Str = ""; }

      const enriched = Object.assign({}, data, { top5_users: top5Str });
      const msg = buildTgMsg_(cfg, site, title, "ALERT", enriched);
      queueTelegram_(ss, cfg, `NOC Alert • ${site}`, msg);
      queueEmail_(ss, cfg, `NOC Alert: ${site} - ${type}`, msg, true);
    } else {
      sh.getRange(row, 6).setValue(new Date());
    }
  } else if (row !== -1) {
    const now = new Date();
    const oldTitle = String(sh.getRange(row, 4).getValue() || type);
    sh.deleteRow(row);
    logSh.appendRow([now, site, type, "RESOLVED", oldTitle, JSON.stringify(data).slice(0, 4500)]);
    // Include any available top5 users in the resolved message as well
    let top5StrR = "";
    try {
      const svalsR = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
      if (svalsR.length > 1) {
        const sidxR = idxState_(svalsR[0]);
        for (let j = 1; j < svalsR.length; j++) {
          if (String(svalsR[j][sidxR.site]) === String(site)) {
            top5StrR = String(svalsR[j][sidxR.top5_users] || "");
            break;
          }
        }
      }
    } catch (e) { top5StrR = ""; }

    const enrichedR = Object.assign({}, data, { top5_users: top5StrR });
    const resolved = buildTgMsg_(cfg, site, `✅ RESOLVED: ${type}`, "RESOLVED", enrichedR);
    queueTelegram_(ss, cfg, `NOC Resolved • ${site}`, resolved);
    queueEmail_(ss, cfg, `NOC Resolved: ${site} - ${type}`, resolved, true);
  }
}

function enforceRawRetention_(ss, cfg) {
  const keep = Math.max(200, cfgNum_(cfg, "RAW_KEEP_ROWS", 2000));
  const sh = ss.getSheetByName(SHEETS.RAW);
  const last = sh.getLastRow();
  if (last <= keep + 1) return;
  sh.deleteRows(keep + 2, last - (keep + 1));
}

function retentionCleanupNow() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);
  enforceRawRetention_(ss, cfg);
}

function maybeRunEngines_() {
  return;
}

function buildExecReportNow() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);

  const metrics = collectExecMetrics_(ss);
  upsertExecSnapshot_(ss, cfg, metrics);
  refreshExecSummaryPanel_(ss, cfg, metrics);
}

function collectExecMetrics_(ss) {
  const stateVals = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
  const alertVals = ss.getSheetByName(SHEETS.ALERTS).getDataRange().getValues();
  const alertLogVals = ss.getSheetByName(SHEETS.ALERTS_LOG).getDataRange().getValues();

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  if (stateVals.length < 2) {
    return {
      ts: now,
      total_sites: 0,
      ok: 0, warn: 0, crit: 0,
      live: 0, stale: 0, no_data: 0,
      isp_down: 0, vpn_down: 0,
      avg_cpu: 0, avg_ram: 0, avg_isp_pct: 0, max_isp_pct: 0, avg_health: 0,
      active_alerts: Math.max(0, alertVals.length - 1),
      raised_24h: 0,
      resolved_24h: 0,
      top_risk_site: "-",
      top_risk_reason: "No data"
    };
  }

  const idx = idxState_(stateVals[0]);
  let ok = 0, warn = 0, crit = 0;
  let live = 0, stale = 0, no_data = 0;
  let isp_down = 0, vpn_down = 0;
  let sumCpu = 0, sumRam = 0, sumIspPct = 0, sumHealth = 0;
  let cntCpu = 0, cntRam = 0, cntIspPct = 0;
  let maxIspPct = 0;

  let topRisk = { site: "-", reason: "-", priority: -1 };

  for (let i = 1; i < stateVals.length; i++) {
    const row = stateVals[i];
    const site = String(row[idx.site] || "");
    const grade = String(row[idx.status_grade] || "OK");
    const liveState = String(row[idx.live_state] || "");
    const isp = String(row[idx.isp] || "-");
    const vpn = String(row[idx.ipsec] || "-");

    if (grade === "CRIT") crit++; else if (grade === "WARN") warn++; else ok++;
    if (liveState === "LIVE") live++; else if (liveState === "NO_DATA") no_data++; else stale++;
    if (isp === "DOWN") isp_down++;
    if (vpn === "DOWN") vpn_down++;

    const cpu = Number(row[idx.cpu]);
    const ram = Number(row[idx.mem_pct]);
    const ispPct = Number(row[idx.isp_pct]);
    if (isFinite(cpu)) { sumCpu += cpu; cntCpu++; }
    if (isFinite(ram)) { sumRam += ram; cntRam++; }
    if (isFinite(ispPct)) {
      sumIspPct += ispPct;
      cntIspPct++;
      if (ispPct > maxIspPct) maxIspPct = ispPct;
    }

    const health = calcHealthScore_(grade, liveState, isp, vpn, ispPct, cpu, ram);
    sumHealth += health;

    const pr = statusPriority_(grade, liveState, isp, vpn, ispPct);
    if (pr > topRisk.priority) {
      topRisk = {
        site: site || "-",
        reason: attentionLabel_(grade, liveState, isp, vpn, ispPct),
        priority: pr
      };
    }
  }

  let raised_24h = 0, resolved_24h = 0;
  for (let i = 1; i < alertLogVals.length; i++) {
    const ts = alertLogVals[i][0];
    const action = String(alertLogVals[i][3] || "");
    if (!(ts instanceof Date) || ts < since) continue;
    if (action === "RAISED") raised_24h++;
    else if (action === "RESOLVED") resolved_24h++;
  }

  const totalSites = stateVals.length - 1;
  const avgHealth = totalSites ? Math.round((sumHealth / totalSites) * 10) / 10 : 0;

  return {
    ts: now,
    total_sites: totalSites,
    ok, warn, crit,
    live, stale, no_data,
    isp_down, vpn_down,
    avg_cpu: cntCpu ? Math.round((sumCpu / cntCpu) * 10) / 10 : 0,
    avg_ram: cntRam ? Math.round((sumRam / cntRam) * 10) / 10 : 0,
    avg_isp_pct: cntIspPct ? Math.round((sumIspPct / cntIspPct) * 10) / 10 : 0,
    max_isp_pct: Math.round(maxIspPct * 10) / 10,
    avg_health: avgHealth,
    active_alerts: Math.max(0, alertVals.length - 1),
    raised_24h,
    resolved_24h,
    top_risk_site: topRisk.site,
    top_risk_reason: topRisk.reason
  };
}

function upsertExecSnapshot_(ss, cfg, m) {
  const sh = ss.getSheetByName(SHEETS.EXEC);
  styleSheetHeader_(sh);

  const payload = [[
    m.ts,
    m.total_sites, m.ok, m.warn, m.crit,
    m.live, m.stale, m.no_data,
    m.isp_down, m.vpn_down,
    m.avg_cpu, m.avg_ram, m.avg_isp_pct, m.max_isp_pct, m.avg_health,
    m.active_alerts, m.raised_24h, m.resolved_24h,
    m.top_risk_site, m.top_risk_reason,
    "AUTO"
  ]];

  const data = sh.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const bucketNow = Utilities.formatDate(m.ts, tz, "yyyyMMddHH");

  if (data.length >= 2) {
    const lastRow = data[data.length - 1];
    const lastTs = lastRow[0];
    if (lastTs instanceof Date) {
      const bucketLast = Utilities.formatDate(lastTs, tz, "yyyyMMddHH");
      if (bucketLast === bucketNow) {
        sh.getRange(data.length, 1, 1, payload[0].length).setValues(payload);
        sh.getRange(data.length, 1).setNumberFormat(cfgFmt_(cfg));
        return;
      }
    }
  }

  sh.appendRow(payload[0]);
  sh.getRange(sh.getLastRow(), 1).setNumberFormat(cfgFmt_(cfg));

  const keep = Math.max(240, cfgNum_(cfg, "EXEC_KEEP_ROWS", 1440));
  const last = sh.getLastRow();
  if (last > keep + 1) {
    sh.deleteRows(2, last - (keep + 1));
  }
}

function refreshExecSummaryPanel_(ss, cfg, metrics) {
  const sh = ss.getSheetByName(SHEETS.EXEC);
  const vals = sh.getDataRange().getValues();
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const snaps = [];
  for (let i = 1; i < vals.length; i++) {
    const ts = vals[i][0];
    if (!(ts instanceof Date)) continue;
    if (ts < since) continue;
    snaps.push(vals[i]);
  }

  let peakCrit = 0, peakNoData = 0, peakActiveAlerts = 0;
  let avgHealth24 = 0, avgIsp24 = 0;
  if (snaps.length) {
    let sumHealth = 0, sumIsp = 0;
    for (let i = 0; i < snaps.length; i++) {
      peakCrit = Math.max(peakCrit, Number(snaps[i][4]) || 0);
      peakNoData = Math.max(peakNoData, Number(snaps[i][7]) || 0);
      peakActiveAlerts = Math.max(peakActiveAlerts, Number(snaps[i][15]) || 0);
      sumHealth += Number(snaps[i][14]) || 0;
      sumIsp += Number(snaps[i][12]) || 0;
    }
    avgHealth24 = Math.round((sumHealth / snaps.length) * 10) / 10;
    avgIsp24 = Math.round((sumIsp / snaps.length) * 10) / 10;
  }

  const panel = [
    ["EXECUTIVE REPORT PANEL", ""],
    ["Last Update", formatDateTime_(metrics.ts, cfg)],
    ["Snapshots (24h)", snaps.length],
    ["Avg Health (24h)", avgHealth24],
    ["Avg ISP Util % (24h)", avgIsp24],
    ["Peak CRIT Sites (24h)", peakCrit],
    ["Peak NO_DATA Sites (24h)", peakNoData],
    ["Peak Active Alerts (24h)", peakActiveAlerts],
    ["Current Active Alerts", metrics.active_alerts],
    ["Raised Alerts (24h)", metrics.raised_24h],
    ["Resolved Alerts (24h)", metrics.resolved_24h],
    ["Top Risk Site", metrics.top_risk_site],
    ["Top Risk Reason", metrics.top_risk_reason],
  ];

  sh.getRange(1, 23, 30, 2).clearContent().clearFormat();
  sh.getRange(1, 23, panel.length, 2).setValues(panel);
  sh.getRange(1, 23, 1, 2).setFontWeight("bold").setBackground("#e8f0fe");
  sh.getRange(2, 23, panel.length - 1, 1).setFontWeight("bold");
  sh.getRange(3, 24, 10, 1).setNumberFormat("0.0");
}

function buildDataAuditNow() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const sh = ss.getSheetByName(SHEETS.AUDIT);
  const rawSh = ss.getSheetByName(SHEETS.RAW);
  const stateSh = ss.getSheetByName(SHEETS.STATE);
  const logDetailSh = ss.getSheetByName(SHEETS.LOG_DETAIL);

  const rawVals = rawSh.getDataRange().getValues();
  const stateVals = stateSh.getDataRange().getValues();
  const logVals = logDetailSh.getDataRange().getValues();

  const rawHeader = rawVals.length ? rawVals[0] : [];
  const stateHeader = stateVals.length ? stateVals[0] : [];
  const logHeader = logVals.length ? logVals[0] : [];
  const rawIdx = idxMap_(rawHeader);
  const stateIdx = idxMap_(stateHeader);
  const logIdx = idxMap_(logHeader);

  const rawRows = rawVals.slice(1, 301);
  const logRows = logVals.slice(1, 301);

  const now = new Date();
  const fields = [
    { key: "cpu", name: "CPU Load %", src: "raw", collectable: "YES", note: "Router se direct aata hai" },
    { key: "mem_pct", name: "RAM Usage %", src: "raw", collectable: "YES", note: "memfree/memtotal se calculate hota hai" },
    { key: "leases", name: "Active DHCP/Users", src: "raw", collectable: "YES", note: "Network load ka simple indicator" },
    { key: "isp", name: "Internet Status", src: "raw", collectable: "YES", note: "UP/DOWN health signal" },
    { key: "ipsec", name: "VPN Status", src: "raw", collectable: "YES", note: "Tunnel health ke liye important" },
    { key: "gw_ping", name: "Gateway Ping", src: "payload", collectable: "YES", note: "Gateway reachability" },
    { key: "wan_run", name: "WAN Interface Run", src: "payload", collectable: "YES", note: "Physical/link status" },
    { key: "wanip", name: "WAN Public IP", src: "raw", collectable: "YES", note: "ISP change track karne ke liye" },
    { key: "hotspot_active", name: "Hotspot Active Users", src: "raw", collectable: "YES", note: "Live hotspot sessions" },
    { key: "isp_rx", name: "WAN RX Bytes", src: "raw", collectable: "YES", note: "Mbps trend ke liye base counter" },
    { key: "isp_tx", name: "WAN TX Bytes", src: "raw", collectable: "YES", note: "Mbps trend ke liye base counter" },
    { key: "lan_rx", name: "LAN RX Bytes", src: "raw", collectable: "YES", note: "LAN side traffic estimate" },
    { key: "lan_tx", name: "LAN TX Bytes", src: "raw", collectable: "YES", note: "LAN side traffic estimate" },
    { key: "top5_users", name: "Top 5 User Usage", src: "raw", collectable: "YES", note: "Team ko heavy users dikhte hain" },
    { key: "isp_mbps", name: "WAN Throughput Mbps", src: "state", collectable: "PARTIAL", note: "Abhi mostly blank; bytes counters chahiye" },
    { key: "qos_msg", name: "Queue/QoS Summary", src: "payload", collectable: "YES", note: "Queue health insight" },
    { key: "log_topics", name: "Router Log Topics", src: "log", collectable: "YES", note: "Issue category clarity" },
    { key: "msg", name: "Router Log Message", src: "log", collectable: "YES", note: "Incident detail" },
    { key: "log_time", name: "Router Log Time", src: "log", collectable: "YES", note: "Timeline correlation" },
  ];

  const out = [];
  fields.forEach(f => {
    let total = 0;
    let nonEmpty = 0;
    let sample = "";

    const takeSample = v => {
      if (sample !== "") return;
      const s = String(v || "").trim();
      if (s) sample = s.slice(0, 140);
    };

    if (f.src === "raw" && rawRows.length) {
      const col = rawIdx[f.key];
      if (col !== undefined) {
        total = rawRows.length;
        rawRows.forEach(r => {
          const v = r[col];
          if (v !== "" && v !== null && v !== undefined) {
            nonEmpty++;
            takeSample(v);
          }
        });
      }
    } else if (f.src === "state" && stateVals.length > 1) {
      const col = stateIdx[f.key];
      if (col !== undefined) {
        const sRows = stateVals.slice(1);
        total = sRows.length;
        sRows.forEach(r => {
          const v = r[col];
          if (v !== "" && v !== null && v !== undefined) {
            nonEmpty++;
            takeSample(v);
          }
        });
      }
    } else if (f.src === "log" && logRows.length) {
      const col = logIdx[f.key];
      if (col !== undefined) {
        total = logRows.length;
        logRows.forEach(r => {
          const v = r[col];
          if (v !== "" && v !== null && v !== undefined) {
            nonEmpty++;
            takeSample(v);
          }
        });
      }
    } else if (f.src === "payload" && rawRows.length) {
      const pCol = rawIdx.payload_json;
      if (pCol !== undefined) {
        total = rawRows.length;
        rawRows.forEach(r => {
          const rawJson = String(r[pCol] || "");
          if (!rawJson) return;
          try {
            const obj = JSON.parse(rawJson);
            const v = obj[f.key];
            if (v !== "" && v !== null && v !== undefined) {
              nonEmpty++;
              takeSample(v);
            }
          } catch (_) {}
        });
      }
    }

    const coverage = total > 0 ? Math.round((nonEmpty / total) * 100) : 0;
    out.push([
      now,
      f.key,
      f.name,
      coverage,
      sample || "-",
      stateIdx[f.key] !== undefined ? "YES" : "NO",
      f.collectable,
      f.note
    ]);
  });

  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  }
  if (out.length) {
    sh.getRange(2, 1, out.length, out[0].length).setValues(out);
    sh.getRange(2, 1, out.length, 1).setNumberFormat(cfgFmt_(getCfg_(ss)));
    sh.getRange(2, 4, out.length, 1).setNumberFormat("0");
  }
  styleSheetHeader_(sh);
}

function testIngestLive() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);
  const token = cfgStr_(cfg, "TOKEN", "MONITOR_TOKEN_2026");

  ingest_({
    parameter: {
      token,
      type: "live",
      site: cfgStr_(cfg, "SITE", "KANO"),
      router: "TEST_ROUTER",
      uptime: "TEST_UPTIME",
      cpu: "5",
      memfree: "9999",
      memtotal: "19999",
      leases: "14",
      isp: "UP",
      ipsec: "UP",
      wanip: "102.165.125.225"
    }
  });
}

function testIngestLog() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);
  const token = cfgStr_(cfg, "TOKEN", "MONITOR_TOKEN_2026");

  ingest_({
    parameter: {
      token,
      type: "log",
      site: cfgStr_(cfg, "SITE", "KANO"),
      router: "TEST_ROUTER",
      msg: "Manual log test"
    }
  });
}

function getDashboardData(limit) {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const st = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
  if (st.length < 2) return [];
  const idx = idxState_(st[0]);
  const recs = [];

  for (let i = 1; i < st.length; i++) {
    const row = st[i];
    const site = String(row[idx.site] || "");
    const grade = String(row[idx.status_grade] || "OK");
    const live = String(row[idx.live_state] || "");
    const isp = String(row[idx.isp] || "");
    const vpn = String(row[idx.ipsec] || "");
    const ispPct = Number(row[idx.isp_pct] || 0);
    const cpu = Number(row[idx.cpu] || 0);
    const leases = Number(row[idx.leases] || 0);
    const lastSeen = row[idx.last_seen];
    const isp_mbps = Number(row[idx.isp_mbps] || 0);
    const lan_mbps = Number(row[idx.lan_mbps] || 0);
    const unity_mbps = Number(row[idx.unity_mbps] || 0);
    const store_mbps = Number(row[idx.store_mbps] || 0);
    const buk_mbps = Number(row[idx.buk_mbps] || 0);
    const wifi_mbps = Number(row[idx.wifi_mbps] || 0);
    const top_group = String(row[idx.top_group] || "");
    const top5_users = String(row[idx.top5_users] || "");
    const priority = statusPriority_(grade, live, isp, vpn, ispPct);

    recs.push({ site, grade, live, isp, vpn, ispPct, isp_mbps, lan_mbps, unity_mbps, store_mbps, buk_mbps, wifi_mbps, top_group, top5_users, cpu, leases, lastSeen, priority });
  }

  recs.sort((a, b) => b.priority - a.priority);
  const n = Math.max(10, Number(limit || 10));
  return recs.slice(0, n);
}