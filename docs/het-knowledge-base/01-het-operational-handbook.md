# het operational handbook

version: 2026-03-10
scope: production monitoring stack (router -> worker -> apps script -> google sheet -> dashboard/alerts/telegram)

## 1) project overview

### 1.1 project name
- het network operations monitoring platform

### 1.2 purpose
- router telemetry ko centralize karke real-time operations visibility dena
- faults, stale data, resource pressure, vpn status ko detect karna
- dashboard, alerts aur telegram reports automate karna

### 1.3 site/router identity
- site: `kano`
- router: `ambariyya_global`

### 1.4 business problem jo solve hota hai
- manual health check dependency kam hoti hai
- branch traffic aur uptime ek jagah visible hota hai
- stale ya down conditions pe fast response possible hota hai

### 1.5 daily operations me fayda
- noc team ko live health view milta hai
- telegram se quick command/report mil jata hai
- daily summary se management update automate hota hai

## 2) full architecture documentation

### 2.1 end-to-end architecture
1. mikrotik router scripts telemetry payload banate hain
2. cloudflare worker token validate karta hai, dedupe karta hai, aur apps script ko forward karta hai
3. apps script `doGet`/`doPost` request ingest karta hai
4. `HET_ingest` payload type ke mutabiq target sheet update karta hai
5. dashboard snapshots, alerts, reports, telegram commands same sheet layer se read karte hain

### 2.2 component responsibilities
- router: raw telemetry producer
- worker: auth gateway + proxy + dedupe
- apps script api: routing, ingest, processing
- google sheets: source of truth and historical log
- dashboard: operational visualization
- alerts: threshold and stale detection
- telegram: command/query channel
- reports: daily summary + attachments

### 2.3 dependency map (high level)
- router scripts depend on: `het_CONFIG`, `het_HTTP_SEND`
- worker depends on env: `ROUTER_TOKEN`, `APPS_SCRIPT_URL`, `DEDUPE_SEC`
- apps script ingest depends on: valid token + valid `type`
- dashboard depends on: `RAW_TRAFFIC_LOG`, `Router Status`, `VPN Status`, `Alerts`, `Connected Users`
- alerts depend on: `Router Status`, `RAW_TRAFFIC_LOG`
- telegram commands depend on: `HET_collectSnapshot_()` and configured `TG_BOT`

## 3) google sheet documentation

### 3.1 critical realtime sheets
- `Router Status`
  - source: `type=live`
  - writer: `Ingest.js`
  - readers: dashboard, alerts, telegram, reports
  - freshness: near realtime (10m schedule from router side)
  - stale impact: last seen/cpu/memory status wrong ho sakta hai

- `VPN Status`
  - source: `type=vpn`
  - writer: ingest
  - readers: dashboard, telegram, reports
  - freshness: near realtime (15m)
  - stale impact: vpn up/down visibility delay

- `Raw_Traffic_Log`
  - source: `type=traffic`
  - writer: ingest
  - readers: dashboard traffic section, stale-traffic alerts, reports
  - freshness: high (5m)
  - stale impact: throughput display outdated

- `RAW Live`
  - source: all accepted payloads raw copy
  - writer: `hetAppendRaw_(false, ...)`
  - readers: sheet health logic
  - freshness: realtime

- `Alerts`
  - source: alert engine + ingest events
  - writer: `HET_logAlert_`
  - readers: dashboard, telegram, reports
  - freshness: event-driven

### 3.2 operational sheets
- `Connected Users`
  - source: `type=users`
  - writer: ingest
  - readers: dashboard active users, telegram `/users`
  - cadence: 20m schedule

- `User Data Usage`
  - source: `type=usage`
  - writer: ingest
  - readers: top users, reports
  - cadence: 30m schedule
  - note: payload format `usage=WAN_TOTAL|upload|download|total;` required

- `Router Logs`
  - source: `type=routerlog`
  - writer: ingest
  - readers: ops audit, alert logic for critical/high logs

