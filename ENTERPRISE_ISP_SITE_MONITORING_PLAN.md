# Enterprise ISP and Site Usage Monitoring Plan (MikroTik ROS 6.49.19)

## 1) Final Architecture
- MikroTik (light collectors only)
- POST to Cloudflare Worker (primary) and Apps Script (optional backup)
- Apps Script ingest + validation
- Google Sheets raw logs (append-only)
- Apps Script processors (delta, aggregation, trend, summary)
- Dashboard + daily Telegram/Email summary

Data flow:
- Router `traffic push` every 5 min (standard) / 15 min (lite)
- Router `health push` every 10 min (standard) / 15 min (lite)
- Apps Script computes all heavy analytics from counters

## 2) Router-Side Data Model (minimal load)
Use cumulative counters, not heavy analytics.

Payload type `traffic`:
- token, type=traffic, site, router
- wan=ether1
- ifs=serialized interface blocks for ether1..ether5
- cpu, memory, uptime, public_ip, wan_running

Interface block format:
- `ifname|rx_bytes|tx_bytes|running`
- Blocks separated by `;`

Example:
- `ifs=ether1|123|456|1;ether2|111|222|1;ether3|...`

Payload type `health`:
- token, type=health, site, router
- cpu, memory, uptime, public_ip, wan_running, ipsec(optional)

Router does NOT compute:
- trends, daily totals, top site, peak windows, anomaly logic

## 3) Apps Script Backend Logic
### Ingest
- Validate token and required fields
- Append to `Raw_Traffic_Log` for type=traffic
- Append to `Router_Status`/`VPN_Status` for health/vpn (existing)

### Delta Processor (`runTrafficDeltaProcessor` every 5 min)
- Read unprocessed rows from `Raw_Traffic_Log` via cursor property
- Parse interface blocks
- For each interface and sample pair:
  - delta_rx = current_rx - previous_rx
  - delta_tx = current_tx - previous_tx
  - if delta < 0 => counter reset/reboot; set delta=0 and mark reset
- Compute rates in backend:
  - rx_bps = delta_rx * 8 / sample_seconds
  - tx_bps = delta_tx * 8 / sample_seconds
  - rx_mbps, tx_mbps
- Append to `Traffic_Delta_Log`

### Daily Aggregator (`runDailyIspSiteSummary` daily)
From `Traffic_Delta_Log` aggregate per day:
- ISP total download/upload/combined
- Peak WAN rx/tx Mbps
- Site totals for ether2..ether5
- Top consuming site
- Avg CPU / Max CPU (join from health rows)
- WAN downtime count (wan_running=0 samples)
- Notes/anomalies

### Dashboard updater
- Existing dashboard remains
- Add ISP section and per-site usage section from summary tables
- Keep `Sheet Health` status checks

## 4) Google Sheet Schema
### A) `Raw_Traffic_Log` (append-only)
- Timestamp
- Router
- Site
- WAN Interface
- WAN RX Bytes
- WAN TX Bytes
- WAN Running
- ether2 RX Bytes
- ether2 TX Bytes
- ether2 Running
- ether3 RX Bytes
- ether3 TX Bytes
- ether3 Running
- ether4 RX Bytes
- ether4 TX Bytes
- ether4 Running
- ether5 RX Bytes
- ether5 TX Bytes
- ether5 Running
- CPU
- Memory
- Uptime
- Public IP
- Push Status
- Raw Payload

### B) `Traffic_Delta_Log`
- Timestamp
- Router
- Site
- Interface
- Delta RX Bytes
- Delta TX Bytes
- Delta Total Bytes
- RX Mbps
- TX Mbps
- Counter Reset Flag
- Running Flag

### C) `Daily_Summary`
- Date
- Router
- ISP Download
- ISP Upload
- ISP Total
- Peak WAN RX Mbps
- Peak WAN TX Mbps
- Unity Shop Total
- Store-2 Total
- Store-1 Total
- BUK Site Total
- Top Consuming Site
- Avg CPU
- Max CPU
- WAN Downtime Count
- Notes

## 5) Scheduler Intervals
Recommended (enterprise standard):
- Traffic push: every 5 min
- Health push: every 10 min
- Delta processor: every 5 min
- Daily summary: once/day

Lite mode:
- Traffic push: every 15 min
- Health push: every 15 min
- Delta processor: every 15 min

Why this is best:
- Keeps router CPU low
- Limits sheet growth and API noise
- Enough granularity for operations and planning

## 6) Daily Summary Enhancement (without breaking existing flow)
Enhance current daily report by adding section:
- ISP usage totals
- Peak WAN speeds
- Each site usage totals
- Top consuming site
- WAN health snapshot
- Remarks like `Store-2 inactive today` when usage near zero

Do not remove current report fields; append new ISP/Site block to existing template.

## 7) Retention Strategy
- Raw logs: keep 90 days active
- Monthly archive job:
  - copy previous month rows to `Archive_YYYY_MM`
  - optionally export CSV to Drive
  - delete archived raw rows from active sheet
- Delta and Daily summary retained longer (compact)
- Design remains BigQuery-ready by keeping typed numeric columns

## 8) Error Handling Strategy
- Router:
  - payload empty guard
  - primary send with timeout
  - optional backup only if needed
  - concise logs only (`_OK`, `_FAIL`)
- Backend:
  - strict validation
  - unknown payloads into RAW_EVENTS
  - idempotent processors with cursors
  - counter reset guard (no negative deltas)
- Operational:
  - Sheet Health report for freshness
  - stale alert when traffic/health stops

## 9) Naming Standards
Router scripts:
- `het_CONFIG`, `het_HTTP_SEND`, `het_PUSH_TRAFFIC`, `het_PUSH_HEALTH`
- Optional: `het_PUSH_VPN`, `het_PUSH_ROUTERLOG`

Schedulers:
- `het_traffic`, `het_health`, `het_vpn`, `het_change`

Apps Script functions:
- `HET_ingestTraffic_`
- `runTrafficDeltaProcessor`
- `runDailyIspSiteSummary`
- `HET_buildEnhancedDailyReport_`

Sheets:
- `Raw_Traffic_Log`, `Traffic_Delta_Log`, `Daily_Summary`, `Dashboard`, `Sheet Health`

## 10) Future Scalability Notes
- Add interface map in config table instead of hardcoding names
- Add second router support by router key
- Optional migrate raw + delta to BigQuery
- Keep reports from aggregates, never from direct raw scans

---

## One-Time Rollout Runbook (high level)
1. Deploy router scripts (config/transport/traffic/health/schedulers)
2. Verify `TEST SENDOK=1`, `TRAFFIC SENDOK=1`, `HEALTH SENDOK=1`
3. Deploy Apps Script ingest + delta processor + summary updates
4. Create triggers for processor and daily summary
5. Run backfill for today from raw logs
6. Refresh dashboard and validate Sheet Health

## Acceptance Criteria
- Router Status fresh within 15 min
- VPN/Health fresh within 15 min
- Raw traffic rows increasing at expected cadence
- Delta rows generated with no negative deltas
- Daily summary includes ISP + all four sites
- Telegram/Email daily summary shows enhanced block
