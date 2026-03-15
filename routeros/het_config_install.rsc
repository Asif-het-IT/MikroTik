# het config install
# RouterOS 6.49.x safe minimal module

:log info "het config install started"

/system scheduler remove [find name~"het_"]
/system script remove [find name~"het_"]

/system script add name="het_CONFIG" policy=read,write,test,policy source={
  :global APIURL "https://mikrotik-monitor-proxy.hetgraphic17.workers.dev";
  :global BACKUPURL "";
  :global TOKEN "MONITOR_TOKEN_2026";
  :global SITE "KANO";
  :global ROUTER "AMBARIYYA_GLOBAL";
  :global WANIF "ether1";
  :global VPNHOST "vpn.hetdubai.com";
  :global SENDDATA;
  :global SENDOK;
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA ""; }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0; }
  :log info "het_CONFIG_LOADED";
}

/system script run het_CONFIG

:log info "het config install finished"
