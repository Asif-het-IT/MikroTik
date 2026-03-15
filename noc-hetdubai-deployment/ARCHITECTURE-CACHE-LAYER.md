# NOC Dashboard - Centralized Cache Architecture

## Problem Statement

**Current (Broken) Architecture:**
```
Browser 1 → fetch status → Apps Script
Browser 2 → fetch status → Apps Script
Browser 3 → fetch status → Apps Script
...
```

Every user opening the dashboard triggers a full backend sync cycle.

**Issues:**
- Multiple simultaneous users = multiple simultaneous API calls to Apps Script
- Each API call takes 30-90 seconds (timeout handling)
- Repeated data processing
- Poor scalability
- High backend load
- User experience: slow page loads

---

## Solution: Centralized Cache Layer

**New (Correct) Architecture:**
```
Routers
   ↓
Cloudflare Worker
   ↓
Google Apps Script (Collector)
   ↓
Google Sheets (Real-time Data)
   ↓
┌─────────────────────────────────────┐
│  SYNC ENGINE (runs on schedule)     │
│  /api/sync.php                      │
│  Triggered by: cron every 5 minutes │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│  CACHE STORAGE                      │
│  /api/cache/dashboard.json          │
│  (read-only, fast access)           │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│  READ-ONLY API                      │
│  /api/cached-api.php                │
│  (returns cached snapshot)          │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│  WEB DASHBOARD (Multiple Users)     │
│  Loads cache every 15-30 seconds    │
│  NO sync operations triggered       │
└─────────────────────────────────────┘
```

---

## Design Principles

1. **Separation of Concerns**
   - Sync Engine: Heavy lifting (fetch, process, store)
   - Cache: Fast read-only access
   - Dashboard: Display only (no processing)

2. **Single Source of Truth**
   - `/api/cache/dashboard.json` is the only data source users read from
   - All users read the same cached snapshot
   - Consistency guaranteed

3. **Scheduled Updates**
   - Sync only happens at fixed intervals
   - Predictable backend load
   - No per-user triggers

4. **Performance**
   - Dashboard page load: < 1 second (reads local JSON)
   - Auto-refresh: < 500ms (cached file read)
   - Backend: Only 1 fetch per 5 minutes (not per user)

5. **Scalability**
   - 1 user opening dashboard = no extra backend load
   - 100 users opening dashboard = same backend load (1 sync every 5 min)
   - Linear cost scaling based on data refresh frequency, not user count

---

## System Components

### 1. Sync Engine (`/api/sync.php`)

**Purpose:** Central data collector that runs on schedule

**Behavior:**
- Called every 5 minutes via cron
- Fetches data from Apps Script endpoints:
  - `?admin=status` (router/VPN/traffic/alerts/runtime/sheets)
  - `?admin=topusers&period=daily&limit=10`
  - `?admin=topusers&period=monthly&limit=10`
- Processes/validates data
- Merges into unified structure
- Writes to `/api/cache/dashboard.json`
- Returns status (success/failure)
- Logs operation

**Security:**
- Protected by secret token (`X-Sync-Token` header)
- Only callable from localhost or with valid token
- Prevents user-triggered sync operations
- Logs all sync attempts

**Idempotent:**
- Can be called multiple times without harm
- Failed sync doesn't overwrite good cache
- Atomic file operations (write to temp, then rename)

### 2. Cache Storage (`/api/cache/dashboard.json`)

**Purpose:** Cached snapshot of all dashboard data

**Structure:**
```json
{
  "meta": {
    "version": "1.0",
    "timestamp": "2026-03-11T15:30:45Z",
    "lastSync": "2026-03-11T15:30:45Z",
    "nextSync": "2026-03-11T15:35:00Z",
    "syncSuccess": true,
    "syncDuration": 2.345
  },
  "status": {
    "dashboard": { ... },
    "runtimeHealth": { ... },
    "triggerIntegrity": { ... },
    "timeFmt": "2026-03-11 15:30:45",
    "dailyReportTime": "22:00",
    "sheets": { ... }
  },
  "topDaily": {
    "rows": [ ... ]
  },
  "topMonthly": {
    "rows": [ ... ]
  }
}
```

**Properties:**
- Written atomically (temp file + rename)
- Readable by all users
- Cached by web servers (can add cache headers)
- Can be statically served or via PHP

### 3. Cached API (`/api/cached-api.php`)

**Purpose:** Fast read-only endpoint for dashboard

**Behavior:**
- Reads `/api/cache/dashboard.json`
- Returns JSON with cache headers
- Optional: Add compression, CORS headers
- Minimal PHP overhead
- Can be CPU-cached

**Endpoints:**
- `GET /api/cached-api.php` → Returns full cached state
- `GET /api/cached-api.php?view=status` → Returns only status
- `GET /api/cached-api.php?view=topusers` → Returns only top users

### 4. Dashboard (`index.html`, `assets/js/`)

**Changes:**
- Load data from `/api/cached-api.php` (not `/api/proxy.php`)
- Auto-refresh every 15-30 seconds (reads cache)
- Manual refresh: reload cache (no backend sync)
- Show cache age in footer: "Last sync: 2 minutes ago"

**Behavior:**
- User opens dashboard → loads index.html (2KB)
- Fetch `/api/cached-api.php` → receives cached JSON (50-100KB)
- Renders dashboard (instant)
- Auto-refresh every 15 seconds → re-fetches cache (very fast)
- NO backend processing triggered

---

## Sync Schedule

### Recommended Timing

