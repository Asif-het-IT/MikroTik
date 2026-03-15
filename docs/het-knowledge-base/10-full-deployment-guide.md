## runtime hardening after deployment

1. verify karein ke yeh triggers موجود hon:
- `runDashboardRefresh`
- `runAlertCycle`
- `runDailyReport`
- `runCommandCycle`
- `runRuntimeHealthCheck`
- `runMaintenanceCycle`

2. `admin=verifytriggers` aur `admin=runtimehealth` run karke confirm karein ke trigger integrity aur runtime heartbeat healthy hai.

3. full installer path me `het_enterprise_traffic_install.rsc` ab canonical package ka hissa hai; deploy verification me `het_traffic` scheduler ka hona mandatory hai.
# het full deployment guide

version: 2026-03-10
scope: new router ya new site par het monitoring stack ka complete deployment

## 1) deployment objective

is guide ka maqsad yeh hai ke naya engineer bhi without guesswork full stack deploy kar sake: router scripts, worker, Apps Script, sheet, telegram, dashboard, aur verification.

## 2) prerequisites

1. MikroTik RouterOS access (admin level).
2. Cloudflare account with workers deploy access.
3. Google account with Apps Script + Sheets access.
4. Telegram bot token + target chat id.
5. canonical monitor token (example: `MONITOR_TOKEN_2026`).

## 3) step-by-step deployment

### 3.1 router preparation
1. router identity, clock, DNS, internet connectivity verify karo.
2. config backup export lo.
3. upload/install files (`.rsc`) ready rakho.

recommended checks:
```routeros
/system resource print
/system clock print
/ping 1.1.1.1 count=3
```

### 3.2 router script installation
1. files import order me run karo:
   - `het_config_install.rsc`
   - `het_transport_install.rsc`
   - `het_telemetry_install.rsc`
   - `het_events_install.rsc`
   - `het_schedulers_install.rsc`
2. alternatively `het_full_installer.rsc` se one-shot install karo.
3. script validity check karo.

commands:
```routeros
/import file-name=het_config_install.rsc
/import file-name=het_transport_install.rsc
/import file-name=het_telemetry_install.rsc
/import file-name=het_events_install.rsc
/import file-name=het_schedulers_install.rsc
/system script print without-paging where name~"^het_"
```

### 3.3 scheduler creation and validation
1. ensure schedulers created: `het_live`, `het_vpn`, `het_users`, `het_usage`, `het_rlog`, `het_change`, `het_traffic`.
2. on-event script names validate karo.
3. intervals production policy ke mutabiq verify karo.

command:
```routeros
/system scheduler print without-paging where name~"^het_"
```

### 3.4 worker deployment
1. `cloudflare-worker/worker.js` project open karo.
2. env vars configure karo:
   - `ROUTER_TOKEN=MONITOR_TOKEN_2026`
   - `APPS_SCRIPT_URL=<apps script web app exec url>`
   - `DEDUPE_SEC=30` (ya policy value)
3. deploy with Wrangler.

command:
```powershell
wrangler deploy
```

### 3.5 Apps Script deployment
1. Apps Script project me required source files upload/paste karo.
2. `applyScriptProperties` run karo.
3. `createOrResetTriggers` run karo.
4. web app deploy karo (execute as owner, accessible to required callers).
5. deployed exec URL note karo.

### 3.6 Google Sheet setup
1. monitoring spreadsheet create ya select karo.
2. setup helpers se required tabs ensure karo.
3. headers verify karo.
4. dashboard tab ready karo.

minimum required operational tabs:
- `Router Status`
- `Raw_Traffic_Log`
- `VPN Status`
- `Connected Users`
- `User Data Usage`
- `Alerts`
- `Dashboard`
- `RAW Live`
- `RAW Events`

### 3.7 token configuration
1. same token router, worker, Apps Script me align karo.
2. token typo aur trailing spaces check karo.
3. token update ke baad manual live push test karo.

### 3.8 endpoint configuration
1. router `APIURL` worker endpoint pe set karo.
2. worker `APPS_SCRIPT_URL` latest deployment URL par set ho.
3. direct Apps Script fallback policy ke mutabiq enable/disable rakho.

### 3.9 telegram bot setup
1. `TG_BOT` token set karo.
2. `TG_CHAT` ya authorized users configure karo.
3. strict auth flags policy ke mutabiq set karo.
4. polling mode verify karo.

### 3.10 dashboard activation
1. `runDashboardRefresh` trigger active ho.
2. ek manual refresh run karo.
3. activity labels validate karo (`Active`, `No recent traffic`, `Not connected`, etc.).

### 3.11 monitoring verification tests

#### test-a router fetch test
```routeros
/system script run het_PUSH_LIVE
/system script run het_PUSH_TRAFFIC
```
expected: no script error, transport success log.

#### test-b worker connectivity test
```powershell
$u='https://mikrotik-monitor-proxy.hetgraphic17.workers.dev?token=MONITOR_TOKEN_2026&admin=status'
$o=Invoke-RestMethod -Uri $u -Method Get -TimeoutSec 90
$o.status
```
expected: status 200 and upstream payload.

#### test-c Apps Script status test
```powershell
$s=$o.upstream | ConvertFrom-Json
$s.ok
$s.sheets.'Router Status'.topRow
```
expected: `ok=true` and latest row data visible.

#### test-d sheet ingestion test
- `Router Status`, `Raw_Traffic_Log`, `VPN Status` me new timestamped rows check.
expected: recent rows appear after manual push.

#### test-e telegram command test
- chat me `/health`, `/traffic`, `/users`, `/report` run karo.
expected: valid response with current snapshot data.

## 4) go-live checklist

1. all required scripts valid state me hon.
2. all required schedulers enabled hon.
3. worker auth test pass ho.
4. apps script triggers active hon.
5. key sheets fresh hon.
6. dashboard render fresh ho.
7. telegram bot commands responsive hon.

## 5) common deployment pitfalls

1. token mismatch (`401 AUTH_FAIL`).
2. wrong Apps Script deployment URL.
3. triggers create na karna.
4. router script invalid due syntax issues.
5. usage payload format mistake (`usage=WAN_TOTAL|...;`).

## 6) post-deployment handover

1. quick reference share karo.
2. SOP schedule ownership assign karo.
3. change log baseline entry add karo.
4. disaster recovery playbook owner assign karo.

## 7) cross references

- architecture: `docs/het-knowledge-base/08-system-architecture-blueprint.md`
- disaster recovery: `docs/het-knowledge-base/09-disaster-recovery-playbook.md`
- quick reference: `docs/het-knowledge-base/04-quick-reference.md`
- maintenance sop: `docs/het-knowledge-base/03-maintenance-sop.md`