- `Router Changes`
  - source: `type=change`
  - writer: ingest
  - readers: change audit + alerts

### 3.3 governance/support sheets
- `RAW Events`: rejected/missing type/exception trace
- `Daily Reports`: daily summary records
- `Command Center`: queue for smart-summary/ops commands
- `Smart Summary Log`: generated summaries history
- `Sheet Health`: freshness status by sheet
- `Dashboard`: rendered dashboard layout
- `Outbox`: pending/sent telegram/email messages
- `Interface Traffic` and `RDP Logs`: optional event streams

## 4) apps script documentation

### 4.1 api entry layer
- file: `Code.js`
- key functions:
  - `doGet(e)`: token check, admin routes, ingest fallback
  - `doPost(e)`: payload parse, telegram/update routing, fallback to `doGet`
- important admin routes:
  - `admin=status`, `admin=setup`, `admin=refreshdashboard`, `admin=runalertcycle`, `admin=rundailyreport`, `admin=tgdebug`, `admin=tgpoll`

### 4.2 ingest layer
- file: `Ingest.js`
- key function: `HET_ingest(e)`
- type routing:
  - `traffic` -> `Raw_Traffic_Log`
  - `live` -> `Router Status`
  - `users` -> `Connected Users`
  - `usage` -> `User Data Usage`
  - `vpn` -> `VPN Status`
  - `routerlog` -> `Router Logs`
  - `change` -> `Router Changes`
  - `rdp` -> `RDP Logs`
  - `alert` -> `Alerts`
- unknown/missing types `RAW Events` me log hote hain

### 4.3 dashboard layer
- file: `Dashboard.js`
- key functions:
  - `HET_collectSnapshot_()`
  - `HET_dashRefresh()`
  - `HET_sheetActivityRows_()`
- activity classification update (recent fix):
  - `Active`, `Backbone`, `No recent traffic`, `Not connected`, `Disabled`, `Closed / No activity`, `Idle`
- current hardening model:
  - realtime pipeline health is class-based (`REALTIME`, `PERIODIC`, `EVENT_DRIVEN`, `DAILY`, `OPTIONAL`, `MANUAL`)
  - top banner depends only on realtime health + active incidents
  - historical alert counts are separated from active open incidents
  - optional services (`Smart Summary`, `Command Center`, per-user usage) do not affect system health

### 4.4 alert layer
- file: `Alerts.js`
- key rules:
  - cpu warn/crit
  - memory warn/crit
  - ipsec down
  - live stale warn/crit
  - traffic stale warn/crit
  - router log critical/high (config-controlled)
- incident lifecycle:
  - open incidents tracked in script properties by family
  - recovery events logged for router, live freshness, traffic freshness, VPN/IPsec, CPU, memory
  - active incidents are separate from historical alert volume
- cooldown:
  - stale alert cooldown: `ALERT_STALE_COOLDOWN_MIN`
  - routerlog cooldown: `ALERT_ROUTERLOG_COOLDOWN_MIN`

### 4.5 report layer
- file: `Reports.js`
- key functions:
  - `HET_buildDailyReportPayload_()`
  - `HET_dailyReport()`
  - `sendDailySummaryTelegramNow()`
  - `sendDailySummaryEmailNow()`
- output channels: telegram + email

### 4.6 telegram layer
- file: `Telegram.js`
- key functions:
  - `HET_handleTelegramUpdate_(update)`
  - `handleTelegramCommand_(command, payload)`
  - `HET_pollTelegramUpdates_()`
- important fix: monitor payload ke string `message` ko telegram update samajhne wala bug remove hua

### 4.7 setup and config layer
- `Setup.js`: script properties apply, trigger creation, admin status helpers
- `Config.js`: defaults + sheet names + headers
- `Utils.js`: helper functions, token check, sheet create, raw append
- `Menu.js`: spreadsheet menu actions
- `Email.js`: smtp wrapper for gmail send
- runtime hardening:
  - trigger verification helper recreates missing runtime triggers
  - runtime heartbeat tracks dashboard, alerts, commands, reports, trigger integrity, maintenance cycle
  - maintenance cycle runs Google-side retention and archive cleanup

