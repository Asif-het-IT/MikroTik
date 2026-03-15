# het events install
# RouterOS 6.49.x extended telemetry module

:log info "het events install started"

/system script remove [find name="het_PUSH_IFACE"]
/system script remove [find name="het_PUSH_USERS"]
/system script remove [find name="het_PUSH_USAGE"]
/system script remove [find name="het_PUSH_ROUTERLOG"]
/system script remove [find name="het_PUSH_CHANGE"]

/system script add name="het_PUSH_IFACE" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global WANIF;
  :global SENDDATA;
  :global SENDOK;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }

  :local i [/interface find where name=$WANIF];
  :if ([:len $i] = 0) do={ :log warning "het_PUSH_IFACE_NO_IFACE"; :return; }

  :local tx [/interface get [:pick $i 0] tx-byte];
  :local rx [/interface get [:pick $i 0] rx-byte];
  :local running [/interface get [:pick $i 0] running];
  :local st "DOWN";
  :if ($running = true) do={ :set st "UP"; }

  :set SENDDATA ("token=" . $TOKEN . "&type=iface&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&interface=" . $WANIF);
  :set SENDDATA ($SENDDATA . "&upload=" . $tx . "&download=" . $rx);
  :set SENDDATA ($SENDDATA . "&status=" . $st);
  /system script run het_HTTP_SEND;

  :if ($SENDOK != 1) do={ :log error "het_PUSH_IFACE_FAIL"; }
}

/system script add name="het_PUSH_USERS" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global SENDDATA;
  :global SENDOK;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }

  :local users "";
  :local count 0;
  :foreach id in=[/ip dhcp-server lease find where status="bound"] do={
    :if ($count >= 25) do={ :break; }
    :local ip [/ip dhcp-server lease get $id address];
    :local mac [/ip dhcp-server lease get $id mac-address];
    :local host [/ip dhcp-server lease get $id host-name];
    :if ([:len $host] = 0) do={ :set host "unknown"; }
    :set users ($users . $ip . "|" . $mac . "|" . $host . "|bridge1|LAN;");
    :set count ($count + 1);
  }

  :if ([:len $users] = 0) do={
    :log info "het_PUSH_USERS_NO_LEASES";
    :return;
  }

  :set SENDDATA ("token=" . $TOKEN . "&type=users&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&users=" . $users);
  /system script run het_HTTP_SEND;

  :if ($SENDOK != 1) do={ :log error "het_PUSH_USERS_FAIL"; }
}

/system script add name="het_PUSH_USAGE" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global SENDDATA;
  :global SENDOK;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }

  :local usage "";
  :local txTotal 0;
  :local rxTotal 0;
  :local i [/interface find where running=yes];
  :if ([:len $i] > 0) do={
    :foreach x in=$i do={
      :set txTotal ($txTotal + [/interface get $x tx-byte]);
      :set rxTotal ($rxTotal + [/interface get $x rx-byte]);
    }
  }
  :local sum ($txTotal + $rxTotal);
  :set usage ("WAN_TOTAL|" . $txTotal . "|" . $rxTotal . "|" . $sum . ";");

  :set SENDDATA ("token=" . $TOKEN . "&type=usage&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&usage=" . $usage);
  /system script run het_HTTP_SEND;

  :if ($SENDOK != 1) do={ :log error "het_PUSH_USAGE_FAIL"; }
}

/system script add name="het_PUSH_ROUTERLOG" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global SENDDATA;
  :global SENDOK;
  :global HET_ROUTERLOG_LASTCOUNT;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }
  :if ([:typeof $HET_ROUTERLOG_LASTCOUNT] = "nothing") do={ :set HET_ROUTERLOG_LASTCOUNT 0; }

  :local ids [/log find];
  :local total [:len $ids];
  :if ($total = 0) do={ :set HET_ROUTERLOG_LASTCOUNT 0; :return; }
  :if ($HET_ROUTERLOG_LASTCOUNT <= 0) do={ :set HET_ROUTERLOG_LASTCOUNT $total; :return; }
  :if ($HET_ROUTERLOG_LASTCOUNT > $total) do={ :set HET_ROUTERLOG_LASTCOUNT 0; }

  :local startIdx $HET_ROUTERLOG_LASTCOUNT;
  :if (($total - $startIdx) > 20) do={ :set startIdx ($total - 20); }

  :for i from=$startIdx to=($total - 1) do={
    :local id [:pick $ids $i];
    :local t [/log get $id time];
    :local topics [/log get $id topics];
    :local msg [/log get $id message];
    :local sev "INFO";

    :if ([:find $msg "het_"] != nil) do={ :continue; }

    :if ([:find $topics "error"] != nil) do={ :set sev "CRITICAL"; }
    :if (($sev = "INFO") and ([:find $topics "warning"] != nil)) do={ :set sev "HIGH"; }

    :set SENDDATA ("token=" . $TOKEN . "&type=routerlog&site=" . $SITE);
    :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
    :set SENDDATA ($SENDDATA . "&log_time=" . $t);
    :set SENDDATA ($SENDDATA . "&topics=" . $topics);
    :set SENDDATA ($SENDDATA . "&severity=" . $sev);
    :set SENDDATA ($SENDDATA . "&message=" . $msg);
    /system script run het_HTTP_SEND;

    :if ($SENDOK != 1) do={ :log error "het_PUSH_ROUTERLOG_FAIL"; }
  }

  :set HET_ROUTERLOG_LASTCOUNT $total;
}

/system script add name="het_PUSH_CHANGE" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global SENDDATA;
  :global SENDOK;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }

  :local up [/system resource get uptime];
  :set SENDDATA ("token=" . $TOKEN . "&type=change&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&category=system&item=monitor");
  :set SENDDATA ($SENDDATA . "&action=heartbeat&details=uptime_" . $up);
  /system script run het_HTTP_SEND;

  :if ($SENDOK != 1) do={ :log error "het_PUSH_CHANGE_FAIL"; }
}

:log info "het events install finished"