| Data Type | Interval | Reason |
|-----------|----------|--------|
| Router Telemetry | 5 minutes | Live link status |
| Traffic Counters | 5 minutes | User bandwidth patterns |
| User Usage Stats | 5 minutes | Top users shifts |
| Alerts | 5 minutes | Incident detection |
| System Health | 10 minutes | Performance trends |
| Reports | Hourly | Aggregated data |
| Sheet Health | 10 minutes | Data pipeline status |

### Cron Jobs

**Every 5 minutes:**
```bash
*/5 * * * * curl -s -X POST http://localhost/noc/api/sync.php \
  -H "X-Sync-Token: SYNC_SECRET_TOKEN" \
  -d "schedule=router" > /dev/null 2>&1
```

**Every 10 minutes:**
```bash
*/10 * * * * curl -s -X POST http://localhost/noc/api/sync.php \
  -H "X-Sync-Token: SYNC_SECRET_TOKEN" \
  -d "schedule=health" > /dev/null 2>&1
```

---

## Data Flow Example

**Timeline: User opens dashboard at 15:30:42**

```
15:30:00 - Cron triggers sync.php
15:30:02 - sync.php fetches from Apps Script
15:30:04 - sync.php processes data
15:30:05 - sync.php writes cache/dashboard.json
15:30:05 - Cron completes, next run scheduled 15:35:00

15:30:42 - User opens browser, navigates to https://noc.hetdubai.com/
15:30:43 - Browser loads index.html (2KB)
15:30:43 - JavaScript calls fetch("/api/cached-api.php")
15:30:44 - Server returns cached JSON (50KB, instant)
15:30:44 - Dashboard renders (instant, no processing)
15:30:44 - User sees live data (37 seconds old, acceptable)

15:30:55 - Auto-refresh (15 second interval)
15:30:55 - Browser calls fetch("/api/cached-api.php")
15:30:56 - Server returns cached JSON (instant)
15:30:56 - Dashboard updates (instant)

15:35:00 - Next scheduled sync runs
15:35:05 - Cache updated with fresh data
```

---

## Performance Metrics

### Current Implementation (Per-User Fetching)
- Dashboard load: 45-90 seconds (timeout issues)
- Auto-refresh: 15-90 seconds (variable)
- Backend calls per second at peak: N (one per user)
- Timeout failures: Common
- Scalability: Poor (linear increase with users)

### New Implementation (Cached)
- Dashboard load: < 1 second (reads local JSON)
- Auto-refresh: < 500ms (cached file read)
- Backend calls per second: ~1 every 5 minutes (0.003 per second)
- Timeout failures: Impossible (no per-user backend calls)
- Scalability: Excellent (independent of user count)

**Example: 50 users open dashboard simultaneously**
- Current: 50 parallel API calls to Apps Script → timeouts, slow responses
- New: 0 additional backend load → all read same cache

---

## Security Considerations

1. **Sync Engine Protection**
   - Secret token (X-Sync-Token header)
   - Only accepts POST requests
   - Only callable from localhost or authorized IPs
   - Logs all attempts

2. **Cache File Permissions**
   - 644 (readable by web server, not writable by users)
   - Cannot be modified by user requests
   - Write-protect via PHP (only sync.php writes)

3. **API Access Control**
   - cached-api.php is public (read-only)
   - No sensitive data exposed (monitor token stays server-side)
   - CORS headers if needed

4. **Cache Consistency**
   - Atomic writes (write to temp, rename)
   - No partial data served
   - Version check in meta

---

## File Structure

```
/home/hetdubai/noc/
├── index.html                    (Dashboard)
├── config.js                     (Client config)
├── config/
│   └── app.php                   (Server secrets)
├── api/
│   ├── proxy.php                 (Original upstream bridge - DEPRECATED)
│   ├── sync.php                  (NEW: Sync engine)
│   ├── cached-api.php            (NEW: Cache API)
│   ├── cache/                    (NEW: Cache directory)
│   │   ├── dashboard.json        (Central cached snapshot)
│   │   └── .htaccess             (Prevent direct browser access)
│   └── logs/                     (NEW: Sync logs)
│       └── sync.log              (Sync operation logs)
├── assets/
│   ├── css/
│   │   └── style.css             (Same as before)
│   └── js/
│       ├── api.js                (MODIFIED: Use cached-api.php)
│       ├── app.js                (MODIFIED: Refresh logic)
│       ├── render.js             (Same as before)
│       └── charts.js             (Same as before)
├── .htaccess                     (Restrict config/, protect cache/)
└── cron-setup.sh                 (NEW: Cron configuration script)
```

---

## Implementation Checklist

- [ ] Create `/api/sync.php` (sync engine)
- [ ] Create `/api/cached-api.php` (cache API)
- [ ] Create `/api/cache/` directory
- [ ] Initialize `/api/cache/dashboard.json` (empty structure)
- [ ] Update `/assets/js/api.js` (use cached-api.php)
- [ ] Update `/assets/js/app.js` (cache age display)
- [ ] Update `/assets/js/render.js` (show sync status)
- [ ] Create `/.htaccess` (protect cache from direct access)
- [ ] Create `/cron-setup.sh` (cron job configuration)
- [ ] Test sync.php manually
- [ ] Test cached-api.php manually
- [ ] Deploy to cPanel
- [ ] Set up cron jobs
- [ ] Monitor first sync cycle

---

## Next Steps

1. Create sync engine that fetches from Apps Script
2. Implement cache storage with atomic writes
3. Update dashboard to read from cache
4. Update refresh logic (read cache, not backend)
5. Set up cron jobs on cPanel
6. Monitor and optimize

This architecture will make your NOC dashboard:
✅ Fast (< 1s load time)
✅ Scalable (100+ users, same backend load)
✅ Reliable (no timeout errors)
✅ Professional (proper separation of concerns)
✅ Maintainable (central sync logic)

