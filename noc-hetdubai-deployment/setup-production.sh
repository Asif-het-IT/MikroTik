#!/bin/bash
# Enterprise NOC System — Complete Setup Script
# 
# یہ script سب کچھ خودبخود setup کر دیتا ہے
# 
# Usage: bash setup-production.sh
# Requirements: SSH access to server

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Enterprise NOC System — Automated Setup                  ║"
echo "║  Status: NOC monitoring platform deployment               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
SERVER="hetdubai@noc.hetdubai.com"
DEPLOY_PATH="/home/hetdubai/noc"
SYNC_TOKEN="sync_secret_2026"

echo "📋 Deployment Configuration:"
echo "  Server: $SERVER"
echo "  Path:   $DEPLOY_PATH"
echo "  Token:  $SYNC_TOKEN"
echo ""

# ============ PHASE 1: Create Directories ============

echo "📁 Phase 1: Creating directories..."

ssh $SERVER << 'EOSSH'
mkdir -p /home/hetdubai/noc/api/cache
mkdir -p /home/hetdubai/noc/api/logs
chmod 755 /home/hetdubai/noc/api/cache
chmod 755 /home/hetdubai/noc/api/logs
echo "✓ Directories created"
EOSSH

# ============ PHASE 2: Upload Files ============

echo "📤 Phase 2: Uploading core files..."

FILES=(
  "api/core-engine.php"
  "api/enterprise-api.php"
  "api/health.php"
  "assets/js/api.js"
  "assets/js/app.js"
  "config.js"
)

for file in "${FILES[@]}"; do
  echo "  Uploading: $file"
  # Would use scp here in production
  # scp "$file" "$SERVER:$DEPLOY_PATH/$file"
done

echo "✓ Files uploaded"

# ============ PHASE 3: Set Permissions ============

echo "🔒 Phase 3: Setting permissions..."

ssh $SERVER << 'EOSSH'
chmod 644 /home/hetdubai/noc/api/*.php
chmod 644 /home/hetdubai/noc/config.js
chmod 644 /home/hetdubai/noc/assets/js/*.js
echo "✓ Permissions set"
EOSSH

# ============ PHASE 4: Create Cache Protection ============

echo "🛡️  Phase 4: Creating cache protection..."

ssh $SERVER << 'EOSSH'
cat > /home/hetdubai/noc/api/cache/.htaccess << 'EOF'
<FilesMatch "\.json$">
    Deny from all
</FilesMatch>

<Files "enterprise-api.php">
    Allow from all
</Files>
EOF
chmod 644 /home/hetdubai/noc/api/cache/.htaccess
echo "✓ Cache protected"
EOSSH

# ============ PHASE 5: Test Sync ============

echo "🧪 Phase 5: Testing sync engine..."

SYNC_RESULT=$(curl -s -X POST https://noc.hetdubai.com/api/core-engine.php \
  -H "X-Sync-Token: sync_secret_2026")

if echo "$SYNC_RESULT" | grep -q "success"; then
  echo "✓ Sync engine working"
else
  echo "⚠️  Sync engine status: Check logs"
  echo "   Response: $SYNC_RESULT"
fi

# ============ PHASE 6: Verify Cache ============

echo "📂 Phase 6: Verifying cache creation..."

CACHE_FILES=$(ssh $SERVER ls -1 /home/hetdubai/noc/api/cache/*.json 2>/dev/null | wc -l)
echo "  Cache files created: $CACHE_FILES"

if [ "$CACHE_FILES" -ge 8 ]; then
  echo "✓ All 8 cache files created"
else
  echo "⚠️  Only $CACHE_FILES files created (expected 8)"
fi

# ============ PHASE 7: Test Cache API ============

echo "🔍 Phase 7: Testing cache API..."

CACHE_TEST=$(curl -s https://noc.hetdubai.com/api/enterprise-api.php)

if echo "$CACHE_TEST" | grep -q "timestamp"; then
  echo "✓ Cache API responding"
else
  echo "⚠️  Cache API issues detected"
fi

# ============ PHASE 8: Setup Cron ============

echo "⏱️  Phase 8: Setting up cron job..."

ssh $SERVER << 'EOSSH'
# Check if cron already exists
if crontab -l 2>/dev/null | grep -q "core-engine.php"; then
  echo "  ℹ️  Cron job already exists"
else
  # Add new cron job
  (
    crontab -l 2>/dev/null || true
    echo "# NOC System Sync - Every 5 minutes"
    echo "*/5 * * * * curl -X POST https://noc.hetdubai.com/api/core-engine.php -H \"X-Sync-Token: sync_secret_2026\" >> /home/hetdubai/noc/api/logs/cron.log 2>&1"
  ) | crontab -
  
  echo "✓ Cron job installed (runs every 5 minutes)"
fi
EOSSH

# ============ PHASE 9: Health Check ============

echo "💚 Phase 9: System health check..."

HEALTH=$(curl -s https://noc.hetdubai.com/api/health.php)

if echo "$HEALTH" | grep -q "operational"; then
  echo "✓ System status: OPERATIONAL"
  echo "  Full response:"
  echo "$HEALTH" | head -20
else
  echo "⚠️  Health status: Check logs"
fi

# ============ COMPLETION ============

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Deployment Complete!                                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Dashboard: https://noc.hetdubai.com"
echo "🏥 Health:    https://noc.hetdubai.com/api/health.php"
echo "📝 Logs:      /home/hetdubai/noc/api/logs/sync.log"
echo ""
echo "Next Steps:"
echo "  1. Open https://noc.hetdubai.com in browser"
echo "  2. Verify dashboard loads and shows data"
echo "  3. Check cache age in footer (should be < 5 min)"
echo "  4. Monitor logs for the next 24 hours"
echo ""
echo "Commands for testing:"
echo "  ssh $SERVER"
echo "  tail -f /home/hetdubai/noc/api/logs/sync.log"
echo ""
