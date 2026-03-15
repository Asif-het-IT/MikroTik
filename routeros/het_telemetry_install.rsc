# het telemetry install
# RouterOS 6.49.x safe minimal module

:log info "het telemetry install started"

/system script add name="het_PUSH_LIVE" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global WANIF;
  :global SENDDATA;
  :global SENDOK;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }

  :local cpu [/system resource get cpu-load];
  :local memFree [/system resource get free-memory];
  :local memTot [/system resource get total-memory];
  :local mem 0;
  :local uptime [/system resource get uptime];
  :local peers 0;
  :local ipsec "DOWN";
  :local pubip "0.0.0.0";
  :local addrId [/ip address find where interface=$WANIF and disabled=no];

  :if ($memTot > 0) do={ :set mem (100 - (($memFree * 100) / $memTot)); }
  :do { :set peers [/ip ipsec active-peers print count-only]; } on-error={ :set peers 0; };
  :if ($peers > 0) do={ :set ipsec "UP"; }

  :if ([:len $addrId] > 0) do={
    :local rawAddr [/ip address get [:pick $addrId 0] address];
    :if ([:len $rawAddr] > 0) do={
      :local slashPos [:find $rawAddr "/"];
      :if ($slashPos != nil) do={ :set pubip [:pick $rawAddr 0 $slashPos]; } else={ :set pubip $rawAddr; }
    }
  }

  :set SENDDATA ("token=" . $TOKEN . "&type=live&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&status=ONLINE&message=router_live_ok");
  :set SENDDATA ($SENDDATA . "&cpu=" . $cpu . "&memory=" . $mem);
  :set SENDDATA ($SENDDATA . "&uptime=" . $uptime);
  :set SENDDATA ($SENDDATA . "&public_ip=" . $pubip);
  :set SENDDATA ($SENDDATA . "&ipsec=" . $ipsec . "&isp=n/a");
  /system script run het_HTTP_SEND;

  :if ($SENDOK != 1) do={ :log error ("het_PUSH_LIVE_FAIL len=" . [:len $SENDDATA]); }
}

/system script add name="het_VPN_CHECK" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global VPNHOST;
  :global SENDDATA;
  :global SENDOK;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }

  :local peers 0;
  :local ipsec "DOWN";
  :local status "DOWN";
  :local pingOk 0;

  :do { :set peers [/ip ipsec active-peers print count-only]; } on-error={ :set peers 0; };
  :if ($peers > 0) do={
    :set ipsec "UP";
    :set status "UP";
    :set pingOk 1;
  }

  :set SENDDATA ("token=" . $TOKEN . "&type=vpn&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&host=" . $VPNHOST);
  :set SENDDATA ($SENDDATA . "&status=" . $status . "&ping=" . $pingOk);
  :set SENDDATA ($SENDDATA . "&message=ipsec=" . $ipsec);
  /system script run het_HTTP_SEND;

  :if ($SENDOK != 1) do={ :log error ("het_VPN_CHECK_FAIL len=" . [:len $SENDDATA]); }
}

:log info "het telemetry install finished"
