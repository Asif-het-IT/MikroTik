# het living update policy

ye policy mandatory hai. koi bhi technical change bina documentation update ke complete nahi samjha jayega.

## mandatory update triggers
1. apps script me koi function/logic change
2. naya sheet add/remove/rename
3. naya payload type add
4. naya router script ya scheduler change
5. cloudflare worker auth/forward logic change
6. telegram command add/remove/change
7. dashboard wording/label logic change
8. alert thresholds/rules change
9. token/config endpoint change

## minimum documentation updates per change
1. `02-change-log.md` me entry add karo
2. relevant handbook section update karo
3. quick reference update karo agar commands/urls change hue
4. source inventory me file/function update reflect karo

## review cadence
- weekly: docs accuracy quick review
- monthly: full docs audit
- major release: pre-release + post-release docs signoff

## ownership model
- primary owner: project operator
- backup owner: noc technical lead
- review signoff: deployment karne wala engineer

## quality checklist
- text Roman Urdu me clear ho
- brand name `het` lowercase ho
- references outdated na hon
- stale or removed components clearly mark hon
