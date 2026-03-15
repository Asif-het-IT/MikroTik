# het transport install
# RouterOS 6.49.x safe minimal module

:log info "het transport install started"

/system script add name="het_HTTP_SEND" policy=read,write,test,policy source={
  :global APIURL;
  :global BACKUPURL;
  :global SENDDATA;
  :global SENDOK;
  :local header "Content-Type: application/x-www-form-urlencoded";
  :local payload "";

  :if ([:len $APIURL] = 0) do={ /system script run het_CONFIG; }

  :set SENDOK 0;
  :set payload [:tostr $SENDDATA];
  :if ([:len $payload] = 0) do={
    :log error "het_HTTP_SEND_DATA_EMPTY";
    :return;
  }

  :do {
    /tool fetch url=$APIURL http-method=post http-data=$payload http-header-field=$header check-certificate=no duration=10s output=none;
    :set SENDOK 1;
    :log info "het_HTTP_SEND_PRIMARY_OK";
  } on-error={
    :set SENDOK 0;
    :log warning "het_HTTP_SEND_PRIMARY_FAIL";
  }

  :if (($SENDOK != 1) and ([:len $BACKUPURL] > 0)) do={
    :do {
      /tool fetch url=$BACKUPURL http-method=post http-data=$payload http-header-field=$header check-certificate=no duration=10s output=none;
      :set SENDOK 1;
      :log warning "het_HTTP_SEND_BACKUP_OK";
    } on-error={
      :set SENDOK 0;
      :log error "het_HTTP_SEND_BACKUP_FAIL";
    }
  }

  :if ($SENDOK != 1) do={ :log error "het_HTTP_SEND_FAIL"; }
}

:log info "het transport install finished"
