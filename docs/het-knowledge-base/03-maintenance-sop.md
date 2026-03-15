# het maintenance sop

## daily checks
1. worker route health check (`admin=status` via worker)
2. key sheet freshness:
- Router Status
- VPN Status
- Raw_Traffic_Log
- Connected Users
- User Data Usage
3. alerts panel check for new critical entries
4. telegram `/health` aur `/traffic` quick command test
5. runtime health check (`admin=runtimehealth`) verify karein ke dashboard, alert cycle, command cycle, daily report, aur trigger integrity healthy hain
6. active incidents aur recovery events dono review karein

## weekly checks
1. router script inventory verify (`het_` scripts valid)
2. scheduler run-count trend verify
3. outbox backlog cleanup check
4. `RAW Events` scan for auth/type exceptions
5. trigger integrity verify karein aur agar koi trigger recreate hua ho to root cause note karein
6. archive tabs aur active sheet row counts review karein

## monthly checks
1. token and endpoint review
2. threshold review (`CPU_*`, `MEM_*`, stale windows)
3. dashboard wording and usability review
4. documentation and change log sync review
5. retention policy aur archive growth review

## release/change procedure
1. code change prepare
2. local audit and reference update
3. deploy
4. post-deploy test:
- router probe
- worker probe
- `admin=status`
- dashboard refresh
- telegram command response
5. change log entry

## emergency rollback guideline
1. issue isolate: router vs worker vs apps script
2. worker env rollback if auth issue
3. apps script deployment rollback if api logic regression
4. confirm with `admin=status` + sample payload post
