# het live users install
# LAYER 2 — Real Live Users metric (RouterOS 6.49.x)
#
# Counts: PPP active + Hotspot active + Unique LAN ARP clients.
# Rules: exclude WAN ARP, exclude router/bridge local MACs, dedupe by MAC or IP.
# Payload type: live_users
#
# DEPLOY STEPS:
#   1. Paste this file in RouterOS terminal.
#   2. Script is installed; scheduler is created as disabled=yes.
#   3. In Apps Script properties, set LIVE_USERS_ENABLE=YES.
#   4. Enable scheduler on router: /system scheduler enable het_live_users
#   5. Layer 2 is now active. Verify via Telegram: /status

:log info "het live users install started"

/system script remove [find name="het_PUSH_LIVE_USERS"]
/system script add name="het_PUSH_LIVE_USERS" policy=read,write,test,policy source={
  :global TOKEN
  :global SITE
  :global ROUTER
  :global WANIF
  :global SENDDATA
  :global SENDOK

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA "" }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0 }

  # --- PPP active sessions (VPN / PPPoE WAN clients) ---
  :local pppCount 0
  :do { :set pppCount [/ppp active print count-only] } on-error={ :set pppCount 0 }

  # --- Hotspot active sessions (captive portal) ---
  :local hsCount 0
  :do { :set hsCount [/ip hotspot active print count-only] } on-error={ :set hsCount 0 }

  # --- Build local MAC list (router interfaces/bridge), used to exclude self entries ---
  :local localMacs ","
  :foreach i in=[/interface find] do={
    :local ifMac [/interface get $i mac-address]
    :if ([:len $ifMac] > 0) do={ :set localMacs ($localMacs . $ifMac . ",") }
  }

  # --- Unique LAN ARP clients (router-only source) ---
  :local seenIPs ","
  :local seenMacs ","
  :local entries ""
  :local arpCount 0
  :local maxArpRows 120
  :foreach a in=[/ip arp find where dynamic=yes and interface!=$WANIF] do={
    :if ($arpCount >= $maxArpRows) do={ :break }
    :local arpIp  [/ip arp get $a address]
    :local arpMac [/ip arp get $a mac-address]
    :local arpIf  [/ip arp get $a interface]

    :if ([:len $arpIp] = 0) do={ :set arpIp "0.0.0.0" }
    :if ([:len $arpMac] = 0) do={ :set arpMac "00:00:00:00:00:00" }

    # Skip router/bridge own MAC entries
    :if ([:typeof [:find $localMacs ("," . $arpMac . ",")]] != "nil") do={ :continue }

    # Accept only if both IP and MAC are new (dedupe by MAC or IP)
    :if (([:typeof [:find $seenIPs ("," . $arpIp . ",")]] = "nil") and ([:typeof [:find $seenMacs ("," . $arpMac . ",")]] = "nil")) do={
      :if ([:len $entries] < 12000) do={
        :set entries ($entries . $arpIp . "|" . $arpMac . "|" . $arpIf . "|ARP;")
        :set seenIPs ($seenIPs . "," . $arpIp . ",")
        :set seenMacs ($seenMacs . "," . $arpMac . ",")
        :set arpCount ($arpCount + 1)
      }
    }
  }

  # Composite per enterprise formula
  :local total ($pppCount + $hsCount + $arpCount)

  :set SENDDATA ("token=" . $TOKEN . "&type=live_users&site=" . $SITE)
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER)
  :set SENDDATA ($SENDDATA . "&ppp="     . $pppCount)
  :set SENDDATA ($SENDDATA . "&hotspot=" . $hsCount)
  :set SENDDATA ($SENDDATA . "&arp_lan=" . $arpCount)
  :set SENDDATA ($SENDDATA . "&total="   . $total)
  :set SENDDATA ($SENDDATA . "&entries=" . $entries)
  /system script run het_HTTP_SEND

  :if ($SENDOK != 1) do={
    :log error "het_PUSH_LIVE_USERS_FAIL"
  } else={
    :log info ("het_PUSH_LIVE_USERS_OK ppp=" . $pppCount . " hs=" . $hsCount . " arp=" . $arpCount . " total=" . $total)
  }
}

/system scheduler remove [find name="het_live_users"]
/system scheduler add name="het_live_users" start-time=startup interval=10m on-event=":delay 50s; /system script run het_PUSH_LIVE_USERS" policy=read,write,test,policy disabled=yes

:log info "het live users install finished"
