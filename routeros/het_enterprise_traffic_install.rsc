# het enterprise traffic install
# Lightweight compact ISP + site counters (ether1..ether5)

:log info "het enterprise traffic install started"

/system script add name="het_PUSH_TRAFFIC" policy=read,write,test,policy source={
  :global TOKEN;
  :global SITE;
  :global ROUTER;
  :global SENDDATA;
  :global SENDOK;

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG; }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }

  :local packed "";
  :local rx;
  :local tx;
  :local running;
  :local runNum;

  :do {
    :set rx [/interface get [find where name="ether1"] rx-byte];
    :set tx [/interface get [find where name="ether1"] tx-byte];
    :set running [/interface get [find where name="ether1"] running];
    :set runNum "0";
    :if ($running = true) do={ :set runNum "1"; }
    :set packed ($packed . "ether1|" . $rx . "|" . $tx . "|" . $runNum . ";");
  } on-error={}

  :do {
    :set rx [/interface get [find where name="ether2"] rx-byte];
    :set tx [/interface get [find where name="ether2"] tx-byte];
    :set running [/interface get [find where name="ether2"] running];
    :set runNum "0";
    :if ($running = true) do={ :set runNum "1"; }
    :set packed ($packed . "ether2|" . $rx . "|" . $tx . "|" . $runNum . ";");
  } on-error={}

  :do {
    :set rx [/interface get [find where name="ether3"] rx-byte];
    :set tx [/interface get [find where name="ether3"] tx-byte];
    :set running [/interface get [find where name="ether3"] running];
    :set runNum "0";
    :if ($running = true) do={ :set runNum "1"; }
    :set packed ($packed . "ether3|" . $rx . "|" . $tx . "|" . $runNum . ";");
  } on-error={}

  :do {
    :set rx [/interface get [find where name="ether4"] rx-byte];
    :set tx [/interface get [find where name="ether4"] tx-byte];
    :set running [/interface get [find where name="ether4"] running];
    :set runNum "0";
    :if ($running = true) do={ :set runNum "1"; }
    :set packed ($packed . "ether4|" . $rx . "|" . $tx . "|" . $runNum . ";");
  } on-error={}

  :do {
    :set rx [/interface get [find where name="ether5"] rx-byte];
    :set tx [/interface get [find where name="ether5"] tx-byte];
    :set running [/interface get [find where name="ether5"] running];
    :set runNum "0";
    :if ($running = true) do={ :set runNum "1"; }
    :set packed ($packed . "ether5|" . $rx . "|" . $tx . "|" . $runNum . ";");
  } on-error={}

  :local cpu [/system resource get cpu-load];
  :local memFree [/system resource get free-memory];
  :local memTot [/system resource get total-memory];
  :local mem 0;
  :local wanName "ISP";
  :local e2Name "Unity Shop";
  :local e3Name "Store Site-2";
  :local e4Name "Store Site-1";
  :local e5Name "BUK Site";
  :local uptime [/system resource get uptime];
  :local pubip "0.0.0.0";
  :local wanIds [/ip address find where interface="ether1" and disabled=no];
  :if ($memTot > 0) do={ :set mem (100 - (($memFree * 100) / $memTot)); }
  :if ([:len $wanIds] > 0) do={
    :local rawAddr [/ip address get [:pick $wanIds 0] address];
    :local slashPos [:find $rawAddr "/"];
    :if ($slashPos != nil) do={ :set pubip [:pick $rawAddr 0 $slashPos]; } else={ :set pubip $rawAddr; }
  }

  :set SENDDATA ("token=" . $TOKEN . "&type=traffic&site=" . $SITE);
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER);
  :set SENDDATA ($SENDDATA . "&wan=ether1");
  :set SENDDATA ($SENDDATA . "&wan_name=" . $wanName);
  :set SENDDATA ($SENDDATA . "&e2_name=" . $e2Name);
  :set SENDDATA ($SENDDATA . "&e3_name=" . $e3Name);
  :set SENDDATA ($SENDDATA . "&e4_name=" . $e4Name);
  :set SENDDATA ($SENDDATA . "&e5_name=" . $e5Name);
  :set SENDDATA ($SENDDATA . "&ifs=" . $packed);
  :set SENDDATA ($SENDDATA . "&cpu=" . $cpu . "&memory=" . $mem);
  :set SENDDATA ($SENDDATA . "&uptime=" . $uptime);
  :set SENDDATA ($SENDDATA . "&public_ip=" . $pubip);

  /system script run het_HTTP_SEND;
  :if ($SENDOK != 1) do={ :log error ("het_PUSH_TRAFFIC_FAIL len=" . [:len $SENDDATA]); }
}

/system scheduler remove [find name="het_traffic"]
/system scheduler add name="het_traffic" start-time=startup interval=5m on-event=":delay 20s; /system script run het_PUSH_TRAFFIC" policy=read,write,test,policy disabled=no

:log info "het enterprise traffic install finished"
