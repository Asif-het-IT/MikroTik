# Enterprise NOC System — Deployment Guide

**Version:** 2.0  
**Date:** 2026-03-11  
**Target:** Production at noc.hetdubai.com  

---

## Section 1️⃣ — Pre-Deployment Checklist

### Files Required

```
✓ api/core-engine.php          (550 lines)  ← Main sync engine
✓ api/enterprise-api.php       (200 lines)  ← Read-only cache API
✓ api/health.php               (150 lines)  ← Health monitoring
✓ cloudflare-worker/security-layer.js      ← Router gateway
✓ config.js                    (updated)    ← API configuration
✓ assets/js/api.js             (updated)    ← Cache-aware loading
✓ assets/js/app.js             (updated)    ← Health display
```

### Required Directories

```
/home/hetdubai/noc/api/cache/       (read/write for web server)
/home/hetdubai/noc/api/logs/        (read/write for web server)
```

### Required Environment Variables

```
NOC_SYNC_TOKEN = "sync_secret_2026"         ← Cron job auth
NOC_ENDPOINT = "https://..."                ← Apps Script (existing)
NOC_TOKEN = "MONITOR_TOKEN_2026"            ← Apps Script token (existing)
```

### Required Tools (Already Have)

```
✓ cPanel access
✓ SFTP or File Manager
✓ SSH terminal (optional but recommended)
✓ Browser for testing
```

---

## Section 2️⃣ — Step-by-Step Deployment

### PHASE 1: Upload Core Engine Files

**Method A: cPanel File Manager**

1. Login to cPanel → File Manager
2. Navigate to `/home/hetdubai/noc/api/`
3. Upload these files:
   - `core-engine.php`
   - `enterprise-api.php`
   - `health.php`

**Method B: SFTP (Recommended)**

```bash
sftp hetdubai@noc.hetdubai.com
cd /home/hetdubai/noc/api/
put core-engine.php
put enterprise-api.php
put health.php
chmod 644 core-engine.php
chmod 644 enterprise-api.php
chmod 644 health.php
quit
```

### PHASE 2: Create Cache & Logs Directories

**Via SSH (Best):**

```bash
ssh hetdubai@noc.hetdubai.com

# Create directories
mkdir -p /home/hetdubai/noc/api/cache
mkdir -p /home/hetdubai/noc/api/logs

# Set permissions (web server must write)
chmod 755 /home/hetdubai/noc/api/cache
chmod 755 /home/hetdubai/noc/api/logs

# Create .htaccess to protect cache
cat > /home/hetdubai/noc/api/cache/.htaccess << 'EOF'
<FilesMatch "\.json$">
    Deny from all
</FilesMatch>

<Files "cached-api.php">
    Allow from all
</Files>
EOF

chmod 644 /home/hetdubai/noc/api/cache/.htaccess
```

**Via cPanel File Manager:**

1. Navigate to `/home/hetdubai/noc/api/`
2. Create new folder: `cache`
3. Create new folder: `logs`
4. Right-click on cache → Permissions → Set to 755
5. Right-click on logs → Permissions → Set to 755
6. Create `cache/.htaccess` file with content above

### PHASE 3: Set Environment Variables

**Method A: cPanel**

1. cPanel → Advanced → Environment Variables
2. Add variable:
   ```
   Name: NOC_SYNC_TOKEN
   Value: sync_secret_2026
   ```

**Method B: .htaccess (if env vars not available)**

```apache
SetEnv NOC_SYNC_TOKEN sync_secret_2026
SetEnv NOC_ENDPOINT "https://script.google.com/macros/d/AKfycbx40IW46YtUHZ8_YTLMnU48VIRZwnyqhgVFRJNutKKLZ8MrucMBTxP9yfqf_Dk6_g1O/usercontent"
SetEnv NOC_TOKEN "MONITOR_TOKEN_2026"
```

Add to `/home/hetdubai/noc/.htaccess`

**Method C: PHP config.php (Alternative)**

```php
<?php
define('NOC_SYNC_TOKEN', 'sync_secret_2026');
define('NOC_ENDPOINT', 'https://script.google.com/...');
define('NOC_TOKEN', 'MONITOR_TOKEN_2026');
?>
```

Include in core-engine.php:
```php
require_once __DIR__ . '/../config/app.php';
```

