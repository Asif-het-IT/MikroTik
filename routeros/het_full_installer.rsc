# het full installer wrapper
# Upload files first:
# 1. het_config_install.rsc
# 2. het_transport_install.rsc
# 3. het_telemetry_install.rsc
# 4. het_enterprise_traffic_install.rsc
# 5. het_events_install.rsc
# 6. het_live_users_install.rsc
# 7. het_user_usage_install.rsc
# 8. het_enterprise_monitor.rsc
# 9. het_mobile_vpn_monitor_install.rsc
# 10. het_schedulers_install.rsc

:log info "het full install started"
/import file-name=het_config_install.rsc
/import file-name=het_transport_install.rsc
/import file-name=het_telemetry_install.rsc
/import file-name=het_enterprise_traffic_install.rsc
/import file-name=het_events_install.rsc
/import file-name=het_live_users_install.rsc
/import file-name=het_user_usage_install.rsc
/import file-name=het_enterprise_monitor.rsc
/import file-name=het_mobile_vpn_monitor_install.rsc
/import file-name=het_schedulers_install.rsc
:log info "het full install finished"
