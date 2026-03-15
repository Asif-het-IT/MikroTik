this.HET = this.HET || {};

(function(ns) {
  if (ns.Monitoring) return;

  function base_(p) {
    var c = ns.Config.get();
    return {
      site: ns.Utils.safeString(p.site, c.SITE),
      router: ns.Utils.safeString(p.router, 'AMBARIYYA_GLOBAL')
    };
  }

  function parseLive_(p) {
    var b = base_(p);
    return {
      site: b.site,
      router: b.router,
      row: [
        ns.Utils.nowDate(),
        b.site,
        b.router,
        ns.Utils.safeString(p.status, 'ONLINE').toUpperCase(),
        ns.Utils.safeString(p.message, 'OK'),
        ns.Utils.toInt(p.cpu, 0),
        ns.Utils.toInt(p.memory, 0),
        ns.Utils.safeString(p.uptime, ''),
        ns.Utils.safeString(p.public_ip || p.publicIp, ''),
        ns.Utils.safeString(p.ipsec, 'UNKNOWN').toUpperCase(),
        ns.Utils.safeString(p.isp, '')
      ]
    };
  }

  function ingestLive(p) {
    var obj = parseLive_(p);
    ns.Utils.appendRow(ns.Config.SHEETS.ROUTER_STATUS.name, obj.row);

    ns.Alerts.processLive(obj);
  }

  function ingestIface(p) {
    var b = base_(p);
    var rows = [];
    if (p.interface) {
      rows.push([
        ns.Utils.nowDate(), b.site, b.router,
        ns.Utils.safeString(p.interface, ''),
        ns.Utils.toNum(p.upload, 0),
        ns.Utils.toNum(p.download, 0),
        ns.Utils.safeString(p.status, 'UP').toUpperCase()
      ]);
    }

    var packed = ns.Utils.splitRecords(p.entries, ';', '|');
    var i;
    for (i = 0; i < packed.length; i++) {
      var a = packed[i];
      rows.push([
        ns.Utils.nowDate(), b.site, b.router,
        ns.Utils.safeString(a[0], ''),
        ns.Utils.toNum(a[1], 0),
        ns.Utils.toNum(a[2], 0),
        ns.Utils.safeString(a[3], 'UP').toUpperCase()
      ]);
    }

    for (i = 0; i < rows.length; i++) {
      ns.Utils.appendRow(ns.Config.SHEETS.INTERFACE_TRAFFIC.name, rows[i]);
    }

    ns.Alerts.processIface({ site: b.site, router: b.router, rows: rows });
  }

  function ingestUsers(p) {
    var b = base_(p);
    var rows = [];

    if (p.ip || p.mac || p.hostname) {
      rows.push([
        ns.Utils.nowDate(), b.site, b.router,
        ns.Utils.safeString(p.ip, ''),
        ns.Utils.safeString(p.mac, ''),
        ns.Utils.safeString(p.hostname, ''),
        ns.Utils.safeString(p.interface, ''),
        ns.Utils.safeString(p.connection_type || p.connectionType, '')
      ]);
    }

    var packed = ns.Utils.splitRecords(p.users, ';', '|');
    var i;
    for (i = 0; i < packed.length; i++) {
      var a = packed[i];
      rows.push([
        ns.Utils.nowDate(), b.site, b.router,
        ns.Utils.safeString(a[0], ''),
        ns.Utils.safeString(a[1], ''),
        ns.Utils.safeString(a[2], ''),
        ns.Utils.safeString(a[3], ''),
        ns.Utils.safeString(a[4], '')
      ]);
    }

    for (i = 0; i < rows.length; i++) {
      ns.Utils.appendRow(ns.Config.SHEETS.CONNECTED_USERS.name, rows[i]);
    }
  }

  function ingestUsage(p) {
    var b = base_(p);
    var rows = [];

    if (p.ip || p.upload || p.download || p.total) {
      rows.push([
        ns.Utils.nowDate(), b.site, b.router,
        ns.Utils.safeString(p.ip, ''),
        ns.Utils.toNum(p.upload, 0),
        ns.Utils.toNum(p.download, 0),
        ns.Utils.toNum(p.total, 0)
      ]);
    }

    var packed = ns.Utils.splitRecords(p.usage, ';', '|');
    var i;
    for (i = 0; i < packed.length; i++) {
      var a = packed[i];
      rows.push([
        ns.Utils.nowDate(), b.site, b.router,
        ns.Utils.safeString(a[0], ''),
        ns.Utils.toNum(a[1], 0),
        ns.Utils.toNum(a[2], 0),
        ns.Utils.toNum(a[3], 0)
      ]);
    }

    for (i = 0; i < rows.length; i++) {
      ns.Utils.appendRow(ns.Config.SHEETS.USER_DATA_USAGE.name, rows[i]);
    }
  }

  function ingestVpn(p) {
    var b = base_(p);
    var row = [
      ns.Utils.nowDate(), b.site, b.router,
      ns.Utils.safeString(p.host, 'vpn.hetdubai.com'),
      ns.Utils.safeString(p.status, 'UNKNOWN').toUpperCase(),
      ns.Utils.safeString(p.ping, ''),
      ns.Utils.safeString(p.message, '')
    ];
    ns.Utils.appendRow(ns.Config.SHEETS.VPN_STATUS.name, row);

    ns.Alerts.processVpn({ site: b.site, router: b.router, row: row });
  }

  function ingestRdp(p) {
    var b = base_(p);
    var row = [
      ns.Utils.nowDate(), b.site, b.router,
      ns.Utils.safeString(p.source, ''),
      ns.Utils.safeString(p.destination, '192.168.78.201:7753'),
      ns.Utils.safeString(p.protocol, 'TCP'),
      ns.Utils.safeString(p.message, 'RDP activity detected')
    ];
    ns.Utils.appendRow(ns.Config.SHEETS.RDP_LOGS.name, row);

    ns.Alerts.processRdp({ site: b.site, router: b.router, row: row });
  }

  function ingestAlert(p) {
    var b = base_(p);
    ns.Alerts.raise({
      severity: ns.Utils.safeString(p.severity, 'MEDIUM').toUpperCase(),
      site: b.site,
      router: b.router,
      type: ns.Utils.safeString(p.alert_type || p.alertType, 'MANUAL_ALERT'),
      message: ns.Utils.safeString(p.message, 'Manual alert from router'),
      metadata: p.metadata || ''
    });
  }

  ns.Monitoring = {
    ingestLive: ingestLive,
    ingestIface: ingestIface,
    ingestUsers: ingestUsers,
    ingestUsage: ingestUsage,
    ingestVpn: ingestVpn,
    ingestRdp: ingestRdp,
    ingestAlert: ingestAlert
  };
})(this.HET);