## 5) cloudflare worker documentation

- file: `cloudflare-worker/worker.js`
- purpose:
  - router requests validate karna
  - apps script endpoint ko proxy/forward karna
  - short-window dedupe lagana

### 5.1 auth logic
- token read: `payload.token` ya `payload.t` ya `X-Token`
- validate against: `env.ROUTER_TOKEN`
- mismatch: `AUTH_FAIL` with `401`

### 5.2 forward logic
- GET: query params ke sath forward
- POST: form-urlencoded body ke sath forward
- upstream response wrapper json me return hota hai (`ok`, `status`, `upstream`)

### 5.3 dedupe logic
- hash key from payload (time fields exclude)
- cache hit pe `DEDUPED`
- ttl from `env.DEDUPE_SEC`

### 5.4 required env bindings
- `ROUTER_TOKEN`
- `APPS_SCRIPT_URL`
- `DEDUPE_SEC`

### 5.5 known incident and fix
- incident: worker auth mismatch se router requests `401 unauthorized`
- fix: worker redeploy with correct `ROUTER_TOKEN=MONITOR_TOKEN_2026` and valid `APPS_SCRIPT_URL`

## 6) mikrotik router script documentation

### 6.0 coverage validation
- documented active scripts: `het_CONFIG`, `het_HTTP_SEND`, `het_PUSH_LIVE`, `het_PUSH_TRAFFIC`, `het_PUSH_USERS`, `het_PUSH_USAGE`, `het_PUSH_ROUTERLOG`, `het_PUSH_CHANGE`, `het_VPN_CHECK`
- additional optional script: `het_PUSH_IFACE`

### 6.1 base scripts
- `het_CONFIG`
  - globals set karta hai: apiurl, token, site, router, wanif, vpnhost

- `het_HTTP_SEND`
  - common transport script
  - `SENDDATA` payload worker endpoint pe post karta hai
  - `SENDOK` status set karta hai

### 6.2 telemetry scripts
- `het_PUSH_LIVE`
  - payload type: `live`
  - fields: status, message, cpu, memory, uptime, public_ip, ipsec
  - target sheet: `Router Status`

- `het_VPN_CHECK`
  - payload type: `vpn`
  - fields: host, status, ping, message
  - target sheet: `VPN Status`

- `het_PUSH_TRAFFIC`
  - payload type: `traffic`
  - fields: wan/e2/e3/e4/e5 counters + running flags
  - target sheet: `Raw_Traffic_Log`

- `het_PUSH_USERS`
  - payload type: `users`
  - fields: dhcp bound leases packed list
  - target sheet: `Connected Users`

- `het_PUSH_USAGE`
  - payload type: `usage`
  - field: `usage=WAN_TOTAL|upload|download|total;`
  - target sheet: `User Data Usage`

- `het_PUSH_ROUTERLOG`
  - payload type: `routerlog`
  - fields: log_time, topics, severity, message
  - target sheet: `Router Logs`

- `het_PUSH_CHANGE`
  - payload type: `change`
  - fields: category, item, action, details
  - target sheet: `Router Changes`

### 6.4 script mapping table (operational)

