# het user usage install - v2 (IP Accounting snapshot)
# RouterOS 6.49.x — uses /ip accounting snapshot for reliable per-device usage.
# No queue simple dependency. Works on any LAN setup.
# Safe: scheduler disabled=yes by default.

:log info "het user usage install v2 started"

/system script remove [find name="het_PUSH_USER_USAGE"]
/system script add name="het_PUSH_USER_USAGE" policy=read,write,test,policy source={
  :global TOKEN
  :global SITE
  :global ROUTER
  :global SENDDATA
  :global SENDOK

  :if ([:len $TOKEN] = 0) do={ /system script run het_CONFIG }
  :if ([:typeof $SENDDATA] = "nothing") do={ :set SENDDATA "" }
  :if ([:typeof $SENDOK] = "nothing") do={ :set SENDOK 0 }

  # Take IP accounting snapshot — captures interval bytes since last snapshot.
  # Each push is a delta (bytes transferred in last 30 min), not cumulative.
  /ip accounting snapshot take

  :local entries ""
  :local maxRows 50
  :local count 0
  :local ts [/system clock get time]

  # Iterate all DHCP leases (all, not just bound — captures today's users even after lease expires)
  :foreach l in=[/ip dhcp-server lease find] do={
    :if ($count >= $maxRows) do={ :break }

    :local ip      [/ip dhcp-server lease get $l address]
    :local mac     [/ip dhcp-server lease get $l mac-address]
    :local host    [/ip dhcp-server lease get $l host-name]
    :local comment [/ip dhcp-server lease get $l comment]

    :if ([:len $host]    = 0) do={ :set host    "unknown" }
    :if ([:len $comment] = 0) do={ :set comment "n/a"     }

    # Upload: sum bytes where this IP is the source (LAN→WAN)
    :local upload 0
    :foreach a in=[/ip accounting snapshot find where src-address=$ip] do={
      :set upload ($upload + [/ip accounting snapshot get $a bytes])
    }

    # Download: sum bytes where this IP is the destination (WAN→LAN)
    :local download 0
    :foreach a in=[/ip accounting snapshot find where dst-address=$ip] do={
      :set download ($download + [/ip accounting snapshot get $a bytes])
    }

    # Skip devices with no activity (< 1 KB filters ARP/discovery noise)
    :if (($upload + $download) > 1024) do={
      :set entries ($entries . $ip . "|" . $mac . "|" . $host . "|" . $comment . "|lan|" . $upload . "|" . $download . ";")
      :set count ($count + 1)
    }
  }

  :if ([:len $entries] = 0) do={ :log info "het_PUSH_USER_USAGE_NO_ROWS" ; :return }

  :set SENDDATA ("token=" . $TOKEN . "&type=user_usage&site=" . $SITE)
  :set SENDDATA ($SENDDATA . "&router=" . $ROUTER . "&source=accounting_delta")
  :set SENDDATA ($SENDDATA . "&ts=" . $ts . "&entries=" . $entries)

  /system script run het_HTTP_SEND
  :if ($SENDOK != 1) do={ :log error "het_PUSH_USER_USAGE_FAIL" }
}

/system scheduler remove [find name="het_user_usage"]
/system scheduler add name="het_user_usage" start-time=startup interval=30m on-event=":delay 45s; /system script run het_PUSH_USER_USAGE" policy=read,write,test,policy disabled=yes

:log info "het user usage install v2 finished"
