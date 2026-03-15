function HET_requiredDocumentationTabs_() {
  return [
    'DOC_Master_Index',
    'DOC_Project_Overview',
    'DOC_Architecture',
    'DOC_Sheets',
    'DOC_Router_Scripts',
    'DOC_Worker',
    'DOC_Apps_Script',
    'DOC_Dashboard',
    'DOC_Alerts',
    'DOC_Data_Flow',
    'DOC_Telegram',
    'DOC_Troubleshooting',
    'DOC_Deployment',
    'DOC_Disaster_Recovery',
    'DOC_Change_Log',
    'DOC_SOP',
    'DOC_Quick_Reference'
  ];
}

function HET_documentationHeader_() {
  return ['section id', 'section title', 'detail', 'source file', 'last updated at', 'owner'];
}

function HET_getDocumentationPack_() {
  // yeh function canonical docs pack ko read karta hai aur tab-wise content return karta hai.
  return {
    DOC_Master_Index: [
      ['MI-01', 'docs navigation', 'het docs ka complete index maintain ho jahan se har section tak direct reference milay.', 'docs/het-knowledge-base/00-master-index.md'],
      ['MI-02', 'knowledge base scope', 'architecture, deployment, disaster recovery, sop, quick reference aur change log sab include hon.', 'docs/het-knowledge-base/00-master-index.md'],
      ['MI-03', 'primary reference rule', 'Google Sheet ke DOC_* tabs ko operations me primary handbook reference use kiya jaye.', 'docs/het-knowledge-base/07-google-sheet-mirroring-plan.md']
    ],
    DOC_Project_Overview: [
      ['OV-01', 'project purpose', 'het monitoring platform realtime network visibility, proactive alerting, aur daily reporting provide karta hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['OV-02', 'site context', 'deployment context me site identity aur router identity ko clear tarah document kiya gaya hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['OV-03', 'business value', 'manual checks kam hotay hain aur noc response speed improve hoti hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md']
    ],
    DOC_Architecture: [
      ['AR-01', 'logical flow', 'router -> router scripts -> worker -> apps script -> sheets -> dashboard/alerts/telegram/reports.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['AR-02', 'component role clarity', 'har layer ka role clearly define hai: collect, transport, ingest, store, visualize, alert, command.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['AR-03', 'dependency map', 'component dependency matrix me failure impact aur upstream/downstream dependencies documented hain.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['AR-04', 'visual architecture', 'Mermaid diagram architecture blueprint file me available hai aur docs reference ke liye linked hai.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md']
    ],
    DOC_Sheets: [
      ['SH-01', 'critical realtime sheets', 'Router Status, Raw_Traffic_Log, VPN Status, Connected Users, User Data Usage key operational sheets hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['SH-02', 'support sheets', 'RAW Live, RAW Events, Alerts, Dashboard, Outbox, Daily Reports support aur audit workflows ke liye use hoti hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['SH-03', 'freshness expectation', 'key sheets ka timestamp movement daily health checks ka mandatory part hai.', 'docs/het-knowledge-base/03-maintenance-sop.md']
    ],
    DOC_Router_Scripts: [
      ['RS-01', 'base scripts', 'het_CONFIG configuration set karta hai aur het_HTTP_SEND transport handle karta hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['RS-02', 'telemetry scripts', 'het_PUSH_LIVE, het_PUSH_TRAFFIC, het_VPN_CHECK, het_PUSH_USERS, het_PUSH_USAGE streams generate karte hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['RS-03', 'event scripts', 'het_PUSH_ROUTERLOG aur het_PUSH_CHANGE audit/event pipeline feed karte hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['RS-04', 'optional script', 'het_PUSH_IFACE optional interface stream ke liye available hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md']
    ],
    DOC_Worker: [
      ['WK-01', 'worker purpose', 'cloudflare worker auth gateway, forward proxy, aur short-window dedupe provide karta hai.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['WK-02', 'authentication flow', 'payload token ya header token ko ROUTER_TOKEN env ke against verify kiya jata hai.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['WK-03', 'forwarding flow', 'valid request apps script endpoint ko forward hoti hai aur wrapped response return hota hai.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['WK-04', 'failure behavior', 'token mismatch par 401 aur upstream config issue par status diagnostics milti hain.', 'docs/het-knowledge-base/09-disaster-recovery-playbook.md']
    ],
    DOC_Apps_Script: [
      ['AS-01', 'entry layer', 'doGet aur doPost request routing, auth, aur admin endpoints handle karte hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['AS-02', 'ingest layer', 'HET_ingest payload type ke mutabiq target sheet me record write karta hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['AS-03', 'trigger lifecycle', 'runDashboardRefresh, runAlertCycle, runDailyReport, runCommandCycle periodic operations run karte hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['AS-04', 'admin diagnostics', 'admin=status aur setup helpers runtime health aur setup verification ke liye use hotay hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md']
    ],
    DOC_Dashboard: [
      ['DB-01', 'snapshot model', 'dashboard latest sheet rows se runtime snapshot banata hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['DB-02', 'activity labels', 'labels running-aware aur neutral hain: Active, No recent traffic, Not connected, Disabled, Idle.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['DB-03', 'stale handling', 'stale ya delayed data scenario troubleshooting section me documented hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md']
    ],
    DOC_Alerts: [
      ['AL-01', 'alert rules', 'cpu, memory, stale, vpn, routerlog severity aur change events ke rules defined hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['AL-02', 'cooldown controls', 'stale aur routerlog alerts me cooldown duplication reduce karta hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['AL-03', 'destinations', 'alerts sheet base store hai aur required cases me telegram/email outbox integration hota hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md']
    ],
    DOC_Data_Flow: [
      ['DF-01', 'payload catalog', 'traffic, live, vpn, users, usage, routerlog, change, iface, rdp, alert payload mappings documented hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['DF-02', 'stage mapping', 'router -> worker -> apps script -> sheet -> dashboard/alerts/telegram/report full mapping documented hai.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['DF-03', 'consumer mapping', 'har payload ka downstream consumer documented hai taa ke impact analysis easy ho.', 'docs/het-knowledge-base/01-het-operational-handbook.md']
    ],
    DOC_Telegram: [
      ['TG-01', 'command set', '/help, /health, /traffic, /alerts, /users, /report, /status, /snapshot, /tgdebug support available hai.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['TG-02', 'polling model', 'command cycle polling ke through updates pull karke command handlers run karta hai.', 'docs/het-knowledge-base/08-system-architecture-blueprint.md'],
      ['TG-03', 'auth behavior', 'strict auth aur mention policies configuration se control hoti hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md']
    ],
    DOC_Troubleshooting: [
      ['TS-01', 'first-line checks', 'worker status, key sheet freshness, triggers, aur router scripts ko first diagnostics banaya gaya hai.', 'docs/het-knowledge-base/09-disaster-recovery-playbook.md'],
      ['TS-02', 'common incidents', '401 auth fail, stale dashboard, telegram no response, usage empty scenarios documented hain.', 'docs/het-knowledge-base/01-het-operational-handbook.md'],
      ['TS-03', 'safe recovery approach', 'har issue me isolate -> diagnose -> recover -> verify workflow follow karna mandatory hai.', 'docs/het-knowledge-base/09-disaster-recovery-playbook.md']
    ],
    DOC_Deployment: [
      ['DP-01', 'deployment sequence', 'router prep -> scripts -> schedulers -> worker -> apps script -> sheet -> telegram -> verification.', 'docs/het-knowledge-base/10-full-deployment-guide.md'],
      ['DP-02', 'validation tests', 'router push test, worker status test, apps script status test, sheet ingest test, telegram command test mandatory hain.', 'docs/het-knowledge-base/10-full-deployment-guide.md'],
      ['DP-03', 'go-live signoff', 'all critical streams fresh, dashboard live, alerts cycle active, telegram responsive hone chahiye.', 'docs/het-knowledge-base/10-full-deployment-guide.md']
    ],
    DOC_Disaster_Recovery: [
      ['DR-01', 'scenario coverage', 'router reset, scripts deleted, worker deleted, apps script loss, sheet loss, trigger failure covered hain.', 'docs/het-knowledge-base/09-disaster-recovery-playbook.md'],
      ['DR-02', 'incident structure', 'har scenario me symptoms, root causes, diagnostics, safe recovery, verification documented hai.', 'docs/het-knowledge-base/09-disaster-recovery-playbook.md'],
      ['DR-03', 'rebuild readiness', 'playbook ka goal fast rebuild aur minimum downtime achieve karna hai.', 'docs/het-knowledge-base/09-disaster-recovery-playbook.md']
    ],
    DOC_Change_Log: [
      ['CL-01', 'release history', 'production-impact changes date aur reason ke sath track kiye jate hain.', 'docs/het-knowledge-base/02-change-log.md'],
      ['CL-02', 'mandatory update rule', 'har functional change ke sath change log update required hai.', 'docs/het-knowledge-base/02-change-log.md'],
      ['CL-03', 'audit support', 'incident investigations me chronological change tracking direct reference provide karta hai.', 'docs/het-knowledge-base/02-change-log.md']
    ],
    DOC_SOP: [
      ['SOP-01', 'daily checks', 'worker status, key sheet freshness, alerts panel, telegram quick command test daily run karein.', 'docs/het-knowledge-base/03-maintenance-sop.md'],
      ['SOP-02', 'weekly/monthly checks', 'scripts, schedulers, outbox, raw events, thresholds aur docs sync periodic review me include hon.', 'docs/het-knowledge-base/03-maintenance-sop.md'],
      ['SOP-03', 'release and rollback', 'deploy ke baad post-checks aur emergency rollback sequence documented hai.', 'docs/het-knowledge-base/03-maintenance-sop.md']
    ],
    DOC_Quick_Reference: [
      ['QR-01', 'essential urls', 'worker endpoint aur apps script exec endpoint quick access ke liye documented hain.', 'docs/het-knowledge-base/04-quick-reference.md'],
      ['QR-02', 'essential commands', 'router script/scheduler checks aur powershell status checks quick runbook me available hain.', 'docs/het-knowledge-base/04-quick-reference.md'],
      ['QR-03', 'on-call references', 'deployment aur disaster recovery docs ke direct references fast action ke liye include hain.', 'docs/het-knowledge-base/10-full-deployment-guide.md']
    ]
  };
}

function HET_buildDocRows_(items, updatedAt, owner) {
  var rows = [HET_documentationHeader_()];
  var i;
  for (i = 0; i < items.length; i++) {
    rows.push([items[i][0], items[i][1], items[i][2], items[i][3], updatedAt, owner]);
  }
  return rows;
}

function updateHetDocumentation() {
  var cfg = HET.cfg();
  var ssId = String(cfg.SS_ID || '').trim();
  if (!ssId) {
    throw new Error('SS_ID missing. updateHetDocumentation requires monitoring spreadsheet id.');
  }

  var ss = SpreadsheetApp.openById(ssId);
  var tabNames = HET_requiredDocumentationTabs_();
  var pack = HET_getDocumentationPack_();
  var owner = 'het ops';
  var updatedAt = Utilities.formatDate(new Date(), cfg.TZ || 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');

  var createdTabs = [];
  var rowsWritten = {};
  var i;

  for (i = 0; i < tabNames.length; i++) {
    var name = tabNames[i];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      createdTabs.push(name);
    }

    var tabItems = pack[name] || [];
    var values = HET_buildDocRows_(tabItems, updatedAt, owner);

    sh.clearContents();
    sh.getRange(1, 1, values.length, values[0].length).setValues(values);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, values[0].length);
    sh.getRange(1, 1, 1, values[0].length).setFontWeight('bold');
    sh.getRange(1, 1, values.length, values[0].length).setWrap(true);

    rowsWritten[name] = values.length;
  }

  var result = {
    ok: true,
    message: 'het documentation sync completed',
    sheetId: ssId,
    totalRequiredTabs: tabNames.length,
    totalTabsCreatedNow: createdTabs.length,
    createdTabs: createdTabs,
    rowsWritten: rowsWritten,
    updatedAt: updatedAt
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
