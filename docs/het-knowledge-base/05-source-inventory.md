# het source code inventory

## apps script files
- `Code.js`: api entry (`doGet`, `doPost`), admin routes, telegram handoff
- `Config.js`: default config, sheet names, headers, ids
- `Utils.js`: shared helpers, token validation, sheet helpers, raw logging
- `Ingest.js`: payload type routing and writes
- `Dashboard.js`: snapshot and dashboard rendering
- `Alerts.js`: alert creation, stale checks, outbox send
- `Reports.js`: daily report, snapshot attachments, manual report send
- `SmartSummary.js`: command center cycle and smart summaries
- `Telegram.js`: bot send helpers, polling, command parser and handlers
- `Setup.js`: script properties, trigger setup, admin status tools
- `Menu.js`: spreadsheet menu actions
- `Email.js`: email transport helper
- `UI.html`: web dashboard front-end

## apps script key function map

| file | key functions | operational note |
|---|---|---|
| Code.js | `doGet`, `doPost` | api ingress + admin routing |
| Ingest.js | `HET_ingest` | payload type dispatcher |
| Dashboard.js | `HET_collectSnapshot_`, `HET_dashRefresh`, `runDashboardRefresh` | dashboard rendering |
| Alerts.js | `HET_logAlert_`, `HET_processLiveAlerts_`, `runAlertCycle_AlertsBridge` | alert lifecycle |
| Reports.js | `HET_dailyReport`, `sendDailySummaryTelegramNow`, `sendDailySummaryEmailNow` | daily reporting |
| SmartSummary.js | `HET_runCommandCycle_`, `HET_executeCommand_`, `HET_generateSmartSummary_` | command center engine |
| Telegram.js | `HET_handleTelegramUpdate_`, `HET_pollTelegramUpdates_`, `handleTelegramCommand_` | telegram polling + commands |
| Setup.js | `applyScriptProperties`, `createOrResetTriggers`, `verifyTriggers`, `runRuntimeHealthCheck`, `runMaintenanceCycle`, `HET_adminStatus_` | setup and runtime admin |
| Utils.js | `hetRequireToken_`, `hetEnsureAllSheets_`, `hetAppendRaw_` | shared infra utilities |
| Menu.js | `onOpen`, menu action handlers | spreadsheet operator controls |
| Email.js | `HET_sendEmail_` | mail transport wrapper |

## worker files
- `cloudflare-worker/worker.js`: auth, dedupe, proxy forward, response wrapper

## router source bundles
- `routeros/het_config_install.rsc`
- `routeros/het_transport_install.rsc`
- `routeros/het_telemetry_install.rsc`
- `routeros/het_events_install.rsc`
- `routeros/het_schedulers_install.rsc`
- `routeros/het_full_installer.rsc`

## router script inventory (runtime names)
- `het_CONFIG`
- `het_HTTP_SEND`
- `het_PUSH_LIVE`
- `het_VPN_CHECK`
- `het_PUSH_TRAFFIC`
- `het_PUSH_IFACE` (optional)
- `het_PUSH_USERS`
- `het_PUSH_USAGE`
- `het_PUSH_ROUTERLOG`
- `het_PUSH_CHANGE`

## key code references
- ingest mapping: `Ingest.js:41`, `Ingest.js:90`, `Ingest.js:139`, `Ingest.js:161`, `Ingest.js:182`, `Ingest.js:209`, `Ingest.js:259`
- trigger creation: `Setup.js:64`, `Setup.js:69`, `Setup.js:74`, `Setup.js:79`
- telegram command switch: `Telegram.js:596`
- worker auth check: `cloudflare-worker/worker.js:18`
- dashboard activity logic and class-based sheet health: `Dashboard.js`
- runtime heartbeat and retention engine: `Core.js`, `Setup.js`

## operational debug references
- telegram misroute guard: `Telegram.js` function `HET_isTelegramUpdate_`
- worker auth gate: `cloudflare-worker/worker.js` token check block
- trigger creation: `Setup.js` `ScriptApp.newTrigger(...)` block
- usage payload parser target: `Ingest.js` `type === 'usage'`

## inventory audit counts
- documented Apps Script files: 13
- documented Apps Script key functions: 27
- documented worker files: 1
- documented router bundle files: 6
- documented router runtime scripts: 10
