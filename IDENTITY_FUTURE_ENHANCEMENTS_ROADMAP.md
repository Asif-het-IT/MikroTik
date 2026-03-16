# Identity Future Enhancements Roadmap (Design Only)

Status: Design only. Do not implement until shadow validation is approved.

## Architecture Principles
- Router remains lightweight collector only
- Logic stays in Google side (Apps Script + Sheets)
- Additive, backward-compatible changes only
- Feature-flag gated rollout

## 1) Automatic Device Type Detection

### Goal
Classify devices using lightweight signals:
- MAC vendor (OUI)
- Hostname patterns
- Preferred name/comment patterns
- Historical identity behavior

### Proposed Types
- `Laptop`
- `Mobile`
- `CCTV`
- `Printer`
- `IoT`
- `Unknown`

### Proposed Strategy
1. Rule engine first (cheap deterministic patterns)
2. Optional OUI lookup table in Sheets
3. Confidence scoring (`HIGH/MEDIUM/LOW`)
4. Store result in additive columns/sheet

### Proposed Feature Flags
- `DEVICE_TYPE_DETECT_ENABLE`
- `DEVICE_TYPE_OUTPUT_ENABLE`

### Proposed Additive Schema
New sheet: `Device_Type_Rules`
- Pattern Type, Pattern, Device Type, Priority, Enabled, Notes

New sheet: `Device_Type_Log`
- Time, MAC, IP, Resolved Name, Device Type, Source, Confidence, Router, Site

## 2) New Device Detection Alert

### Goal
Detect first-seen MACs and surface quickly.

### Behavior
- Log to `Unknown_Device_Triage`
- Optional Telegram notification

### Alert Example
- New device detected
- IP, MAC, Site, First Seen

### Proposed Feature Flags
- `NEW_DEVICE_ALERT_ENABLE`
- `NEW_DEVICE_TG_ALERT_ENABLE`

### Proposed Additive Schema
New sheet: `Known_Mac_Index`
- MAC, First Seen, Last Seen, First Site, Last Site, Status

New sheet: `Device_Event_Log`
- Time, Event Type, MAC, IP, Name, Site, Meta

## 3) Device Offline Monitoring

### Goal
Detect when known devices disappear for a configured period.

### Behavior
- Track `last seen` per known MAC
- Trigger offline event when threshold exceeded
- Optional Telegram alert

### Offline Threshold
- Configurable, e.g. `DEVICE_OFFLINE_MIN=5`

### Proposed Feature Flags
- `DEVICE_OFFLINE_MONITOR_ENABLE`
- `DEVICE_OFFLINE_TG_ALERT_ENABLE`

### Proposed Additive Schema
New sheet: `Device_Heartbeat_State`
- MAC, Last Seen, Last IP, Last Site, Online State, Updated At

## Rollout Order
1. Device Type Detection (shadow logs only)
2. New Device Detection (log only, then optional Telegram)
3. Offline Monitoring (log only, then optional Telegram)

## Risk Controls
- Keep legacy outputs default until validated
- Dual-write logs before any output cutover
- Use cooldown windows to avoid alert spam
- Add source/confidence on all derived labels

## Exit Criteria Per Enhancement
- No ingestion regressions
- False positive rate acceptable
- Telegram noise acceptable
- Team sign-off
