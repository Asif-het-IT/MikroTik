function HET_sendTelegramMessageToChat_(chatId, text, opts) {
  var c = HET.cfg();
  var cid = String(chatId || c.TG_CHAT || '').trim();
  if (!c.TG_BOT || !cid) return;
  opts = opts || {};

  var payload = {
    chat_id: cid,
    text: hetSafeStr_(text, 3900),
    disable_web_page_preview: opts.disableWebPreview !== false
  };
  if (opts.messageThreadId !== undefined && opts.messageThreadId !== null && String(opts.messageThreadId) !== '') {
    payload.message_thread_id = Number(opts.messageThreadId);
  }

  var url = 'https://api.telegram.org/bot' + encodeURIComponent(c.TG_BOT) + '/sendMessage';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  HET_tgDebugLog_('sendMessage', {
    chatId: cid,
    threadId: opts.messageThreadId,
    status: res.getResponseCode(),
    ok: /"ok"\s*:\s*true/.test(String(res.getContentText() || ''))
  });
  HET_tgSaveDebugState_('TG_LAST_SEND_API', {
    at: hetFmt_(hetNowDate_()),
    api: 'sendMessage',
    chatId: cid,
    threadId: opts.messageThreadId,
    status: res.getResponseCode(),
    body: hetSafeStr_(String(res.getContentText() || ''), 2000)
  });
}

function HET_sendTelegramDocument_(blob, caption, chatId) {
  var c = HET.cfg();
  var cid = String(chatId || c.TG_CHAT || '').trim();
  if (!c.TG_BOT || !cid || !blob) return;

  var docUrl = 'https://api.telegram.org/bot' + encodeURIComponent(c.TG_BOT) + '/sendDocument';
  var res = UrlFetchApp.fetch(docUrl, {
    method: 'post',
    payload: {
      chat_id: cid,
      caption: hetSafeStr_(caption || '', 900),
      document: blob
    },
    muteHttpExceptions: true
  });
  HET_tgDebugLog_('sendDocument', { chatId: cid, status: res.getResponseCode() });
  HET_tgSaveDebugState_('TG_LAST_SEND_API', {
    at: hetFmt_(hetNowDate_()),
    api: 'sendDocument',
    chatId: cid,
    status: res.getResponseCode(),
    body: hetSafeStr_(String(res.getContentText() || ''), 2000)
  });
}

function HET_sendTelegramPhoto_(blob, caption, chatId, opts) {
  var c = HET.cfg();
  var cid = String(chatId || c.TG_CHAT || '').trim();
  if (!c.TG_BOT || !cid || !blob) return;
  opts = opts || {};

  var payload = {
    chat_id: cid,
    caption: hetSafeStr_(caption || '', 900),
    photo: blob
  };
  if (opts.messageThreadId !== undefined && opts.messageThreadId !== null && String(opts.messageThreadId) !== '') {
    payload.message_thread_id = Number(opts.messageThreadId);
  }

  var photoUrl = 'https://api.telegram.org/bot' + encodeURIComponent(c.TG_BOT) + '/sendPhoto';
  var res = UrlFetchApp.fetch(photoUrl, {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  });
  HET_tgDebugLog_('sendPhoto', { chatId: cid, threadId: opts.messageThreadId, status: res.getResponseCode() });
  HET_tgSaveDebugState_('TG_LAST_SEND_API', {
    at: hetFmt_(hetNowDate_()),
    api: 'sendPhoto',
    chatId: cid,
    threadId: opts.messageThreadId,
    status: res.getResponseCode(),
    body: hetSafeStr_(String(res.getContentText() || ''), 2000)
  });
}

function HET_sendTelegram_(text, opts) {
  var c = HET.cfg();
  if (!c.TG_BOT || !c.TG_CHAT) return;
  opts = opts || {};
  var cid = String(opts.chatId || c.TG_CHAT).trim();

  HET_sendTelegramMessageToChat_(cid, text, opts);

  if (opts.documentBlob) {
    HET_sendTelegramDocument_(opts.documentBlob, opts.documentCaption || 'Dashboard Snapshot', cid);
  }
  if (opts.photoBlobs && opts.photoBlobs.length) {
    for (var i = 0; i < opts.photoBlobs.length; i++) {
      var cap = (opts.photoCaption || 'Dashboard Snapshot') + ' ' + (i + 1) + '/' + opts.photoBlobs.length;
      HET_sendTelegramPhoto_(opts.photoBlobs[i], cap, cid, opts);
    }
    return;
  }
  if (opts.photoBlob) {
    HET_sendTelegramPhoto_(opts.photoBlob, opts.photoCaption || 'Dashboard Snapshot', cid, opts);
  }
}