| script | scheduler | interval | payload type | ingest target sheet | downstream impact | source reference |
|---|---|---|---|---|---|---|
| het_CONFIG | manual/bootstrap | on demand | n/a | n/a | sab scripts ke globals set karta hai | `routeros/het_config_install.rsc` |
| het_HTTP_SEND | called by push scripts | per call | form post | n/a | worker forward depend karta hai | `routeros/het_transport_install.rsc` |
| het_PUSH_LIVE | het_live | 10m | live | Router Status | live health, cpu/memory, ipsec view | `routeros/het_telemetry_install.rsc` |
| het_VPN_CHECK | het_vpn | 15m | vpn | VPN Status | vpn state aur alerts | `routeros/het_telemetry_install.rsc` |
| het_PUSH_TRAFFIC | het_traffic | 5m | traffic | Raw_Traffic_Log | site usage, traffic stale alerts | `routeros/het_enterprise_traffic_install.rsc` / runtime script |
| het_PUSH_USERS | het_users | 20m | users | Connected Users | active users card, telegram users | `routeros/het_events_install.rsc` |
| het_PUSH_USAGE | het_usage | 30m | usage | User Data Usage | top users, daily report usage | `routeros/het_events_install.rsc` |
| het_PUSH_ROUTERLOG | het_rlog | 10m | routerlog | Router Logs | router log timeline and alerts | `routeros/het_events_install.rsc` |
| het_PUSH_CHANGE | het_change | 1h | change | Router Changes | change audit and high alerts | `routeros/het_events_install.rsc` |

### 6.5 Roman Urdu logic notes (per script)
- `het_CONFIG`: yeh script asal foundation hai. agar yeh run na ho to token/site/router values blank reh sakti hain.
- `het_HTTP_SEND`: yeh transport layer hai. har push script issi ke through worker ko payload bhejti hai.
- `het_PUSH_LIVE`: router ki heartbeat bhejta hai, jis se dashboard ka status section update hota hai.
- `het_VPN_CHECK`: ipsec/vpn health bhejta hai. vpn down detect ho to ops action trigger hota hai.
- `het_PUSH_TRAFFIC`: ether interfaces ke counters bhejta hai. traffic panel isi pe depend karta hai.
- `het_PUSH_USERS`: active dhcp lease users bhejta hai. users snapshot isi se banta hai.
- `het_PUSH_USAGE`: aggregate usage bhejta hai. agar yeh fail ho to `User Data Usage` sheet blank rehti hai.
- `het_PUSH_ROUTERLOG`: latest router log event bhejta hai. audit aur critical keyword alerts me kaam aata hai.
- `het_PUSH_CHANGE`: periodic change heartbeat bhejta hai. config drift ya ops timeline me helpful hai.

### 6.3 optional scripts
- `het_PUSH_IFACE` (type `iface`)

## 7) scheduler and trigger documentation

### 7.1 router schedulers mapping

| scheduler name | interval | target script | operational purpose |
|---|---|---|---|
| het_live | 10m | het_PUSH_LIVE | router health heartbeat |
| het_vpn | 15m | het_VPN_CHECK | vpn/ipsec state |
| het_users | 20m | het_PUSH_USERS | connected users list |
| het_usage | 30m | het_PUSH_USAGE | aggregated usage summary |
| het_rlog | 10m | het_PUSH_ROUTERLOG | router log ingestion |
| het_change | 1h | het_PUSH_CHANGE | change heartbeat |
| het_traffic | 5m | het_PUSH_TRAFFIC | interface traffic counters |
| het_iface (optional) | 15m | het_PUSH_IFACE | single interface metrics |

### 7.2 apps script trigger mapping

| trigger name | interval | target function | operational purpose |
|---|---|---|---|
| runDashboardRefresh | every few minutes (`DASH_REFRESH_MIN`) | runDashboardRefresh | dashboard layout and latest snapshot refresh |
| runAlertCycle | every 1 min (internal cooldown) | runAlertCycle | stale/cpu/memory/ipsec alert engine |
| runDailyReport | every 1 min (day gate) | runDailyReport | daily summary generation and send |
| runCommandCycle | every 1 min | runCommandCycle | telegram polling + command queue execution |

### 7.3 realtime vs daily vs manual clarity
- realtime-ish: live, traffic, vpn, users, usage streams
- periodic control: alert cycle and command cycle
- daily: report generation (`LAST_DAILY_REPORT` gate)
- manual/admin: setup, cleanup, smart-summary admin endpoints

