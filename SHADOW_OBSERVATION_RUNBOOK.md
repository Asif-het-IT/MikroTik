# Shadow Observation Runbook (48-72 Hours)

## Objective
Run identity resolver in shadow mode only, validate quality and stability, and keep all existing user-facing outputs unchanged.

## Guardrails
- Keep `ENRICHED_OUTPUT_ENABLE=NO`
- No router script changes
- No VPN/config changes
- No endpoint contract changes
- Additive sheets/logging only

## Start Observation Window
Use Apps Script admin endpoint:

`?token=<MONITOR_TOKEN>&admin=startshadowobs&hours=72`

Notes:
- You can use `hours=48` or `hours=72`
- This sets and enforces:
  - `IDENTITY_ENRICH_ENABLE=YES`
  - `SITE_RESOLVE_ENABLE=YES`
  - `UNKNOWN_TRIAGE_ENABLE=YES`
  - `ENRICHED_OUTPUT_ENABLE=NO`

## Monitor During Window
### Quick shadow health
`?token=<MONITOR_TOKEN>&admin=identityshadow`

### Full status (includes identity shadow block)
`?token=<MONITOR_TOKEN>&admin=status`

### Runtime integrity
`?token=<MONITOR_TOKEN>&admin=runtimehealth`

## Sheets to Watch
- `Identity_Resolution_Log`
- `Unknown_Device_Triage`
- `Device_Mapping`
- `RAW Events` (for ingestion errors/exceptions)

## End of Window Validation
Generate final KPI report:

`?token=<MONITOR_TOKEN>&admin=identityvalidation&hours=72`

For 48h window:

`?token=<MONITOR_TOKEN>&admin=identityvalidation&hours=48`

## KPI Definitions
- `totalDevicesDetected`: unique MACs seen in `Identity_Resolution_Log` during window
- `unknownDeviceRatio`: percent of unresolved/fallback identity rows
- `successfulSiteResolutionRate`: percent of rows with resolved site (not `Site Unresolved`)
- `misclassifiedDevicesCount`: MACs mapped to multiple names/sites in window
- `ingestionFailures`: exceptions/unknown-type rows detected in `RAW Events`
- `deviceMappingUpdates`: `Device_Mapping` rows updated in window

## Stability Pass Criteria
- `ingestionFailures = 0` (or explained and non-recurring)
- `ENRICHED_OUTPUT_ENABLE` remains `NO`
- Dashboard + Telegram legacy outputs remain unchanged
- Unknowns appear in triage (not silently hidden)
- Site resolution trend improving over baseline

## Phase 3/4 Go/No-Go
Proceed to Phase 3 only if all are true:
- No production regressions
- KPI trend acceptable
- Misclassification list reviewed
- Team approval recorded

Then Phase 4 after Phase 3 stability checks pass.
