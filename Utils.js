function logErr_(ss, module, error, payload) {
  // Avoid writing to a sheet in single-sheet deployment. Log to Apps Script logger instead.
  try {
    const msg = `[${module}] ${String(error)} ${String(payload || '')}`;
    Logger.log(msg);
    console && console.log ? console.log(msg) : null;
  } catch (e) {}
}

function safeText_(s, maxLen) {
  s = String(s || "");
  if (s.startsWith("=")) s = "'" + s;
  return s.slice(0, maxLen || 255);
}

function safeNum_(n) {
  const x = Number(n);
  if (!isFinite(x)) return "";
  return x;
}

function isFiniteNum_(n) {
  return isFinite(Number(n));
}

function safeEnum_(v, allowed, def) {
  v = String(v || "");
  return allowed.includes(v) ? v : def;
}

function calcMemPct_(free, total) {
  const f = Number(free), t = Number(total);
  if (!isFinite(f) || !isFinite(t) || t <= 0) return "";
  return Math.round((1 - (f / t)) * 100);
}

function formatDateTime_(d, cfg) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), cfgFmt_(cfg));
}

function numText_(n) {
  const x = Number(n);
  return isFinite(x) ? String(x) : "-";
}

function escapeHtml_(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseChatIds_(raw) {
  raw = String(raw || "").trim();
  if (!raw) return [];
  return raw.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
}

function normalizeEveryMinutes_(n) {
  const allowed = [1, 5, 10, 15, 30];
  n = Math.round(Number(n));
  if (!isFinite(n) || n <= 0) return 5;
  let best = allowed[0], bestDiff = Math.abs(n - best);
  for (const a of allowed) {
    const d = Math.abs(n - a);
    if (d < bestDiff) {
      best = a;
      bestDiff = d;
    }
  }
  return best;
}

function styleSheetHeader_(sh) {
  sh.setFrozenRows(1);
  const lastCol = sh.getLastColumn();
  if (lastCol > 0) {
    sh.getRange(1, 1, 1, lastCol).setFontWeight("bold").setBackground("#f3f3f3");
  }
}

function styleNewRow_(sh, rowNum, colCount, dateFmt) {
  sh.getRange(rowNum, 1, 1, colCount).setFontWeight("bold").setBackground("#eef3ff");
  sh.getRange(rowNum, 1).setNumberFormat(dateFmt);
}

function idxState_(header) {
  const m = {};
  header.forEach((h, i) => m[String(h)] = i);
  return {
    site: m.site,
    last_seen: m.last_seen,
    router: m.router,
    uptime: m.uptime,
    cpu: m.cpu,
    mem_pct: m.mem_pct,
    isp: m.isp,
    ipsec: m.ipsec,
    rdp: m.rdp,
    hotspot_active: m.hotspot_active,
    leases: m.leases,
    wanip: m.wanip,
    status_grade: m.status_grade,
    live_state: m.live_state,
    stale_minutes: m.stale_minutes,
    isp_mbps: m.isp_mbps,
    lan_mbps: m.lan_mbps,
    unity_mbps: m.unity_mbps,
    store_mbps: m.store_mbps,
    buk_mbps: m.buk_mbps,
    wifi_mbps: m.wifi_mbps,
    isp_pct: m.isp_pct,
    top_group: m.top_group,
    top5_users: m.top5_users,
  };
}

function idxRaw_(header) {
  const m = {};
  header.forEach((h, i) => m[String(h)] = i);
  return {
    ts_server: m.ts_server,
    site: m.site,
    isp_rx: m.isp_rx,
    isp_tx: m.isp_tx,
    lan_rx: m.lan_rx,
    lan_tx: m.lan_tx,
    unity_rx: m.unity_rx,
    unity_tx: m.unity_tx,
    store_rx: m.store_rx,
    store_tx: m.store_tx,
    buk_rx: m.buk_rx,
    buk_tx: m.buk_tx,
    wifi_rx: m.wifi_rx,
    wifi_tx: m.wifi_tx,
    top5_users: m.top5_users,
    queues: m.queues,
    payload_json: m.payload_json,
  };
}

function extractTop5FromPayload_(payload) {
  if (!payload) return "";
  try {
    const j = (typeof payload === 'string') ? JSON.parse(payload) : payload;
    const candidates = [];
    // Known keys that may contain per-user info
    ['top5_users', 'dhcp_top10', 'hotspot_top10', 'queues', 'top10'].forEach(k => {
      if (j[k]) candidates.push(j[k]);
    });

    // If top5_users is already a formatted string, return that
    if (j.top5_users && typeof j.top5_users === 'string' && j.top5_users.trim()) return j.top5_users;

    // If any candidate looks like an array/object, try to convert to "name=bytes | ..." format
    for (const c of candidates) {
      if (!c) continue;
      if (Array.isArray(c)) {
        const parts = c.map(x => {
          if (typeof x === 'string') return x;
          if (x.name && x.bytes) return `${x.name}=${x.bytes}`;
          return '';
        }).filter(Boolean);
        if (parts.length) return parts.join(' | ');
      }
      if (typeof c === 'object') {
        // object with name:bytes map
        const parts = Object.keys(c).slice(0, 10).map(k => `${k}=${c[k]}`);
        if (parts.length) return parts.join(' | ');
      }
      if (typeof c === 'string' && c.trim()) return c;
    }
    return '';
  } catch (e) {
    return '';
  }
}

function idxMap_(header) {
  const m = {};
  header.forEach((h, i) => m[String(h)] = i);
  return m;
}

function parseTop5Users_(queuesSnapshot) {
  const s = String(queuesSnapshot || "").trim();
  if (!s) return "";
  const parts = s.split("|").map(x => x.trim()).filter(Boolean);
  const list = [];
  for (const p of parts) {
    const [name, bytesStr] = p.split("=");
    const bytes = Number(bytesStr);
    if (!name) continue;
    if (!isFinite(bytes) || bytes <= 0) continue;
    list.push({ name: name.trim(), bytes });
  }
  list.sort((a, b) => b.bytes - a.bytes);
  const top = list.slice(0, 5);
  const fmtMB = b => (b / 1024 / 1024).toFixed(2) + "MB";
  return top.map(x => `${x.name} (${fmtMB(x.bytes)})`).join(" | ");
}

function parseTop5UsersArray_(queuesSnapshot) {
  const s = String(queuesSnapshot || "").trim();
  if (!s) return [];
  const parts = s.split("|").map(x => x.trim()).filter(Boolean);
  const list = [];
  for (const p of parts) {
    const [name, bytesStr] = p.split("=");
    const bytes = Number(bytesStr);
    if (!name) continue;
    if (!isFinite(bytes) || bytes <= 0) continue;
    list.push({ name: name.trim(), bytes });
  }
  list.sort((a, b) => b.bytes - a.bytes);
  return list.slice(0, 10); // return up to top 10 entries for analysis
}