# NOC Dashboard - Deployment Guide for Cache Architecture

## Overview

This guide shows how to deploy the **production-grade centralized cache architecture** for the NOC dashboard.

**Key Change:** The dashboard no longer triggers backend syncs. Instead, a **central sync engine** updates a cached snapshot every 5 minutes, and users simply read that cache.

---

## Architecture

```
Routers → Cloudflare Worker → Apps Script → Google Sheets
                                              ↓
                                    Sync Engine (cron)
                                    /api/sync.php
                                              ↓
                                    Cache Storage
                                    /api/cache/dashboard.json
                                              ↓
                                    Read-Only API
                                    /api/cached-api.php
                                              ↓
                              Browser Dashboard
                      (Multiple users, instant loads)
```

---

## Pre-Deployment Checklist

- [ ] Apps Script deployment ID confirmed: `AKfycbx40IW46YtUHZ8_YTLMnU48VIRZwnyqhgVFRJNutKKLZ8MrucMBTxP9yfqf_Dk6_g1O`
- [ ] Monitor token available: `MONITOR_TOKEN_2026`
- [ ] cPanel SSH access available
- [ ] cPanel cron job access available
- [ ] `/home/hetdubai/noc` directory exists

---

## Step 1: Organize New Files

All files should be in `/noc-hetdubai-deployment/noc-root/`:

```
noc-root/
├── index.html                 (Dashboard - no changes)
├── config.js                  (UPDATED - uses cached-api.php)
├── config/
│   └── app.php                (Server secrets - no changes)
├── api/
│   ├── sync.php               (NEW - Central sync engine)
│   ├── cached-api.php         (NEW - Read-only cache API)
│   ├── cache/
│   │   └── .htaccess          (NEW - Protect cache files)
│   ├── logs/                  (NEW - Sync logs)
│   └── [keep proxy.php]       (Old endpoint - can deprecate)
├── assets/
│   ├── css/style.css          (No changes)
│   └── js/
│       ├── api.js             (UPDATED - Use cached API)
│       ├── app.js             (UPDATED - Cache refresh logic)
│       ├── render.js          (No changes)
│       └── charts.js          (No changes)
└── cron-setup.sh              (NEW - Cron configuration guide)
```

---

## Step 2: Upload Files to cPanel

Using FTP or cPanel File Manager:

### 2.1 Delete old cache

If upgrading from old system:
```bash
rm -rf /home/hetdubai/noc/api/cache/*
```

### 2.2 Upload new/updated files

```
api/sync.php                   → /home/hetdubai/noc/api/sync.php
api/cached-api.php            → /home/hetdubai/noc/api/cached-api.php
api/cache/.htaccess           → /home/hetdubai/noc/api/cache/.htaccess
config.js                     → /home/hetdubai/noc/config.js
assets/js/api.js              → /home/hetdubai/noc/assets/js/api.js
assets/js/app.js              → /home/hetdubai/noc/assets/js/app.js
```

### 2.3 Set permissions

Via SSH:
```bash
cd /home/hetdubai/noc

# Sync engine needs to be readable/executable
chmod 644 api/sync.php

# Cache directory needs to be writable by web server
mkdir -p api/cache api/logs
chmod 755 api/cache
chmod 755 api/logs

# Cache and log files writeable by web server
chmod 666 api/cache/*.json 2>/dev/null
chmod 666 api/logs/*.log 2>/dev/null
```

---

## Step 3: Configure Environment (Optional but Recommended)

### 3.1 Set sync token via environment variable

In cPanel or `.htaccess`:
```
SetEnv NOC_SYNC_TOKEN "sync_secret_2026"
```

**Or** edit `api/sync.php` line 24:
```php
'secret_token' => 'sync_secret_2026',
```

### 3.2 Allow remote sync (optional)

If cron jobs run from external server instead of localhost:
```php
// In sync.php, uncomment this line:
// SetEnv NOC_ALLOW_REMOTE_SYNC "1"
```

---

## Step 4: Test Sync Engine Manually

### 4.1 SSH into server

```bash
ssh user@hetdubai.com
cd /home/hetdubai/noc
```

### 4.2 Trigger sync manually

```bash
curl -X POST https://noc.hetdubai.com/api/sync.php \
  -H "X-Sync-Token: sync_secret_2026" \
  -d "test=1"
```

**Expected response:**
```json
{
  "status": "success",
  "timestamp": "2026-03-11T15:30:45+00:00",
  "duration": 2.345,
  "cached": true,
  "errors": [],
  "next_sync": "2026-03-11T15:35:00+00:00"
}
```

### 4.3 Check cache was created

```bash
ls -lh api/cache/dashboard.json
cat api/cache/dashboard.json | jq .meta
```

