// Single-sheet monitoring: USER_MONITOR only

function ingestUserSnapshotToMonitor(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return ContentService.createTextOutput('LOCK_BUSY');
  var ss = null;
  try {
    ss = SpreadsheetApp.openById(SS_ID);
    var params = (e && e.parameter) ? e.parameter : (e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {});
    var cfg = getCfg_(ss);
    var inToken = String(params.token || '').trim();
    var t1 = String(cfgStr_(cfg, 'TOKEN', '')).trim();
    if (!inToken || inToken !== t1) {
      try { logErr_(ss, 'AUTH_FAIL_USER_MON', 'invalid token', JSON.stringify(params).slice(0,500)); } catch (err) {}
      return ContentService.createTextOutput('AUTH_FAIL');
    }
    var ts = params.ts ? new Date(params.ts) : new Date();
    var site = String(params.site || cfgStr_(cfg, 'SITE', 'UNKNOWN'));
    var router = String(params.router || '');
    var ip = String(params.ip || params.IP || '');
    var rx = Number(params.rx_total || params.rx || 0);
    var tx = Number(params.tx_total || params.tx || 0);
    var total = rx + tx;
    var sh = ss.getSheetByName(SHEETS.USER_MONITOR);
    if (!sh) { logErr_(ss, 'INGEST_USER_MON', 'USER_MONITOR missing', ''); return ContentService.createTextOutput('NO_SHEET'); }

    // scan for previous total
    var prev = null;
    try {
      var lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        var vals = sh.getRange(2,1,lastRow-1,11).getValues();
        for (var i=vals.length-1;i>=0;i--) {
          var r = vals[i];
          var rRouter = String(r[2] || '');
          var rIp = String(r[3] || '');
          if (rRouter === router && rIp === ip) {
            var rRx = Number(r[6] || 0);
            var rTx = Number(r[7] || 0);
            prev = rRx + rTx;
            break;
          }
        }
      }
    } catch (err) { try { logErr_(ss, 'INGEST_USER_MON', 'prev lookup failed', String(err)); } catch (e) {} }

    var delta = (prev === null) ? 0 : Math.max(0, total - prev);
    var dateKey = Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    try { sh.appendRow([ts, site, router, ip, '', '', rx, tx, delta, 0, dateKey]); } catch (err) { try { logErr_(ss, 'INGEST_USER_MON', 'append failed', String(err)); } catch (e) {} return ContentService.createTextOutput('ERROR'); }
    return ContentService.createTextOutput('OK');
  } catch (err) { try { if (!ss) ss = SpreadsheetApp.openById(SS_ID); logErr_(ss, 'INGEST_USER_MON', String(err), ''); } catch(e) {} return ContentService.createTextOutput('ERROR'); } finally { try { lock.releaseLock(); } catch(e) {} }
}

function generateTop10FromUserMonitor(dateKey, topN) {
  topN = topN || 10;
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName(SHEETS.USER_MONITOR);
  if (!sh) return [];
  var lastRow = sh.getLastRow(); if (lastRow < 2) return [];
  var vals = sh.getRange(2,1,lastRow-1,11).getValues();
  var key = dateKey || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var map = {};
  for (var i=0;i<vals.length;i++) {
    var r = vals[i]; var rDate = String(r[10] || ''); if (rDate !== key) continue;
    var ip = String(r[3] || ''); var mac = String(r[4] || ''); var host = String(r[5] || ''); var d = Number(r[8] || 0);
    if (!map[ip]) map[ip] = {ip: ip, mac: mac, host: host, bytes: 0}; map[ip].bytes += d;
  }
  var arr = [];
  for (var k in map) arr.push(map[k]);
  arr.sort(function(a,b){ return b.bytes - a.bytes; });
  var out = [];
  for (var j=0;j<Math.min(topN, arr.length); j++) {
    var x = arr[j]; out.push({rank: j+1, ip: x.ip, mac: x.mac, host: x.host, bytes: x.bytes, mb: Number((x.bytes/1e6).toFixed(3))});
  }
  return out;
}

function dailyTop10Job() {
  var ss = SpreadsheetApp.openById(SS_ID); var cfg = getCfg_(ss);
  var key = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var top = generateTop10FromUserMonitor(key, 10); if (!top || !top.length) return;
  var lines = [];
  lines.push('<b>Daily Top ' + top.length + ' Users (' + key + ')</b>');
  lines.push('---');
  for (var i=0;i<top.length;i++) { lines.push((i+1) + '. ' + (top[i].host || top[i].ip) + ' • ' + top[i].mb + ' MB'); }
  lines.push('---');
  var bot = cfgStr_(cfg, 'TG_BOT', ''); var chats = parseChatIds_(cfgStr_(cfg, 'TG_CHAT', ''));
  if (bot && chats && chats.length) {
    for (var c=0;c<chats.length;c++) { try { sendTelegramRaw_(bot, chats[c], lines.join('\n')); } catch (e) { try { logErr_(ss, 'TOP10_TG', String(e), ''); } catch(_){} } }
  }
  var emails = cfgStr_(cfg, 'EMAILS', '') || cfgStr_(cfg, 'EMAIL_TO', '');
  if (emails) { try { MailApp.sendEmail({to: emails.split(/[,;]+/).map(function(x){return x.trim();}).filter(function(x){return x;}).join(','), subject: 'Daily Top ' + top.length + ' Users ' + key, htmlBody: lines.join('<br/>')}); } catch (e) { try { logErr_(ss, 'TOP10_EMAIL', String(e), ''); } catch(_){} } }
}

function testIngestUserMonitor() {
  var ss = SpreadsheetApp.openById(SS_ID); var cfg = getCfg_(ss); var token = cfgStr_(cfg, 'TOKEN', '');
  if (!token) throw new Error('No TOKEN in script properties; set TOKEN to run test');
  var payload = { parameter: { token: token, ts: new Date().toISOString(), site: 'TEST', router: 'test-r1', ip: '10.10.10.1', mac: 'AA:BB:CC:DD', host: 'test-host', rx_total: 1000000, tx_total: 500000, interval_sec: 60 } };
  return ingestUserSnapshotToMonitor(payload);
}
