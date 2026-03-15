this.HET = this.HET || {};

(function(ns) {
  if (ns.Alerts) return;

  function toObjMeta_(meta) {
    if (!meta) return {};
    if (typeof meta === 'object') return meta;
    try {
      return JSON.parse(String(meta));
    } catch (err) {
      return { raw: String(meta) };
    }
  }

  function queueOutbox_(channel, subject, message, meta) {
    ns.Utils.appendRow(ns.Config.SHEETS.OUTBOX.name, [
      ns.Utils.nowDate(),
      channel,
      subject,
      ns.Utils.trimToLimit(message, 4000),
      'PENDING',
      0,
      JSON.stringify(meta || {})
    ]);
  }

  function raise(alert) {
    var a = alert || {};
    var sev = ns.Utils.safeString(a.severity, 'MEDIUM').toUpperCase();
    var site = ns.Utils.safeString(a.site, ns.Config.get().SITE);
    var router = ns.Utils.safeString(a.router, 'ROUTER');
    var type = ns.Utils.safeString(a.type, 'GENERIC');
    var msg = ns.Utils.safeString(a.message, 'Alert');
    var meta = toObjMeta_(a.metadata);

    var stateKey = site + ':' + router + ':' + type;
    var stateVal = sev + '|' + msg;
    var changed = ns.Utils.compareAndSetState('ALERT', stateKey, stateVal);
    if (!changed) return;

    ns.Utils.appendRow(ns.Config.SHEETS.ALERTS.name, [
      ns.Utils.nowDate(), sev, site, router, type, msg, JSON.stringify(meta)
    ]);

    var subject = '[NOC ' + sev + '] ' + site + '/' + router + ' ' + type;
    var body = subject + '\n' + msg + '\n' + JSON.stringify(meta);

    queueOutbox_('TELEGRAM', subject, body, { site: site, router: router, type: type });
    queueOutbox_('EMAIL', subject, body, { site: site, router: router, type: type });

    if (String(ns.Config.get().AUTO_SEND_OUTBOX).toUpperCase() === 'YES') {
      flushOutbox(20);
    }
  }

  function processLive(obj) {
    var c = ns.Config.get();
    var row = obj.row;
    var cpu = ns.Utils.toInt(row[5], 0);
    var mem = ns.Utils.toInt(row[6], 0);
    var status = ns.Utils.safeString(row[3], 'ONLINE').toUpperCase();
    var ipsec = ns.Utils.safeString(row[9], 'UNKNOWN').toUpperCase();

    if (status !== 'ONLINE' && status !== 'UP') {
      raise({ severity: 'CRITICAL', site: obj.site, router: obj.router, type: 'ROUTER_DOWN', message: 'Router status: ' + status });
    }
    if (cpu >= ns.Utils.toInt(c.CPU_CRIT, 85)) {
      raise({ severity: 'CRITICAL', site: obj.site, router: obj.router, type: 'CPU_CRIT', message: 'CPU ' + cpu + '%' });
    } else if (cpu >= ns.Utils.toInt(c.CPU_WARN, 70)) {
      raise({ severity: 'HIGH', site: obj.site, router: obj.router, type: 'CPU_WARN', message: 'CPU ' + cpu + '%' });
    }

    if (mem >= ns.Utils.toInt(c.MEM_CRIT, 90)) {
      raise({ severity: 'CRITICAL', site: obj.site, router: obj.router, type: 'MEM_CRIT', message: 'Memory ' + mem + '%' });
    } else if (mem >= ns.Utils.toInt(c.MEM_WARN, 80)) {
      raise({ severity: 'HIGH', site: obj.site, router: obj.router, type: 'MEM_WARN', message: 'Memory ' + mem + '%' });
    }

    if (ipsec === 'DOWN') {
      raise({ severity: 'CRITICAL', site: obj.site, router: obj.router, type: 'IPSEC_DOWN', message: 'IPsec tunnel down' });
    }
  }

  function processIface(obj) {
    var c = ns.Config.get();
    var maxMbps = ns.Utils.toNum(c.ISP_MAX_MBPS, 20);
    var warnPct = ns.Utils.toNum(c.ISP_SAT_WARN_PCT, 70);
    var critPct = ns.Utils.toNum(c.ISP_SAT_CRIT_PCT, 90);

    var i;
    for (i = 0; i < obj.rows.length; i++) {
      var r = obj.rows[i];
      var iface = ns.Utils.safeString(r[3], 'iface');
      var up = ns.Utils.toNum(r[4], 0);
      var down = ns.Utils.toNum(r[5], 0);
      var mbps = ((up + down) * 8) / 1000000;
      var pct = maxMbps > 0 ? (mbps / maxMbps) * 100 : 0;

      if (pct >= critPct) {
        raise({ severity: 'CRITICAL', site: obj.site, router: obj.router, type: 'ISP_SAT_CRIT', message: iface + ' saturation ' + pct.toFixed(1) + '%' });
      } else if (pct >= warnPct) {
        raise({ severity: 'HIGH', site: obj.site, router: obj.router, type: 'ISP_SAT_WARN', message: iface + ' saturation ' + pct.toFixed(1) + '%' });
      }
    }
  }

  function processVpn(obj) {
    var status = ns.Utils.safeString(obj.row[4], 'UNKNOWN').toUpperCase();
    if (status === 'DOWN') {
      raise({ severity: 'CRITICAL', site: obj.site, router: obj.router, type: 'VPN_DOWN', message: 'vpn.hetdubai.com unreachable' });
    }
  }

  function processRdp(obj) {
    raise({
      severity: 'HIGH',
      site: obj.site,
      router: obj.router,
      type: 'RDP_DETECTED',
      message: ns.Utils.safeString(obj.row[3], '') + ' -> ' + ns.Utils.safeString(obj.row[4], '')
    });
  }

  function checkStaleRouters() {
    var c = ns.Config.get();
    var sh = ns.Utils.getOrCreateSheet(ns.Config.SHEETS.ROUTER_STATUS.name);
    var lr = sh.getLastRow();
    if (lr < 2) return;

    var row = sh.getRange(lr, 1, 1, 11).getValues()[0];
    var lastDate = row[0];
    var site = ns.Utils.safeString(row[1], c.SITE);
    var router = ns.Utils.safeString(row[2], 'ROUTER');

    if (!(lastDate instanceof Date)) return;

    var diffMs = new Date().getTime() - lastDate.getTime();
    var mins = diffMs / 60000;

    if (mins >= ns.Utils.toInt(c.STALE_CRIT, 10)) {
      raise({ severity: 'CRITICAL', site: site, router: router, type: 'STALE_CRIT', message: 'No live data for ' + mins.toFixed(1) + ' min' });
    } else if (mins >= ns.Utils.toInt(c.STALE_WARN, 3)) {
      raise({ severity: 'MEDIUM', site: site, router: router, type: 'STALE_WARN', message: 'Live data delayed ' + mins.toFixed(1) + ' min' });
    }
  }

  function flushOutbox(maxItems) {
    var limit = ns.Utils.toInt(maxItems, 20);
    var sh = ns.Utils.getOrCreateSheet(ns.Config.SHEETS.OUTBOX.name);
    var lr = sh.getLastRow();
    if (lr < 2) return;

    var data = sh.getRange(2, 1, lr - 1, 7).getValues();
    var sent = 0;
    var i;
    for (i = 0; i < data.length && sent < limit; i++) {
      var row = data[i];
      var status = ns.Utils.safeString(row[4], '');
      if (status !== 'PENDING') continue;

      var channel = ns.Utils.safeString(row[1], '');
      var subject = ns.Utils.safeString(row[2], '');
      var message = ns.Utils.safeString(row[3], '');
      var attempts = ns.Utils.toInt(row[5], 0);

      try {
        if (channel === 'TELEGRAM') {
          ns.Telegram.sendMessage(message);
        } else if (channel === 'EMAIL') {
          ns.Email.send(subject, message, '<pre>' + message + '</pre>');
        }
        sh.getRange(i + 2, 5).setValue('SENT');
      } catch (err) {
        sh.getRange(i + 2, 5).setValue('FAILED');
        sh.getRange(i + 2, 6).setValue(attempts + 1);
      }
      sent++;
    }
  }

  function runAlertCycle() {
    ns.Utils.withScriptLock(function() {
      checkStaleRouters();
      flushOutbox(30);
    });
  }

  ns.Alerts = {
    raise: raise,
    processLive: processLive,
    processIface: processIface,
    processVpn: processVpn,
    processRdp: processRdp,
    checkStaleRouters: checkStaleRouters,
    flushOutbox: flushOutbox,
    runAlertCycle: runAlertCycle
  };
})(this.HET);
