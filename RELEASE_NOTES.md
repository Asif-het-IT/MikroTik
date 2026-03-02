Release: Convert to Sheets-only NOC project

Summary
- Removed BigQuery integration (deleted `BigQuery.js`).
- Dropped the BigQuery OAuth scope from `appsscript.json`.
- Improved Telegram outbox handling in `Telegram.js`:
  - Exponential backoff retries (up to 5 attempts).
  - Structured parsing of Telegram API responses.
  - Better logging and next-try timestamps.
- Added a lightweight NOC Dashboard UI (`UI.html`) and `showDashboard()` menu entry (`Code.js`).
- Added server helper `getDashboardData(limit)` in `Monitoring.js` to feed the UI.

Notes
- No BigQuery calls remain; data is stored and handled entirely in Google Sheets.
- The Apps Script project requires re-deploying if published; the files here are the source code changes.

Local commit & push (run from project root `D:\GitHub Projects\MikroTik`):

```powershell
# configure if not already set
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# commit & push
git add -A
git commit -m "chore: remove BigQuery.js and drop BigQuery scope (Sheets-only)"
git push origin HEAD
```

If you want, I can also prepare a single patch file or add a short `README.md` update — tell me which.