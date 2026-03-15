# het mobile vpn monitor install
# RouterOS 6.49.x
# Dedicated for KANO Mobile VPN (L2TP/IPsec)
# Sends type=mobile_vpn payloads compatible with current Apps Script backend.

:log info "het mobile vpn monitor install started"

/system script remove [find name="het_MVPN_PUSH"]
/system script remove [find name="het_MVPN_INIT"]
/system scheduler remove [find name="het_mobile_vpn_monitor"]

/system script add name="het_MVPN_INIT" policy=read,write,test,policy source={
:global TOKEN;
:global SITE;
:global ROUTER;
:global SENDDATA;
:global SENDOK;
:if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
:global MVPNSERVICE;
:global MVPNTYPE;
:global MVPNTRACKEDUSERS;
:global MVPNLASTSTATUS;
:global MVPNFAILCOUNTLAST;
:global MVPNPREVUSERSCSV;
:if ([:typeof $MVPNSERVICE] = "nothing") do={ :set MVPNSERVICE "Mobile VPN"; }
:if ([:typeof $MVPNTYPE] = "nothing") do={ :set MVPNTYPE "L2TP/IPsec"; }
:if ([:typeof $MVPNTRACKEDUSERS] = "nothing") do={ :set MVPNTRACKEDUSERS "asif,het2,het3,het4"; }
:if ([:typeof $MVPNLASTSTATUS] = "nothing") do={ :set MVPNLASTSTATUS "UNKNOWN"; }
:if ([:typeof $MVPNFAILCOUNTLAST] = "nothing") do={ :set MVPNFAILCOUNTLAST 0; }
:if ([:typeof $MVPNPREVUSERSCSV] = "nothing") do={ :set MVPNPREVUSERSCSV ""; }
:if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
:if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }
}

