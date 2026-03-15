# Kano Mobile VPN Monitoring Integration (Production)

## Scope
This integration is dedicated to KANO Mobile VPN only.

- Site: KANO
- Router: MikroTik RB951Ui-2HnD
- RouterOS: 6.49.19
- WAN/Public IP: 102.165.125.225
- LAN: 192.168.2.0/24
- VPN Type: L2TP/IPsec
- Pool: 10.20.30.10-10.20.30.20
- Tracked users: asif, het2, het3, het4

No other legacy VPN context is required for this flow.

## Final Architecture
1. Router pushes Mobile VPN payloads to Apps Script endpoint with `type=mobile_vpn`.
2. `HET_ingest` processes payload into three dedicated sheets:
- `Mobile_VPN_Events` (event log)
- `Mobile_VPN_Active` (current connected users snapshot)
- `Mobile_VPN_Summary` (service-level summary timeline)
3. Daily counters are maintained in script properties:
- connects today
- disconnects today
- failed logins today
- last connected/disconnected user
- last event and last connection time
4. Health logic computes:
- `UP` if L2TP enabled and service available (even when active users = 0)
- `DOWN` if service disabled/unavailable
- `WARNING` if auth failures today >= threshold
5. Telegram emits Mobile VPN event notifications for:
- connect
- disconnect
- auth_fail
- repeated_fail
- server_down
- server_up
6. NOC dashboards consume `Mobile_VPN_Summary` + `Mobile_VPN_Active` to render dedicated Mobile VPN cards/widgets.

## Google Sheet Schema

### Mobile_VPN_Events
Columns:
1. Timestamp
2. Site
3. Service
4. VPN Type
5. Username
6. Assigned VPN IP
7. Source Public IP
8. Event Type
9. Status
10. Notes

Recommended fixed values:
- Site = KANO
- Service = Mobile VPN
- VPN Type = L2TP/IPsec

Event types:
- connect
- disconnect
- auth_fail
- server_down
- server_up

### Mobile_VPN_Active
Columns:
1. Timestamp
2. Site
3. Service
4. VPN Type
5. Username
6. Assigned VPN IP
7. Source Public IP
8. Connection Start Time
9. Connection Status

### Mobile_VPN_Summary
Columns:
1. Timestamp
2. Site
3. Service
4. VPN Type
5. Service Status
6. L2TP Server
7. Health
8. Current Active Users
9. Connected Usernames
10. Assigned VPN IPs
11. Source Public IPs
12. Last Event
13. Last Connection Time
14. Failed Logins Today
15. Total Connects Today
16. Total Disconnects Today
17. Last Connected User
18. Last Disconnected User
19. VPN Pool
20. Pool Usage
21. Notes

## Telegram Alert Mapping
Message includes:
- Site: KANO
- Service: Mobile VPN
- VPN Type: L2TP/IPsec
- Username
- Assigned VPN IP
- Source Public IP
- Event
- Status
- Time

Event-to-title mapping:
- connect -> Mobile VPN Connected
- disconnect -> Mobile VPN Disconnected
- auth_fail -> Mobile VPN Authentication Failed
- repeated_fail -> Mobile VPN Repeated Failed Attempts
- server_down -> Mobile VPN Service Down
- server_up -> Mobile VPN Service Restored

## Dashboard and NOC Visibility
Mobile VPN is rendered as a dedicated monitored service with:
- Status (UP/DOWN)
- Health (WORKING/WARNING/DOWN)
- L2TP server state
- Active users count
- Connected usernames
- Assigned VPN IPs
- Source public IPs
- Last event
- Last connection time
- Failed login count today

Color mapping:
- Green: WORKING
- Amber: WARNING
- Red: DOWN

## Ingest Payload Contract (Implementation Ready)
Required minimum fields:
- `type=mobile_vpn`
- `site=KANO`
- `router=<router-name>`
- `service_status=UP|DOWN`
- `l2tp_enabled=1|0`

Optional event fields:
- `event_type=connect|disconnect|auth_fail|server_down|server_up`
- `username=<vpn user>`
- `vpn_ip=<assigned pool ip>`
- `source_ip=<public source ip>`
- `event_status=<CONNECTED|FAILED|...>`
- `notes=<detail>`

Optional active snapshot fields:
- `active_users=user|vpn_ip|source_ip|start_time;...`
- `active_count=<number>`

## Deployment Checklist
1. Deploy latest Apps Script code.
2. Run setup to apply new script properties.
3. Confirm new sheets are created with headers.
4. Push test payloads for:
- connect
- disconnect
- auth_fail
- server_down
- server_up
5. Verify outputs in:
- Mobile_VPN_Events
- Mobile_VPN_Active
- Mobile_VPN_Summary
- Telegram notifications
- NOC web dashboard
6. Validate fail threshold warning and repeated_fail Telegram alert.

## Event Flow Summary
1. Router sends event/snapshot payload.
2. Apps Script validates and ingests as `mobile_vpn`.
3. Event row written to `Mobile_VPN_Events`.
4. Active snapshot refreshed in `Mobile_VPN_Active`.
5. Summary state appended to `Mobile_VPN_Summary`.
6. Health evaluated and alerts raised/recovered.
7. Telegram event message dispatched.
8. Dashboard reads latest summary and renders Mobile VPN widget.
