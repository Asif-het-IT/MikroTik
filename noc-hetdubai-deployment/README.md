# hetdubai NOC Web Dashboard Package

This folder includes deployment-ready files for:
- `noc.hetdubai.com`
- cPanel document root: `/home/hetdubai/noc`

## Contents
- `NOC_DASHBOARD_DEPLOYMENT_PLAN.md`: Full A-J deployment plan and version roadmap.
- `noc-root/`: Upload this content directly into `/home/hetdubai/noc`.

## Required edit before go-live
Update `noc-root/config/app.php`:
- `NOC_ENDPOINT` = Apps Script `/exec` URL
- `NOC_TOKEN` = monitor token

## Live endpoints used (through proxy)
- `/api/proxy.php?view=status`
- `/api/proxy.php?view=topusers&period=daily&limit=10`
- `/api/proxy.php?view=topusers&period=monthly&limit=10`
