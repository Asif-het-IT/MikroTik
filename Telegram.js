function buildTgMsg_(cfg, site, title, mode, d) {
  const icon = (mode === "ALERT") ? "🚨" : "✅";
  const fmt = cfgFmt_(cfg);
  return [
    `${icon} <b>NOC Team Alert (${escapeHtml_(mode)})</b>`,
    "━━━━━━━━━━━━━━━━━━",
    `🏢 <b>Site:</b> ${escapeHtml_(site)}`,
    `📌 <b>Masla/Update:</b> ${escapeHtml_(title)}`,
    `📊 <b>CPU:</b> ${numText_(d.cpu)}%  |  👥 <b>Active Users:</b> ${numText_(d.leases)}`,
    `🌐 <b>Internet:</b> ${escapeHtml_(d.isp || "-")}  |  🔐 <b>VPN:</b> ${escapeHtml_(d.vpn || "-")}  |  🟢 <b>Live:</b> ${escapeHtml_(d.live || "-")}`,
    `📶 <b>WAN Mbps:</b> ${numText_(d.isp_mbps)}  |  <b>WAN Load %:</b> ${numText_(d.isp_pct)}`,
    "━━━━━━━━━━━━━━━━━━",
    `🕒 Report Time: ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), fmt)}`
  ].join("\n");
}

function dailySummary() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);

  const state = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
  if (state.length < 2) return;

  const idx = idxState_(state[0]);
  let ok = 0, warn = 0, crit = 0;
  let liveCount = 0, staleCount = 0, nodataCount = 0, ispDown = 0, vpnDown = 0;
  const maxLines = Math.max(5, cfgNum_(cfg, "REPORT_MAX_LINES", 20));
  const records = [];

  for (let i = 1; i < state.length; i++) {
    const site = String(state[i][idx.site] || "");
    const grade = String(state[i][idx.status_grade] || "OK");
    const liveState = String(state[i][idx.live_state] || "");
    const isp = String(state[i][idx.isp] || "-");
    const vpn = String(state[i][idx.ipsec] || "-");
    const cpu = String(state[i][idx.cpu] || "0");
    const ram = String(state[i][idx.mem_pct] || "-");
    const dev = String(state[i][idx.leases] || "0");
    const ispmbps = String(state[i][idx.isp_mbps] || "0");
    const isppct = String(state[i][idx.isp_pct] || "0");

    if (grade === "CRIT") crit++; else if (grade === "WARN") warn++; else ok++;

    if (liveState === "LIVE") { liveCount++; } else if (liveState === "NO_DATA") { nodataCount++; } else { staleCount++; }
    if (isp === "DOWN") ispDown++;
    if (vpn === "DOWN") vpnDown++;

    records.push({
      site,
      grade,
      live: liveState,
      isp,
      vpn,
      cpu,
      ram,
      dev,
      ispmbps,
      isppct,
      priority: statusPriority_(grade, liveState, isp, vpn, Number(isppct || 0))
    });
  }

  records.sort((a, b) => b.priority - a.priority);
  const lines = records.slice(0, maxLines).map(r => {
    const icon = r.grade === "CRIT" ? "🔴" : r.grade === "WARN" ? "🟡" : "🟢";
    return `${icon} <b>${escapeHtml_(r.site)}</b> • ${escapeHtml_(r.grade)} • ${escapeHtml_(r.live)}\n` +
      `   Internet:${escapeHtml_(r.isp)} VPN:${escapeHtml_(r.vpn)} | CPU:${escapeHtml_(r.cpu)}% RAM:${escapeHtml_(r.ram)}% | Users:${escapeHtml_(r.dev)} | WAN:${escapeHtml_(r.ispmbps)}Mbps (${escapeHtml_(r.isppct)}%)`;
  });

  const msg = [
    "📊 <b>Rozana NOC Team Summary</b>",
    "━━━━━━━━━━━━━━━━━━",
    `🟢 Theek: ${ok}   🟡 Warning: ${warn}   🔴 Critical: ${crit}`,
    `🟢 Live: ${liveCount}   🟠 Stale: ${staleCount}   ⚫ No Data: ${nodataCount}`,
    `🌐 Internet Down: ${ispDown}   🔐 VPN Down: ${vpnDown}`,
    `🏢 Total Sites: ${records.length}`,
    "",
    ...lines,
    "━━━━━━━━━━━━━━━━━━",
    `🕒 Update Time: ${formatDateTime_(new Date(), cfg)}`
  ].join("\n");

  queueTelegram_(ss, cfg, "NOC Daily Summary", msg);
  queueEmail_(ss, cfg, "NOC Daily Summary", msg, true);
  processOutboxNow();
}

