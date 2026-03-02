# MikroTik Pro Monitoring Scripts (RB951 safe, RouterOS 6.49.19)

Use file: `mikrotik/MTK_PRO_SCRIPTS.rsc`

## Import Steps
1. Winbox/WebFig → **Files** → upload `MTK_PRO_SCRIPTS.rsc`
2. Terminal:
   - `/import file-name=MTK_PRO_SCRIPTS.rsc`
3. Edit config values in script `MTK_CONFIG`:
   - `MTKURL`
   - `MTKTOKEN`
   - `MTKSITE`
   - `MTKWANIF`
   - `MTKLANIF` (usually `bridge1`)
   - `MTKGWIP`
   - `MTKRDPQUEUE`
4. Run:
   - `/system script run MTK_CONFIG`
   - `/system script run MTK_MONITOR_CORE`

## Important (common mistake)
- `MTK_PRO_SCRIPTS.rsc` is a file, not a script name.
- Do **not** run: `/system script run MTK_PRO_SCRIPTS.rsc`
- Correct flow is always:
   - upload file
   - `/import file-name=MTK_PRO_SCRIPTS.rsc`
   - then run created scripts like `MTK_CONFIG`
- RouterOS script variable names do not support `_` reliably, so config variables are now underscore-free internally.

## If you already got syntax/no-such-item errors
Run these commands, then import again:
```routeros
/system scheduler remove [find where name~"MTK_SCH_"]
/system script remove [find where name~"MTK_"]
/system script remove [find where invalid]
/import file-name=MTK_PRO_SCRIPTS.rsc
/system script print where name~"^MTK_"
/system script run MTK_CONFIG
/system script run MTK_MONITOR_CORE
```

## What runs automatically
- `MTK_MONITOR_CORE` every `2m` (light-load live telemetry)
- `MTK_MONITOR_QOS` every `10m`
- `MTK_MONITOR_SECURITY` every `15m`
- `MTK_LOG_PUSH` every `2m` (deduplicated important logs)

## New data in Google Sheets
- Top 5 active hotspot users with usage are pushed in live payload (`top5_users`).
- Detailed router log entries are saved in new sheet: `ROUTER_LOG_DETAILS`.
- WAN/LAN byte counters are now pushed (`isp_rx`,`isp_tx`,`lan_rx`,`lan_tx`) for better trend and utilization.
- Data coverage and missing-fields report is saved in `DATA_AUDIT` (run menu: `📋 Build Data Audit`).

## Safety profile
- No heavy per-connection analytics
- No L7 inspection
- Lightweight snapshots and counters
- Top users cache refresh every ~10m (not every cycle) for lower CPU load
- Suitable for RouterOS 6.49.19 on RB951 (128MB RAM)

## Recommended production flow
1. Import script and run `MTK_CONFIG` once.
2. Verify one live push manually: `/system script run MTK_MONITOR_CORE`.
3. Check Google Sheet updates in `RAW_EVENTS`, `STATE_LATEST`, `ROUTER_LOGS`, `ROUTER_LOG_DETAILS`.
4. Wait 2-3 monitoring cycles so trend analytics can calculate Mbps from byte deltas.
5. Build reports from Apps Script menu:
   - `📋 Build Data Audit`
   - `📊 Rebuild Dashboard`
   - `📡 Send Full Status`

## Remove schedulers (rollback)
```routeros
/system scheduler remove [find where name~"MTK_SCH_"]
```

## Remove scripts (rollback)
```routeros
/system script remove [find where name~"MTK_"]
```

## If `status: failed` appears on `MTK_MONITOR_CORE`
If Google Sheet/GAS data is still updating, this is usually a redirect-response quirk on RouterOS 6 fetch (not a real send failure).

For some RouterOS 6.49.19 builds, `output=none` and URL-query mode can fail with special characters. This pack uses POST with explicit `output=user`.

Run quick transport checks on router:
```routeros
/system clock print
/ip dns print
/ping 8.8.8.8 count=3
/tool fetch url="https://script.google.com" mode=https check-certificate=no keep-result=no
/tool fetch url="https://script.google.com/macros/s/AKfycbx9-NRt1Cdj2kR4nijgH2aaGjfLHrxdMk6CgAcNV0DG3yhy82iDPBlJGgrJ5D_c_yn6/exec" mode=https check-certificate=no keep-result=no
```
If last fetch fails, issue is router-to-Google HTTPS path (DNS/firewall/ISP TLS filtering), not script syntax.

Manual test (POST mode):
```routeros
:global MTKURL; :global MTKTOKEN; :global MTKSITE
:local r [/system identity get name]
:local d ("token=".$MTKTOKEN."&type=log&site=".$MTKSITE."&router=".$r."&msg=mtk_manual_test")
/tool fetch url=$MTKURL mode=https check-certificate=no http-method=post http-data=$d output=user keep-result=no
```