---

### PHASE 4: Test Manual Sync

**Test API Endpoint:**

```bash
# Test 1: Health check (should be initializing first time)
curl -s https://noc.hetdubai.com/api/health.php | json_pp

# Test 2: Run manual sync
curl -X POST https://noc.hetdubai.com/api/core-engine.php \
  -H "X-Sync-Token: sync_secret_2026" \
  -H "Content-Type: application/json"
```

**Expected Response:**

```json
{
  "status": "success",
  "timestamp": "2026-03-11T14:35:00Z",
  "duration": 2.345,
  "alerts": 0,
  "topUsers": 10,
  "cacheFiles": 8,
  "message": "Enterprise NOC data synchronized successfully"
}
```

**If Error:**

```json
{
  "error": "Cache not ready",
  "status": "initializing"
}
```

This is normal first time. Cache files will be created on first successful sync.

### PHASE 5: Verify Cache Files Created

**Check what was created:**

```bash
ssh hetdubai@noc.hetdubai.com
ls -lah /home/hetdubai/noc/api/cache/

# Output should show:
# -rw-r--r-- dashboard.json
# -rw-r--r-- device-mapping.json
# -rw-r--r-- top-users-daily.json
# -rw-r--r-- top-users-monthly.json
# -rw-r--r-- alerts.json
# -rw-r--r-- health.json
# -rw-r--r-- daily-report.json
# -rw-r--r-- monthly-report.json
```

**Read cache content:**

```bash
cat /home/hetdubai/noc/api/cache/dashboard.json | head -c 500

# Should show JSON with meta, status, topDaily, etc.
```

### PHASE 6: Test Cache API

```bash
# Full response
curl -s https://noc.hetdubai.com/api/enterprise-api.php | json_pp | head -50

# Status only
curl -s "https://noc.hetdubai.com/api/enterprise-api.php?view=status" | json_pp

# Alerts only
curl -s "https://noc.hetdubai.com/api/enterprise-api.php?view=alerts" | json_pp

# Health only
curl -s "https://noc.hetdubai.com/api/enterprise-api.php?view=health" | json_pp
```

**Expected:** Each returns relevant cache portion with cache metadata

### PHASE 7: Update Dashboard Files

**Update `config.js`:**

```javascript
const CONFIG = {
  // API endpoint - now points to cache
  apiBase: '/api/enterprise-api.php',
  
  // Refresh every 15 seconds (cache reads are instant)
  refreshMs: 15000,
  
  // Timeout for cache reads (should be quick)
  requestTimeoutMs: 5000,
};
```

**Update `assets/js/api.js`:**

Rewrite to call `/api/enterprise-api.php` instead of proxy. See code example in architecture document.

**Update `assets/js/app.js`:**

Add cache age display in footer:

```javascript
function updateFooterWithCacheInfo(cacheAge) {
  const indicator = cacheAge < 300 ? '●' : cacheAge < 600 ? '◐' : '◯';
  const status = cacheAge < 300 ? 'in-sync' : cacheAge < 600 ? 'aging' : 'stale';
  
  document.getElementById('syncStatus').textContent = indicator + ' ' + status;
}
```

---

## Section 3️⃣ — Cron Job Setup

### Option A: cPanel Cron Manager (Easiest)

1. **Login to cPanel**
2. **Advanced → Cron Jobs**
3. **Email:** hetdubai@hetdubai.com
4. **Add New Cron Job:**

| Field | Value |
|-------|-------|
| Common Settings | Custom |
| Minute | */5 |
| Hour | * |
| Day | * |
| Month | * |
| Weekday | * |
| Command | `curl -X POST https://noc.hetdubai.com/api/core-engine.php -H "X-Sync-Token: sync_secret_2026"` |

5. **Add Cron Job**

### Option B: SSH Command Line

```bash
ssh hetdubai@noc.hetdubai.com

# Edit crontab
crontab -e

# Add this line:
*/5 * * * * curl -X POST https://noc.hetdubai.com/api/core-engine.php -H "X-Sync-Token: sync_secret_2026" >> /home/hetdubai/noc/api/logs/cron.log 2>&1

# Save and exit
# Crontab will auto-run now

# Verify it was added:
crontab -l
```

### Option C: Direct File Edit

