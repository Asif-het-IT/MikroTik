# het quick reference

## key urls
- worker: `https://mikrotik-monitor-proxy.hetgraphic17.workers.dev`
- apps script exec: `https://script.google.com/macros/s/AKfycbx40IW46YtUHZ8_YTLMnU48VIRZwnyqhgVFRJNutKKLZ8MrucMBTxP9yfqf_Dk6_g1O/exec`
- status via worker: `...?token=MONITOR_TOKEN_2026&admin=status`

## key payload types
- `traffic`
- `live`
- `vpn`
- `users`
- `usage`
- `routerlog`
- `change`
- `iface` (optional)
- `rdp` (manual/external)
- `alert` (manual/external)

## key router scripts
- `het_CONFIG`
- `het_HTTP_SEND`
- `het_PUSH_LIVE`
- `het_VPN_CHECK`
- `het_PUSH_TRAFFIC`
- `het_PUSH_USERS`
- `het_PUSH_USAGE`
- `het_PUSH_ROUTERLOG`
- `het_PUSH_CHANGE`

## key apps script triggers
- `runDashboardRefresh`
- `runAlertCycle`
- `runDailyReport`
- `runCommandCycle`
- `runRuntimeHealthCheck`
- `runMaintenanceCycle`

## key admin routes
- `?admin=status&token=...`
- `?admin=verifytriggers&token=...`
- `?admin=runtimehealth&token=...`
- `?admin=maintenance&token=...`
- `?admin=refreshtopusers&token=...`
- `?admin=topusers&period=daily&limit=20&token=...`
- `?admin=runmonthlytopusers&token=...`

## key telegram commands
- `/health`
- `/traffic`
- `/alerts`
- `/users`
- `/report`
- `/status`
- `/ping`
- `/tgdebug`

## fast troubleshooting commands

### router check
```routeros
/system script print without-paging where name~"^het_"
/system scheduler print without-paging where name~"^het_"
/log print without-paging where message~"het_HTTP|FAIL|error"
```

### worker status check (powershell)
```powershell
$u='https://mikrotik-monitor-proxy.hetgraphic17.workers.dev?token=MONITOR_TOKEN_2026&admin=status'
$o=Invoke-RestMethod -Uri $u -Method Get -TimeoutSec 90
$s=$o.upstream | ConvertFrom-Json
$s.sheets.'Router Status'.topRow
```

### runtime health check (powershell)
```powershell
$u='https://mikrotik-monitor-proxy.hetgraphic17.workers.dev?token=MONITOR_TOKEN_2026&admin=runtimehealth'
$o=Invoke-RestMethod -Uri $u -Method Get -TimeoutSec 90
$s=$o.upstream | ConvertFrom-Json
$s.runtimeHealth
```
