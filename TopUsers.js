function HET_macKey_(value) {
  return hetSafeStr_(value, 32).toUpperCase();
}

function HET_dateKey_(d) {
  return Utilities.formatDate(d, HET.cfg().TZ, 'yyyy-MM-dd');
}

function HET_monthKey_(d) {
  return Utilities.formatDate(d, HET.cfg().TZ, 'yyyy-MM');
}

function HET_userUsagePeriodStart_(period, now) {
  var d = new Date(now.getTime());
  if (String(period).toLowerCase() === 'monthly') {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function HET_parseUserUsageEntries_(entriesText) {
  var out = [];
  String(entriesText || '').split(';').forEach(function(line) {
    var a;
    if (!line) return;
    a = line.split('|');
    out.push({
      ip: hetSafeStr_(a[0], 40),
      mac: HET_macKey_(a[1]),
      hostname: hetSafeStr_(a[2], 120),
      comment: hetSafeStr_(a[3], 120),
      iface: hetSafeStr_(a[4], 40),
      upload: hetToNum_(a[5], 0),
      download: hetToNum_(a[6], 0)
    });
  });
  return out;
}

function HET_deviceMap_() {
  var sh = HET.ss().getSheetByName(HET.SHEETS.DEVICE_MAPPING);
  var width = (HET.HEADERS[HET.SHEETS.DEVICE_MAPPING] || []).length || 13;
  var rows = hetGetTopDataRows_(sh, width, 5000);
  var map = {};

  rows.forEach(function(r) {
    var mac = HET_macKey_(r[0]);
    if (!mac) return;
    map[mac] = {
      mac: mac,
      hostname: hetSafeStr_(r[1], 120),
      comment: hetSafeStr_(r[2], 120),
      deviceType: hetSafeStr_(r[3], 60),
      notes: hetSafeStr_(r[4], 250),
      preferredName: hetSafeStr_(r[5], 120),
      lastSeenIp: hetSafeStr_(r[6], 40),
      resolvedSite: hetSafeStr_(r[8], 40),
      nameSource: hetSafeStr_(r[9], 30),
      siteSource: hetSafeStr_(r[10], 30),
      confidence: hetSafeStr_(r[11], 20),
      lastSeenInterface: hetSafeStr_(r[12], 40)
    };
  });

  return map;
}

function HET_upsertDeviceMapping_(rows) {
  var ss = HET.ss();
  var sh = hetGetOrCreateSheet_(ss, HET.SHEETS.DEVICE_MAPPING);
  var header = HET.HEADERS[HET.SHEETS.DEVICE_MAPPING] || [];
  var width = header.length || 13;
  var existingRows = hetGetTopDataRows_(sh, width, 10000);
  var map = {};
  var order = [];
  var i;

  existingRows.forEach(function(r) {
    var mac = HET_macKey_(r[0]);
    if (!mac) return;
    map[mac] = [
      mac,
      hetSafeStr_(r[1], 120),
      hetSafeStr_(r[2], 120),
      hetSafeStr_(r[3], 60),
      hetSafeStr_(r[4], 250),
      hetSafeStr_(r[5], 120),
      hetSafeStr_(r[6], 40),
      r[7] instanceof Date ? r[7] : '',
      hetSafeStr_(r[8], 40),
      hetSafeStr_(r[9], 30),
      hetSafeStr_(r[10], 30),
      hetSafeStr_(r[11], 20),
      hetSafeStr_(r[12], 40)
    ];
    order.push(mac);
  });

  rows.forEach(function(item) {
    var mac = HET_macKey_(item.mac);
    var row;
    if (!mac) return;

    row = map[mac] || [mac, '', '', '', '', '', '', '', '', '', '', '', ''];
    if (item.hostname) row[1] = hetSafeStr_(item.hostname, 120);
    if (item.comment && item.comment !== 'n/a') row[2] = hetSafeStr_(item.comment, 120);
    if (!row[5]) {
      row[5] = row[2] || row[1] || mac;
    }
    row[6] = hetSafeStr_(item.ip, 40);
    row[7] = hetNowDate_();
    if (item.resolvedSite) row[8] = hetSafeStr_(item.resolvedSite, 40);
    if (item.nameSource) row[9] = hetSafeStr_(item.nameSource, 30);
    if (item.siteSource) row[10] = hetSafeStr_(item.siteSource, 30);
    if (item.confidence) row[11] = hetSafeStr_(item.confidence, 20);
    if (item.lastSeenInterface) row[12] = hetSafeStr_(item.lastSeenInterface, 40);

    map[mac] = row;
    if (order.indexOf(mac) < 0) order.push(mac);
  });

  if (!order.length) return;

  sh.clearContents();
  hetEnsureHeader_(sh, header);

  var out = order.map(function(mac) { return map[mac]; });
  sh.getRange(2, 1, out.length, width).setValues(out);
  sh.getRange(2, 8, out.length, 1).setNumberFormat(HET.cfg().DATE_TIME_FMT);
}

function HET_ingestUserUsage_(now, site, router, p) {
  var ss = HET.ss();
  var sh = hetGetOrCreateSheet_(ss, HET.SHEETS.RAW_USER_USAGE);
  var source = hetSafeStr_(p.source, 30) || 'router';
  var windowKey = hetSafeStr_(p.window_key || p.windowKey || p.ts, 40) || Utilities.formatDate(now, HET.cfg().TZ, 'yyyyMMddHHmm');
  var rows = [];
  var entries = HET_parseUserUsageEntries_(p.entries || p.usage_rows || p.rows);

  entries.forEach(function(item) {
    var up = hetToNum_(item.upload, 0);
    var down = hetToNum_(item.download, 0);
    if (!item.mac && !item.ip) return;

    rows.push([
      now,
      site,
      router,
      item.ip || '',
      item.mac || '',
      item.hostname || '',
      item.comment || '',
      item.iface || '',
      up,
      down,
      up + down,
      source,
      windowKey
    ]);
  });

  if (rows.length) {
    var resolvedMap = (typeof HET_shadowResolveRows_ === 'function')
      ? HET_shadowResolveRows_({
          now: now,
          site: site,
          router: router,
          payloadType: 'user_usage',
          rows: entries.map(function(x) {
            return {
              ip: x.ip,
              mac: x.mac,
              hostname: x.hostname,
              comment: x.comment,
              iface: x.iface,
              totalBytes: hetToNum_(x.upload, 0) + hetToNum_(x.download, 0)
            };
          })
        })
      : {};

    entries.forEach(function(item) {
      var meta = resolvedMap[HET_macKey_(item.mac)] || null;
      if (!meta) return;
      item.resolvedSite = meta.resolvedSite;
      item.nameSource = meta.nameSource;
      item.siteSource = meta.siteSource;
      item.confidence = meta.confidence;
      item.lastSeenInterface = meta.lastSeenInterface;
    });

    hetInsertRows_(sh, rows);
    HET_upsertDeviceMapping_(entries);
  }
}

function HET_computeTopUsers_(period) {
  var now = hetNowDate_();
  var start = HET_userUsagePeriodStart_(period, now);
  var sh = HET.ss().getSheetByName(HET.SHEETS.RAW_USER_USAGE);
  var rows = hetGetTopDataRows_(sh, 13, 12000);
  var map = {};
  var deviceMap = HET_deviceMap_();

  rows.forEach(function(r) {
    var t = r[0] instanceof Date ? r[0] : null;
    var mac;
    var rec;
    var up;
    var down;

    if (!t || t.getTime() < start.getTime()) return;

    mac = HET_macKey_(r[4]);
    if (!mac) return;

    rec = map[mac] || {
      mac: mac,
      ip: hetSafeStr_(r[3], 40),
      hostname: hetSafeStr_(r[5], 120),
      comment: hetSafeStr_(r[6], 120),
      iface: hetSafeStr_(r[7], 40),
        totalUp: 0,
        totalDown: 0,
      samples: 0,
      firstAt: null,
      lastAt: null
    };

    up = hetToNum_(r[8], 0);
    down = hetToNum_(r[9], 0);

    rec.totalUp += up;
    rec.totalDown += down;

    rec.samples++;
    if (!rec.firstAt || t.getTime() < rec.firstAt.getTime()) rec.firstAt = t;
    if (!rec.lastAt || t.getTime() > rec.lastAt.getTime()) {
      rec.lastAt = t;
      rec.ip = hetSafeStr_(r[3], 40) || rec.ip;
      rec.hostname = hetSafeStr_(r[5], 120) || rec.hostname;
      rec.comment = hetSafeStr_(r[6], 120) || rec.comment;
      rec.iface = hetSafeStr_(r[7], 40) || rec.iface;
    }

    map[mac] = rec;
  });

  var out = [];
  Object.keys(map).forEach(function(mac) {
    var rec = map[mac];
    var upload = rec.totalUp;
    var download = rec.totalDown;
    var d = deviceMap[mac] || {};

    out.push({
      ip: rec.ip || d.lastSeenIp || 'n/a',
      mac: mac,
      hostname: d.hostname || rec.hostname || 'unknown',
      comment: d.comment || rec.comment || 'n/a',
      deviceType: d.deviceType || 'unknown',
      preferredName: d.preferredName || d.comment || d.hostname || rec.hostname || mac,
      resolvedSite: d.resolvedSite || '',
      nameSource: d.nameSource || '',
      siteSource: d.siteSource || '',
      confidence: d.confidence || '',
      lastSeenInterface: d.lastSeenInterface || rec.iface || '',
      upload: upload,
      download: download,
      total: upload + download,
      samples: rec.samples,
      lastSeen: rec.lastAt ? hetFmt_(rec.lastAt) : 'n/a'
    });
  });

  out.sort(function(a, b) { return b.total - a.total; });
  out.forEach(function(item, idx) {
    item.rank = idx + 1;
    item.label = item.preferredName + ' [' + item.ip + ']';
  });

  return out;
}

function HET_writeTopUserSheets_() {
  var ss = HET.ss();
  var dailyRows = HET_computeTopUsers_('daily');
  var monthlyRows = HET_computeTopUsers_('monthly');
  var now = hetNowDate_();
  var dateKey = HET_dateKey_(now);
  var monthKey = HET_monthKey_(now);

  // Keep maintenance lightweight when user-level telemetry is not enabled yet.
  if (!dailyRows.length && !monthlyRows.length) {
    return {
      ok: true,
      dailyRows: 0,
      monthlyRows: 0,
      dateKey: dateKey,
      monthKey: monthKey,
      skipped: true,
      reason: 'no user_usage rows available'
    };
  }

  var dailySummary = hetGetOrCreateSheet_(ss, HET.SHEETS.DAILY_USER_SUMMARY);
  var monthlySummary = hetGetOrCreateSheet_(ss, HET.SHEETS.MONTHLY_USER_SUMMARY);
  var topDaily = hetGetOrCreateSheet_(ss, HET.SHEETS.TOP_USERS_DAILY);
  var topMonthly = hetGetOrCreateSheet_(ss, HET.SHEETS.TOP_USERS_MONTHLY);

  function writeSummary_(sh, rows, periodKey, periodType) {
    var out = rows.map(function(item) {
      if (periodType === 'monthly') {
        return [periodKey, HET.cfg().SITE_DEFAULT, 'ALL', item.mac, item.ip, item.hostname, item.comment, item.deviceType, item.upload, item.download, item.total, 1, item.lastSeen];
      }
      return [periodKey, HET.cfg().SITE_DEFAULT, 'ALL', item.mac, item.ip, item.hostname, item.comment, item.deviceType, item.upload, item.download, item.total, item.samples, item.lastSeen];
    });
    sh.clearContents();
    hetEnsureHeader_(sh, HET.HEADERS[sh.getName()]);
    if (out.length) {
      sh.getRange(2, 1, out.length, out[0].length).setValues(out);
    }
  }

  function writeTop_(sh, rows, periodKey) {
    var out = rows.slice(0, 50).map(function(item, idx) {
      return [periodKey, idx + 1, item.ip, item.mac, item.hostname, item.comment, item.deviceType, item.upload, item.download, item.total];
    });
    sh.clearContents();
    hetEnsureHeader_(sh, HET.HEADERS[sh.getName()]);
    if (out.length) {
      sh.getRange(2, 1, out.length, 10).setValues(out);
    }
  }

  writeSummary_(dailySummary, dailyRows, dateKey, 'daily');
  writeSummary_(monthlySummary, monthlyRows, monthKey, 'monthly');
  writeTop_(topDaily, dailyRows, dateKey);
  writeTop_(topMonthly, monthlyRows, monthKey);

  return {
    ok: true,
    dailyRows: dailyRows.length,
    monthlyRows: monthlyRows.length,
    dateKey: dateKey,
    monthKey: monthKey
  };
}

function HET_getTopUsers_(limit, period) {
  var take = Math.max(1, Math.min(hetToInt_(limit, 10), 50));
  var p = String(period || 'daily').toLowerCase();
  var sheetName = p === 'monthly' ? HET.SHEETS.TOP_USERS_MONTHLY : HET.SHEETS.TOP_USERS_DAILY;
  var sh = HET.ss().getSheetByName(sheetName);
  var rows = hetGetTopDataRows_(sh, 10, 80);

  if (!rows.length) {
    var computed = HET_computeTopUsers_(p);
    return computed.slice(0, take);
  }

  var deviceMap = HET_deviceMap_();

  return rows.slice(0, take).map(function(r) {
    var mac = HET_macKey_(r[3]);
    var d = deviceMap[mac] || {};
    return {
      rank: hetToInt_(r[1], 0),
      ip: hetSafeStr_(r[2], 40) || 'n/a',
      mac: mac,
      hostname: hetSafeStr_(r[4], 120) || 'unknown',
      comment: hetSafeStr_(r[5], 120) || 'n/a',
      deviceType: hetSafeStr_(r[6], 60) || 'unknown',
      upload: hetToNum_(r[7], 0),
      download: hetToNum_(r[8], 0),
      total: hetToNum_(r[9], 0),
      preferredName: hetSafeStr_(r[5], 120) || hetSafeStr_(r[4], 120) || mac || hetSafeStr_(r[2], 40),
      resolvedSite: d.resolvedSite || '',
      nameSource: d.nameSource || '',
      siteSource: d.siteSource || '',
      confidence: d.confidence || '',
      lastSeenInterface: d.lastSeenInterface || ''
    };
  });
}

function HET_writeReportsOutputTopUsers_(reportType, periodKey, rows) {
  var sh = hetGetOrCreateSheet_(HET.ss(), HET.SHEETS.REPORTS_OUTPUT);
  var now = hetNowDate_();
  var out = rows.map(function(item) {
    return [
      now,
      reportType,
      periodKey,
      item.rank,
      item.ip,
      item.mac,
      item.hostname,
      item.comment,
      item.deviceType,
      item.upload,
      item.download,
      item.total,
      ''
    ];
  });

  if (out.length) {
    hetInsertRows_(sh, out);
  }
}

function HET_getTopUsersApi_(limit, period) {
  return {
    ok: true,
    period: String(period || 'daily').toLowerCase(),
    limit: Math.max(1, Math.min(hetToInt_(limit, 10), 50)),
    rows: HET_getTopUsers_(limit, period)
  };
}