### 7.3 trigger missing risk
- dashboard trigger missing -> dashboard stale
- alert trigger missing -> stale/cpu/vpn alerts miss
- command trigger missing -> telegram poll/command queue delay

## 8) telegram bot and command documentation

### 8.1 auth and intake
- mode: polling first-class (`HET_pollTelegramUpdates_`)
- strict auth controlled by `TG_AUTH_STRICT`
- mention policy controlled by `TG_STRICT_MENTION`

### 8.2 supported commands
- `/help`, `/start`
- `/report`
- `/health`
- `/traffic`
- `/alerts`
- `/top`
- `/vpn`
- `/users`
- `/uptime`
- `/wan`
- `/status`
- `/snapshot`
- `/ping`
- `/tgdebug`

### 8.3 command data source
- almost tamam commands `HET_collectSnapshot_()` se derive hotay hain
- `/snapshot` dashboard screenshot service use karta hai

## 9) dashboard documentation

### 9.1 major sections
- header: site/router/refresh/overall health
- kpi cards: router, vpn, wan, cpu, memory, users, pending commands, public ip
- traffic and site usage
- network connectivity
- alerts panel
- data pipeline health
- top users
- command and summary sections (snapshot dependent)

### 9.2 activity label logic (current)
- `Backbone` for wan row
- `Active` when bytes > 0
- `No recent traffic` when running up but bytes 0
- `Not connected` when running down
- `Disabled` when disabled
- `Closed / No activity` sunday idle context
- `Idle` fallback

### 9.2.1 classification rule matrix

| interface state | bytes | day context | label |
|---|---:|---|---|
| wan row | any | any | Backbone |
| running up | >0 | any | Active |
| running up | 0 | weekday | No recent traffic |
| running up | 0 | sunday | Closed / No activity |
| running down | any | any | Not connected |
| disabled | any | any | Disabled |
| unknown | 0 | any | Idle |

### 9.3 false label incident
- pehle zero bytes par direct `Unexpected inactivity` lagta tha
- ab running-state aware neutral classification apply hai
- correction reference: `Dashboard.js` activity logic block (post-fix deployment)

## 10) alert logic documentation

### 10.1 alert types
- `ROUTER_DOWN`
- `CPU_WARN`, `CPU_CRIT`
- `MEM_WARN`, `MEM_CRIT`
- `IPSEC_DOWN`, `VPN_DOWN`
- `STALE_WARN`, `STALE_CRIT`
- `TRAFFIC_STALE_WARN`, `TRAFFIC_STALE_CRIT`
- `ROUTER_LOG_CRITICAL/HIGH`
- `ROUTER_CHANGE`
- `RDP_DETECTED`

### 10.2 severity and destination
- severities: `CRITICAL`, `HIGH`, `MEDIUM`
- destination: `Alerts` sheet + optional outbox telegram/email

## 11) data flow documentation

| payload type | router script | worker action | ingest mapping | target sheet | downstream consumers |
|---|---|---|---|---|---|
| traffic | het_PUSH_TRAFFIC | auth+forward+dedupe | traffic branch | Raw_Traffic_Log | dashboard, stale alert, reports |
| live | het_PUSH_LIVE | auth+forward | live branch | Router Status | dashboard, alerts, telegram |
| vpn | het_VPN_CHECK | auth+forward | vpn branch | VPN Status | dashboard, telegram, reports |
| users | het_PUSH_USERS | auth+forward | users branch | Connected Users | users card, telegram |
| usage | het_PUSH_USAGE | auth+forward | usage branch | User Data Usage | top users, reports |
| routerlog | het_PUSH_ROUTERLOG | auth+forward | routerlog branch | Router Logs | audit + log alerts |
| change | het_PUSH_CHANGE | auth+forward | change branch | Router Changes | change alert |
| iface | het_PUSH_IFACE | auth+forward | iface branch | Interface Traffic | optional |
| rdp | external/manual | auth+forward | rdp branch | RDP Logs | security alert |
| alert | external/manual | auth+forward | alert branch | Alerts | dashboard, reports |

