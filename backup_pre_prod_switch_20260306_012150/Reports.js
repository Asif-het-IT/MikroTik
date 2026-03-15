this.HET = this.HET || {};

(function(ns) {
  if (ns.Reports) return;

  function topUsers_() {
    var c = ns.Config.get();
    var sh = ns.Utils.getOrCreateSheet(ns.Config.SHEETS.USER_DATA_USAGE.name);
    var lr = sh.getLastRow();
    if (lr < 2) return [];

    var sample = ns.Utils.toInt(c.TREND_SAMPLES, 180);
    var start = Math.max(2, lr - sample + 1);
    var rows = sh.getRange(start, 1, lr - start + 1, 7).getValues();
    var map = {};
    var i;

    for (i = 0; i < rows.length; i++) {
      var ip = ns.Utils.safeString(rows[i][3], 'unknown');
      var total = ns.Utils.toNum(rows[i][6], 0);
      map[ip] = (map[ip] || 0) + total;
    }

    var list = [];
    var k;
    for (k in map) {
      list.push({ ip: k, total: map[k] });
    }

    list.sort(function(a, b) { return b.total - a.total; });
    return list.slice(0, 5);
  }

  function makeSummary_(tops) {
    var lines = [];
    lines.push('Daily MikroTik Report (' + ns.Config.get().SITE + ')');
    lines.push('Time: ' + ns.Utils.nowText());
    lines.push('Top 5 Users by Total Usage:');

    var i;
    for (i = 0; i < tops.length; i++) {
      lines.push((i + 1) + '. ' + tops[i].ip + ' -> ' + tops[i].total.toFixed(0));
    }

    if (!tops.length) lines.push('No usage rows available.');
    return lines.join('\n');
  }

  function runDailyReport() {
    ns.Utils.withScriptLock(function() {
      var dayKey = Utilities.formatDate(new Date(), ns.Config.get().TZ || 'Asia/Dubai', 'yyyy-MM-dd');
      if (ns.Utils.dedupeSeen('DAILY_REPORT', dayKey, 20 * 3600)) {
        return;
      }

      var tops = topUsers_();
      var sh = ns.Utils.getOrCreateSheet(ns.Config.SHEETS.DAILY_REPORTS.name);
      var row = [ns.Utils.nowDate()];
      var i;
      for (i = 0; i < 5; i++) {
        row.push(tops[i] ? (tops[i].ip + ' (' + tops[i].total.toFixed(0) + ')') : '');
      }
      ns.Utils.appendRow(ns.Config.SHEETS.DAILY_REPORTS.name, row);

      var summary = makeSummary_(tops);
      ns.Telegram.sendMessage(summary);
      ns.Email.send('Daily MikroTik Report - ' + ns.Config.get().SITE, summary, '<pre>' + summary + '</pre>');
    });
  }

  ns.Reports = {
    runDailyReport: runDailyReport
  };
})(this.HET);

function runDailyReport() {
  HET.Reports.runDailyReport();
}
