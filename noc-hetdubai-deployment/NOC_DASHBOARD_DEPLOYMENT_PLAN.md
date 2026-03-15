# NOC Dashboard Deployment Package

Deployment target:
- Subdomain: `noc.hetdubai.com`
- Document root: `/home/hetdubai/noc`
- Hosting type: shared cPanel

## A. Deployment plan for noc.hetdubai.com
1. Keep existing backend architecture unchanged:
   - MikroTik Router -> Cloudflare Worker -> Apps Script -> Google Sheets/API
2. Add only a thin web layer in cPanel document root.
3. Use server-side proxy (`api/proxy.php`) to read Apps Script JSON securely.
4. Frontend remains read-only and consumes proxy JSON.
5. Auto-refresh every 30s with no write-back actions.
6. Keep router load unchanged (no new polling from router side).
7. Rollout in 3 versions:
   - Version 1: simple live dashboard with core cards + alerts + runtime.
   - Version 2: improved enterprise UX and top-users daily/monthly.
   - Version 3: advanced NOC view with richer charts, report archive cards, optional device mapping.

## B. Recommended folder/file structure under /home/hetdubai/noc
```text
/home/hetdubai/noc
├─ index.html
├─ .htaccess
├─ config.js
├─ api/
│  ├─ proxy.php
│  └─ .htaccess
├─ config/
│  ├─ app.php
│  └─ .htaccess
└─ assets/
   ├─ css/
   │  └─ style.css
   ├─ js/
   │  ├─ app.js
   │  ├─ api.js
   │  ├─ render.js
   │  └─ charts.js
   └─ img/
```

## C. Required frontend files
- `index.html`: main dashboard layout and sections.
- `assets/css/style.css`: dark modern NOC style, responsive card/table system.
- `config.js`: public runtime settings (refresh interval, API base URL).
- `assets/js/api.js`: fetch wrapper with timeout and no-store behavior.
- `assets/js/render.js`: UI rendering for cards/tables/sections.
- `assets/js/charts.js`: lightweight canvas charts for top users.
- `assets/js/app.js`: bootstrap + auto-refresh orchestration.
- `api/proxy.php`: secure upstream bridge to Apps Script.
- `config/app.php`: secret storage (Apps Script exec URL + token).

## D. JSON endpoints to use
Use existing Apps Script API only (no backend redesign):

1. Core status snapshot (source of truth for most dashboard blocks)
- Upstream: `GET <APPS_SCRIPT_EXEC_URL>?admin=status&token=<MONITOR_TOKEN>`
- Used for:
  - live router status
  - VPN status
  - CPU/memory
  - active users
  - public IP
  - traffic/interface snapshot
  - alerts + active incidents
  - sheet health
  - runtime health
  - trigger integrity

2. Top users (daily)
- Upstream: `GET <APPS_SCRIPT_EXEC_URL>?admin=topusers&period=daily&limit=10&token=<MONITOR_TOKEN>`

3. Top users (monthly)
- Upstream: `GET <APPS_SCRIPT_EXEC_URL>?admin=topusers&period=monthly&limit=10&token=<MONITOR_TOKEN>`

Web frontend should call only:
- `/api/proxy.php?view=status`
- `/api/proxy.php?view=topusers&period=daily&limit=10`
- `/api/proxy.php?view=topusers&period=monthly&limit=10`

## E. Page/component design
Sections:
1. Core Health
- Router status, VPN status, CPU, memory, active users, public IP, IPsec, sheet count.

2. Incidents / Alerts
- Critical/High/Medium summary cards.
- Recent alerts table.

3. Traffic
- WAN running state.
- WAN total + interface/branch traffic cards.

4. Users
- Daily top users chart + table.
- Monthly top users chart + table.
- Optional device mapping display using preferredName/comment/hostname from top users payload.

5. Reports
- Daily report section: daily top-users load and current active users summary.
- Monthly report section: monthly top-users summary.

6. Runtime Health
- Overall runtime status, trigger integrity, timezone/report-time, cycle table.

## F. Auto-refresh design
- Default interval: 30 seconds.
- Method: `setInterval` with parallel API calls (`status + daily + monthly`).
- Safety controls:
  - request timeout: 10s
  - cache disabled (`cache: no-store`)
  - manual Refresh button
  - API health indicator in footer
- Failure behavior:
  - keep old rendered data visible
  - update health text with error state

## G. Security considerations for shared hosting
1. Never expose monitor token in browser JS.
2. Keep secrets in `config/app.php` (server-side only).
3. Block access to config directory using `config/.htaccess` (`Deny from all`).
4. Disable directory listing (`Options -Indexes`).
5. Add security headers from root `.htaccess`.
6. Force HTTPS at subdomain level via cPanel SSL + redirect.
7. Keep dashboard read-only; no admin actions from frontend.
8. Keep proxy restricted to safe views (`status`, `topusers`).

## H. Final deployment steps in cPanel
1. Open cPanel -> File Manager.
2. Go to `/home/hetdubai/noc`.
3. Upload all files from `noc-root/` into this path.
4. Edit `config/app.php`:
   - set `NOC_ENDPOINT` to Apps Script `/exec` URL
   - set `NOC_TOKEN` to monitor token
5. Verify `config/.htaccess` exists and blocks public access.
6. Ensure SSL is active for `noc.hetdubai.com`.
7. Browse `https://noc.hetdubai.com`.
8. Click `Refresh Now` and check cards/tables populate.

## I. Validation checklist after upload
1. Page opens successfully on desktop + mobile.
2. `Last refresh` timestamp updates.
3. Core cards show live values (router, VPN, CPU, memory, active users, public IP).
4. Alert summary + recent alert rows appear.
5. Traffic cards show WAN/interface values.
6. Daily/monthly top users tables populate.
7. Runtime health + trigger integrity are visible.
8. `https://noc.hetdubai.com/config/app.php` is blocked (403/denied).
9. No token visible in page source/devtools network query strings from browser.
10. API health in footer shows healthy under normal operation.

## J. Recommended future enhancements
1. Add historical trend mini-charts from dedicated read-only timeseries endpoints.
2. Add per-site filter if multi-site rollout begins.
3. Add NOC wallboard mode (large-screen auto-cycle view).
4. Add report archive widget using `Reports Output` sheet read endpoint.
5. Add role-based access (Basic Auth or cPanel password protect).
6. Add maintenance banner mode for planned downtime windows.

## Deployment-ready version plan
Version 1 (Simple working live dashboard)
- Core Health + Alerts + Runtime Health
- Basic traffic cards
- 30s auto-refresh
- Secure proxy

Version 2 (Enterprise improved dashboard)
- Better card hierarchy and color states
- Daily/monthly top users table + charts
- Improved API health indicators
- Mobile polish and operations-friendly spacing

Version 3 (Advanced NOC dashboard)
- Extended traffic charting and trend slices
- Daily/monthly report widgets with archive links
- Optional device mapping and MAC comment richness
- Optional wallboard mode and advanced filters
