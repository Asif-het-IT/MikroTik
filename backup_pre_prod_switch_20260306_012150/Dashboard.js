this.HET = this.HET || {};

(function(ns) {
  if (ns.Dashboard) return;

  function latestRow_(sheetName, width) {
    var sh = ns.Utils.getOrCreateSheet(sheetName);
    var lr = sh.getLastRow();
    if (lr < 2) return null;
    return sh.getRange(lr, 1, 1, width).getValues()[0];
  }

  function refreshDashboard() {
    var c = ns.Config.get();
    var dash = ns.Utils.getOrCreateSheet(ns.Config.SHEETS.DASHBOARD.name);

    var live = latestRow_(ns.Config.SHEETS.ROUTER_STATUS.name, 11);
    var vpn = latestRow_(ns.Config.SHEETS.VPN_STATUS.name, 7);
    var usersSh = ns.Utils.getOrCreateSheet(ns.Config.SHEETS.CONNECTED_USERS.name);

    var usersCount = Math.max(usersSh.getLastRow() - 1, 0);
    var liveSeen = live && live[0] instanceof Date ? live[0] : null;
    var lastSeenMin = liveSeen ? ((new Date().getTime() - liveSeen.getTime()) / 60000).toFixed(1) : 'n/a';

    var rows = [
      ['Metric', 'Value', 'Updated At'],
      ['Site', c.SITE, ns.Utils.nowDate()],
      ['Router Status', live ? ns.Utils.safeString(live[3], 'n/a') : 'n/a', ns.Utils.nowDate()],
      ['CPU %', live ? ns.Utils.toInt(live[5], 0) : 0, ns.Utils.nowDate()],
      ['Memory %', live ? ns.Utils.toInt(live[6], 0) : 0, ns.Utils.nowDate()],
      ['IPsec', live ? ns.Utils.safeString(live[9], 'n/a') : 'n/a', ns.Utils.nowDate()],
      ['VPN', vpn ? ns.Utils.safeString(vpn[4], 'n/a') : 'n/a', ns.Utils.nowDate()],
      ['Users (rows)', usersCount, ns.Utils.nowDate()],
      ['Last Seen (min)', lastSeenMin, ns.Utils.nowDate()]
    ];

    dash.clear();
    dash.getRange(1, 1, rows.length, 3).setValues(rows);
    dash.setFrozenRows(1);
    dash.getRange(2, 3, rows.length - 1, 1).setNumberFormat(c.DATE_TIME_FMT || 'dd-MMM-yyyy hh:mm a');
  }

  function runDashboardRefresh() {
    ns.Utils.withScriptLock(function() {
      refreshDashboard();
    });
  }

  ns.Dashboard = {
    refreshDashboard: refreshDashboard,
    runDashboardRefresh: runDashboardRefresh
  };
})(this.HET);
