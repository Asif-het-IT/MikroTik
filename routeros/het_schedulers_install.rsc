# het schedulers install
# RouterOS 6.49.x safe minimal module

:log info "het schedulers install started"

/system scheduler remove [find name="het_live"]
/system scheduler remove [find name="het_vpn"]
/system scheduler remove [find name="het_iface"]
/system scheduler remove [find name="het_users"]
/system scheduler remove [find name="het_usage"]
/system scheduler remove [find name="het_rlog"]
/system scheduler remove [find name="het_change"]

/system scheduler add name="het_live" start-time=startup interval=10m on-event=":delay 5s; /system script run het_PUSH_LIVE" policy=read,write,test,policy disabled=no
/system scheduler add name="het_vpn" start-time=startup interval=15m on-event=":delay 15s; /system script run het_VPN_CHECK" policy=read,write,test,policy disabled=no
/system scheduler add name="het_iface" start-time=startup interval=15m on-event=":delay 20s; /system script run het_PUSH_IFACE" policy=read,write,test,policy disabled=no
/system scheduler add name="het_users" start-time=startup interval=20m on-event=":delay 25s; /system script run het_PUSH_USERS" policy=read,write,test,policy disabled=no
/system scheduler add name="het_usage" start-time=startup interval=30m on-event=":delay 30s; /system script run het_PUSH_USAGE" policy=read,write,test,policy disabled=no
/system scheduler add name="het_rlog" start-time=startup interval=1m on-event=":delay 35s; /system script run het_PUSH_ROUTERLOG" policy=read,write,test,policy disabled=no
/system scheduler add name="het_change" start-time=startup interval=1h on-event=":delay 40s; /system script run het_PUSH_CHANGE" policy=read,write,test,policy disabled=no

:log info "het schedulers install finished"
