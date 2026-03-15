this.HET = this.HET || {};

(function(ns) {
  if (ns.Config) return;

  var SHEETS = {
    ROUTER_STATUS: { name: 'Router Status', headers: ['Time', 'Site', 'Router', 'Status', 'Message', 'CPU', 'Memory %', 'Uptime', 'Public IP', 'IPsec', 'ISP'] },
    INTERFACE_TRAFFIC: { name: 'Interface Traffic', headers: ['Time', 'Site', 'Router', 'Interface', 'Upload', 'Download', 'Status'] },
    CONNECTED_USERS: { name: 'Connected Users', headers: ['Time', 'Site', 'Router', 'IP', 'MAC', 'Hostname', 'Interface', 'Connection Type'] },
    USER_DATA_USAGE: { name: 'User Data Usage', headers: ['Time', 'Site', 'Router', 'IP', 'Upload', 'Download', 'Total'] },
    VPN_STATUS: { name: 'VPN Status', headers: ['Time', 'Site', 'Router', 'Host', 'Status', 'Ping', 'Message'] },
    RDP_LOGS: { name: 'RDP Logs', headers: ['Time', 'Site', 'Router', 'Source', 'Destination', 'Protocol', 'Message'] },
    ALERTS: { name: 'Alerts', headers: ['Time', 'Severity', 'Site', 'Router', 'Type', 'Message', 'Metadata'] },
    DAILY_REPORTS: { name: 'Daily Reports', headers: ['Date', 'Top User 1', 'Top User 2', 'Top User 3', 'Top User 4', 'Top User 5'] },
    RAW_LIVE: { name: 'RAW Live', headers: ['Time', 'Type', 'Site', 'Router', 'Payload'] },
    RAW_EVENTS: { name: 'RAW Events', headers: ['Time', 'Type', 'Site', 'Router', 'Payload'] },
    OUTBOX: { name: 'Outbox', headers: ['Time', 'Channel', 'Subject', 'Message', 'Status', 'Attempts', 'Meta'] },
    DASHBOARD: { name: 'Dashboard', headers: ['Metric', 'Value', 'Updated At'] }
  };

  var DEFAULTS = {
    MONITOR_TOKEN: 'MONITOR_TOKEN_2026',
    TG_BOT: '8546997581:AAEEyKvRaR_QzhBrSBCLwseYgHTBHMizSkg',
    TG_CHAT: '-1003786414616',
    EMAILS: 'asif@harisheximtrading.com,hetnigeria@harisheximtrading.com',
    SITE: 'KANO',
    DATE_TIME_FMT: 'dd-MMM-yyyy hh:mm a',
    DASH_REFRESH_MIN: '5',
    ALERT_REFRESH_MIN: '2',
    DAILY_HOUR: '9',
    CPU_WARN: '70',
    CPU_CRIT: '85',
    MEM_WARN: '80',
    MEM_CRIT: '90',
    LEASES_WARN: '45',
    STALE_WARN: '3',
    STALE_CRIT: '10',
    LIVE_MINUTES: '2',
    TREND_SAMPLES: '180',
    RAW_KEEP_ROWS: '2000',
    RAW_MODE: 'TOP',
    ISP_MAX_MBPS: '20',
    ISP_SAT_WARN_PCT: '70',
    ISP_SAT_CRIT_PCT: '90',
    AUTO_SEND_OUTBOX: 'YES',
    TZ: 'Asia/Dubai',
    SS_ID: ''
  };

  function scriptProps_() {
    return PropertiesService.getScriptProperties();
  }

  function readProps_() {
    var sp = scriptProps_();
    var all = sp.getProperties();
    var merged = {};
    var k;
    for (k in DEFAULTS) merged[k] = DEFAULTS[k];
    for (k in all) merged[k] = all[k];
    return merged;
  }

  function ensureDefaults_() {
    var sp = scriptProps_();
    var all = sp.getProperties();
    var updates = {};
    var k;
    for (k in DEFAULTS) {
      if (!(k in all)) updates[k] = DEFAULTS[k];
    }
    if (Object.keys(updates).length) sp.setProperties(updates, false);
  }

  function getSpreadsheet_() {
    ensureDefaults_();

    var sp = scriptProps_();
    var p = readProps_();
    var ssId = p.SS_ID;
    var ss;

    if (ssId) {
      try {
        ss = SpreadsheetApp.openById(ssId);
      } catch (err) {
        ss = null;
      }
    }

    if (!ss) {
      ss = SpreadsheetApp.create('MikroTik Monitoring DB - ' + p.SITE);
      ssId = ss.getId();
      sp.setProperty('SS_ID', ssId);
    }

    ss.setSpreadsheetTimeZone(p.TZ || 'Asia/Dubai');
    return ss;
  }

  function get() {
    return readProps_();
  }

  function set(obj) {
    scriptProps_().setProperties(obj || {}, false);
  }

  ns.Config = {
    SHEETS: SHEETS,
    DEFAULTS: DEFAULTS,
    get: get,
    set: set,
    getSpreadsheet: getSpreadsheet_
  };
})(this.HET);