function HET_isTelegramUpdate_(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.update_id !== undefined) return true;

  // Avoid misclassifying monitor payloads that contain a plain "message" field.
  var msg = payload.message || payload.edited_message || payload.channel_post || payload.edited_channel_post;
  if (!msg || typeof msg !== 'object') return false;

  return msg.chat !== undefined ||
    msg.from !== undefined ||
    msg.message_id !== undefined ||
    msg.text !== undefined ||
    msg.caption !== undefined;
}

function HET_tgDebugEnabled_() {
  var p = HET.props();
  var v = String(p.getProperty('TG_DEBUG_ENABLE') || HET.cfg().TG_DEBUG_ENABLE || 'YES').toUpperCase();
  return v === 'YES';
}

function HET_tgDebugLog_(stage, meta) {
  if (!HET_tgDebugEnabled_()) return;
  try {
    Logger.log('[TG_DEBUG] ' + stage + ' | ' + JSON.stringify(meta || {}));
  } catch (_) {}
}

function parseTelegramCommand_(text) {
  var raw = hetSafeStr_(text || '', 500).replace(/[\u200B-\u200F\uFEFF]/g, '');
  if (!raw) return { command: '', args: '', raw: '', mention: '' };
  var m = raw.match(/^\s*\/(\w+)(?:@([A-Za-z0-9_]+))?(?:\s+(.*))?\s*$/s);
  if (!m) return { command: '', args: '', raw: raw, mention: '' };
  var cmd = '/' + String(m[1] || '').toLowerCase();
  var mention = String(m[2] || '').toLowerCase();
  var args = hetSafeStr_(m[3] || '', 400);
  return {
    command: cmd,
    args: args,
    raw: raw,
    mention: mention
  };
}

function HET_parseTelegramCommand_(text) {
  return parseTelegramCommand_(text).command;
}

function HET_getTelegramBotUsername_() {
  var c = HET.cfg();
  if (!c.TG_BOT) return '';

  try {
    var props = HET.props();
    var cachedName = String(props.getProperty('TG_BOT_USERNAME') || '').trim().toLowerCase();
    var cachedAt = parseInt(props.getProperty('TG_BOT_USERNAME_AT_MS') || '0', 10);
    var now = Date.now();
    if (cachedName && cachedAt && (now - cachedAt) < 24 * 60 * 60 * 1000) return cachedName;

    var url = 'https://api.telegram.org/bot' + encodeURIComponent(c.TG_BOT) + '/getMe';
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return cachedName;
    var json = hetSafeJsonParse_(res.getContentText(), {});
    var uname = String(json && json.result && json.result.username || '').trim().toLowerCase();
    if (uname) {
      props.setProperty('TG_BOT_USERNAME', uname);
      props.setProperty('TG_BOT_USERNAME_AT_MS', String(now));
      return uname;
    }
    return cachedName;
  } catch (_) {
    return '';
  }
}

function HET_extractTelegramCommandFromMessage_(msg) {
  if (!msg) return { command: '', args: '', mention: '', raw: '' };
  var text = String(msg.text || msg.caption || '');
  var entities = msg.entities || msg.caption_entities || [];
  var i;
  for (i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (!e || e.type !== 'bot_command' || e.offset !== 0) continue;
    var token = text.substr(e.offset, e.length);
    var parsed = parseTelegramCommand_(token);
    parsed.args = text.substr(e.length).trim();
    parsed.raw = text;
    return parsed;
  }
  return parseTelegramCommand_(text);
}

function isAuthorizedTelegramChat_(chatId) {
  var allowed = String(HET.cfg().TG_CHAT || '').trim();
  return !!(allowed && String(chatId || '').trim() === allowed);
}

function sendTelegramMessage_(chatId, text, opts) {
  HET_sendTelegramMessageToChat_(chatId, text, opts || { disableWebPreview: true });
}

function sendTelegramPhoto_(chatId, imageBlob, caption, opts) {
  HET_sendTelegramPhoto_(imageBlob, caption || 'Snapshot', chatId, opts || {});
}

function HET_tgSaveDebugState_(name, valueObj) {
  try {
    var props = HET.props();
    props.setProperty(name, JSON.stringify(valueObj || {}));
  } catch (_) {}
}

function HET_tgLoadDebugState_(name) {
  try {
    return hetSafeJsonParse_(HET.props().getProperty(name) || '{}', {});
  } catch (_) {
    return {};
  }
}