function sendFullStatusNow() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);

  const state = ss.getSheetByName(SHEETS.STATE).getDataRange().getValues();
  if (state.length < 2) return;

  const idx = idxState_(state[0]);
  const maxLines = Math.max(5, cfgNum_(cfg, "REPORT_MAX_LINES", 20));
  const records = [];

  for (let i = 1; i < state.length; i++) {
    const grade = String(state[i][idx.status_grade] || "OK");
    const live = String(state[i][idx.live_state] || "");
    const isp = String(state[i][idx.isp] || "-");
    const vpn = String(state[i][idx.ipsec] || "-");
    const isppct = Number(state[i][idx.isp_pct] || 0);
    records.push({
      site: String(state[i][idx.site] || ""),
      grade,
      live,
      isp,
      vpn,
      cpu: String(state[i][idx.cpu] || "0"),
      ram: String(state[i][idx.mem_pct] || "-"),
      dev: String(state[i][idx.leases] || "0"),
      ispmbps: String(state[i][idx.isp_mbps] || "0"),
      isppct: String(state[i][idx.isp_pct] || "0"),
      topg: String(state[i][idx.top_group] || "-"),
      top5: String(state[i][idx.top5_users] || "-"),
      priority: statusPriority_(grade, live, isp, vpn, isppct)
    });
  }

  records.sort((a, b) => b.priority - a.priority);
  const selected = records.slice(0, maxLines);

  const lines = [];
  lines.push("📡 <b>NOC Live Status (Team Priority View)</b>");
  lines.push("━━━━━━━━━━━━━━━━━━");

  for (let i = 0; i < selected.length; i++) {
    const r = selected[i];
    const icon = r.grade === "CRIT" ? "🔴" : r.grade === "WARN" ? "🟡" : "🟢";
    lines.push(`${icon} <b>${escapeHtml_(r.site)}</b> | <b>${escapeHtml_(r.grade)}</b> | ${escapeHtml_(r.live)}`);
    lines.push(`   🌐 Internet=${escapeHtml_(r.isp)}  🔐 VPN=${escapeHtml_(r.vpn)}`);
    lines.push(`   📊 CPU=${escapeHtml_(r.cpu)}%  🧠 RAM=${escapeHtml_(r.ram)}%  👥 Users=${escapeHtml_(r.dev)}`);
    lines.push(`   📶 WAN=${escapeHtml_(r.ispmbps)}Mbps (${escapeHtml_(r.isppct)}%) | 🏷 Top Group=${escapeHtml_(r.topg)}`);
    lines.push(`   👤 Top 5 Users: ${escapeHtml_(r.top5)}`);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`📌 Top ${selected.length} priority sites (kul ${records.length})`);
  lines.push(`🕒 Update Time: ${formatDateTime_(new Date(), cfg)}`);

  const msg = lines.join("\n");
  queueTelegram_(ss, cfg, "NOC Full Status", msg);
  queueEmail_(ss, cfg, "NOC Full Status", msg, true);
  processOutboxNow();
}

function queueTelegram_(ss, cfg, title, htmlText) {
  const sh = ss.getSheetByName(SHEETS.TG_OUT);
  const bot = cfgStr_(cfg, "TG_BOT", "");
  const chats = parseChatIds_(cfgStr_(cfg, "TG_CHAT", ""));

  if (!bot || chats.length === 0) return;

  const now = new Date();
  chats.forEach(chatId => {
    sh.appendRow([
      now,
      String(title || "NOC Message").slice(0, 80),
      String(chatId),
      String(htmlText || "").slice(0, 3800),
      "PENDING",
      "",
      0
    ]);
  });

  styleSheetHeader_(sh);
}

function processOutboxNow() {
  const ss = SpreadsheetApp.openById(SS_ID);
  ensureAll_(ss);
  const cfg = getCfg_(ss);

  const bot = cfgStr_(cfg, "TG_BOT", "");
  if (!bot) return;

  const sh = ss.getSheetByName(SHEETS.TG_OUT);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;

  const idx = { ts: 0, title: 1, chat: 2, msg: 3, status: 4, result: 5, attempts: 6 };

  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][idx.status] || "");
    if (status !== "PENDING") continue;

    const attempts = Number(data[i][idx.attempts] || 0);
    if (attempts >= 3) {
      sh.getRange(i + 1, idx.status + 1).setValue("FAILED");
      sh.getRange(i + 1, idx.result + 1).setValue("Max attempts reached");
      continue;
    }

    const chatId = String(data[i][idx.chat] || "").trim();
    const text = String(data[i][idx.msg] || "");
    const res = sendTelegramRaw_(bot, chatId, text);

    sh.getRange(i + 1, idx.attempts + 1).setValue(attempts + 1);
    sh.getRange(i + 1, idx.status + 1).setValue(res.ok ? "SENT" : "PENDING");
    sh.getRange(i + 1, idx.result + 1).setValue(res.info.slice(0, 900));

    if (!res.ok && /HTTP_(401|403|400)/.test(res.info)) {
      sh.getRange(i + 1, idx.status + 1).setValue("FAILED");
    }
  }
}

function sendTelegramRaw_(botToken, chatId, htmlText) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      muteHttpExceptions: true,
      payload: {
        chat_id: chatId,
        text: String(htmlText).slice(0, 3900),
        parse_mode: "HTML",
        disable_web_page_preview: true
      }
    });
    const code = res.getResponseCode();
    const body = res.getContentText() || "";
    return { ok: (code >= 200 && code < 300), info: `HTTP_${code} ${body}` };
  } catch (err) {
    return { ok: false, info: `EXCEPTION ${String(err)}` };
  }
}

function queueEmail_(ss, cfg, subject, body, isHtml) {
  const emailsRaw = cfgStr_(cfg, "EMAILS", "") || cfgStr_(cfg, "EMAIL_TO", "");
  if (!emailsRaw) return;

  const list = emailsRaw.split(",").map(x => x.trim()).filter(Boolean);
  if (!list.length) return;

  try {
    if (isHtml) {
      MailApp.sendEmail({
        to: list.join(","),
        subject: String(subject || "NOC Monitoring").slice(0, 120),
        htmlBody: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">${body}</div>`
      });
    } else {
      MailApp.sendEmail(list.join(","), subject, body);
    }
  } catch (err) {
    logErr_(ss, "EMAIL", String(err), emailsRaw);
  }
}

function maybeAutoOutbox_(ss, cfg) {
  if (cfgYes_(cfg, "AUTO_SEND_OUTBOX", "YES")) processOutboxNow();
}