# het google sheet documentation pack

version: 2026-03-10
purpose: Google Sheet tabs me direct paste ke liye Roman Urdu documentation blocks

## use instructions

1. Google Sheet me niche diye gaye exact tab names create karein.
2. har tab me 1st row headers rakhein: `section id | section title | detail | source file | last updated at | owner`.
3. niche diya gaya tab content section-wise paste karein.
4. `last updated at` aur `owner` fields operations ke mutabiq fill karein.

---

## TAB: DOC_Master_Index

- section id: MI-01
- section title: docs navigation
- detail: complete docs index `00-master-index.md` ke mutabiq maintain ho.
- source file: `docs/het-knowledge-base/00-master-index.md`

- section id: MI-02
- section title: mandatory docs scope
- detail: architecture, deployment, disaster recovery, SOP, quick reference, changelog sab include hon.
- source file: `docs/het-knowledge-base/00-master-index.md`

## TAB: DOC_Project_Overview

- section id: OV-01
- section title: project purpose
- detail: het monitoring platform ka maqsad realtime network visibility, proactive alerts, aur automated reporting dena hai.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: OV-02
- section title: business value
- detail: manual checks kam hotay hain, dashboard aur telegram se fast incident response possible hota hai.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

## TAB: DOC_Architecture

- section id: AR-01
- section title: logical flow
- detail: router -> router scripts -> worker -> Apps Script -> sheets -> dashboard/alerts/telegram/reports.
- source file: `docs/het-knowledge-base/08-system-architecture-blueprint.md`

- section id: AR-02
- section title: worker responsibility
- detail: token auth + dedupe + forwarding worker ki core zimmedari hai.
- source file: `docs/het-knowledge-base/08-system-architecture-blueprint.md`

- section id: AR-03
- section title: visual diagram
- detail: mermaid architecture diagram architecture blueprint me available hai.
- source file: `docs/het-knowledge-base/08-system-architecture-blueprint.md`

## TAB: DOC_Sheets

- section id: SH-01
- section title: realtime sheets
- detail: `Router Status`, `Raw_Traffic_Log`, `VPN Status`, `Connected Users`, `User Data Usage`.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: SH-02
- section title: support sheets
- detail: `RAW Live`, `RAW Events`, `Alerts`, `Dashboard`, `Daily Reports`, `Outbox`.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

## TAB: DOC_Router_Scripts

- section id: RS-01
- section title: base scripts
- detail: `het_CONFIG` globals set karta hai aur `het_HTTP_SEND` transport handle karta hai.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: RS-02
- section title: telemetry scripts
- detail: `het_PUSH_LIVE`, `het_PUSH_TRAFFIC`, `het_VPN_CHECK`, `het_PUSH_USERS`, `het_PUSH_USAGE`, `het_PUSH_ROUTERLOG`, `het_PUSH_CHANGE`.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

## TAB: DOC_Worker

- section id: WK-01
- section title: auth flow
- detail: token from payload/header read hota hai aur `ROUTER_TOKEN` se match hota hai.
- source file: `docs/het-knowledge-base/08-system-architecture-blueprint.md`

- section id: WK-02
- section title: forwarding flow
- detail: valid request `APPS_SCRIPT_URL` ko forward hoti hai aur wrapper response return hota hai.
- source file: `docs/het-knowledge-base/08-system-architecture-blueprint.md`

## TAB: DOC_Apps_Script

- section id: AS-01
- section title: entry layer
- detail: `doGet` aur `doPost` ingest/admin routing manage karte hain.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: AS-02
- section title: ingest routing
- detail: `HET_ingest` payload type ke mutabiq target sheets me append karta hai.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

## TAB: DOC_Dashboard

- section id: DB-01
- section title: snapshot model
- detail: dashboard latest sheet rows se build hota hai.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: DB-02
- section title: activity labels
- detail: labels running-aware hain: `Active`, `No recent traffic`, `Not connected`, `Disabled`, `Idle`.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

## TAB: DOC_Alerts