function HET_adminTelegramDebug_() {
  return {
    ok: true,
    pollLast: HET_tgLoadDebugState_('TG_LAST_POLL'),
    webhookLast: HET_tgLoadDebugState_('TG_LAST_WEBHOOK'),
    incomingLast: HET_tgLoadDebugState_('TG_LAST_INCOMING'),
    rawLast: HET_tgLoadDebugState_('TG_LAST_RAW_UPDATE'),
    parseLast: HET_tgLoadDebugState_('TG_LAST_PARSE'),
    sendLast: HET_tgLoadDebugState_('TG_LAST_SEND'),
    sendApiLast: HET_tgLoadDebugState_('TG_LAST_SEND_API')
  };
}

function HET_pollTelegramUpdates_() {
  var c = HET.cfg();
  if (!c.TG_BOT) return { ok: false, reason: 'TG_BOT_MISSING' };

  var props = HET.props();
  var offset = parseInt(props.getProperty('TG_UPDATE_OFFSET') || '0', 10);
  if (isNaN(offset) || offset < 0) offset = 0;

  var url = 'https://api.telegram.org/bot' + encodeURIComponent(c.TG_BOT) +
    '/getUpdates?timeout=0&limit=20&allowed_updates=%5B%22message%22,%22edited_message%22,%22channel_post%22,%22edited_channel_post%22%5D' +
    (offset ? ('&offset=' + offset) : '');

  HET_tgSaveDebugState_('TG_LAST_POLL', {
    at: hetFmt_(hetNowDate_()),
    stage: 'poll_started',
    lastOffset: offset,
    urlMasked: 'https://api.telegram.org/bot***' + '/getUpdates?offset=' + offset
  });

  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    var body = String(res.getContentText() || '');
    var json = hetSafeJsonParse_(body, {});
    if (code !== 200 || !json || !json.ok) {
      HET_tgDebugLog_('poll_error', { status: code, body: hetSafeStr_(body, 500) });
      HET_tgSaveDebugState_('TG_LAST_POLL', {
        at: hetFmt_(hetNowDate_()),
        stage: 'poll_finished',
        ok: false,
        status: code,
        lastOffset: offset,
        updatesReceivedCount: 0,
        nextOffset: offset,
        body: hetSafeStr_(body, 500)
      });
      return { ok: false, status: code, body: hetSafeStr_(body, 500) };
    }

    var arr = json.result || [];
    var processed = 0;
    var maxId = offset;

    for (var i = 0; i < arr.length; i++) {
      var upd = arr[i] || {};
      var uid = parseInt(upd.update_id, 10);
      if (!isNaN(uid) && uid >= maxId) maxId = uid + 1;
      if (typeof HET_handleTelegramUpdate_ === 'function') {
        HET_handleTelegramUpdate_(upd);
      }
      processed++;
    }

    if (maxId > offset) props.setProperty('TG_UPDATE_OFFSET', String(maxId));
    HET_tgDebugLog_('poll_ok', { processed: processed, nextOffset: maxId });
    HET_tgSaveDebugState_('TG_LAST_POLL', {
      at: hetFmt_(hetNowDate_()),
      stage: 'poll_finished',
      ok: true,
      lastOffset: offset,
      updatesReceivedCount: arr.length,
      processed: processed,
      receivedUpdateId: arr.length ? arr[arr.length - 1].update_id : '',
      nextOffset: maxId
    });
    return { ok: true, processed: processed, nextOffset: maxId };
  } catch (err) {
    HET_tgDebugLog_('poll_exception', { error: String(err) });
    HET_tgSaveDebugState_('TG_LAST_POLL', {
      at: hetFmt_(hetNowDate_()),
      stage: 'poll_finished',
      ok: false,
      lastOffset: offset,
      nextOffset: offset,
      error: String(err)
    });
    return { ok: false, error: String(err) };
  }
}

function HET_adminTelegramPollNow_() {
  return HET_pollTelegramUpdates_();
}

function HET_tgBytes_(value) {
  var n = hetToNum_(value, 0);
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB';
  return n.toFixed(0) + ' B';
}

function HET_tgActivityText_(bytes) {
  var n = hetToNum_(bytes, 0);
  if (n > 0) return HET_tgBytes_(n);
  var dayNum = parseInt(Utilities.formatDate(hetNowDate_(), HET.cfg().TZ, 'u'), 10);
  return dayNum === 7 ? 'Closed / No activity' : 'Unexpected inactivity';
}

function HET_tgDashboardUrl_() {
  var c = HET.cfg();
  var raw = String(c.DASHBOARD_UI_URL || c.WEBAPP_EXEC_URL || '').trim();
  if (!raw) {
    try {
      raw = String(ScriptApp.getService().getUrl() || '').trim();
    } catch (_) {
      raw = '';
    }
  }
  if (!raw) return '';
  return raw.indexOf('?') > -1 ? raw : (raw + '?page=dashboard');
}

