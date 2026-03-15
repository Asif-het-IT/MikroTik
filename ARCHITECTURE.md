# het monitoring architecture

## live flow

MikroTik router sirf lightweight telemetry bhejta hai.

1. Router `live`, `iface`, `users`, aur `vpn` payloads Cloudflare Worker ko bhejta hai.
2. Worker token validate karta hai, duplicate requests ko short-term dedupe karta hai, aur payload Apps Script web app `/exec` endpoint ko forward karta hai.
3. Apps Script Google Sheet ko operational database ke taur par use karta hai.
4. Dashboard, alerts, email, Telegram, daily report, aur smart summary workflow sab backend par run karte hain.

## design rules

- Brand hamesha lowercase `het` rahegi in user-facing output.
- Router par heavy logic, summarization, ya command orchestration nahin chalegi.
- System local smart summary engine par run karta hai. External AI dependency active workflow ka hissa nahin hai.
- Sheet writes top-insert mode mein hoti hain, is liye latest data row 2 par milti hai.

## sheets

- `Router Status`: latest live health snapshots.
- `Interface Traffic`: WAN/LAN/WiFi tx/rx snapshots.
- `Connected Users`: current DHCP/WiFi user rows.
- `VPN Status`: VPN reachability and IPsec state.
- `Alerts`: deduped alert history.
- `Daily Reports`: daily executive summary log.
- `Dashboard`: generated spreadsheet dashboard.
- `Outbox`: email/Telegram delivery queue.
- `Command Center`: operator commands for refresh, smart summary, reports, and alert cycle.
- `Smart Summary Log`: local Roman Urdu summaries with status and engine info.

## command center format

Columns:

1. `Time`
2. `Requested By`
3. `Command`
4. `Target`
5. `Prompt`
6. `Status`
7. `Result`
8. `Output Channel`
9. `Updated At`
10. `Meta`

Supported commands:

- `REFRESH_DASHBOARD`
- `RUN_DAILY_REPORT`
- `RUN_ALERT_CYCLE`
- `SUMMARIZE_STATUS`
- `EXPLAIN_ALERTS`
- `SMART_SUMMARY`
- `SEND_SMART_SUMMARY`

Valid output channels:

- `NONE`
- `TELEGRAM`
- `EMAIL`
- `BOTH`

## script properties

Production-relevant properties:

- `MONITOR_TOKEN`
- `SS_ID`
- `TG_BOT`
- `TG_CHAT`
- `EMAILS`
- `COMMAND_BATCH_LIMIT`

## admin endpoints

All admin endpoints still require the monitor token.

- `?admin=status&token=...`
- `?admin=setup&token=...`
- `?admin=cleanup&token=...`
- `?admin=runcommands&token=...`
- `?admin=summary&token=...&prompt=...&target=...`