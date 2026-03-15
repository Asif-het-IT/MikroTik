this.HET = this.HET || {};

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var U = this.HET.Utils;

  try {
    U.withScriptLock(function() {
      U.ensureAllSheets();

      var c = HET.Config.get();
      var type = U.safeString(p.type, '').toLowerCase();
      var site = U.safeString(p.site, c.SITE);
      var router = U.safeString(p.router, 'AMBARIYYA_GLOBAL');

      var token = U.safeString(p.token, '');
      var valid = token && token === U.safeString(c.MONITOR_TOKEN, '');

      if (!valid) {
        U.appendRaw('auth_fail', site, router, { reason: 'invalid token', type: type }, true);
        return;
      }

      if (!type) {
        U.appendRaw('unknown', site, router, { reason: 'missing type' }, true);
        return;
      }

      if (U.isRateLimited(site, router, type)) {
        U.appendRaw(type, site, router, { info: 'rate-limited' }, true);
        return;
      }

      U.appendRaw(type, site, router, p, false);

      if (type === 'test') return;
      if (type === 'live') {
        HET.Monitoring.ingestLive(p);
        return;
      }
      if (type === 'iface') {
        HET.Monitoring.ingestIface(p);
        return;
      }
      if (type === 'users') {
        HET.Monitoring.ingestUsers(p);
        return;
      }
      if (type === 'usage') {
        HET.Monitoring.ingestUsage(p);
        return;
      }
      if (type === 'vpn') {
        HET.Monitoring.ingestVpn(p);
        return;
      }
      if (type === 'rdp') {
        HET.Monitoring.ingestRdp(p);
        return;
      }
      if (type === 'alert') {
        HET.Monitoring.ingestAlert(p);
        return;
      }

      U.appendRaw(type, site, router, { reason: 'unknown type' }, true);
    });
  } catch (err) {
    try {
      U.appendRaw('ingest_exception', U.safeString(p.site, ''), U.safeString(p.router, ''), { message: String(err) }, true);
    } catch (_) {}
  }

  // RouterOS expects a simple text response; keep it stable to avoid retries.
  return U.textOk();
}

function initMonitoringSystem() {
  HET.Utils.withScriptLock(function() {
    HET.Utils.ensureAllSheets();
    HET.Dashboard.refreshDashboard();
  });
}
