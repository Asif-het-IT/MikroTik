# het change log

| date | sr | change title | kya change hua | kyun change hua | impact |
|---|---:|---|---|---|---|
| 2026-03-10 | 1 | worker auth fix | cloudflare worker redeploy with correct `ROUTER_TOKEN` and `APPS_SCRIPT_URL` | router posts `401 unauthorized` aa raha tha | router -> worker -> apps script flow restore hua |
| 2026-03-10 | 2 | telegram misroute fix | `HET_isTelegramUpdate_` detection strict ki gayi | monitor payload ke `message` field ko galat telegram update samjha ja raha tha | `live/vpn/routerlog` ingest restore hua |
| 2026-03-10 | 3 | usage stream recovery | `type=usage` pipeline verify aur `User Data Usage` row updates confirm | usage sheet stale thi | top usage/report inputs recover hue |
| 2026-03-10 | 4 | dashboard activity wording fix | bytes-only logic remove, running-state aware labels add | false `Unexpected inactivity` labels aa rahe thay | activity column operationally accurate ho gaya |
| 2026-03-10 | 5 | telegram polling observability | tg debug state fields aur poll lifecycle logs enhance | production troubleshooting me evidence chahiye tha | command/control diagnostics better hue |

## update rule
- har functional change ke sath yeh log update karna mandatory hai.
