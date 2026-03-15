function HET_mobileVpnDayKey_() {
  return Utilities.formatDate(hetNowDate_(), HET.cfg().TZ, 'yyyy-MM-dd');
}

function HET_mobileVpnPoolSize_(startIp, endIp) {
  var a = String(startIp || '').split('.');
  var b = String(endIp || '').split('.');
  if (a.length !== 4 || b.length !== 4) return 0;
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) return 0;
  var s = hetToInt_(a[3], 0);
  var e = hetToInt_(b[3], 0);
  if (s <= 0 || e <= 0 || e < s) return 0;
  return (e - s + 1);
}

function HET_mobileVpnBool_(v, defVal) {
  var t = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
  if (!t) return !!defVal;
  return t === '1' || t === 'yes' || t === 'true' || t === 'up' || t === 'enabled';
}

function HET_mobileVpnParseUsers_(raw) {
  var out = [];
  if (!raw) return out;

  if (Object.prototype.toString.call(raw) === '[object Array]') {
    raw.forEach(function(item) {
      if (!item) return;
      out.push({
        username: hetSafeStr_(item.username || item.user, 60),
        vpnIp: hetSafeStr_(item.vpn_ip || item.vpnIp || item.assigned_ip, 40),
        sourceIp: hetSafeStr_(item.source_ip || item.sourceIp || item.public_ip, 60),
        startedAt: hetSafeStr_(item.started_at || item.start_time || item.connected_at, 60)
      });
    });
    return out;
  }

  String(raw).split(';').forEach(function(line) {
    if (!line) return;
    var a = line.split('|');
    out.push({
      username: hetSafeStr_(a[0], 60),
      vpnIp: hetSafeStr_(a[1], 40),
      sourceIp: hetSafeStr_(a[2], 60),
      startedAt: hetSafeStr_(a[3], 60)
    });
  });

  return out;
}

function HET_mobileVpnLoadDailyState_() {
  var props = HET.props();
  var today = HET_mobileVpnDayKey_();
  var key = 'MOBILE_VPN_DAILY_STATE';
  var raw = props.getProperty(key) || '';
  var state = hetSafeJsonParse_(raw, null);

  if (!state || state.day !== today) {
    state = {
      day: today,
      connects: 0,
      disconnects: 0,
      authFails: 0,
      lastConnectedUser: '',
      lastDisconnectedUser: '',
      lastEvent: '',
      lastEventStatus: '',
      lastConnectionTime: '',
      failSpikeSent: false
    };
  }

  return state;
}

function HET_mobileVpnSaveDailyState_(state) {
  HET.props().setProperty('MOBILE_VPN_DAILY_STATE', JSON.stringify(state || {}));
}

function HET_mobileVpnNormalizeEvent_(value) {
  var e = String(value || '').trim().toLowerCase();
  if (e === 'login' || e === 'connected') return 'connect';
  if (e === 'logout' || e === 'disconnected') return 'disconnect';
  if (e === 'failed' || e === 'auth_failed' || e === 'authentication_failed') return 'auth_fail';
  if (e === 'down') return 'server_down';
  if (e === 'up' || e === 'restored') return 'server_up';
  return e;
}

function HET_mobileVpnApplyEvent_(state, eventType, username, eventTime, statusText) {
  var e = HET_mobileVpnNormalizeEvent_(eventType);
  if (!e) return;

  state.lastEvent = e;
  state.lastEventStatus = String(statusText || '').toUpperCase() || 'INFO';

  if (e === 'connect') {
    state.connects++;
    state.lastConnectedUser = username || state.lastConnectedUser || '';
    state.lastConnectionTime = eventTime ? hetFmt_(eventTime) : hetFmt_(hetNowDate_());
    return;
  }
  if (e === 'disconnect') {
    state.disconnects++;
    state.lastDisconnectedUser = username || state.lastDisconnectedUser || '';
    return;
  }
  if (e === 'auth_fail') {
    state.authFails++;
  }
}