function HET_tgTimestamp_() {
  return 'Generated: ' + hetFmt_(hetNowDate_());
}

function HET_tgTopUsersLines_(snap, take) {
  var top = (snap.topUsage && snap.topUsage.length) ? snap.topUsage.slice(0, take || 5) : [];
  if (!top.length) return ['No recent user usage data received'];
  return top.map(function(item, idx) {
    var name = item.preferredName || item.comment || item.hostname || 'unknown';
    return (idx + 1) + '. ' + name + ' | ' + (item.ip || 'n/a') + ' | ' + (item.mac || 'n/a') + ' | ' + HET_tgBytes_(item.total);
  });
}

function HET_tgLiveUsersText_(snap) {
  var lu = snap && snap.users ? snap.users.live : null;
  if (!lu) return 'Disabled';
  return String(hetToInt_(lu.total, 0)) + ' (age ' + lu.ageMin + 'm)';
}

function buildHelpMessage_() {
  return [
    'het Telegram NOC Commands',
    '',
    '/help - Show available commands',
    '/report - Full live monitoring report',
    '/health - Quick health summary',
    '/traffic - WAN and branch traffic overview',
    '/alerts - Alerts count and recent alerts',
    '/top - Top bandwidth users',
    '/vpn - VPN and IPsec status',
    '/mobilevpn - Mobile VPN status and users',
    '/users - DHCP + Live users summary',
    '/uptime - Router uptime and update time',
    '/wan - WAN, Public IP, ISP status',
    '/status - Executive one-screen status',
    '/snapshot - Dashboard full-page screenshot',
    '',
    HET_tgTimestamp_()
  ].join('\n');
}

function buildReportMessage_(snap) {
  var mv = snap.mobileVpn || {};
  var lines = [
    'het Network Report',
    '',
    'Site: ' + (snap.site || 'KANO'),
    'Router: ' + (snap.router || 'UNKNOWN'),
    '',
    'System Status',
    'Router: ' + snap.live.status,
    'Mobile VPN: ' + (mv.status || 'UNKNOWN') + ' | Active ' + (mv.activeCount || 0) + ' | Failed today ' + (mv.failedToday || 0),
    'VPN/IPsec: ' + (((snap.vpn.status || 'UNKNOWN') === 'UP' && (snap.live.ipsec || 'UNKNOWN') === 'UP') ? 'UP' : 'DEGRADED'),
    'CPU Load: ' + snap.live.cpu + '%',
    'Memory Usage: ' + snap.live.memory + '%',
    'DHCP Users (Snapshot): ' + snap.users.active,
    'Live Users (Router): ' + HET_tgLiveUsersText_(snap),
    '',
    'Network',
    'Public IP: ' + (snap.live.publicIp || 'n/a'),
    'Last Seen: ' + (snap.live.lastSeen || 'n/a'),
    '',
    'Traffic Overview',
    'WAN Total: ' + HET_tgBytes_(snap.traffic.wanTotalText),
    (snap.traffic.e2Label || 'Unity Shop') + ': ' + HET_tgActivityText_(snap.traffic.e2Text),
    (snap.traffic.e3Label || 'Store Site-2') + ': ' + HET_tgActivityText_(snap.traffic.e3Text),
    (snap.traffic.e4Label || 'Store Site-1') + ': ' + HET_tgActivityText_(snap.traffic.e4Text),
    (snap.traffic.e5Label || 'BUK Site') + ': ' + HET_tgActivityText_(snap.traffic.e5Text),
    '',
    'Alerts (Last 24h)',
    'Critical: ' + snap.alerts.critical,
    'High: ' + snap.alerts.high,
    'Medium: ' + snap.alerts.medium,
    '',
    'Dashboard: ' + HET_tgDashboardUrl_(),
    HET_tgTimestamp_()
  ];
  return lines.join('\n');
}

function buildHealthMessage_(snap) {
  var mv = snap.mobileVpn || {};
  return [
    'het Network Health',
    '',
    'Site: ' + snap.site,
    'Router: ' + snap.router,
    '',
    'Router: ' + snap.live.status,
    'Mobile VPN: ' + (mv.status || 'UNKNOWN') + ' | Health ' + (mv.health || 'UNKNOWN'),
    'VPN/IPsec: ' + (((snap.vpn.status || 'UNKNOWN') === 'UP' && (snap.live.ipsec || 'UNKNOWN') === 'UP') ? 'UP' : 'DEGRADED'),
    'WAN: ' + snap.traffic.wanRunning,
    'CPU: ' + snap.live.cpu + '%',
    'Memory: ' + snap.live.memory + '%',
    'DHCP Users: ' + snap.users.active,
    'Live Users (Router): ' + HET_tgLiveUsersText_(snap),
    'Last Seen: ' + snap.live.lastSeen,
    HET_tgTimestamp_()
  ].join('\n');
}

