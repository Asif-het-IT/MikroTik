# het google sheet mirroring plan

yeh plan `DOC_*` tabs ke standard ke saath banaya gaya hai taa ke monitoring sheet hi primary documentation workspace ban jaye.

## required tabs and source mapping

| tab name | source document |
|---|---|
| DOC_Master_Index | `docs/het-knowledge-base/00-master-index.md` |
| DOC_Project_Overview | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Architecture | `docs/het-knowledge-base/08-system-architecture-blueprint.md` |
| DOC_Sheets | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Router_Scripts | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Worker | `docs/het-knowledge-base/08-system-architecture-blueprint.md` |
| DOC_Apps_Script | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Dashboard | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Alerts | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Data_Flow | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Telegram | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Troubleshooting | `docs/het-knowledge-base/01-het-operational-handbook.md` |
| DOC_Deployment | `docs/het-knowledge-base/10-full-deployment-guide.md` |
| DOC_Disaster_Recovery | `docs/het-knowledge-base/09-disaster-recovery-playbook.md` |
| DOC_Change_Log | `docs/het-knowledge-base/02-change-log.md` |
| DOC_SOP | `docs/het-knowledge-base/03-maintenance-sop.md` |
| DOC_Quick_Reference | `docs/het-knowledge-base/04-quick-reference.md` |

## mirror workflow

1. pehle markdown docs update karo.
2. phir related `DOC_*` tab me updated content paste karo.
3. har tab ki top row me `last updated at`, `updated by`, `source file` fill karo.
4. major doc update par `DOC_Change_Log` tab me entry mandatory add karo.
5. monthly SOP review me docs mirror freshness verify karo.

## standard tab header columns

- section id
- section title
- detail
- source file
- last updated at
- owner

## implementation note

paste-ready structured content pack ke liye yeh file use karein:
- `docs/het-knowledge-base/11-google-sheet-documentation-pack.md`
