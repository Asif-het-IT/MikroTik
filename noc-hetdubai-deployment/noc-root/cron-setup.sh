#!/bin/bash
#
# NOC Dashboard - Cron Job Setup Script
#
# This script sets up the cron jobs that run the central sync engine.
# The sync engine is what keeps the dashboard cache updated.
#
# Usage:
#   bash cron-setup.sh
#
# This will:
# 1. Display required cron entries
# 2. Show how to add them to cPanel
# 3. Provide curl commands for manual testing
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="noc.hetdubai.com"
SYNC_ENDPOINT="https://$DOMAIN/api/sync.php"
SYNC_TOKEN="sync_secret_2026"  # Must match NOC_SYNC_TOKEN in env

echo "========================================"
echo "NOC Dashboard - Cron Setup"
echo "========================================"
echo ""
echo "Domain: $DOMAIN"
echo "Sync Endpoint: $SYNC_ENDPOINT"
echo "Sync Token: $SYNC_TOKEN"
echo ""

# ============ CONNECTION TEST ============
echo "Testing connection to sync endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$SYNC_ENDPOINT" \
  -H "X-Sync-Token: $SYNC_TOKEN" \
  -d "test=1" | tail -1)

if [ "$RESPONSE" = "403" ]; then
  echo "✓ Connection OK (403 = test request rejected, sync endpoint is active)"
elif [ "$RESPONSE" = "200" ]; then
  echo "✓ Connection OK (200 = sync executed successfully)"
else
  echo "✗ Connection FAILED (HTTP $RESPONSE)"
  echo "  Make sure /api/sync.php exists and is callable"
  exit 1
fi

echo ""
echo "========================================"
echo "CRON JOB CONFIGURATION"
echo "========================================"
echo ""
echo "Add these cron jobs to your cPanel account:"
echo "(or run: crontab -e)"
echo ""

# Helper function to display cron entry
show_cron_entry() {
  local schedule="$1"
  local description="$2"
  echo "# $description"
  echo "$schedule curl -s -X POST $SYNC_ENDPOINT \\"
  echo "  -H 'X-Sync-Token: $SYNC_TOKEN' \\"
  echo "  -d 'schedule=sync' > /dev/null 2>&1"
  echo ""
}

show_cron_entry "*/5 * * * *" "Every 5 minutes: Router, Traffic, Alerts, Users"
show_cron_entry "*/10 * * * *" "Every 10 minutes: System Health, Sheets"
show_cron_entry "0 * * * *" "Every hour: Reports (optional)"

echo ""
echo "========================================"
echo "CPANEL INSTRUCTIONS"
echo "========================================"
echo ""
echo "1. Log in to cPanel"
echo "2. Go to: Advanced → Cron Jobs"
echo "3. For each cron job above:"
echo "   - Set the schedule (every 5 min / every 10 min / hourly)"
echo "   - Enter the command:"
echo "     curl -s -X POST $SYNC_ENDPOINT \\"
echo "     -H 'X-Sync-Token: $SYNC_TOKEN' \\"
echo "     -d 'schedule=sync' > /dev/null 2>&1"
echo ""
echo "4. Click 'Add New Cron Job'"
echo ""

echo "========================================"
echo "MANUAL TEST"
echo "========================================"
echo ""
echo "To manually trigger a sync (for testing), run:"
echo ""
echo "curl -X POST $SYNC_ENDPOINT \\"
echo "  -H 'X-Sync-Token: $SYNC_TOKEN' \\"
echo "  -d 'test=1'"
echo ""

echo "========================================"
echo "MONITORING"
echo "========================================"
echo ""
echo "To check sync logs, SSH into your account and run:"
echo "tail -f /home/hetdubai/noc/api/logs/sync.log"
echo ""
echo "Expected output:"
echo "[2026-03-11 15:30:00] START: Sync initiated..."
echo "[2026-03-11 15:30:01] Fetching: status"
echo "[2026-03-11 15:30:03] ✓ Status fetched successfully"
echo "[2026-03-11 15:30:04] Cache file written: ... (2048 bytes)"
echo "[2026-03-11 15:30:04] END: Sync completed in 4.123s"
echo ""

echo "========================================"
echo "TROUBLESHOOTING"
echo "========================================"
echo ""
echo "If cron jobs don't run:"
echo "1. Check cPanel error logs"
echo "2. Test manually: curl -X POST $SYNC_ENDPOINT -H 'X-Sync-Token: $SYNC_TOKEN'"
echo "3. Verify sync.php exists at /home/hetdubai/noc/api/sync.php"
echo "4. Check cache directory permissions: ls -la /home/hetdubai/noc/api/cache/"
echo "5. Verify NOC_SYNC_TOKEN env var is set (or hardcoded in sync.php)"
echo ""

echo "========================================"
echo "NEXT STEPS"
echo "========================================"
echo ""
echo "1. Add cron jobs to cPanel"
echo "2. Wait for first sync to complete (5 minutes)"
echo "3. Check if cache file was created:"
echo "   curl $SYNC_ENDPOINT/cached-api.php"
echo "4. Monitor sync.log for errors"
echo "5. Verify dashboard shows updated data"
echo ""