function buildTrafficMessage_(snap) {
  return [
    'het Traffic Overview',
    '',
    'WAN Total: ' + HET_tgBytes_(snap.traffic.wanTotalText),
    (snap.traffic.e2Label || 'Unity Shop') + ': ' + HET_tgActivityText_(snap.traffic.e2Text),
    (snap.traffic.e3Label || 'Store Site-2') + ': ' + HET_tgActivityText_(snap.traffic.e3Text),
    (snap.traffic.e4Label || 'Store Site-1') + ': ' + HET_tgActivityText_(snap.traffic.e4Text),
    (snap.traffic.e5Label || 'BUK Site') + ': ' + HET_tgActivityText_(snap.traffic.e5Text),
    HET_tgTimestamp_()
  ].join('\n');
}

function buildAlertsMessage_(snap) {
  var lines = [
    'het Alerts Summary',
    '',
    'Critical: ' + snap.alerts.critical,
    'High: ' + snap.alerts.high,
    'Medium: ' + snap.alerts.medium,
    ''
  ];
  var recent = snap.alerts && snap.alerts.recent ? snap.alerts.recent.slice(0, 5) : [];
  if (!recent.length) {
    lines.push('No recent alerts.');
  } else {
    recent.forEach(function(a) {
      lines.push('- ' + a.time + ' | ' + a.severity + ' | ' + a.type + ' | ' + hetSafeStr_(a.message, 90));
    });
  }
  lines.push(HET_tgTimestamp_());
  return lines.join('\n');
}

function buildTopUsersMessage_(snap) {
  var lines = ['het Top Bandwidth Users', ''];
  lines = lines.concat(HET_tgTopUsersLines_(snap, 5));
  lines.push(HET_tgTimestamp_());
  return lines.join('\n');
}

function buildVpnMessage_(snap) {
  return [
    'het VPN Status',
    '',
    'VPN Host: ' + (snap.vpn.host || 'n/a'),
    'VPN Status: ' + (snap.vpn.status || 'UNKNOWN'),
    'Ping: ' + (snap.vpn.ping || 'n/a'),
    'IPsec: ' + (snap.live.ipsec || 'UNKNOWN'),
    HET_tgTimestamp_()
  ].join('\n');
}

function buildMobileVpnMessage_(snap) {
  var mv = snap && snap.mobileVpn ? snap.mobileVpn : {};
  var users = (mv.connectedUsers && mv.connectedUsers.length) ? mv.connectedUsers.join(', ') : '-';
  var vpnIps = (mv.assignedIps && mv.assignedIps.length) ? mv.assignedIps.join(', ') : '-';
  var sourceIps = (mv.sourceIps && mv.sourceIps.length) ? mv.sourceIps.join(', ') : '-';
  return [
    'Mobile VPN Status',
    '',
    'Site: ' + (mv.site || 'KANO'),
    'Service: ' + (mv.service || 'Mobile VPN'),
    'VPN Type: ' + (mv.vpnType || 'L2TP/IPsec'),
    'Status: ' + (mv.status || 'UNKNOWN'),
    'Health: ' + (mv.health || 'UNKNOWN'),
    'L2TP Server: ' + (mv.l2tpServer || 'UNKNOWN'),
    'Active Users: ' + String(hetToInt_(mv.activeCount, 0)),
    'Connected Users: ' + users,
    'Assigned VPN IPs: ' + vpnIps,
    'Source Public IPs: ' + sourceIps,
    'Last Event: ' + (mv.lastEvent || 'none'),
    'Last Connection Time: ' + (mv.lastConnectionTime || 'n/a'),
    'Failed Logins Today: ' + String(hetToInt_(mv.failedToday, 0)),
    HET_tgTimestamp_()
  ].join('\n');
}

