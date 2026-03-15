# het disaster recovery playbook

version: 2026-03-10
scope: het monitoring stack ke major failure scenarios ka safe recovery handbook

## 1) recovery principles

1. pehle blast radius identify karo: router, worker, apps script, sheet, ya trigger layer.
2. production me destructive actions se pehle backup/export lo.
3. har recovery step ke baad verification run karo, phir next step lo.
4. token aur endpoint values manually double-check karo.
5. change log me incident aur fix mandatory record karo.

## 2) rapid triage sequence

1. worker status check (`admin=status` via worker).
2. key sheets freshness check (`Router Status`, `Raw_Traffic_Log`, `VPN Status`).
3. router scripts/schedulers validity check.
4. Apps Script triggers state verify.
5. telegram `/health` aur `/tgdebug` test.

## 3) failure scenario playbooks

### 3.1 router reset

- symptoms:
  - router side `het_` scripts missing.
  - worker par periodic telemetry band.
  - sheet rows freeze.
- root cause possibilities:
  - device reset/default config restore.
  - backup restore me scripts include na hon.
- diagnostic steps:
  - `/system identity print`
  - `/system script print without-paging where name~"^het_"`
  - `/system scheduler print without-paging where name~"^het_"`
- safe recovery steps:
  1. router identity/network baseline restore karo.
  2. `routeros/het_full_installer.rsc` ya modular install files import karo.
  3. `het_CONFIG` run karo.
  4. `het_PUSH_LIVE` manual run karo.
- commands/actions:
```routeros
/import file-name=het_full_installer.rsc
/system script run het_CONFIG
/system script run het_PUSH_LIVE
```
- expected verification:
  - worker response success.
  - `Router Status` me new row aaye.

### 3.2 router scripts deleted

- symptoms:
  - schedulers exist lekin target script not found.
  - logs me script error.
- root cause possibilities:
  - manual accidental delete.
  - partial import failure.
- diagnostic steps:
  - script list aur scheduler on-event check.
- safe recovery steps:
  1. missing module file re-import karo (`config/transport/telemetry/events/schedulers`).
  2. invalid scripts ko clean recreate karo.
  3. scheduler links revalidate karo.
- commands/actions:
```routeros
/import file-name=het_config_install.rsc
/import file-name=het_transport_install.rsc
/import file-name=het_telemetry_install.rsc
/import file-name=het_events_install.rsc
/import file-name=het_schedulers_install.rsc
```
- expected verification:
  - `/system script print` me all expected `het_` scripts valid state me hon.

### 3.3 cloudflare worker deleted

- symptoms:
  - router fetch endpoint resolve fail/404.
  - worker URL unreachable.
- root cause possibilities:
  - accidental worker deletion.
  - account/project cleanup.
- diagnostic steps:
  - worker URL browser/powershell se hit karo.
  - Cloudflare dashboard me worker project existence check.
- safe recovery steps:
  1. `cloudflare-worker/worker.js` se worker re-create karo.
  2. env vars set karo: `ROUTER_TOKEN`, `APPS_SCRIPT_URL`, `DEDUPE_SEC`.
  3. route/domain publish verify karo.
- commands/actions:
```powershell
wrangler deploy
```
- expected verification:
  - `admin=status` worker route se 200/upstream ok aaye.

### 3.4 Apps Script project lost

- symptoms:
  - worker upstream 404/permission error.
  - Apps Script exec URL invalid.
- root cause possibilities:
  - script project delete.
  - wrong deployment selected.
- diagnostic steps:
  - saved source files se project existence verify.
  - old deployment URL test.
- safe recovery steps:
  1. naya Apps Script project create karo.
  2. repo ke files (`Code.js`, `Ingest.js`, etc.) paste/import karo.
  3. script properties apply karo.
  4. web app deploy as execute-as-owner + anyone with link.
  5. worker `APPS_SCRIPT_URL` update karo.
- expected verification:
  - worker admin status me sheets summary return ho.

### 3.5 google sheet accidentally deleted

- symptoms:
  - Apps Script writes fail (`Spreadsheet not found`).
  - dashboard empty.
- root cause possibilities:
  - accidental deletion.
  - sheet id rotation/update missing.
- diagnostic steps:
  - Apps Script logs me spreadsheet open errors check.
- safe recovery steps:
  1. nayi sheet create karo.
  2. setup function se required tabs auto-create karo.
  3. script properties me new sheet id set karo.
  4. trigger re-run + sample payload ingest.
- expected verification:
  - key tabs auto-create hon aur new rows ingest hon.

### 3.6 triggers stopped running

- symptoms:
  - dashboard stale.
  - alerts delay.
  - telegram polling stop.
- root cause possibilities:
  - trigger deleted/disabled.
  - Apps Script auth expired.