```bash
ssh hetdubai@noc.hetdubai.com

# Backup current crontab
crontab -l > /tmp/crontab.backup

# Create new crontab entry
cat > /tmp/new_cron.txt << 'EOF'
# NOC System Sync - Every 5 minutes
*/5 * * * * curl -X POST https://noc.hetdubai.com/api/core-engine.php -H "X-Sync-Token: sync_secret_2026" >> /home/hetdubai/noc/api/logs/cron.log 2>&1

# Optional: Cleanup old logs - Every day at 2 AM
0 2 * * * find /home/hetdubai/noc/api/logs -type f -mtime +30 -delete
EOF

# Install new crontab
crontab /tmp/new_cron.txt

# Verify
crontab -l
```

---

## Section 4️⃣ — Monitoring & Verification

### Test Dashboard in Browser

```
https://noc.hetdubai.com
```

**Expected to see:**

1. ✅ Header loads quickly (< 1 second)
2. ✅ Router status shows (not loading spinner)
3. ✅ Top daily users displayed
4. ✅ Top monthly users displayed
5. ✅ Alerts section shows (with counts)
6. ✅ Footer shows cache age ("45s ago")
7. ✅ No console errors

### Check Sync Logs

```bash
ssh hetdubai@noc.hetdubai.com

# View latest syncs
tail -f /home/hetdubai/noc/api/logs/sync.log

# Output should show:
# [2026-03-11 14:35:00] === NOC CORE ENGINE START ===
# [2026-03-11 14:35:01] Step 1: Fetching data from Apps Script...
# [2026-03-11 14:35:02] ✓ Data fetched from Apps Script
# [2026-03-11 14:35:02] Step 2: Loading device mapping...
# [2026-03-11 14:35:02] ✓ Device mapping loaded and cached
# ...
# [2026-03-11 14:35:04] === NOC CORE ENGINE COMPLETE ===
```

### Monitor System Health

```bash
# Check health endpoint
curl -s https://noc.hetdubai.com/api/health.php | json_pp

# Check cache age
curl -s https://noc.hetdubai.com/api/enterprise-api.php | jq '._cache'

# Expected output:
# {
#   "age": 45,
#   "ageText": "45s ago",
#   "synced": "2026-03-11T14:35:00Z",
#   "freshness": "fresh"
# }
```

---

## Section 5️⃣ — Troubleshooting Guide

### Problem 1: Sync returns 403 Forbidden

**Cause:** Invalid sync token

**Solution:**
```bash
# Verify token in environment
grep NOC_SYNC_TOKEN /home/hetdubai/noc/.htaccess

# OR Check cPanel → Environment Variables

# Make sure cron command has correct token:
curl -X POST https://noc.hetdubai.com/api/core-engine.php \
  -H "X-Sync-Token: sync_secret_2026"  # ← Check this matches
```

### Problem 2: Cache not created

**Cause:** Directory permissions or Apps Script connection

**Solution:**
```bash
# Check directory permissions
ls -ld /home/hetdubai/noc/api/cache
# Output should show: drwxr-xr-x (755)

# Check if web server can write
touch /home/hetdubai/noc/api/cache/test.txt
rm /home/hetdubai/noc/api/cache/test.txt

# Test Apps Script connection manually:
curl "https://script.google.com/macros/d/AKfycbx40IW46YtUHZ8_YTLMnU48VIRZwnyqhgVFRJNutKKLZ8MrucMBTxP9yfqf_Dk6_g1O/usercontent?admin=status&token=MONITOR_TOKEN_2026"
```

### Problem 3: Dashboard shows "loading..." forever

**Cause:** API not returning data

**Solution:**
```bash
# Check if cache exists
ls -la /home/hetdubai/noc/api/cache/

# If files missing, run sync manually:
curl -X POST https://noc.hetdubai.com/api/core-engine.php \
  -H "X-Sync-Token: sync_secret_2026" \
  -v  # ← verbose to see what happens

# Check for errors in response
```

### Problem 4: Cron job not running

**Cause:** Syntax error or wrong permission

**Solution:**
```bash
# Check cron logs
tail -f /var/log/apache2/access.log | grep "core-engine"

# OR

# Check mail (cPanel sends error emails)
mail  # ← Read your email

# Test command manually:
curl -X POST https://noc.hetdubai.com/api/core-engine.php \
  -H "X-Sync-Token: sync_secret_2026"
  
# If this works, cron should work

# View active crons:
crontab -l

# Verify format is correct:
# */5 * * * * command
# ^^
# Must have TWO asterisks for every-5-min
```

