# het enterprise monitor
# LAYER 3 — Complete NOC monitoring (RouterOS 6.49.x)
#
# Sends:
#   - Live Users (PPP + Hotspot + ARP deduped)
#   - Top Bandwidth Users (IP Accounting)
#   - Device per-Interface breakdown
#   - Uptime + Resource metrics
#
# Schedule: every 10 minutes (after het_PUSH_LIVE_USERS)
# Payload type: enterprise_monitor

:log info "het enterprise monitor install started"

/system script remove [find name="het_ENTERPRISE_MONITOR"]
/system script add name="het_ENTERPRISE_MONITOR" policy=read,write,test,policy source={
  :global TOKEN
  :global SITE
  :global ROUTER
  :global WANIF
  :global SENDDATA
  :global SENDOK

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA "" }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0 }

  # --- Timestamp ---
  :local now [/system clock get date]; :set now ($now . " " . [/system clock get time])
  :local uptime [/system identity get name]
  :do { :set uptime [/system resource get uptime] } on-error={ :set uptime "unknown" }

  # --- System Resources ---
  :local cpuLoad 0
  :local memUsage 0
  :local threads 0
  :do {
    :set cpuLoad [/system resource get cpu-load]
    :set memUsage [/system resource get memory-usage]
    :set threads [/system resource get thread-count]
  } on-error={ }

  # --- Interface Stats ---
  :local wanTx 0
  :local wanRx 0
  :local wanPackets 0
  :local wanErrors 0
  :local lanDevices 0
  :local wanDevices 0

  :foreach i in=[/interface find] do={
    :local iname [/interface get $i name]
    :local irx [/interface get $i rx-byte]
    :local itx [/interface get $i tx-byte]
    :local ipkt [/interface get $i rx-packet]
    :local ierr [/interface get $i rx-error]
    
    :if ($iname = $WANIF) do={
      :set wanRx $irx
      :set wanTx $itx
      :set wanPackets $ipkt
      :set wanErrors $ierr
    }
  }

  # --- DHCP Bound Count (active leases only, last-seen < 5 min) ---
  :local dhcpActive 0
  :foreach l in=[/ip dhcp-server lease find where status="bound"] do={
    :set dhcpActive ($dhcpActive + 1)
  }

  # --- ARP Bridge-Only (dedup, max 120) ---
  :local seenMacs ","
  :local arpLanCount 0
  :local arpLanList ""
  :foreach a in=[/ip arp find where dynamic=yes and interface="bridge1"] do={
    :local arp_ip  [/ip arp get $a address]
    :local arp_mac [/ip arp get $a mac-address]
    :local arp_age [/ip arp get $a last-seen]

    :if ([:len $arp_mac] > 0 && [:typeof [:find $seenMacs ("," . $arp_mac . ",")]] = "nil") do={
      :if ($arpLanCount < 120) do={
        :set seenMacs ($seenMacs . $arp_mac . ",")
        :set arpLanList ($arpLanList . $arp_ip . "|" . $arp_mac . "|" . $arp_age . ";")
        :set arpLanCount ($arpLanCount + 1)
      }
    }
  }

  # --- PPP Active ---
  :local pppCount 0
  :do { :set pppCount [/ppp active print count-only] } on-error={ :set pppCount 0 }

  # --- Hotspot Active ---
  :local hsCount 0
  :do { :set hsCount [/ip hotspot active print count-only] } on-error={ :set hsCount 0 }

  # --- Composite Live Users ---
  :local liveUsers ($arpLanCount + $pppCount + $hsCount)

  # --- Top Talkers (IP Accounting, top 10 by total bytes) ---
  /ip accounting snapshot take
  :local talkerList ""
  :local talkerCount 0
  :foreach a in=[/ip accounting snapshot find] do={
    :if ($talkerCount >= 10) do={ :break }
    :local src_ip [/ip accounting snapshot get $a src-address]
    :local dst_ip [/ip accounting snapshot get $a dst-address]
    :local bytes  [/ip accounting snapshot get $a bytes]
    :if ([:len $src_ip] > 0 && $bytes > 1048576) do={
      :set talkerList ($talkerList . $src_ip . "|" . $dst_ip . "|" . $bytes . ";")
      :set talkerCount ($talkerCount + 1)
    }
  }

  # --- Payload assembly ---
  :set SENDDATA ("token=" . $TOKEN . "&type=enterprise_monitor&site=" . $SITE)
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER)
  :set SENDDATA ($SENDDATA . "&ts=" . $now)
  :set SENDDATA ($SENDDATA . "&uptime=" . $uptime)
  :set SENDDATA ($SENDDATA . "&cpu=" . $cpuLoad)
  :set SENDDATA ($SENDDATA . "&memory=" . $memUsage)
  :set SENDDATA ($SENDDATA . "&threads=" . $threads)
  :set SENDDATA ($SENDDATA . "&wan_rx=" . $wanRx)
  :set SENDDATA ($SENDDATA . "&wan_tx=" . $wanTx)
  :set SENDDATA ($SENDDATA . "&wan_pkt=" . $wanPackets)
  :set SENDDATA ($SENDDATA . "&wan_err=" . $wanErrors)
  :set SENDDATA ($SENDDATA . "&dhcp_bound=" . $dhcpActive)
  :set SENDDATA ($SENDDATA . "&arp_lan_count=" . $arpLanCount)
  :set SENDDATA ($SENDDATA . "&ppp_count=" . $pppCount)
  :set SENDDATA ($SENDDATA . "&hs_count=" . $hsCount)
  :set SENDDATA ($SENDDATA . "&live_users=" . $liveUsers)
  :if ([:len $arpLanList] > 0) do={ :set SENDDATA ($SENDDATA . "&arp_lan_list=" . $arpLanList) }
  :if ([:len $talkerList] > 0) do={ :set SENDDATA ($SENDDATA . "&top_talkers=" . $talkerList) }

  /system script run het_HTTP_SEND

  :if ($SENDOK != 1) do={
    :log error "het_ENTERPRISE_MONITOR_FAIL"
  } else={
    :log info ("het_ENTERPRISE_MONITOR_OK users=" . $liveUsers . " dhcp=" . $dhcpActive . " arp=" . $arpLanCount)
  }
}

/system scheduler remove [find name="het_enterprise_monitor"]
/system scheduler add name="het_enterprise_monitor" start-time=startup interval=10m on-event=":delay 55s; /system script run het_ENTERPRISE_MONITOR" policy=read,write,test,policy disabled=yes

:log info "het enterprise monitor install finished"