- diagnostic steps:
  - Apps Script trigger dashboard check.
  - `admin=status` me trigger summary review.
- safe recovery steps:
  1. `createOrResetTriggers` run karo.
  2. owner account auth refresh karo.
- expected verification:
  - `runDashboardRefresh`, `runAlertCycle`, `runDailyReport`, `runCommandCycle` active hon.

### 3.7 token mismatch or authentication failure

- symptoms:
  - worker `401 AUTH_FAIL`.
  - ingest rows na bane.
- root cause possibilities:
  - router token aur worker token mismatch.
  - typo in script/global.
- diagnostic steps:
  - router `MONITOR_TOKEN` value print karo.
  - worker env `ROUTER_TOKEN` verify karo.
- safe recovery steps:
  1. canonical token decide karo (`MONITOR_TOKEN_2026`).
  2. router `het_CONFIG` update karo.
  3. worker env update + redeploy.
- expected verification:
  - same payload par 401 khatam ho aur success mile.

### 3.8 worker returning 401/403

- symptoms:
  - 401: auth fail.
  - 403: upstream/App Script access restrictions.
- root cause possibilities:
  - 401: token mismatch.
  - 403: Apps Script deployment permission/throttle/session.
- diagnostic steps:
  - worker wrapper `status`, `upstream` inspect karo.
  - direct Apps Script status vs worker status compare karo.
- safe recovery steps:
  1. 401 path me token realign + redeploy.
  2. 403 path me Apps Script deployment permissions reset.
  3. optional workaround: worker-routed status endpoint use karo for ops checks.
- expected verification:
  - worker GET status stable 200/upstream ok.

### 3.9 dashboard showing stale data

- symptoms:
  - dashboard time old.
  - traffic/users/vpn cards freeze.
- root cause possibilities:
  - router schedulers stop.
  - ingest stop.
  - dashboard trigger stop.
- diagnostic steps:
  - latest row timestamps compare in key sheets.
  - `runDashboardRefresh` trigger check.
- safe recovery steps:
  1. upstream stream fix karo (router/worker/apps script).
  2. dashboard refresh manual run.
  3. trigger reset.
- expected verification:
  - dashboard refresh time recent aur KPIs update.

### 3.10 telegram bot not responding

- symptoms:
  - commands ka koi reply nahi.
- root cause possibilities:
  - command trigger stopped.
  - invalid `TG_BOT` token.
  - strict auth mismatch.
- diagnostic steps:
  - `/tgdebug` state check.
  - command cycle trigger verify.
  - Apps Script logs me telegram send errors check.
- safe recovery steps:
  1. bot token/property validate.
  2. `runCommandCycle` trigger ensure.
  3. polling offset reset if needed.
- expected verification:
  - `/health` command par immediate response.

## 4) component-level recovery runbooks

### 4.1 router script recovery
1. config + transport + telemetry + events + schedulers modules re-import.
2. `het_CONFIG` run.
3. one-by-one manual push test.

### 4.2 worker redeployment
1. worker code restore from repo.
2. env vars set.
3. deploy and smoke test.

### 4.3 Apps Script redeployment
1. source files restore.
2. script properties apply.
3. web app deployment publish.
4. triggers recreate.

### 4.4 google sheet reconstruction
1. new sheet create.
2. setup helpers se tabs/headers create.
3. sample ingest run.

### 4.5 token reconfiguration
1. single source-of-truth token define.
2. router + worker + Apps Script me same value align.
3. auth smoke test run.

### 4.6 scheduler recreation
1. router schedulers reinstall.
2. intervals verify.
3. logs monitor for first run success.

## 5) verification command pack

### router verification
```routeros
/system script print without-paging where name~"^het_"
/system scheduler print without-paging where name~"^het_"
/system script run het_PUSH_LIVE
```

### worker and upstream verification (PowerShell)
```powershell
$u='https://mikrotik-monitor-proxy.hetgraphic17.workers.dev?token=MONITOR_TOKEN_2026&admin=status'
$o=Invoke-RestMethod -Uri $u -Method Get -TimeoutSec 90
$o.status
$s=$o.upstream | ConvertFrom-Json
$s.ok
```

### dashboard/telegram verification
```powershell
# dashboard data freshness sample
$s.sheets.'Router Status'.topRow
# telegram command check manually in chat: /health
```

## 6) post-recovery signoff checklist

1. live, traffic, vpn, users, usage streams fresh hon.
2. dashboard labels sane hon.
3. alerts cycle active ho.
4. telegram `/health` aur `/traffic` reply dein.
5. change log entry add ho.

## 7) cross references

- architecture: `docs/het-knowledge-base/08-system-architecture-blueprint.md`
- deployment: `docs/het-knowledge-base/10-full-deployment-guide.md`
- handbook: `docs/het-knowledge-base/01-het-operational-handbook.md`
