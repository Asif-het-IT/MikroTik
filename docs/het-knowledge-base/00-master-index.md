# het master index

is index ka maqsad yeh hai ke poora project documentation ek standard structure me maintain ho.

| sr | section title | subsection title | short description | where belongs | reference |
|---|---|---|---|---|---|
| 1 | master index | full navigation | poori docs ki entry point list | docs | `docs/het-knowledge-base/00-master-index.md` |
| 2 | project overview | purpose, scope, business value | project ka high-level samajh | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 3 | architecture | component map | router se dashboard tak complete flow | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 4 | google sheet documentation | sheet-by-sheet reference | har sheet ka role, source, impact | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 5 | apps script documentation | file and function reference | backend api, ingest, dashboard, alerts, reports | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 6 | cloudflare worker documentation | auth, forward, dedupe | worker behavior aur env vars | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 7 | mikrotik router documentation | scripts and payloads | har router script ka logic aur mapping | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 8 | scheduler and trigger documentation | router + apps script schedule | kis interval pe kya run hota hai | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 9 | telegram documentation | command catalog | bot commands, source sheets, limits | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 10 | dashboard documentation | sections + labels | dashboard ke panel, kpi aur label logic | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 11 | alert logic | rules and severity | alert conditions, cooldown, destinations | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 12 | data flow documentation | payload mapping | type -> script -> ingest -> sheet -> consumer | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 13 | token/config/endpoint | config control | properties, tokens, urls, break impact | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 14 | troubleshooting guide | issue playbooks | common problems ka step-by-step fix | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 15 | change log | revision history | kya change hua, kyun hua, impact kya hua | docs | `docs/het-knowledge-base/02-change-log.md` |
| 16 | maintenance sop | daily/weekly/monthly checks | operations routine aur health checks | docs | `docs/het-knowledge-base/03-maintenance-sop.md` |
| 17 | future improvements | pending items | roadmap, optional enhancements | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 18 | dependency map | upstream/downstream dependency | failure blast radius samajhne ke liye | docs | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| 19 | quick reference | commands and urls | on-call fast access section | docs | `docs/het-knowledge-base/04-quick-reference.md` |
| 20 | source code inventory | file inventory | apps script, worker, router source map | docs | `docs/het-knowledge-base/05-source-inventory.md` |
| 21 | living update policy | documentation governance | har change ke sath docs update mandatory | docs | `docs/het-knowledge-base/06-living-update-policy.md` |
| 22 | google sheet mirroring plan | docs-to-sheet rollout | markdown docs ko sheet tabs me structured mirror karna | docs | `docs/het-knowledge-base/07-google-sheet-mirroring-plan.md` |
| 23 | system architecture blueprint | logical + visual architecture | end-to-end flow, dependency map, trust boundaries | docs | `docs/het-knowledge-base/08-system-architecture-blueprint.md` |
| 24 | disaster recovery playbook | failure recovery runbooks | incident scenarios, diagnostics, safe recovery, verification | docs | `docs/het-knowledge-base/09-disaster-recovery-playbook.md` |
| 25 | full deployment guide | greenfield site/router installation | step-by-step deploy + go-live tests | docs | `docs/het-knowledge-base/10-full-deployment-guide.md` |
| 26 | google sheet documentation pack | tab-wise copy pack | `DOC_*` tabs ke liye paste-ready Roman Urdu content | docs | `docs/het-knowledge-base/11-google-sheet-documentation-pack.md` |

## google sheet documentation tab structure (recommended)

agar aap same content google sheet me rakhna chahte hain to yeh tabs banayen:

1. `DOC_Master_Index`
2. `DOC_Project_Overview`
3. `DOC_Architecture`
4. `DOC_Sheets`
5. `DOC_Router_Scripts`
6. `DOC_Worker`
7. `DOC_Apps_Script`
8. `DOC_Dashboard`
9. `DOC_Alerts`
10. `DOC_Data_Flow`
11. `DOC_Telegram`
12. `DOC_Troubleshooting`
13. `DOC_Deployment`
14. `DOC_Disaster_Recovery`
15. `DOC_Change_Log`
16. `DOC_SOP`
17. `DOC_Quick_Reference`