/system script add name="het_MVPN_PUSH" policy=read,write,test,policy source={
:global TOKEN;
:global SITE;
:global ROUTER;
:global SENDDATA;
:global SENDOK;
:global MVPNSERVICE;
:global MVPNTYPE;
:global MVPNTRACKEDUSERS;
:global MVPNLASTSTATUS;
:global MVPNFAILCOUNTLAST;
:global MVPNPREVUSERSCSV;
:if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
:if ([:typeof $MVPNSERVICE] = "nothing") do={ /system script run het_MVPN_INIT; }
:local l2tpEnabled false;
:do { :set l2tpEnabled [/interface l2tp-server server get enabled]; } on-error={ :set l2tpEnabled false; }
:local serviceStatus "DOWN";
:local l2tpFlag 0;
:if ($l2tpEnabled = true) do={ :set serviceStatus "UP"; :set l2tpFlag 1; }
:local trackedList ("," . $MVPNTRACKEDUSERS . ",");
:local currentActiveList "";
:local currentUsersCSV "";
:local activeCount 0;
:foreach a in=[/ppp active find] do={
  :local svc "";
  :do { :set svc [/ppp active get $a service]; } on-error={ :set svc ""; }
  :if ($svc = "l2tp") do={
    :local u "";
    :local vip "0.0.0.0";
    :local src "0.0.0.0";
    :local started "n/a";
    :local include false;
    :do { :set u [/ppp active get $a name]; } on-error={ :set u ""; }
    :do { :set vip [/ppp active get $a address]; } on-error={ :set vip "0.0.0.0"; }
    :do { :set src [/ppp active get $a caller-id]; } on-error={ :set src "0.0.0.0"; }
    :do { :set started [/ppp active get $a uptime]; } on-error={ :set started "n/a"; }
    :if ([:len $u] > 0) do={
      :if ([:len $MVPNTRACKEDUSERS] = 0) do={ :set include true; } else={
        :if ([:typeof [:find $trackedList ("," . $u . ",")]] != "nil") do={ :set include true; }
      }
    }
    :if ($include = true) do={
      :if ([:len $currentActiveList] > 0) do={ :set currentActiveList ($currentActiveList . ";"); }
      :set currentActiveList ($currentActiveList . $u . "|" . $vip . "|" . $src . "|" . $started);
      :if ([:len $currentUsersCSV] > 0) do={ :set currentUsersCSV ($currentUsersCSV . ","); }
      :set currentUsersCSV ($currentUsersCSV . $u);
      :set activeCount ($activeCount + 1);
    }
  }
}
:set SENDDATA ("token=" . $TOKEN . "&type=mobile_vpn&site=" . $SITE);
:set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
:set SENDDATA ($SENDDATA . "&service=" . $MVPNSERVICE);
:set SENDDATA ($SENDDATA . "&vpn_type=" . $MVPNTYPE);
:set SENDDATA ($SENDDATA . "&service_status=" . $serviceStatus);
:set SENDDATA ($SENDDATA . "&l2tp_enabled=" . $l2tpFlag);
:set SENDDATA ($SENDDATA . "&active_count=" . $activeCount);
:set SENDDATA ($SENDDATA . "&active_users=" . $currentActiveList);
:set SENDDATA ($SENDDATA . "&event_status=OK&notes=heartbeat");
/system script run het_HTTP_SEND;
:if (($MVPNLASTSTATUS != $serviceStatus) && ($MVPNLASTSTATUS != "UNKNOWN")) do={
  :set SENDDATA ("token=" . $TOKEN . "&type=mobile_vpn&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&service=" . $MVPNSERVICE);
  :set SENDDATA ($SENDDATA . "&vpn_type=" . $MVPNTYPE);
  :set SENDDATA ($SENDDATA . "&service_status=" . $serviceStatus);
  :set SENDDATA ($SENDDATA . "&l2tp_enabled=" . $l2tpFlag);
  :set SENDDATA ($SENDDATA . "&active_count=" . $activeCount);
  :set SENDDATA ($SENDDATA . "&active_users=" . $currentActiveList);
  :if ($serviceStatus = "DOWN") do={
    :set SENDDATA ($SENDDATA . "&event_type=server_down&event_status=DOWN&notes=l2tp_server_unavailable");
  } else={
    :set SENDDATA ($SENDDATA . "&event_type=server_up&event_status=UP&notes=mobile_vpn_service_restored");
  }
  /system script run het_HTTP_SEND;
}
:local failCount 0;
:do { :set failCount [/log print count-only where message~"authentication failed" and topics~"ppp"]; } on-error={ :set failCount 0; }
:if ($failCount < $MVPNFAILCOUNTLAST) do={ :set MVPNFAILCOUNTLAST $failCount; }
:if ($failCount > $MVPNFAILCOUNTLAST) do={
  :set SENDDATA ("token=" . $TOKEN . "&type=mobile_vpn&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&service=" . $MVPNSERVICE);
  :set SENDDATA ($SENDDATA . "&vpn_type=" . $MVPNTYPE);
  :set SENDDATA ($SENDDATA . "&service_status=" . $serviceStatus);
  :set SENDDATA ($SENDDATA . "&l2tp_enabled=" . $l2tpFlag);
  :set SENDDATA ($SENDDATA . "&active_count=" . $activeCount);
  :set SENDDATA ($SENDDATA . "&active_users=" . $currentActiveList);
  :set SENDDATA ($SENDDATA . "&event_type=auth_fail&username=-&vpn_ip=-&source_ip=-");
  :set SENDDATA ($SENDDATA . "&event_status=FAILED&notes=ppp_authentication_failed_detected");
  /system script run het_HTTP_SEND;
  :set MVPNFAILCOUNTLAST $failCount;
}
:set MVPNPREVUSERSCSV $currentUsersCSV;
:set MVPNLASTSTATUS $serviceStatus;
}


/system scheduler add name="het_mobile_vpn_monitor" start-time=startup interval=1m on-event=":delay 35s; /system script run het_MVPN_PUSH" policy=read,write,test,policy disabled=no

/system script run het_MVPN_INIT

:log info "het mobile vpn monitor install finished"