**Expected output:**
```
{
  "version": "1.0",
  "timestamp": "2026-03-11T15:30:45+00:00",
  "lastSync": "2026-03-11T15:30:45+00:00",
  "cacheAge": 0,
  "syncSuccess": true,
  "syncDuration": 2.345,
  "errors": []
}
```

### 4.4 Test cached API endpoint

```bash
curl https://noc.hetdubai.com/api/cached-api.php | jq .meta
```

Should return the same cache metadata.

---

## Step 5: Set Up Cron Jobs

### 5.1 Via cPanel

1. Log in to cPanel
2. Go to **Advanced → Cron Jobs**
3. Add three cron jobs with these schedules:

**Cron Job 1: Every 5 minutes**
```
*/5 * * * *
```
Command:
```
curl -s -X POST https://noc.hetdubai.com/api/sync.php \
  -H "X-Sync-Token: sync_secret_2026" \
  -d "schedule=5min" > /dev/null 2>&1
```

**Cron Job 2: Every 10 minutes**
```
*/10 * * * *
```
Command:
```
curl -s -X POST https://noc.hetdubai.com/api/sync.php \
  -H "X-Sync-Token: sync_secret_2026" \
  -d "schedule=10min" > /dev/null 2>&1
```

**Cron Job 3: Hourly** (for reports)
```
0 * * * *
```
Command:
```
curl -s -X POST https://noc.hetdubai.com/api/sync.php \
  -H "X-Sync-Token: sync_secret_2026" \
  -d "schedule=hourly" > /dev/null 2>&1
```

### 5.2 Using command line (if SSH available)

```bash
# View current cron jobs
crontab -l

# Edit cron jobs
crontab -e
```

Add these lines:
```
*/5 * * * * curl -s -X POST https://noc.hetdubai.com/api/sync.php -H "X-Sync-Token: sync_secret_2026" -d "schedule=5min" > /dev/null 2>&1
*/10 * * * * curl -s -X POST https://noc.hetdubai.com/api/sync.php -H "X-Sync-Token: sync_secret_2026" -d "schedule=10min" > /dev/null 2>&1
0 * * * * curl -s -X POST https://noc.hetdubai.com/api/sync.php -H "X-Sync-Token: sync_secret_2026" -d "schedule=hourly" > /dev/null 2>&1
```

---

## Step 6: Verify Dashboard Works

### 6.1 Open browser

Navigate to: `https://noc.hetdubai.com/`

### 6.2 Check footer

Should show:
- **Last updated:** "2 minutes ago" (not "waiting...")
- **Sync status:** "● in-sync" (green)
- **API status:** "operational"

### 6.3 Hard refresh (clear cache)

Press **Ctrl+Shift+Delete** (or Cmd+Shift+Delete on Mac)

The page should load **instantly** (< 1 second)

### 6.4 Check auto-refresh

Wait 15 seconds. Data should update without any delay.

### 6.5 Manual refresh

Click **REFRESH** button. Should complete instantly.

---

## Step 7: Monitor Sync Operations

### 7.1 View sync logs

Via SSH:
```bash
tail -f /home/hetdubai/noc/api/logs/sync.log
```

Wait for next cron job (max 10 minutes). Should see:
```
[2026-03-11 15:30:00] START: Sync initiated by 127.0.0.1
[2026-03-11 15:30:00] Fetching data from Apps Script endpoints...
[2026-03-11 15:30:01] Fetching: status
[2026-03-11 15:30:04] ✓ Status fetched successfully
[2026-03-11 15:30:05] Fetching: topusers_daily
[2026-03-11 15:30:06] ✓ Top users daily fetched successfully
[2026-03-11 15:30:07] Sync successful
[2026-03-11 15:30:07] Cache file written: /home/hetdubai/noc/api/cache/dashboard.json (2048 bytes)
[2026-03-11 15:30:07] END: Sync completed in 7.234s
```

### 7.2 Monitor cache freshness

```bash
# Check cache age (should be < 5 minutes)
curl -s https://noc.hetdubai.com/api/cached-api.php | jq .meta.cacheAge

# Check last sync time
curl -s https://noc.hetdubai.com/api/cached-api.php | jq .meta.lastSync
```

### 7.3 Set up log rotation (optional)

Add to crontab:
```bash
# Weekly: Archive old logs
0 0 * * 0 gzip /home/hetdubai/noc/api/logs/sync.log && mv /home/hetdubai/noc/api/logs/sync.log.gz /home/hetdubai/noc/api/logs/sync-$(date +\%Y\%m\%d).log.gz
```

---

## Step 8: Performance Verification

### 8.1 Test with multiple users