function HET_sendMobileVpnTelegramEvent_(eventObj) {
  var ev = eventObj || {};
  var t = String(ev.eventType || '').toLowerCase();
  var title = 'Mobile VPN Event';
  if (t === 'connect') title = '🔐 Mobile VPN Connected';
  if (t === 'disconnect') title = '🔓 Mobile VPN Disconnected';
  if (t === 'auth_fail') title = '⚠️ Mobile VPN Authentication Failed';
  if (t === 'repeated_fail') title = '⚠️ Mobile VPN Repeated Failed Attempts';
  if (t === 'server_down') title = '🚨 Mobile VPN Service Down';
  if (t === 'server_up') title = '✅ Mobile VPN Service Restored';

  var statusText = String(ev.status || '').toUpperCase();
  if (!statusText) statusText = 'INFO';
  if (t === 'connect') statusText = 'CONNECTED';
  if (t === 'disconnect') statusText = 'DISCONNECTED';
  if (t === 'auth_fail') statusText = 'FAILED';
  if (t === 'server_down') statusText = 'DOWN';
  if (t === 'server_up') statusText = 'UP';

  var lines = [
    title,
    'Site: ' + (ev.site || 'KANO'),
    'Service: ' + (ev.service || 'Mobile VPN'),
    'VPN Type: ' + (ev.vpnType || 'L2TP/IPsec'),
    'Username: ' + (ev.username || '-'),
    'Assigned VPN IP: ' + (ev.vpnIp || '-'),
    'Source Public IP: ' + (ev.sourceIp || '-'),
    'Event: ' + (ev.eventType || 'event'),
    'Status: ' + statusText,
    'Time: ' + (ev.time instanceof Date ? hetFmt_(ev.time) : hetFmt_(hetNowDate_()))
  ];
  if (ev.notes) lines.push('Notes: ' + hetSafeStr_(ev.notes, 200));

  HET_sendTelegram_(lines.join('\n'), { disableWebPreview: true });
}

function buildUsersMessage_(snap) {
  return [
    'het Users Summary',
    '',
    'DHCP Users (Snapshot): ' + snap.users.active,
    'Live Users (Router): ' + HET_tgLiveUsersText_(snap),
    'Router: ' + snap.router,
    'Last Seen: ' + snap.live.lastSeen,
    HET_tgTimestamp_()
  ].join('\n');
}

function buildUptimeMessage_(snap) {
  return [
    'het Uptime Summary',
    '',
    'Router: ' + snap.router,
    'Uptime: ' + (snap.live.uptime || 'n/a'),
    'Last Update: ' + (snap.live.updatedAt || 'n/a'),
    HET_tgTimestamp_()
  ].join('\n');
}

function buildWanMessage_(snap) {
  return [
    'het WAN Status',
    '',
    'WAN Running: ' + (snap.traffic.wanRunning || 'UNKNOWN'),
    'Public IP: ' + (snap.live.publicIp || 'n/a'),
    'ISP: ' + (snap.live.isp || 'n/a'),
    'Last WAN Update: ' + (snap.traffic.updatedAt || 'n/a'),
    HET_tgTimestamp_()
  ].join('\n');
}

function buildStatusMessage_(snap) {
  var mv = snap.mobileVpn || {};
  return [
    'het Executive Status',
    '',
    'Router: ' + snap.live.status,
    'Mobile VPN: ' + (mv.status || 'UNKNOWN') + ' | Users ' + (mv.activeCount || 0),
    'VPN: ' + snap.vpn.status,
    'WAN: ' + snap.traffic.wanRunning,
    'CPU: ' + snap.live.cpu + '%',
    'Memory: ' + snap.live.memory + '%',
    'DHCP Users: ' + snap.users.active,
    'Live Users (Router): ' + HET_tgLiveUsersText_(snap),
    'Critical Alerts: ' + snap.alerts.critical,
    HET_tgTimestamp_()
  ].join('\n');
}

function HET_getSnapshotBlob_() {
  try {
    var snap = typeof HET_collectSnapshot_ === 'function' ? HET_collectSnapshot_() : null;
    var dashUrl = HET_tgDashboardUrl_();
    if (snap && typeof HET_dashboardSnapshotPngBlob_ === 'function') {
      var pngBlob = HET_dashboardSnapshotPngBlob_(snap, dashUrl);
      if (pngBlob) return pngBlob;
    }
    if (typeof HET_dashboardWebShots_ === 'function') {
      var shots = HET_dashboardWebShots_(dashUrl);
      if (shots && shots.fullpage) return shots.fullpage;
      if (shots && shots.viewport) return shots.viewport;
    }
  } catch (err) {
    Logger.log('HET_getSnapshotBlob_ failed: ' + err);
  }
  return null;
}

function HET_logTelegramCommand_(chatId, userId, command, status, note) {
  Logger.log('TG_CMD chat=' + chatId + ' user=' + userId + ' cmd=' + command + ' status=' + status + ' note=' + (note || ''));
}

function HET_tgRateLimitOk_(chatId) {
  try {
    var props = HET.props();
    var key = 'TG_CMD_LAST_' + String(chatId || 'na');
    var now = Date.now();
    var last = parseInt(props.getProperty(key) || '0', 10);
    if (!isNaN(last) && now - last < 800) return false;
    props.setProperty(key, String(now));
    return true;
  } catch (_) {
    return true;
  }
}

function HET_tgStrictMention_() {
  var v = String(HET.props().getProperty('TG_STRICT_MENTION') || HET.cfg().TG_STRICT_MENTION || 'NO').toUpperCase();
  return v === 'YES';
}