function HET_mobileVpnHealth_(serviceStatus, l2tpEnabled, authFailsToday, failWarnThreshold) {
  if (!l2tpEnabled || String(serviceStatus || '').toUpperCase() !== 'UP') return 'DOWN';
  if (hetToInt_(authFailsToday, 0) >= Math.max(1, hetToInt_(failWarnThreshold, 3))) return 'WARNING';
  return 'WORKING';
}

function HET_ingest(e) {
  var ss = HET.ss();
  var p = (e && e.parameter) ? e.parameter : {};
  var type = hetSafeStr_(p.type, 50).toLowerCase();
  var site = hetSafeStr_(p.site, 40) || HET.cfg().SITE_DEFAULT;
  var router = hetSafeStr_(p.router, 80) || 'UNKNOWN';
  var now = hetNowDate_();

  hetAppendRaw_(false, type, site, router, p);

  function parseIfMap_(ifsText) {
    var map = {};
    String(ifsText || '').split(';').forEach(function(block) {
      var a;
      var name;
      if (!block) return;
      a = block.split('|');
      name = hetSafeStr_(a[0], 30);
      if (!name) return;
      map[name] = {
        rx: hetToNum_(a[1], 0),
        tx: hetToNum_(a[2], 0),
        running: String(a[3] || '0') === '1' ? 'UP' : 'DOWN'
      };
    });
    return map;
  }

  function getIf_(map, name) {
    return map[name] || { rx: 0, tx: 0, running: 'DOWN' };
  }

  function withFriendly_(ifName, friendly) {
    var base = hetSafeStr_(ifName, 20);
    var label = hetSafeStr_(friendly, 60);
    if (!base) return '';
    if (!label) return base;
    return base + ' (' + label + ')';
  }

  if (type === 'traffic') {
    var cfg = HET.cfg();
    var wanIf = hetSafeStr_(p.wan || 'ether1', 20);
    var wanName = hetSafeStr_(p.wan_name, 60) || hetSafeStr_(cfg.TRAFFIC_WAN_NAME, 60) || 'ISP';
    var e2Name = hetSafeStr_(p.e2_name, 60) || hetSafeStr_(cfg.TRAFFIC_E2_NAME, 60) || 'Unity Shop';
    var e3Name = hetSafeStr_(p.e3_name, 60) || hetSafeStr_(cfg.TRAFFIC_E3_NAME, 60) || 'Store Site-2';
    var e4Name = hetSafeStr_(p.e4_name, 60) || hetSafeStr_(cfg.TRAFFIC_E4_NAME, 60) || 'Store Site-1';
    var e5Name = hetSafeStr_(p.e5_name, 60) || hetSafeStr_(cfg.TRAFFIC_E5_NAME, 60) || 'BUK Site';
    var ifMap = parseIfMap_(p.ifs);
    var wan = getIf_(ifMap, wanIf);
    var e2 = getIf_(ifMap, 'ether2');
    var e3 = getIf_(ifMap, 'ether3');
    var e4 = getIf_(ifMap, 'ether4');
    var e5 = getIf_(ifMap, 'ether5');
    hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.RAW_TRAFFIC_LOG), [
      now,
      router,
      site,
      withFriendly_(wanIf, wanName),
      wan.rx,
      wan.tx,
      wan.rx + wan.tx,
      wan.running,
      e2.rx,
      e2.tx,
      e2.rx + e2.tx,
      e2.running,
      e3.rx,
      e3.tx,
      e3.rx + e3.tx,
      e3.running,
      e4.rx,
      e4.tx,
      e4.rx + e4.tx,
      e4.running,
      e5.rx,
      e5.tx,
      e5.rx + e5.tx,
      e5.running,
      hetToInt_(p.cpu, 0),
      hetToInt_(p.memory, 0),
      hetSafeStr_(p.uptime, 80),
      hetSafeStr_(p.public_ip || p.publicIp, 80),
      'OK',
      hetSafeStr_(p.ifs, 5000) + '|labels=' + e2Name + ',' + e3Name + ',' + e4Name + ',' + e5Name
    ]);
    return;
  }

  if (type === 'live') {
    var cpu = hetToInt_(p.cpu, 0);
    var mem = hetToInt_(p.memory, 0);
    var rowLive = [
      now, site, router,
      hetSafeStr_(p.status, 20) || 'ONLINE',
      hetSafeStr_(p.message, 250) || 'OK',
      cpu,
      mem,
      hetSafeStr_(p.uptime, 80),
      hetSafeStr_(p.public_ip || p.publicIp, 80),
      (hetSafeStr_(p.ipsec, 20) || 'UNKNOWN').toUpperCase(),
      hetSafeStr_(p.isp, 30)
    ];
    hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.ROUTER_STATUS), rowLive);
    HET_processLiveAlerts_(site, router, rowLive);
    return;
  }

  if (type === 'iface') {
    var ifaceSh = hetGetOrCreateSheet_(ss, HET.SHEETS.INTERFACE_TRAFFIC);
    var iface = hetSafeStr_(p.interface || p.iface, 40);
    var ifaceRows = [];
    if (iface) {
      ifaceRows.push([
        now, site, router, iface,
        hetToNum_(p.upload || p.tx, 0),
        hetToNum_(p.download || p.rx, 0),
        (hetSafeStr_(p.status, 20) || 'UP').toUpperCase()
      ]);
    }
    var entries = hetSafeStr_(p.entries, 30000);
    if (entries) {
      entries.split(';').forEach(function(line) {
        if (!line) return;
        var a = line.split('|');
        ifaceRows.push([
          now, site, router,
          hetSafeStr_(a[0], 40),
          hetToNum_(a[1], 0),
          hetToNum_(a[2], 0),
          (hetSafeStr_(a[3], 20) || 'UP').toUpperCase()
        ]);
      });
    }
    hetInsertRows_(ifaceSh, ifaceRows);
    return;
  }

  if (type === 'users') {
    var usrSh = hetGetOrCreateSheet_(ss, HET.SHEETS.CONNECTED_USERS);
    var users = hetSafeStr_(p.users, 45000);
    var userRows = [];
    if (users) {
      users.split(';').forEach(function(line) {
        if (!line) return;
        var a = line.split('|');
        userRows.push([
          now, site, router,
          hetSafeStr_(a[0], 40),
          hetSafeStr_(a[1], 40),
          hetSafeStr_(a[2], 120),
          hetSafeStr_(a[3], 40),
          hetSafeStr_(a[4], 20)
        ]);
      });
    }
    hetInsertRows_(usrSh, userRows);
    return;
  }

  if (type === 'live_users') {
    // LAYER 2 — Live Users ingest: PPP + Hotspot + Unique LAN ARP (excl. WAN, deduped).
    // Stored for future HET_liveUsersSnapshot_(); LIVE_USERS_ENABLE controls readout.
    var luSh = hetGetOrCreateSheet_(ss, HET.SHEETS.LIVE_USERS);
    hetInsertRows_(luSh, [[
      now, site, router,
      hetToInt_(p.ppp, 0),
      hetToInt_(p.hotspot, 0),
      hetToInt_(p.arp_lan, 0),
      hetToInt_(p.total, 0),
      hetSafeStr_(p.entries, 10000)
    ]]);
    return;
  }

  if (type === 'enterprise_monitor') {
    // LAYER 3 — Enterprise NOC monitoring: system resources, interface stats, live users breakdown, top talkers.
    var emSh = hetGetOrCreateSheet_(ss, HET.SHEETS.ENTERPRISE_MONITOR);
    var talkersStr = hetSafeStr_(p.top_talkers, 10000);
    hetInsertRows_(emSh, [[
      now, site, router,
      hetSafeStr_(p.uptime, 80),
      hetToInt_(p.cpu, 0),
      hetToInt_(p.memory, 0),
      hetToNum_(p.wan_rx, 0),
      hetToNum_(p.wan_tx, 0),
      hetToInt_(p.wan_pkt, 0),
      hetToInt_(p.wan_err, 0),
      hetToInt_(p.dhcp_bound, 0),
      hetToInt_(p.arp_lan_count, 0),
      hetToInt_(p.ppp_count, 0),
      hetToInt_(p.hs_count, 0),
      hetToInt_(p.live_users, 0),
      talkersStr
    ]]);

    // Parse ARP list and store devices
    var arpListStr = hetSafeStr_(p.arp_lan_list, 10000);
    if (arpListStr) {
      var deviceSh = hetGetOrCreateSheet_(ss, HET.SHEETS.ENTERPRISE_DEVICES);
      var arpEntries = arpListStr.split(';');
      var devRows = [];
      arpEntries.forEach(function(line) {
        if (!line) return;
        var parts = line.split('|');
        if (parts.length >= 3) {
          devRows.push([now, site, router, hetSafeStr_(parts[0], 40), hetSafeStr_(parts[1], 40), 'bridge1', hetSafeStr_(parts[2], 40), 'Unknown']);
        }
      });
      if (devRows.length) hetInsertRows_(deviceSh, devRows);
    }

    // Parse talkers and store
    var talkerStr = hetSafeStr_(p.top_talkers, 10000);
    if (talkerStr) {
      var talkerSh = hetGetOrCreateSheet_(ss, HET.SHEETS.ENTERPRISE_TALKERS);
      var talkerEntries = talkerStr.split(';');
      var talkRows = [];
      talkerEntries.forEach(function(line) {
        if (!line) return;
        var parts = line.split('|');
        if (parts.length >= 3) {
          talkRows.push([now, site, router, hetSafeStr_(parts[0], 40), hetSafeStr_(parts[1], 40), hetToNum_(parts[2], 0), 'Traffic']);
        }
      });
      if (talkRows.length) hetInsertRows_(talkerSh, talkRows);
    }
    return;
  }

  if (type === 'usage') {
    var usgSh = hetGetOrCreateSheet_(ss, HET.SHEETS.USER_DATA_USAGE);
    var usage = hetSafeStr_(p.usage, 45000);
    var usageRows = [];
    if (usage) {
      usage.split(';').forEach(function(line) {
        if (!line) return;
        var a = line.split('|');
        usageRows.push([
          now, site, router,
          hetSafeStr_(a[0], 40),
          hetToNum_(a[1], 0),
          hetToNum_(a[2], 0),
          hetToNum_(a[3], 0)
        ]);
      });
    }
    hetInsertRows_(usgSh, usageRows);
    return;
  }

  if (type === 'mobile_vpn') {
    var cfg = HET.cfg();
    var mobileSite = hetSafeStr_(p.site, 40) || hetSafeStr_(cfg.MOBILE_VPN_SITE, 40) || site;
    var service = hetSafeStr_(p.service, 60) || hetSafeStr_(cfg.MOBILE_VPN_SERVICE, 60) || 'Mobile VPN';
    var vpnType = hetSafeStr_(p.vpn_type || p.vpnType, 40) || hetSafeStr_(cfg.MOBILE_VPN_TYPE, 40) || 'L2TP/IPsec';
    var l2tpEnabled = HET_mobileVpnBool_(p.l2tp_enabled !== undefined ? p.l2tp_enabled : p.server_enabled, true);
    var explicitUp = String(hetSafeStr_(p.service_status || p.status, 20) || '').toUpperCase();
    var serviceStatus = (explicitUp === 'DOWN' || explicitUp === 'DISABLED' || !l2tpEnabled) ? 'DOWN' : 'UP';
    var activeUsers = HET_mobileVpnParseUsers_(p.active_users || p.users || p.entries);
    var activeCount = hetToInt_(p.active_count, activeUsers.length);
    var eventType = HET_mobileVpnNormalizeEvent_(p.event_type || p.event || '');
    var eventStatus = (hetSafeStr_(p.event_status || p.status, 20) || '').toUpperCase();
    var eventUsername = hetSafeStr_(p.username || p.user, 60);
    var eventVpnIp = hetSafeStr_(p.vpn_ip || p.assigned_ip, 40);
    var eventSourceIp = hetSafeStr_(p.source_ip || p.public_ip || p.src_ip, 60);
    var eventNotes = hetSafeStr_(p.notes || p.message, 250);
    var failWarnThreshold = Math.max(1, hetToInt_(cfg.MOBILE_VPN_FAIL_WARN_THRESHOLD, 3));
    var props = HET.props();
    var lastServiceStatus = String(props.getProperty('MOBILE_VPN_LAST_SERVICE_STATUS') || '').toUpperCase();
    var poolStart = hetSafeStr_(cfg.MOBILE_VPN_POOL_START, 40) || '10.20.30.10';
    var poolEnd = hetSafeStr_(cfg.MOBILE_VPN_POOL_END, 40) || '10.20.30.20';
    var poolSize = HET_mobileVpnPoolSize_(poolStart, poolEnd);
    var poolUsageText;
    var state;
    var health;
    var lastEventText;
    var connectedUsersText;
    var assignedIpsText;
    var sourceIpsText;

    if (!eventUsername && activeUsers.length) eventUsername = activeUsers[0].username;
    if (!eventVpnIp && activeUsers.length) eventVpnIp = activeUsers[0].vpnIp;
    if (!eventSourceIp && activeUsers.length) eventSourceIp = activeUsers[0].sourceIp;

    state = HET_mobileVpnLoadDailyState_();
    HET_mobileVpnApplyEvent_(state, eventType, eventUsername, now, eventStatus || (eventType === 'auth_fail' ? 'FAILED' : 'CONNECTED'));
    health = HET_mobileVpnHealth_(serviceStatus, l2tpEnabled, state.authFails, failWarnThreshold);

    if (eventType) {
      hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.MOBILE_VPN_EVENTS), [
        now,
        mobileSite,
        service,
        vpnType,
        eventUsername || '',
        eventVpnIp || '',
        eventSourceIp || '',
        eventType,
        eventStatus || (eventType === 'auth_fail' ? 'FAILED' : 'OK'),
        eventNotes || ''
      ]);
    }

    var activeSh = hetGetOrCreateSheet_(ss, HET.SHEETS.MOBILE_VPN_ACTIVE);
    activeSh.clearContents();
    hetEnsureHeader_(activeSh, HET.HEADERS[HET.SHEETS.MOBILE_VPN_ACTIVE]);
    if (activeUsers.length) {
      var activeRows = activeUsers.map(function(u) {
        return [
          now,
          mobileSite,
          service,
          vpnType,
          u.username || '',
          u.vpnIp || '',
          u.sourceIp || '',
          u.startedAt || '',
          'CONNECTED'
        ];
      });
      activeSh.getRange(2, 1, activeRows.length, 9).setValues(activeRows);
      activeSh.getRange(2, 1, activeRows.length, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
    }

    connectedUsersText = activeUsers.map(function(u) { return u.username; }).filter(function(v) { return !!v; }).join(', ');
    assignedIpsText = activeUsers.map(function(u) { return u.vpnIp; }).filter(function(v) { return !!v; }).join(', ');
    sourceIpsText = activeUsers.map(function(u) { return u.sourceIp; }).filter(function(v) { return !!v; }).join(', ');
    lastEventText = state.lastEvent ? (state.lastEvent + ' / ' + (state.lastEventStatus || 'INFO')) : 'none';
    poolUsageText = poolSize > 0 ? (String(activeCount) + '/' + String(poolSize)) : String(activeCount);

    hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.MOBILE_VPN_SUMMARY), [
      now,
      mobileSite,
      service,
      vpnType,
      serviceStatus,
      l2tpEnabled ? 'ENABLED' : 'DISABLED',
      health,
      activeCount,
      connectedUsersText || '-',
      assignedIpsText || '-',
      sourceIpsText || '-',
      lastEventText,
      state.lastConnectionTime || 'n/a',
      state.authFails,
      state.connects,
      state.disconnects,
      state.lastConnectedUser || '-',
      state.lastDisconnectedUser || '-',
      poolStart + '-' + poolEnd,
      poolUsageText,
      eventNotes || (health === 'WARNING' ? 'Auth failures elevated' : 'OK')
    ]);

    if (serviceStatus === 'DOWN') {
      HET_logAlert_('CRITICAL', mobileSite, router, 'MOBILE_VPN_DOWN', 'Mobile VPN service is DOWN', 'L2TP=' + (l2tpEnabled ? 'ENABLED' : 'DISABLED'));
    } else {
      HET_recoverIncidentFamily_(mobileSite, router, 'MOBILE_VPN_SERVICE', 'MOBILE_VPN_UP', 'Mobile VPN service restored', 'Service UP');
    }

    if (typeof HET_sendMobileVpnTelegramEvent_ === 'function') {
      if (serviceStatus === 'DOWN' && lastServiceStatus !== 'DOWN') {
        HET_sendMobileVpnTelegramEvent_({
          site: mobileSite,
          service: service,
          vpnType: vpnType,
          eventType: 'server_down',
          status: 'DOWN',
          username: eventUsername || '-',
          vpnIp: eventVpnIp || '-',
          sourceIp: eventSourceIp || '-',
          time: now,
          notes: 'L2TP server unavailable/disabled'
        });
      } else if (serviceStatus === 'UP' && lastServiceStatus === 'DOWN') {
        HET_sendMobileVpnTelegramEvent_({
          site: mobileSite,
          service: service,
          vpnType: vpnType,
          eventType: 'server_up',
          status: 'UP',
          username: eventUsername || '-',
          vpnIp: eventVpnIp || '-',
          sourceIp: eventSourceIp || '-',
          time: now,
          notes: 'Mobile VPN service restored'
        });
      }
    }

    if (state.authFails >= failWarnThreshold && !state.failSpikeSent) {
      state.failSpikeSent = true;
      HET_logAlert_('HIGH', mobileSite, router, 'MOBILE_VPN_FAIL_SPIKE', 'Repeated Mobile VPN authentication failures', 'Count today=' + state.authFails);
      if (typeof HET_sendMobileVpnTelegramEvent_ === 'function') {
        HET_sendMobileVpnTelegramEvent_({
          site: mobileSite,
          service: service,
          vpnType: vpnType,
          eventType: 'repeated_fail',
          status: 'WARNING',
          username: eventUsername || '-',
          vpnIp: eventVpnIp || '-',
          sourceIp: eventSourceIp || '-',
          time: now,
          notes: 'Failed logins today: ' + state.authFails
        });
      }
    }

    HET_mobileVpnSaveDailyState_(state);
    props.setProperty('MOBILE_VPN_LAST_SERVICE_STATUS', serviceStatus);

    if (typeof HET_sendMobileVpnTelegramEvent_ === 'function' && eventType) {
      HET_sendMobileVpnTelegramEvent_({
        site: mobileSite,
        service: service,
        vpnType: vpnType,
        eventType: eventType,
        status: eventStatus || (eventType === 'auth_fail' ? 'FAILED' : 'OK'),
        username: eventUsername || '-',
        vpnIp: eventVpnIp || '-',
        sourceIp: eventSourceIp || '-',
        time: now,
        notes: eventNotes || ''
      });
    }

    return;
  }

  if (type === 'user_usage') {
    if (typeof HET_ingestUserUsage_ === 'function') {
      HET_ingestUserUsage_(now, site, router, p);
    } else {
      hetAppendRaw_(true, type, site, router, { reason: 'TopUsers module missing', payload: p });
    }
    return;
  }

  if (type === 'vpn') {
    var vpnRow = [
      now, site, router,
      hetSafeStr_(p.host, 120),
      (hetSafeStr_(p.status, 20) || 'UNKNOWN').toUpperCase(),
      hetSafeStr_(p.ping, 20),
      hetSafeStr_(p.message, 250)
    ];
    hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.VPN_STATUS), vpnRow);
    if (vpnRow[4] === 'DOWN') {
      HET_logAlert_('CRITICAL', site, router, 'VPN_DOWN', 'VPN connectivity failed', vpnRow[6]);
    } else if (typeof HET_recoverIncidentFamily_ === 'function') {
      HET_recoverIncidentFamily_(site, router, 'VPN_CONNECTIVITY', 'VPN_RECOVERED', 'VPN connectivity restored', vpnRow[6]);
    }
    return;
  }

  if (type === 'rdp') {
    hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.RDP_LOGS), [
      now, site, router,
      hetSafeStr_(p.source, 80),
      hetSafeStr_(p.destination, 80),
      hetSafeStr_(p.protocol, 20) || 'TCP',
      hetSafeStr_(p.message, 250) || 'RDP activity detected'
    ]);
    HET_logAlert_('HIGH', site, router, 'RDP_DETECTED', 'RDP activity detected', hetSafeStr_(p.source, 80));
    return;
  }

  if (type === 'routerlog') {
    var c = HET.cfg();
    var logTime = hetSafeStr_(p.log_time || p.logTime || p.router_time, 40);
    var topics = hetSafeStr_(p.topics, 150);
    var severity = (hetSafeStr_(p.severity, 20) || 'INFO').toUpperCase();
    var logMessage = hetSafeStr_(p.message, 500) || 'Router log received';

    hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.ROUTER_LOGS), [
      now,
      site,
      router,
      logTime,
      topics,
      severity,
      logMessage
    ]);

    if (hetIsYes_(c.ROUTERLOG_ALERT_ENABLE)) {
      var msgL = String(logMessage).toLowerCase();
      var topicsL = String(topics).toLowerCase();
      var blocked = false;
      var blockTerms = String(c.ROUTERLOG_ALERT_BLOCK || '').toLowerCase().split(',');
      var i;
      var t;

      if (msgL.indexOf('het_') >= 0) blocked = true;

      for (i = 0; i < blockTerms.length && !blocked; i++) {
        t = String(blockTerms[i] || '').trim();
        if (!t) continue;
        if (msgL.indexOf(t) >= 0 || topicsL.indexOf(t) >= 0) blocked = true;
      }

      if (!blocked && (severity === 'CRITICAL' || severity === 'HIGH')) {
        var keyTerms = String(c.ROUTERLOG_ALERT_KEYWORDS || '').toLowerCase().split(',');
        var matched = false;
        for (i = 0; i < keyTerms.length && !matched; i++) {
          t = String(keyTerms[i] || '').trim();
          if (!t) continue;
          if (msgL.indexOf(t) >= 0 || topicsL.indexOf(t) >= 0) matched = true;
        }

        if (matched || severity === 'CRITICAL') {
          HET_logAlert_(severity, site, router, 'ROUTER_LOG_' + severity, logMessage, topics + (logTime ? ' @ ' + logTime : ''));
        }
      }
    }
    return;
  }

  if (type === 'change') {
    var category = hetSafeStr_(p.category, 40) || 'system';
    var item = hetSafeStr_(p.item, 80) || 'unknown';
    var action = hetSafeStr_(p.action, 40) || 'changed';
    var details = hetSafeStr_(p.details || p.message, 500) || 'Router change detected';

    hetAppendRow_(hetGetOrCreateSheet_(ss, HET.SHEETS.ROUTER_CHANGES), [
      now,
      site,
      router,
      category,
      item,
      action,
      details
    ]);

    HET_logAlert_('HIGH', site, router, 'ROUTER_CHANGE', category + ' / ' + item + ' / ' + action, details);
    return;
  }

  if (type === 'alert') {
    HET_logAlert_(
      (hetSafeStr_(p.severity, 20) || 'MEDIUM').toUpperCase(),
      site,
      router,
      hetSafeStr_(p.alert_type || p.alertType, 50) || 'MANUAL_ALERT',
      hetSafeStr_(p.message, 250) || 'Manual alert',
      hetSafeStr_(p.metadata, 500)
    );
    return;
  }

  hetAppendRaw_(true, type, site, router, { reason: 'unknown type', payload: p });
}