---

## Section 6️⃣ — Performance Verification

### Load Testing

**Test 1: First-time cache hit**

```bash
time curl -s https://noc.hetdubai.com/api/enterprise-api.php > /dev/null

# Expected: < 200ms
```

**Test 2: Concurrent users**

```bash
# Simulate 10 concurrent users
for i in {1..10}; do
  curl -s "https://noc.hetdubai.com/api/enterprise-api.php?view=$RANDOM" &
done
wait

# All should complete instantly
```

**Test 3: Dashboard load time**

```bash
# Use browser DevTools:
# 1. Open https://noc.hetdubai.com
# 2. Press F12 → Network tab
# 3. Reload page
# 4. Check "DOMContentLoaded" time (should be < 1 sec)
```

---

## Section 7️⃣ — 24-Hour Monitoring Checklist

### First 24 Hours After Deployment

**Hour 1-2:**
- [ ] Dashboard loads at noc.hetdubai.com
- [ ] Data is displayed (not loading)
- [ ] Page refresh every 15 seconds
- [ ] Cache age updates

**Hour 2-4:**
- [ ] Cron job has run at least once
- [ ] Check sync.log for success messages
- [ ] All cache files created
- [ ] Health endpoint responding

**Hour 4-12:**
- [ ] Monitor hits at 5-min, 10-min, 15-min marks
- [ ] Verify cache age stays < 5 minutes
- [ ] No 503 or error codes
- [ ] Check /api/health.php status

**Hour 12-24:**
- [ ] Dashboard works for multiple users
- [ ] No timeout issues
- [ ] Sync logs clean (no errors)
- [ ] Performance metrics stable

### Daily Checks (First Week)

```bash
# Every morning, run this:

# 1. Check cron is working
tail -20 /home/hetdubai/noc/api/logs/sync.log | grep "COMPLETE"

# 2. Check cache freshness
curl -s https://noc.hetdubai.com/api/health.php | jq '.cache.status'
# Should return: "FRESH" or "AGING" (not "STALE")

# 3. Check alert count
curl -s https://noc.hetdubai.com/api/enterprise-api.php?view=alerts | jq '.alerts.total'

# 4. Dashboard browsing
# Open https://noc.hetdubai.com in browser
# Verify all sections load
```

---

## Section 8️⃣ — Production Optimization

### Enable Caching Headers

**Add to `/home/hetdubai/noc/.htaccess`:**

```apache
# Cache static assets for 30 days
<FilesMatch "\.jpg$|\.jpeg$|\.png$|\.gif$|\.css$|\.js$">
  Header set Cache-Control "max-age=2592000, public"
</FilesMatch>

# Cache API responses for 10 seconds
<Files "enterprise-api.php">
  Header set Cache-Control "public, max-age=10"
</Files>

# No-cache for health endpoint
<Files "health.php">
  Header set Cache-Control "no-cache, no-store"
</Files>
```

### Enable GZIP Compression

```apache
# Add to .htaccess
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml
  AddOutputFilterByType DEFLATE text/css text/javascript
  AddOutputFilterByType DEFLATE application/javascript application/json
</IfModule>
```

### Set PHP Limits

```
max_execution_time = 30
max_input_time = 60
memory_limit = 256M
post_max_size = 100M
upload_max_filesize = 100M
```

*In cPanel → PHP Configuration or php.ini*

---

## Summary

**Deployment Steps:** 8  
**Time Required:** 30-45 minutes  
**Risk Level:** Low (all changes non-destructive)  
**Rollback:** Delete `/api/cache/` to revert  

**After deployment:**
- ✅ System runs fully automated
- ✅ Dashboard cached and fast
- ✅ No manual intervention needed
- ✅ Monitoring via `/api/health.php`
- ✅ Logs available at `/api/logs/sync.log`

**Success Criteria:**
- [ ] Dashboard loads in < 1 second
- [ ] Cache age shown in footer (< 5 min)
- [ ] All 8 cache files created
- [ ] Cron job runs every 5 minutes
- [ ] Health endpoint returns "operational"
- [ ] No errors in console or logs

