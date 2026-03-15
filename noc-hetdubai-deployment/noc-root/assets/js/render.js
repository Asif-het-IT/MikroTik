window.NocRender = (function () {
  function statusClass(v) {
    const t = String(v || "").toUpperCase();
    if (["ONLINE", "UP", "HEALTHY", "FRESH", "OK", "WORKING"].includes(t)) return "status-ok";
    if (["WARN", "WARNING", "HIGH"].includes(t)) return "status-warn";
    if (["DOWN", "CRITICAL", "FAILED", "NO DATA", "UNKNOWN"].includes(t)) return "status-crit";
    return "status-neutral";
  }

  function alertSeverityClass(severity) {
    const s = String(severity || "").toLowerCase();
    if (["critical", "error", "alert"].includes(s)) return "severity-critical";
    if (["warning", "high", "warn"].includes(s)) return "severity-warning";
    return "severity-info";
  }

  function fmtBytes(n) {
    const val = Number(n || 0);
    if (val >= 1024 * 1024 * 1024) return `${(val / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (val >= 1024 * 1024) return `${(val / (1024 * 1024)).toFixed(2)} MB`;
    if (val >= 1024) return `${(val / 1024).toFixed(2)} KB`;
    return `${val.toFixed(0)} B`;
  }

  function toNumber(v, fallback = 0) {
    if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
    if (typeof v === "string") {
      const parsed = parseFloat(v.replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  function metricCardHtml(label, value, hint, statusCls) {
    const clsStr = statusCls ? ` ${statusCls}` : "";
    return `<div class="metric-card${clsStr}">
      <div class="card-glow"></div>
      <div class="card-content">
        <span class="metric-label">${label}</span>
        <div class="metric-value">${value}</div>
        <span class="metric-hint">${hint || ""}</span>
      </div>
    </div>`;
  }

  function firstNonEmpty(values, fallback) {
    for (let i = 0; i < values.length; i += 1) {
      const val = values[i];
      if (val === null || val === undefined) continue;
      const text = String(val).trim();
      if (text && text.toLowerCase() !== "n/a" && text.toLowerCase() !== "unknown") return text;
    }
    return fallback;
  }

  function normalizeLogTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "n/a";
    if (raw.indexOf("1899") >= 0) {
      const m = raw.match(/(\d{1,2}:\d{2}:\d{2})/);
      if (m && m[1]) return m[1];
    }
    return raw;
  }

  function renderCore(status) {
    const dash = (status && status.dashboard) || {};
    const live = dash.live || {};
    const vpn = dash.vpn || {};
    const mobileVpn = dash.mobileVpn || {};
    const users = dash.users || {};
    const liveUsers = users.live || null;
    const liveUsersValue = liveUsers ? String(toNumber(liveUsers.total, 0)) : "Disabled";
    const liveUsersHint = liveUsers ? `Router-only | age ${liveUsers.ageMin || "n/a"}m` : "Set LIVE_USERS_ENABLE=YES";

    const cpuVal = toNumber(live.cpu, 0);
    const memVal = toNumber(live.memory, 0);

    const publicIpText = firstNonEmpty([
      live.publicIp,
      live.publicIP,
      live.wanIp,
      live.wanIP,
      dash.publicIp,
      dash.publicIP
    ], "n/a");

    const ispText = firstNonEmpty([
      live.isp,
      live.provider,
      live.ispName,
      dash.isp,
      dash.provider
    ], "n/a");

    const cards = [
      ["Router Status", live.status || "NO DATA", `Last: ${live.lastSeen || "n/a"}`, statusClass(live.status)],
      [
        "Mobile VPN",
        mobileVpn.status || "UNKNOWN",
        `Users ${toNumber(mobileVpn.activeCount, 0)} | Failed ${toNumber(mobileVpn.failedToday, 0)} | ${mobileVpn.lastEvent || "No event"}`,
        statusClass(mobileVpn.health || mobileVpn.status)
      ],
      ["VPN Status", vpn.status || "UNKNOWN", vpn.message || "Monitoring", statusClass(vpn.status)],
      ["CPU Usage", `${cpuVal}%`, live.message || "Current", statusClass(cpuVal > 80 ? "HIGH" : cpuVal > 50 ? "WARN" : "UP")],
      ["Memory", `${memVal}%`, `Up ${live.uptime || "n/a"}`, statusClass(memVal > 80 ? "HIGH" : memVal > 50 ? "WARN" : "UP")],
      ["DHCP Users", String(users.active || 0), "Latest snapshot", "status-ok"],
      ["Live Users", liveUsersValue, liveUsersHint, liveUsers ? "status-ok" : "status-neutral"],
      ["Public IP", publicIpText, `ISP: ${ispText}`, "status-neutral"],
      ["IPsec Tunnel", live.ipsec || "UNKNOWN", `${live.updatedAt || "n/a"}`, statusClass(live.ipsec)],
      ["Sheets", (dash.sheetHealth || []).length, "Monitored", "status-ok"]
    ];

    const coreCardsHTML = cards
      .map((row) => metricCardHtml(row[0], row[1], row[2], row[3]))
      .join("");

    const container = document.getElementById("coreCards");
    if (container) container.innerHTML = coreCardsHTML;
  }

  function renderAlerts(status) {
    const dash = (status && status.dashboard) || {};
    const alerts = dash.alerts || {};

    const summary = [
      ["Critical Alerts", String(alerts.critical || 0), "Severity", alerts.critical > 0 ? "severity-critical" : "severity-info"],
      ["High Warnings", String(alerts.high || 0), "Severity", alerts.high > 0 ? "severity-warning" : "severity-info"],
      ["Medium Issues", String(alerts.medium || 0), "Severity", alerts.medium > 0 ? "severity-warning" : "severity-info"],
      ["Total Active", String((dash.activeIncidents && dash.activeIncidents.total) || 0), "Last 24h", "severity-info"]
    ];

    const summaryHTML = summary
      .map((row) => `<div class="alert-badge ${row[3]}"><div style="font-size:20px;margin-bottom:4px;">${row[1]}</div><div style="font-size:11px;opacity:0.8;">${row[0]}</div></div>`)
      .join("");

    const alertSummary = document.getElementById("alertSummary");
    if (alertSummary) alertSummary.innerHTML = summaryHTML;

    const rows = (alerts.recent || []).slice(0, 10).map((a) => {
      return `<tr><td>${a.time || "n/a"}</td><td><span style="color: ${a.severity === "Critical" ? "#ff1744" : a.severity === "High" ? "#ffaa00" : "#00bfff"}">${a.severity || "-"}</span></td><td>${a.type || "-"}</td><td>${a.message || "-"}</td></tr>`;
    });
    
    const alertsBody = document.getElementById("alertsBody");
    if (alertsBody) alertsBody.innerHTML = rows.length > 0 ? rows.join("") : "<tr><td colspan='4' class='no-data'>No recent incidents</td></tr>";
  }

  function renderTraffic(status) {
    const dash = (status && status.dashboard) || {};
    const t = dash.traffic || {};

    const cards = [
      ["WAN Status", t.wanRunning || "UNKNOWN", `Updated ${t.updatedAt || "n/a"}`, statusClass(t.wanRunning)],
      ["WAN Total", fmtBytes(t.wanTotalText || 0), "Main uplink", "status-ok"],
      [t.e2Label || "E2", fmtBytes(t.e2Text || 0), "Branch load", "status-neutral"],
      [t.e3Label || "E3", fmtBytes(t.e3Text || 0), "Branch load", "status-neutral"],
      [t.e4Label || "E4", fmtBytes(t.e4Text || 0), "Branch load", "status-neutral"],
      [t.e5Label || "E5", fmtBytes(t.e5Text || 0), "Branch load", "status-neutral"]
    ];

    const trafficCardsHTML = cards
      .filter(row => row[0]) // Skip empty rows
      .map((row) => metricCardHtml(row[0], row[1], row[2], row[3]))
      .join("");

    const container = document.getElementById("trafficCards");
    if (container) container.innerHTML = trafficCardsHTML;
  }

  function renderRouterLogs(status) {
    const dash = (status && status.dashboard) || {};
    const logs = (dash.routerLogs || []).slice(0, 20);
    const rows = logs.map((log) => {
      const sev = String(log.severity || "INFO").toUpperCase();
      const color = sev === "CRITICAL" ? "#ff1744" : sev === "HIGH" ? "#ffaa00" : sev === "WARNING" ? "#ffaa00" : "#00bfff";
      return `<tr><td>${log.time || "n/a"}</td><td>${normalizeLogTime(log.logTime)}</td><td><span style="color:${color}">${sev}</span></td><td>${log.topics || "-"}</td><td>${log.message || "-"}</td></tr>`;
    });

    const body = document.getElementById("routerLogsBody");
    if (body) body.innerHTML = rows.length > 0 ? rows.join("") : "<tr><td colspan='5' class='no-data'>No router logs available</td></tr>";
  }

  function topRowHtml(item) {
    const name = item.preferredName || item.comment || item.hostname || "unknown";
    return `<tr><td>${item.rank || "-"}</td><td>${name}</td><td>${item.ip || "n/a"}</td><td>${fmtBytes(item.total || 0)}</td></tr>`;
  }

  function renderUsers(topDaily, topMonthly) {
    const dailyRows = (topDaily && topDaily.rows) || [];
    const monthlyRows = (topMonthly && topMonthly.rows) || [];

    const dailyBody = document.getElementById("dailyUsersTable");
    if (dailyBody) dailyBody.innerHTML = dailyRows.length > 0 ? dailyRows.map(topRowHtml).join("") : "<tr><td colspan='4' class='no-data'>No daily data</td></tr>";

    const monthlyBody = document.getElementById("monthlyUsersTable");
    if (monthlyBody) monthlyBody.innerHTML = monthlyRows.length > 0 ? monthlyRows.map(topRowHtml).join("") : "<tr><td colspan='4' class='no-data'>No monthly data</td></tr>";

    const dailyReport = document.getElementById("dailyReportText");
    if (dailyReport) dailyReport.innerHTML = `<p>Daily top 10 devices: ${dailyRows.length} loaded. Peak usage: ${dailyRows[0] ? fmtBytes(dailyRows[0].total) : "n/a"}</p>`;

    const monthlyReport = document.getElementById("monthlyReportText");
    if (monthlyReport) monthlyReport.innerHTML = `<p>Monthly top 10 devices: ${monthlyRows.length} loaded. Peak usage: ${monthlyRows[0] ? fmtBytes(monthlyRows[0].total) : "n/a"}</p>`;
  }

  function renderRuntime(status) {
    const runtime = status.runtimeHealth || { overall: "UNKNOWN", cycles: [] };
    const trigger = status.triggerIntegrity || { ok: true, missing: [] };
    const inferredSheetCount = Object.keys(status.sheets || {}).length || ((status.dashboard && status.dashboard.sheetHealth) ? status.dashboard.sheetHealth.length : 0);

    const cards = [
      ["Runtime Overall", runtime.overall || "UNKNOWN", "System status", statusClass(runtime.overall)],
      ["Trigger Integrity", trigger.ok ? "HEALTHY" : "NEEDS CHECK", (trigger.missing || []).length > 0 ? `Missing: ${(trigger.missing || []).join(", ")}` : "All OK", trigger.ok ? "status-ok" : "status-warn"],
      ["Timezone", status.timeFmt || "n/a", `Daily @${status.dailyReportTime || "n/a"}`, "status-neutral"],
      ["Sheets", String(inferredSheetCount), "Configured", "status-ok"]
    ];

    const runtimeCardsHTML = cards
      .map((row) => metricCardHtml(row[0], row[1], row[2], row[3]))
      .join("");

    const runtimeCards = document.getElementById("runtimeCards");
    if (runtimeCards) runtimeCards.innerHTML = runtimeCardsHTML;

    const rows = (runtime.cycles || []).map((c) => {
      const cycleName = c.cycle || c.name || c.process || "-";
      const cycleStatus = c.status || c.state || "UNKNOWN";
      const lastSuccess = c.lastSuccessAt || c.lastSuccess || c.successAt || "n/a";
      const lastFailure = c.lastFailureAt || c.lastFailure || c.failureAt || "n/a";
      const color = cycleStatus === "OK" || cycleStatus === "HEALTHY" ? "#00ff88" : cycleStatus === "WARN" ? "#ffaa00" : "#ff1744";
      return `<tr><td>${cycleName}</td><td><span style="color: ${color}">${cycleStatus}</span></td><td>${lastSuccess}</td><td>${lastFailure}</td></tr>`;
    });

    const runtimeTable = document.getElementById("runtimeTable");
    if (runtimeTable) runtimeTable.innerHTML = rows.length > 0 ? rows.join("") : "<tr><td colspan='4' class='no-data'>No runtime data</td></tr>";
  }

  function renderSheetHealth(status) {
    const sheets = status.sheetHealth || [];
    const cards = sheets.slice(0, 8).map((sheet) => {
      const status_val = sheet.status || "UNKNOWN";
      return metricCardHtml(
        sheet.name || sheet.sheet || "Sheet",
        `${sheet.rowCount || sheet.dataRows || 0} rows`,
        `Last: ${sheet.lastModified || sheet.lastDataTime || "n/a"}`,
        statusClass(status_val)
      );
    });

    const healthCards = document.getElementById("sheetHealthCards");
    if (healthCards) healthCards.innerHTML = cards.length > 0 ? cards.join("") : `<div style="padding:20px;text-align:center;color:var(--noc-text-dim)">No sheet health data</div>`;
  }

  function renderAll(state) {
    renderCore(state.status || {});
    renderAlerts(state.status || {});
    renderTraffic(state.status || {});
    renderRouterLogs(state.status || {});
    renderUsers(state.topDaily || {}, state.topMonthly || {});
    renderRuntime(state.status || {});
    renderSheetHealth(state.status || {});
  }

  return { renderAll };
})();