- section id: AL-01
- section title: rule families
- detail: cpu, memory, stale, vpn, routerlog severity based alerts configured hain.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: AL-02
- section title: cooldown behavior
- detail: stale aur routerlog alerts me cooldown duplication control karta hai.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

## TAB: DOC_Data_Flow

- section id: DF-01
- section title: payload mapping
- detail: `traffic/live/vpn/users/usage/routerlog/change/iface/rdp/alert` mapping documented hai.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: DF-02
- section title: downstream consumers
- detail: dashboard, alerts, telegram, reports sab mapped sheets se read karte hain.
- source file: `docs/het-knowledge-base/08-system-architecture-blueprint.md`

## TAB: DOC_Telegram

- section id: TG-01
- section title: commands
- detail: `/help`, `/health`, `/traffic`, `/alerts`, `/users`, `/report`, `/tgdebug` etc supported hain.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: TG-02
- section title: command engine
- detail: polling cycle updates pull karta hai aur command parser handler execute karta hai.
- source file: `docs/het-knowledge-base/08-system-architecture-blueprint.md`

## TAB: DOC_Troubleshooting

- section id: TS-01
- section title: common failures
- detail: no data, usage empty, 401 auth fail, telegram no response, stale dashboard documented hain.
- source file: `docs/het-knowledge-base/01-het-operational-handbook.md`

- section id: TS-02
- section title: rapid checks
- detail: worker status + key sheet freshness + trigger status + router script validity ko first-line checks rakhein.
- source file: `docs/het-knowledge-base/09-disaster-recovery-playbook.md`

## TAB: DOC_Deployment

- section id: DP-01
- section title: install sequence
- detail: router prep -> scripts -> schedulers -> worker -> Apps Script -> sheet -> telegram -> verification.
- source file: `docs/het-knowledge-base/10-full-deployment-guide.md`

- section id: DP-02
- section title: go-live validation
- detail: router push, worker status, sheet ingestion, telegram command tests mandatory hain.
- source file: `docs/het-knowledge-base/10-full-deployment-guide.md`

## TAB: DOC_Disaster_Recovery

- section id: DR-01
- section title: scenario coverage
- detail: router reset, script deletion, worker deletion, Apps Script loss, sheet deletion, trigger failure, auth failure sab covered hain.
- source file: `docs/het-knowledge-base/09-disaster-recovery-playbook.md`

- section id: DR-02
- section title: recovery structure
- detail: har scenario me symptoms, possible root cause, diagnostics, safe recovery, verification result diya gaya hai.
- source file: `docs/het-knowledge-base/09-disaster-recovery-playbook.md`

## TAB: DOC_Change_Log

- section id: CL-01
- section title: release history
- detail: production-impact changes date-wise maintained hain.
- source file: `docs/het-knowledge-base/02-change-log.md`

- section id: CL-02
- section title: update policy
- detail: har functional change ke sath changelog entry mandatory hai.
- source file: `docs/het-knowledge-base/02-change-log.md`

## TAB: DOC_SOP

- section id: SOP-01
- section title: daily/weekly/monthly checks
- detail: routine health checks SOP me documented hain.
- source file: `docs/het-knowledge-base/03-maintenance-sop.md`

- section id: SOP-02
- section title: release + rollback
- detail: deployment validation aur rollback guideline defined hai.
- source file: `docs/het-knowledge-base/03-maintenance-sop.md`

## TAB: DOC_Quick_Reference

- section id: QR-01
- section title: fast commands and urls
- detail: worker status, router commands, aur essential payload/script/trigger list available hai.
- source file: `docs/het-knowledge-base/04-quick-reference.md`

- section id: QR-02
- section title: emergency runbook links
- detail: deployment aur disaster recovery docs ko quick links me rakha gaya hai.
- source file: `docs/het-knowledge-base/10-full-deployment-guide.md`

## mirror completion checklist

1. sab required DOC_ tabs create ho chuke hon.
2. har tab me source file reference ho.
3. last updated timestamp filled ho.
4. owner assigned ho.
5. monthly docs sync SOP me include ho.
