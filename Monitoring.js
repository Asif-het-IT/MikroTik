// Single-sheet monitoring: USER_MONITOR only
// Exposes: ingestUserSnapshotToMonitor(e), generateTop10FromUserMonitor(dateKey, topN), dailyTop10Job(), testIngestUserMonitor()

function ingestUserSnapshotToMonitor(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return ContentService.createTextOutput('LOCK_BUSY');
  let ss = null;
  try {
    ss = SpreadsheetApp.openById(SS_ID);

    const cfg = getCfg_(ss);
    const pRaw = (e && e.parameter) ? e.parameter : (e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {});

    const inToken = String(pRaw.token || '').trim();
    const t1 = String(cfgStr_(cfg, 'TOKEN', '')).trim();
    const t2 = String(cfgStr_(cfg, 'TOKEN_ALT', '')).trim();
    const knownTokens = [t1, t2].filter(Boolean);
    if (!inToken || knownTokens.indexOf(inToken) === -1) {
      try { logErr_(ss, 'AUTH_FAIL_USER_MON', 'invalid token', JSON.stringify(pRaw).slice(0,500)); } catch(_){}
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

    const sh = ss.getSheetByName(SHEETS.USER_MONITOR);
    if (!sh) {
      // Do not auto-create sheets in single-sheet deployment. Return error for operator to run setup.
      logErr_(ss, 'INGEST_USER_MON', 'USER_MONITOR sheet missing', '');
      return ContentService.createTextOutput('NO_SHEET');
    }

    // Find previous row for same router+ip by scanning from bottom
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
    } catch (err) {
      logErr_(ss, 'INGEST_USER_MON', 'prev lookup failed', String(err));
    }

    const delta_bytes = (prev_total === null) ? 0 : Math.max(0, total_bytes - prev_total);
    const delta_mbps = interval_sec > 0 ? Number(((delta_bytes * 8) / interval_sec / 1e6).toFixed(3)) : 0;
    const date_key = Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    try {
      sh.appendRow([ts, site, router, ip, mac, hostname, rx_total, tx_total, delta_bytes, delta_mbps, date_key]);
    } catch (err) {
      logErr_(ss, 'INGEST_USER_MON', 'append failed', String(err));
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

  const map = {};
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

function dailyTop10Job() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const cfg = getCfg_(ss);
  const key = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const top = generateTop10FromUserMonitor(key, 10);
  if (!top || !top.length) return;

  const lines = [];
  lines.push(`<b>Daily Top ${top.length} Users (${key})</b>`);
  lines.push('━━━━━━━━━━━━━━━━━━');
  top.forEach(t => {
    lines.push(`${t.rank}. ${escapeHtml_(t.host || t.ip)} • ${t.mb} MB`);
  });
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push(`Generated: ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), cfgFmt_(cfg))}`);

  const bot = cfgStr_(cfg, 'TG_BOT', '');
  const chats = parseChatIds_(cfgStr_(cfg, 'TG_CHAT', ''));
  if (bot && chats.length) {
    chats.forEach(chatId => {
      try { sendTelegramRaw_(bot, chatId, lines.join('\n')); } catch (e) { logErr_(ss, 'TOP10_TG', String(e), ''); }
    });
  }

  // Send email if configured
  const emails = cfgStr_(cfg, 'EMAILS', '') || cfgStr_(cfg, 'EMAIL_TO', '');
  if (emails) {
    try { MailApp.sendEmail({to: emails.split(/[,;]+/).map(x=>x.trim()).filter(Boolean).join(','), subject: `Daily Top ${top.length} Users ${key}`, htmlBody: lines.join('<br/>')}); } catch (e) { logErr_(ss, 'TOP10_EMAIL', String(e), ''); }
}

function testIngestUserMonitor() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const cfg = getCfg_(ss);
  const token = cfgStr_(cfg, 'TOKEN', '');
  if (!token) throw new Error('No TOKEN in script properties; set TOKEN to run test');
  const payload = { parameter: { token: token, ts: new Date().toISOString(), site: 'TEST', router: 'test-r1', ip: '10.10.10.1', mac: 'AA:BB:CC:DD', host: 'test-host', rx_total: 1000000, tx_total: 500000, interval_sec: 60 } };
  const res = ingestUserSnapshotToMonitor(payload);
  try { Logger.log('testIngestUserMonitor result=%s', (res && res.getContent) ? res.getContent() : String(res)); } catch (e) {}
  return res;
}