function HET_tgStrictAuth_() {
  var v = String(HET.props().getProperty('TG_AUTH_STRICT') || HET.cfg().TG_AUTH_STRICT || 'NO').toUpperCase();
  return v === 'YES';
}

function handleTelegramCommand_(command, payload) {
  var chatId = payload.chatId;
  var threadId = payload.messageThreadId;
  var snap = HET_collectSnapshot_();
  var cmd = String(command || '').toLowerCase();

  if (cmd === '/start' || cmd === '/help') {
    sendTelegramMessage_(chatId, buildHelpMessage_(), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'help' };
  }
  if (cmd === '/tgdebug') {
    var d = HET_adminTelegramDebug_();
    var dbg = [
      'tgdebug',
      'chat_id: ' + chatId,
      'thread_id: ' + (threadId || 'n/a'),
      'last_poll_stage: ' + (((d.pollLast || {}).stage) || 'n/a'),
      'last_poll_updates: ' + (((d.pollLast || {}).updatesReceivedCount) || 0),
      'last_poll_next_offset: ' + (((d.pollLast || {}).nextOffset) || 0),
      'last_parsed_command: ' + (((d.parseLast || {}).command) || 'n/a'),
      HET_tgTimestamp_()
    ].join('\n');
    sendTelegramMessage_(chatId, dbg, { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'tgdebug' };
  }
  if (cmd === '/ping') {
    sendTelegramMessage_(chatId, 'pong\nchat_id: ' + chatId + '\nthread_id: ' + (threadId || 'n/a') + '\n' + HET_tgTimestamp_(), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'ping' };
  }
  if (cmd === '/report') {
    sendTelegramMessage_(chatId, buildReportMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'report' };
  }
  if (cmd === '/health') {
    sendTelegramMessage_(chatId, buildHealthMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'health' };
  }
  if (cmd === '/traffic') {
    sendTelegramMessage_(chatId, buildTrafficMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'traffic' };
  }
  if (cmd === '/alerts') {
    sendTelegramMessage_(chatId, buildAlertsMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'alerts' };
  }
  if (cmd === '/top') {
    sendTelegramMessage_(chatId, buildTopUsersMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'top' };
  }
  if (cmd === '/vpn') {
    sendTelegramMessage_(chatId, buildVpnMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'vpn' };
  }
  if (cmd === '/mobilevpn') {
    sendTelegramMessage_(chatId, buildMobileVpnMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'mobilevpn' };
  }
  if (cmd === '/users') {
    sendTelegramMessage_(chatId, buildUsersMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'users' };
  }
  if (cmd === '/uptime') {
    sendTelegramMessage_(chatId, buildUptimeMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'uptime' };
  }
  if (cmd === '/wan') {
    sendTelegramMessage_(chatId, buildWanMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'wan' };
  }
  if (cmd === '/status') {
    sendTelegramMessage_(chatId, buildStatusMessage_(snap), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'status' };
  }
  if (cmd === '/snapshot') {
    var blob = HET_getSnapshotBlob_();
    if (blob) {
      sendTelegramPhoto_(chatId, blob, 'Dashboard Full Page Screenshot', { messageThreadId: threadId });
      return { ok: true, command: cmd, type: 'snapshot', sent: 'photo' };
    }
    sendTelegramMessage_(chatId, 'Snapshot feature not available yet\n' + HET_tgTimestamp_(), { disableWebPreview: true, messageThreadId: threadId });
    return { ok: true, command: cmd, type: 'snapshot', sent: 'placeholder' };
  }

  sendTelegramMessage_(chatId, 'Unknown command.\nUse /help to see available monitoring commands.', { disableWebPreview: true, messageThreadId: threadId });
  return { ok: true, command: cmd, type: 'unknown' };
}

function HET_buildTelegramReport_(snap) { return buildReportMessage_(snap); }
function HET_buildTelegramHealth_(snap) { return buildHealthMessage_(snap); }
function HET_buildTelegramUsers_(snap) { return buildUsersMessage_(snap); }
function HET_buildTelegramAlerts_(snap) { return buildAlertsMessage_(snap); }

function HET_handleTelegramUpdate_(update) {
  HET_tgDebugLog_('webhook_hit', {
    hasUpdateId: !!(update && update.update_id !== undefined),
    hasMessage: !!(update && update.message),
    hasEditedMessage: !!(update && update.edited_message),
    hasChannelPost: !!(update && update.channel_post),
    hasEditedChannelPost: !!(update && update.edited_channel_post)
  });
  HET_tgSaveDebugState_('TG_LAST_WEBHOOK', {
    at: hetFmt_(hetNowDate_()),
    updateId: update && update.update_id,
    hasMessage: !!(update && update.message),
    hasEditedMessage: !!(update && update.edited_message),
    hasChannelPost: !!(update && update.channel_post),
    hasEditedChannelPost: !!(update && update.edited_channel_post)
  });
  HET_tgSaveDebugState_('TG_LAST_RAW_UPDATE', {
    at: hetFmt_(hetNowDate_()),
    updateId: update && update.update_id,
    raw: hetSafeStr_(JSON.stringify(update || {}), 4000)
  });

  var msg = (update && (update.message || update.edited_message || update.channel_post || update.edited_channel_post)) || null;
  if (typeof msg === 'string') {
    msg = hetSafeJsonParse_(msg, null);
  }
  if (!msg) return { ok: true, ignored: 'no_message' };
  if (msg.from && msg.from.is_bot) return { ok: true, ignored: 'bot_message' };

  var chatId = String(msg.chat && msg.chat.id !== undefined ? msg.chat.id : '').trim();
  var threadId = msg.message_thread_id !== undefined ? msg.message_thread_id : '';
  var rawText = String(msg.text || msg.caption || '');
  var rawEntities = msg.entities || msg.caption_entities || [];
  var preParsed = HET_extractTelegramCommandFromMessage_(msg);

  HET_tgSaveDebugState_('TG_LAST_INCOMING', {
    at: hetFmt_(hetNowDate_()),
    updateId: update && update.update_id,
    chatId: chatId,
    threadId: threadId,
    chatType: String(msg.chat && msg.chat.type || ''),
    isTopicMessage: !!msg.is_topic_message,
    text: hetSafeStr_(rawText, 350),
    entities: rawEntities,
    parsedCommand: preParsed.command || '',
    parsedMention: preParsed.mention || ''
  });

  HET_tgDebugLog_('chat_detected', {
    chatId: chatId,
    threadId: threadId,
    chatType: String(msg.chat && msg.chat.type || ''),
    allowed: String(HET.cfg().TG_CHAT || '')
  });
  if (!chatId || (HET_tgStrictAuth_() && !isAuthorizedTelegramChat_(chatId))) {
    HET_tgDebugLog_('auth_reject', { chatId: chatId });
    return { ok: true, ignored: 'unauthorized_chat', chatId: chatId };
  }
  if (!isAuthorizedTelegramChat_(chatId)) {
    HET_tgDebugLog_('auth_bypass_debug', { chatId: chatId });
  }

  if (!HET_tgRateLimitOk_(chatId)) {
    return { ok: true, ignored: 'rate_limited', chatId: chatId };
  }

  var parsed = preParsed;
  HET_tgDebugLog_('command_parse', {
    command: parsed.command,
    mention: parsed.mention,
    text: hetSafeStr_(msg.text || msg.caption || '', 120)
  });
  if (!parsed.command) return { ok: true, ignored: 'not_command' };
  HET_tgSaveDebugState_('TG_LAST_PARSE', {
    at: hetFmt_(hetNowDate_()),
    chatId: chatId,
    threadId: threadId,
    chatType: String(msg.chat && msg.chat.type || ''),
    text: hetSafeStr_(msg.text || msg.caption || '', 300),
    command: parsed.command,
    mention: parsed.mention || '',
    entities: msg.entities || msg.caption_entities || []
  });

  if (parsed.mention) {
    var botName = HET_getTelegramBotUsername_();
    if (botName && parsed.mention !== botName && HET_tgStrictMention_()) {
      HET_tgDebugLog_('command_for_other_bot', { mention: parsed.mention, botName: botName });
      return { ok: true, ignored: 'command_for_other_bot', mention: parsed.mention };
    }
    if (botName && parsed.mention !== botName && !HET_tgStrictMention_()) {
      HET_tgDebugLog_('mention_mismatch_tolerated', { mention: parsed.mention, botName: botName });
    }
  }

  var userId = String(msg.from && msg.from.id !== undefined ? msg.from.id : 'unknown');
  var result = handleTelegramCommand_(parsed.command, {
    update: update,
    message: msg,
    chatId: chatId,
    messageThreadId: threadId,
    userId: userId,
    args: parsed.args
  });
  HET_tgSaveDebugState_('TG_LAST_SEND', {
    at: hetFmt_(hetNowDate_()),
    chatId: chatId,
    threadId: threadId,
    command: parsed.command,
    result: result
  });
  HET_logTelegramCommand_(chatId, userId, parsed.command, 'OK', JSON.stringify(result || {}));
  HET_tgDebugLog_('command_done', { command: parsed.command, resultType: result && result.type });

  return { ok: true, command: parsed.command, chatId: chatId, result: result };
}
