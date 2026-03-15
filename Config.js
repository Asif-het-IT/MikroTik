this.HET = this.HET || {};

(function(ns) {
  if (ns.CFG && ns.SHEETS && typeof ns.ss === 'function') return;

  ns.CFG = {
    MONITOR_TOKEN: 'MONITOR_TOKEN_2026',
    SITE_DEFAULT: 'KANO',
    NOC_TITLE: 'het',
    TZ: 'Asia/Dubai',
    DATE_FMT: 'dd-MMM-yyyy',
    TIME_FMT: 'hh:mm a',
    DATE_TIME_FMT: 'dd-MMM-yyyy hh:mm a',

    TG_BOT: '8546997581:AAEEyKvRaR_QzhBrSBCLwseYgHTBHMizSkg',
    TG_CHAT: '-1003786414616',
    TG_DEBUG_ENABLE: 'YES',
    TG_AUTH_STRICT: 'NO',
    TG_STRICT_MENTION: 'NO',
    EMAILS: 'asif@harisheximtrading.com,hetnigeria@harisheximtrading.com',

    DASH_REFRESH_MIN: 5,
    ALERT_REFRESH_MIN: 2,
    DAILY_REPORT_TIME: '11:59',

    CPU_WARN: 70,
    CPU_CRIT: 85,
    MEM_WARN: 80,
    MEM_CRIT: 90,
    STALE_WARN: 15,
    STALE_CRIT: 25,
    TRAFFIC_STALE_WARN: 8,
    TRAFFIC_STALE_CRIT: 20,
    ALERT_STALE_COOLDOWN_MIN: 30,
    ALERT_ROUTERLOG_COOLDOWN_MIN: 30,
    OUTBOX_DROP_AGE_MIN: 10,
    REALTIME_ALERT_ENABLE: 'YES',
    REALTIME_TELEGRAM_ENABLE: 'YES',
    REALTIME_EMAIL_ENABLE: 'NO',
    DAILY_TELEGRAM_ENABLE: 'YES',
    DAILY_EMAIL_ENABLE: 'YES',
    ROUTERLOG_ALERT_ENABLE: 'NO',
    ROUTERLOG_ALERT_KEYWORDS: 'critical,error,fail,down,panic,denied,attack',
    ROUTERLOG_ALERT_BLOCK: 'het_,logged in,logged out,script removed,new script added,install started,install finished',
    TREND_SAMPLES: 180,
    RECENT_WINDOW_HOURS: 24,
    DASHBOARD_ALERT_ROWS: 5,
    USERS_SNAPSHOT_MAX_AGE_MIN: 45,
    LIVE_USERS_ENABLE: 'YES',
    LIVE_USERS_MAX_AGE_MIN: 15,
    RAW_KEEP_ROWS: 2000,
    AUTO_SEND_OUTBOX: 'YES',
    COMMAND_BATCH_LIMIT: 3,

    MOBILE_VPN_SITE: 'KANO',
    MOBILE_VPN_SERVICE: 'Mobile VPN',
    MOBILE_VPN_TYPE: 'L2TP/IPsec',
    MOBILE_VPN_POOL_START: '10.20.30.10',
    MOBILE_VPN_POOL_END: '10.20.30.20',
    MOBILE_VPN_FAIL_WARN_THRESHOLD: 3,
    MOBILE_VPN_TRACKED_USERS: 'asif,het2,het3,het4',

    TRAFFIC_WAN_NAME: 'ISP',
    TRAFFIC_E2_NAME: 'Unity Shop',
    TRAFFIC_E3_NAME: 'Store Site-2',
    TRAFFIC_E4_NAME: 'Store Site-1',
    TRAFFIC_E5_NAME: 'BUK Site',

    WEBAPP_EXEC_URL: 'https://script.google.com/macros/s/AKfycbx40IW46YtUHZ8_YTLMnU48VIRZwnyqhgVFRJNutKKLZ8MrucMBTxP9yfqf_Dk6_g1O/exec',

    SS_ID: '1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc'
  };

  ns.SHEETS = {
    ROUTER_STATUS: 'Router Status',
    INTERFACE_TRAFFIC: 'Interface Traffic',
    CONNECTED_USERS: 'Connected Users',
    USER_DATA_USAGE: 'User Data Usage',
    VPN_STATUS: 'VPN Status',
    RDP_LOGS: 'RDP Logs',
    ROUTER_LOGS: 'Router Logs',
    ROUTER_CHANGES: 'Router Changes',
    RAW_TRAFFIC_LOG: 'Raw_Traffic_Log',
    ALERTS: 'Alerts',
    DAILY_REPORTS: 'Daily Reports',
    RAW_LIVE: 'RAW Live',
    RAW_EVENTS: 'RAW Events',
    DASHBOARD: 'Dashboard',
    OUTBOX: 'Outbox',
    COMMAND_CENTER: 'Command Center',
    SMART_SUMMARY_LOG: 'Smart Summary Log',
    SHEET_HEALTH: 'Sheet Health',
    RAW_USER_USAGE: 'Raw_User_Usage',
    DEVICE_MAPPING: 'Device_Mapping',
    DAILY_USER_SUMMARY: 'Daily_User_Summary',
    MONTHLY_USER_SUMMARY: 'Monthly_User_Summary',
    TOP_USERS_DAILY: 'Top_Users_Daily',
    TOP_USERS_MONTHLY: 'Top_Users_Monthly',
    REPORTS_OUTPUT: 'Reports_Output',
    LIVE_USERS: 'Live_Users',
    ENTERPRISE_MONITOR: 'Enterprise_Monitor',
    ENTERPRISE_DEVICES: 'Enterprise_Devices',
    ENTERPRISE_TALKERS: 'Enterprise_Talkers',
    MOBILE_VPN_EVENTS: 'Mobile_VPN_Events',
    MOBILE_VPN_ACTIVE: 'Mobile_VPN_Active',
    MOBILE_VPN_SUMMARY: 'Mobile_VPN_Summary'
  };

  ns.HEADERS = {};
  ns.HEADERS[ns.SHEETS.ROUTER_STATUS] = ['Time', 'Site', 'Router', 'Status', 'Message', 'CPU', 'Memory %', 'Uptime', 'Public IP', 'IPsec', 'ISP'];
  ns.HEADERS[ns.SHEETS.INTERFACE_TRAFFIC] = ['Time', 'Site', 'Router', 'Interface', 'Upload', 'Download', 'Status'];
  ns.HEADERS[ns.SHEETS.CONNECTED_USERS] = ['Time', 'Site', 'Router', 'IP', 'MAC', 'Hostname', 'Interface', 'Connection Type'];
  ns.HEADERS[ns.SHEETS.USER_DATA_USAGE] = ['Time', 'Site', 'Router', 'IP', 'Upload', 'Download', 'Total'];
  ns.HEADERS[ns.SHEETS.VPN_STATUS] = ['Time', 'Site', 'Router', 'Host', 'Status', 'Ping', 'Message'];
  ns.HEADERS[ns.SHEETS.RDP_LOGS] = ['Time', 'Site', 'Router', 'Source', 'Destination', 'Protocol', 'Message'];
  ns.HEADERS[ns.SHEETS.ROUTER_LOGS] = ['Time', 'Site', 'Router', 'Log Time', 'Topics', 'Severity', 'Message'];
  ns.HEADERS[ns.SHEETS.ROUTER_CHANGES] = ['Time', 'Site', 'Router', 'Category', 'Item', 'Action', 'Details'];
  ns.HEADERS[ns.SHEETS.RAW_TRAFFIC_LOG] = ['Timestamp', 'Router', 'Site', 'WAN Interface (ISP)', 'WAN RX Bytes', 'WAN TX Bytes', 'WAN Total Bytes', 'WAN Running', 'ether2 (Unity Shop) RX Bytes', 'ether2 (Unity Shop) TX Bytes', 'ether2 (Unity Shop) Total Bytes', 'ether2 (Unity Shop) Running', 'ether3 (Store Site-2) RX Bytes', 'ether3 (Store Site-2) TX Bytes', 'ether3 (Store Site-2) Total Bytes', 'ether3 (Store Site-2) Running', 'ether4 (Store Site-1) RX Bytes', 'ether4 (Store Site-1) TX Bytes', 'ether4 (Store Site-1) Total Bytes', 'ether4 (Store Site-1) Running', 'ether5 (BUK Site) RX Bytes', 'ether5 (BUK Site) TX Bytes', 'ether5 (BUK Site) Total Bytes', 'ether5 (BUK Site) Running', 'CPU', 'Memory', 'Uptime', 'Public IP', 'Push Status', 'Raw IF Blocks'];
  ns.HEADERS[ns.SHEETS.ALERTS] = ['Time', 'Severity', 'Site', 'Router', 'Type', 'Message', 'Metadata'];
  ns.HEADERS[ns.SHEETS.DAILY_REPORTS] = ['Generated At', 'Site', 'Router', 'Router Status', 'VPN', 'CPU %', 'Memory %', 'DHCP Users Snapshot', 'Critical Alerts', 'High Alerts', 'Medium Alerts', 'Top Users'];
  ns.HEADERS[ns.SHEETS.RAW_LIVE] = ['Time', 'Type', 'Site', 'Router', 'Payload'];
  ns.HEADERS[ns.SHEETS.RAW_EVENTS] = ['Time', 'Type', 'Site', 'Router', 'Payload'];
  ns.HEADERS[ns.SHEETS.DASHBOARD] = ['Section', 'Label', 'Value', 'State', 'Updated At'];
  ns.HEADERS[ns.SHEETS.OUTBOX] = ['Time', 'Channel', 'Subject', 'Message', 'Status', 'Attempts', 'Meta'];
  ns.HEADERS[ns.SHEETS.COMMAND_CENTER] = ['Time', 'Requested By', 'Command', 'Target', 'Prompt', 'Status', 'Result', 'Output Channel', 'Updated At', 'Meta'];
  ns.HEADERS[ns.SHEETS.SMART_SUMMARY_LOG] = ['Time', 'Command', 'Status', 'Engine', 'Prompt', 'Response', 'Meta'];
  ns.HEADERS[ns.SHEETS.SHEET_HEALTH] = ['Checked At', 'Sheet', 'Last Data Time', 'Age (min)', 'Data Rows', 'Status', 'Notes'];
  ns.HEADERS[ns.SHEETS.RAW_USER_USAGE] = ['Time', 'Site', 'Router', 'IP', 'MAC', 'Hostname', 'Comment', 'Interface', 'Upload Bytes', 'Download Bytes', 'Total Bytes', 'Source', 'Window Key'];
  ns.HEADERS[ns.SHEETS.DEVICE_MAPPING] = ['MAC', 'Hostname', 'Comment', 'Device Type', 'Notes', 'Preferred Name', 'Last Seen IP', 'Last Seen'];
  ns.HEADERS[ns.SHEETS.DAILY_USER_SUMMARY] = ['Date', 'Site', 'Router', 'MAC', 'IP', 'Hostname', 'Comment', 'Device Type', 'Upload Delta', 'Download Delta', 'Total Delta', 'Samples', 'Last Seen'];
  ns.HEADERS[ns.SHEETS.MONTHLY_USER_SUMMARY] = ['Month', 'Site', 'Router', 'MAC', 'IP', 'Hostname', 'Comment', 'Device Type', 'Upload Delta', 'Download Delta', 'Total Delta', 'Days Active', 'Last Seen'];
  ns.HEADERS[ns.SHEETS.TOP_USERS_DAILY] = ['Date', 'Rank', 'IP', 'MAC', 'Hostname', 'Comment', 'Device Type', 'Upload', 'Download', 'Total'];
  ns.HEADERS[ns.SHEETS.TOP_USERS_MONTHLY] = ['Month', 'Rank', 'IP', 'MAC', 'Hostname', 'Comment', 'Device Type', 'Upload', 'Download', 'Total'];
  ns.HEADERS[ns.SHEETS.REPORTS_OUTPUT] = ['Time', 'Report Type', 'Period Key', 'Rank', 'IP', 'MAC', 'Hostname', 'Comment', 'Device Type', 'Upload', 'Download', 'Total', 'Meta'];
  ns.HEADERS[ns.SHEETS.LIVE_USERS] = ['Time', 'Site', 'Router', 'PPP Active', 'Hotspot Active', 'LAN ARP Unique', 'Total Live Users', 'Entries'];
  ns.HEADERS[ns.SHEETS.ENTERPRISE_MONITOR] = ['Time', 'Site', 'Router', 'Uptime', 'CPU %', 'Memory %', 'WAN RX', 'WAN TX', 'WAN Packets', 'WAN Errors', 'DHCP Bound', 'ARP LAN', 'PPP', 'Hotspot', 'Live Users', 'Top Talkers'];
  ns.HEADERS[ns.SHEETS.ENTERPRISE_DEVICES] = ['Time', 'Site', 'Router', 'IP', 'MAC', 'Interface', 'Last Seen', 'Device Type'];
  ns.HEADERS[ns.SHEETS.ENTERPRISE_TALKERS] = ['Time', 'Site', 'Router', 'Source IP', 'Destination IP', 'Bytes', 'Category'];
  ns.HEADERS[ns.SHEETS.MOBILE_VPN_EVENTS] = ['Timestamp', 'Site', 'Service', 'VPN Type', 'Username', 'Assigned VPN IP', 'Source Public IP', 'Event Type', 'Status', 'Notes'];
  ns.HEADERS[ns.SHEETS.MOBILE_VPN_ACTIVE] = ['Timestamp', 'Site', 'Service', 'VPN Type', 'Username', 'Assigned VPN IP', 'Source Public IP', 'Connection Start Time', 'Connection Status'];
  ns.HEADERS[ns.SHEETS.MOBILE_VPN_SUMMARY] = ['Timestamp', 'Site', 'Service', 'VPN Type', 'Service Status', 'L2TP Server', 'Health', 'Current Active Users', 'Connected Usernames', 'Assigned VPN IPs', 'Source Public IPs', 'Last Event', 'Last Connection Time', 'Failed Logins Today', 'Total Connects Today', 'Total Disconnects Today', 'Last Connected User', 'Last Disconnected User', 'VPN Pool', 'Pool Usage', 'Notes'];

  ns.props = function() {
    return PropertiesService.getScriptProperties();
  };

  ns.cfg = function() {
    var p = ns.props().getProperties();
    var out = {};
    var k;
    for (k in ns.CFG) out[k] = ns.CFG[k];
    for (k in p) out[k] = p[k];
    out.NOC_TITLE = 'het';
    return out;
  };

  ns.ss = function() {
    var c = ns.cfg();
    var ssId = String(c.SS_ID || '').trim();
    if (!ssId) {
      throw new Error('SS_ID missing. Production sheet ID is required.');
    }
    var ss = SpreadsheetApp.openById(ssId);
    ss.setSpreadsheetTimeZone(c.TZ || 'Asia/Dubai');
    return ss;
  };
})(this.HET);