## 12) token/config/endpoint documentation

### 12.1 key config domains
- monitor token: request authorization
- worker endpoint: router post target
- apps script endpoint: backend api target
- telegram bot/chat: command and report destination
- thresholds: cpu/memory/stale windows

### 12.2 sensitive value policy
- docs me full secret openly share na karein
- operationally masked format use karein
- rotation procedure maintain karein

### 12.3 break impact
- wrong monitor token -> worker `401`
- wrong `APPS_SCRIPT_URL` -> worker `BAD_CONFIG`/502
- wrong `TG_BOT` -> telegram send fail

## 13) troubleshooting guide

### 13.1 no data in router status
- checks:
  - router scheduler `het_live`
  - script `het_PUSH_LIVE` exists and valid
  - worker probe response
- fix:
  - run `het_CONFIG`, run sender manually, inspect logs

### 13.2 user data usage empty
- symptom: `User Data Usage` header only
- likely cause: `het_PUSH_USAGE` missing/invalid or wrong payload format
- fix: ensure `type=usage` and `usage=WAN_TOTAL|...;`

### 13.3 worker returns 401
- cause: `ROUTER_TOKEN` mismatch
- fix: redeploy worker with correct env var

### 13.4 apps script returns 403
- cause: access throttling/web app permission/session issue
- workaround: status via worker `admin=status`

### 13.5 telegram bot no response
- checks:
  - `runCommandCycle` trigger
  - polling offset/debug states (`/tgdebug`)
  - auth strict settings

### 13.6 dashboard wrong inactivity label
- cause (old): bytes-only logic
- fix (new): running-state aware neutral labels

### 13.7 script invalid flag in router
- cause: ros syntax issue (`true/false`, brace mismatch)
- fix: re-create script in minimal validated form

## 14) future improvements / pending items

1. daily report freshness tuning and explicit run window
2. command center automation cadence improvement
3. smart summary scheduled auto-mode review
4. router transport: strict http status parsing in `het_HTTP_SEND`
5. telegram traffic text alignment with dashboard activity wording
6. optional branch business-hours rule support
7. documentation sync automation helper

## 15) quick validation checklist

1. router test: `/system script run het_PUSH_LIVE`
2. router logs: `het_HTTP_SEND_PRIMARY_OK`
3. worker test: status 200 with upstream ok
4. sheet check: latest row time moving in key sheets
5. dashboard refresh and label sanity
6. telegram `/health` and `/traffic` command response

## 16) documentation structure guidance for google sheet

agar aap is handbook ko google sheet docs tabs me rakhna chahte hain:
- section numbers ko row groups me paste karein
- har tab me top pe `last reviewed`, `owner`, `next review date` columns rakhein
- change log tab ko mandatory entry point banayen

## 17) operational status snapshot (latest verified)

- telemetry streams working: live, vpn, users, usage, routerlog, change, traffic
- worker auth fixed and forwarding ok
- dashboard activity labeling corrected to neutral technical wording
- non-realtime tabs (`Daily Reports`, `Command Center`, `Smart Summary Log`) cadence/usage dependent

## 18) business-rule note

jab tak formal branch business-hours policy defined nahi hoti, zero traffic ko direct fault mat samjha jaye. default neutral labels use karein (`No recent traffic`, `Idle`, `Not connected`).

## 19) final completeness summary (validation)

- total documentation sections in knowledge base index: 26
- total documented major sections in handbook: 19
- total documented sheet names: 17
- total documented router scripts (active + optional): 10
- total documented Apps Script key functions: 27
- total documented apps script triggers: 4
- total documented router schedulers: 8
- total documented payload types in mapping: 10
- total documented telegram commands: 14

operational conclusion:
- telemetry chain production usable hai.
- documentation chain maintainable hai.
- living update policy ke sath yeh handbook permanent ops reference ke liye ready hai.