Open dashboard in 3+ browser windows simultaneously.

**Expected:**
- All pages load instantly (< 1 second each)
- No timeout errors
- No repeated backend API calls in sync logs

**Compare to old system:**
- Old: Multiple API calls visible, timeouts possible
- New: Single cache read visible, instant loading

### 8.2 Measure page load time

Using Chrome DevTools:
1. Press F12 (Developer Tools)
2. Go to **Network** tab
3. Hard refresh (Ctrl+Shift+R)
4. Check Total time should be < 1 second

**Breakdown:**
- HTML download: ~2KB (200ms)
- CSS/JS download: ~50KB (500ms)
- API cache read: ~100KB (100ms)
- Total: < 1 second

### 8.3 Check concurrent user impact

Monitor `/api/logs/sync.log` while multiple users refresh:
- Sync logs should show only **one sync operation per 5 minutes**
- Not one per user

---

## Step 9: Optimization (Optional)

### 9.1 Enable caching headers

Edit `api/cached-api.php`, add:
```php
// Cache for 60 seconds (dashboard refreshes every 15s anyway)
header('Cache-Control: public, max-age=60');
header('ETag: "' . md5_file(__DIR__ . '/cache/dashboard.json') . '"');
```

### 9.2 Enable gzip compression

In `.htaccess`:
```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE application/json
</IfModule>
```

Reduces 100KB JSON to ~20KB over the wire.

### 9.3 Monitor with external service

Use Uptime Robot or similar to:
- Check `/api/cached-api.php` every 60 seconds
- Alert if cache is > 10 minutes old
- Alert if HTTP response is not 200

---

## Troubleshooting

### Problem: "Cache not ready" error

**Cause:** Sync has never run

**Solution:**
1. Manually trigger sync: `curl -X POST https://noc.hetdubai.com/api/sync.php -H "X-Sync-Token: sync_secret_2026"`
2. Check logs: `tail /home/hetdubai/noc/api/logs/sync.log`
3. Verify permissions: `ls -la /home/hetdubai/noc/api/cache/`

### Problem: Cache is stale (> 10 minutes old)

**Cause:** Cron jobs not running

**Solution:**
1. Check cPanel Cron Jobs logs
2. Test manually: `curl -X POST https://noc.hetdubai.com/api/sync.php -H "X-Sync-Token: sync_secret_2026" -d "test=1"`
3. If manual sync works, verify cron script syntax
4. Check for any firewall issues blocking outbound HTTPS from cron

### Problem: Apps Script endpoint timeout

**Cause:** Backend slow

**Solution:**
1. This is no longer critical! Sync errors don't crash the dashboard
2. Stale cache is better than no cache
3. Check sync logs: `tail -f /home/hetdubai/noc/api/logs/sync.log`
4. If Apps Script is consistently timing out, increase timeout in `sync.php`

### Problem: Permission denied on cache write

**Cause:** Web server doesn't own cache directory

**Solution:**
```bash
mkdir -p /home/hetdubai/noc/api/cache
chmod 755 /home/hetdubai/noc/api/cache
```

Or ensure web server user has write access.

---

## Rollback (If Needed)

To revert to old system (per-user fetching):

1. Revert `config.js` to use `apiBase: "/api/proxy.php"`
2. Revert `assets/js/api.js` to old version
3. Revert `assets/js/app.js` to old version
4. Restart browser

But this will lose all performance benefits. **Not recommended.**

---

## Success Indicators

✅ **Everything working correctly when:**

1. Dashboard loads in < 1 second
2. Footer shows "Last sync: 3 minutes ago" (not "waiting...")
3. Auto-refresh (every 15s) completes instantly
4. Multiple users can open dashboard simultaneously without slowdown
5. Sync logs show one operation per 5 minutes (not per user)
6. No timeout errors in browser console
7. No stale cache warnings (cache age < 10 minutes)

---

## Support

If issues occur:

1. Check sync logs: `/home/hetdubai/noc/api/logs/sync.log`
2. Test sync manually: `curl -X POST https://noc.hetdubai.com/api/sync.php -H "X-Sync-Token: sync_secret_2026"`
3. Verify cache exists: `curl https://noc.hetdubai.com/api/cached-api.php`
4. Check permissions: `ls -la /home/hetdubai/noc/api/cache/`
5. Monitor Apps Script logs for errors

---

## Summary

**Old Architecture:**
- Each user → Apps Script call
- 90 second wait
- Multiple simultaneous calls
- Scalability: Poor

**New Architecture:**
- Central sync engine → Apps Script (every 5 min)
- Each user → Cache read (instant)
- All users read same snapshot
- Scalability: Excellent

**Result:** Production-grade NOC dashboard that scales to 100+ users.

