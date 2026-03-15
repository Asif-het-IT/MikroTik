this.HET = this.HET || {};

function applyScriptProperties() {
  HET.Config.set({
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
    TZ: 'Asia/Dubai'
  });
}

function initAndFormatSheets() {
  HET.Utils.withScriptLock(function() {
    HET.Utils.ensureAllSheets();
    HET.Dashboard.refreshDashboard();
  });
}

function createOrResetTriggers() {
  var all = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < all.length; i++) {
    ScriptApp.deleteTrigger(all[i]);
  }

  var c = HET.Config.get();

  ScriptApp.newTrigger('runDashboardRefresh')
    .timeBased()
    .everyMinutes(HET.Utils.toInt(c.DASH_REFRESH_MIN, 5))
    .create();

  ScriptApp.newTrigger('runAlertCycle')
    .timeBased()
    .everyMinutes(HET.Utils.toInt(c.ALERT_REFRESH_MIN, 2))
    .create();

  ScriptApp.newTrigger('runDailyReport')
    .timeBased()
    .atHour(HET.Utils.toInt(c.DAILY_HOUR, 9))
    .everyDays(1)
    .create();
}

function runDashboardRefresh() {
  HET.Dashboard.runDashboardRefresh();
}

function runAlertCycle() {
  HET.Alerts.runAlertCycle();
}

function verifyPlannedTriggers() {
  var list = ScriptApp.getProjectTriggers();
  var out = [];
  var i;
  for (i = 0; i < list.length; i++) {
    out.push({
      handler: list[i].getHandlerFunction(),
      type: String(list[i].getEventType())
    });
  }
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
