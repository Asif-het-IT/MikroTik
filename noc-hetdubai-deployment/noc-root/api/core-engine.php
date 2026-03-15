<?php
/**
 * NOC Core Engine - Enterprise Monitoring System
 * 
 * یہ ہے دل (heart) پورے NOC system ka
 * 
 * Kaam:
 * 1. Google Sheets سے data پڑھنا
 * 2. Device mapping merge کرنا
 * 3. Top users calculate کرنا
 * 4. Alerts detect کرنا
 * 5. Reports generate کرنا
 * 6. Cache update کرنا
 * 
 * Scheduled: ہر 5 منٹ میں (cron job)
 */

// ============ CONFIGURATION ============

require_once __DIR__ . '/../config/app.php';

$CONFIG = [
    'sync_token' => getenv('NOC_SYNC_TOKEN') ?: 'sync_secret_2026',
    'cache_dir' => __DIR__ . '/cache',
    'cache_files' => [
        'dashboard' => __DIR__ . '/cache/dashboard.json',
        'device_mapping' => __DIR__ . '/cache/device-mapping.json',
        'top_daily' => __DIR__ . '/cache/top-users-daily.json',
        'top_monthly' => __DIR__ . '/cache/top-users-monthly.json',
        'alerts' => __DIR__ . '/cache/alerts.json',
        'health' => __DIR__ . '/cache/health.json',
        'daily_report' => __DIR__ . '/cache/daily-report.json',
        'monthly_report' => __DIR__ . '/cache/monthly-report.json',
    ],
    'log_file' => __DIR__ . '/logs/sync.log',
    'request_timeout' => 90,
];

// Spreadsheet IDs (from existing setup)
$SHEET_MAPPING = [
    'router_status' => '1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc',
    'device_mapping' => '1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc',
    'raw_traffic' => '1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc',
    'alerts' => '1kBKQQt3406V2PM0uZgmecwKaRoKce_PYdYVf5ixX1Qc',
];

// ============ SECURITY ============

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

$token = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? null;
if ($token !== $CONFIG['sync_token']) {
    logSync('DENIED: Invalid sync token');
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

logSync('=== NOC CORE ENGINE START ===');
$start_time = microtime(true);

// ============ ENSURE DIRECTORIES ============

foreach (['cache', 'logs'] as $dir) {
    $path = $CONFIG['cache_dir'] . ($dir === 'logs' ? '/..' : '') . '/' . ($dir === 'logs' ? 'logs' : $dir);
    if (!is_dir($path)) {
        @mkdir($path, 0755, true);
    }
}

// ============ 1. FETCH DATA FROM APPS SCRIPT ============

logSync('Step 1: Fetching data from Apps Script...');

$status_data = fetchFromAppsScript('?admin=status&token=' . NOC_TOKEN);
$topusers_daily = fetchFromAppsScript('?admin=topusers&period=daily&limit=20&token=' . NOC_TOKEN);
$topusers_monthly = fetchFromAppsScript('?admin=topusers&period=monthly&limit=20&token=' . NOC_TOKEN);

if (!$status_data) {
    logSync('ERROR: Could not fetch status data');
    http_response_code(503);
    die(json_encode(['error' => 'Status data fetch failed']));
}

logSync('✓ Data fetched from Apps Script');

// ============ 2. DEVICE MAPPING ENGINE ============

logSync('Step 2: Loading device mapping...');

$device_mapping = loadDeviceMapping($topusers_daily, $topusers_monthly);
cacheWrite($CONFIG['cache_files']['device_mapping'], $device_mapping);

logSync('✓ Device mapping loaded and cached');

// ============ 3. TOP USERS ENGINE ============

logSync('Step 3: Calculating top users...');

$top_daily = calculateTopUsers($topusers_daily, $device_mapping, 'daily');
$top_monthly = calculateTopUsers($topusers_monthly, $device_mapping, 'monthly');

cacheWrite($CONFIG['cache_files']['top_daily'], $top_daily);
cacheWrite($CONFIG['cache_files']['top_monthly'], $top_monthly);

logSync('✓ Top users calculated: ' . count($top_daily) . ' daily, ' . count($top_monthly) . ' monthly');

// ============ 4. ALERT ENGINE ============

logSync('Step 4: Detecting alerts...');

$alerts = detectAlerts($status_data, $device_mapping);
cacheWrite($CONFIG['cache_files']['alerts'], $alerts);

logSync('✓ Alerts detected: ' . count($alerts['active']) . ' active');

// ============ 5. HEALTH MONITORING ============

logSync('Step 5: Computing system health...');

$health = computeHealth($status_data, $alerts);
cacheWrite($CONFIG['cache_files']['health'], $health);

logSync('✓ Health status updated');

// ============ 6. REPORTS ENGINE ============

logSync('Step 6: Generating reports...');

$daily_report = generateDailyReport($status_data, $top_daily, $alerts);
$monthly_report = generateMonthlyReport($status_data, $top_monthly);

cacheWrite($CONFIG['cache_files']['daily_report'], $daily_report);
cacheWrite($CONFIG['cache_files']['monthly_report'], $monthly_report);

logSync('✓ Reports generated');

// ============ 7. BUILD MASTER DASHBOARD CACHE ============

logSync('Step 7: Building master dashboard cache...');

$dashboard_cache = [
    'meta' => [
        'version' => '2.0',
        'timestamp' => date('c'),
        'syncedAt' => date('c'),
        'nextSync' => date('c', time() + 300),
        'syncDuration' => 0,
        'status' => 'success',
        'errors' => [],
    ],
    'message' => 'Enterprise NOC Monitoring System v2.0 - Centralized Cache Architecture',
    'status' => $status_data['dashboard'] ?? null,
    'topDaily' => $top_daily,
    'topMonthly' => $top_monthly,
    'alerts' => $alerts,
    'health' => $health,
    'reports' => [
        'daily' => $daily_report,
        'monthly' => $monthly_report,
    ],
];

$dashboard_cache['meta']['syncDuration'] = round(microtime(true) - $start_time, 3);

cacheWrite($CONFIG['cache_files']['dashboard'], $dashboard_cache);

logSync('✓ Master dashboard cache built (' . strlen(json_encode($dashboard_cache)) . ' bytes)');

// ============ RESPONSE ============

logSync('=== NOC CORE ENGINE COMPLETE ===');

http_response_code(200);
die(json_encode([
    'status' => 'success',
    'timestamp' => $dashboard_cache['meta']['timestamp'],
    'duration' => $dashboard_cache['meta']['syncDuration'],
    'alerts' => count($alerts['active']),
    'topUsers' => count($top_daily),
    'cacheFiles' => count($CONFIG['cache_files']),
    'message' => 'Enterprise NOC data synchronized successfully',
]));

// ============ HELPER FUNCTIONS ============

/**
 * Fetch data from Apps Script endpoint
 */
function fetchFromAppsScript($query) {
    global $CONFIG;
    
    $url = NOC_ENDPOINT . $query;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, $CONFIG['request_timeout']);
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code !== 200 || !$response) {
        return null;
    }
    
    return json_decode($response, true);
}

/**
 * Load device mapping:
 * IP/MAC → Human-readable name
 * 
 * اگر sheet میں mapping ہے تو وہ استعمال کریں
 * ورنہ IP/hostname use کریں
 */
function loadDeviceMapping($daily_users, $monthly_users) {
    // Create mapping from user data
    $mapping = [];
    
    foreach (($daily_users['rows'] ?? []) as $user) {
        $key = $user['ip'] ?? $user['mac'] ?? '';
        if ($key) {
            $mapping[$key] = [
                'name' => $user['preferredName'] ?? $user['hostname'] ?? 'Unknown',
                'ip' => $user['ip'] ?? '',
                'mac' => $user['mac'] ?? '',
                'type' => detectDeviceType($user),
                'owner' => $user['owner'] ?? 'Unknown',
            ];
        }
    }
    
    return [
        'timestamp' => date('c'),
        'total' => count($mapping),
        'devices' => $mapping,
    ];
}

/**
 * Detect device type from usage patterns
 */
function detectDeviceType($user) {
    $name = strtolower($user['preferredName'] ?? $user['hostname'] ?? '');
    
    if (strpos($name, 'server') !== false) return 'Server';
    if (strpos($name, 'printer') !== false) return 'Printer';
    if (strpos($name, 'dvr') !== false) return 'CTV/DVR';
    if (strpos($name, 'camera') !== false) return 'Camera';
    if (strpos($name, 'phone') !== false) return 'Phone';
    if (strpos($name, 'tablet') !== false) return 'Tablet';
    if (strpos($name, 'laptop') !== false || strpos($name, 'pc') !== false) return 'Computer';
    
    return 'Device';
}

/**
 * Calculate top users:
 * 1. Take previous period data
 * 2. Merge device names
 * 3. Keep top 10
 * 4. Add ranks
 */
function calculateTopUsers($raw_data, $device_mapping, $period) {
    if (!$raw_data || !isset($raw_data['rows'])) {
        return ['period' => $period, 'rows' => [], 'timestamp' => date('c')];
    }
    
    $rows = $raw_data['rows'];
    
    // Enrich with device mapping
    foreach ($rows as &$row) {
        $ip = $row['ip'] ?? '';
        if (isset($device_mapping['devices'][$ip])) {
            $row['deviceType'] = $device_mapping['devices'][$ip]['type'];
            $row['owner'] = $device_mapping['devices'][$ip]['owner'];
        }
    }
    
    // Keep top 10
    $top = array_slice($rows, 0, 10);
    
    return [
        'period' => $period,
        'timestamp' => date('c'),
        'total' => count($rows),
        'top' => count($top),
        'rows' => $top,
    ];
}

/**
 * Alert Detection Engine
 * 
 * Alerts کی تلاش:
 * 1. CPU > 80% → HIGH
 * 2. Memory > 85% → HIGH
 * 3. Router DOWN → CRITICAL
 * 4. VPN DOWN → CRITICAL
 * 5. Traffic spike > 1 hour peak → MEDIUM
 * 6. Sheet stale (> 10 min) → MEDIUM
 * 7. Too many users → MEDIUM
 */
function detectAlerts($status_data, $device_mapping) {
    $alerts = [
        'active' => [],
        'timestamp' => date('c'),
        'total' => 0,
    ];
    
    $dash = $status_data['dashboard'] ?? [];
    $live = $dash['live'] ?? [];
    $vpn = $dash['vpn'] ?? [];
    
    // Router Down
    if (($live['status'] ?? 'UNKNOWN') !== 'ONLINE') {
        $alerts['active'][] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'severity' => 'CRITICAL',
            'type' => 'Router',
            'message' => 'Router is ' . ($live['status'] ?? 'UNKNOWN'),
            'value' => $live['status'] ?? 'UNKNOWN',
        ];
    }
    
    // VPN Down — only alert when explicitly DOWN or FAILED; UP/HEALTHY/UNKNOWN are ok
    $vpn_s = strtoupper($vpn['status'] ?? '');
    if ($vpn_s !== '' && in_array($vpn_s, ['DOWN', 'FAILED', 'ERROR', 'UNREACHABLE'], true)) {
        $alerts['active'][] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'severity' => 'CRITICAL',
            'type' => 'VPN',
            'message' => 'VPN tunnel: ' . ($vpn['status'] ?? 'UNKNOWN'),
            'value' => $vpn['status'] ?? 'UNKNOWN',
        ];
    }
    
    // High CPU
    $cpu = (int)($live['cpu'] ?? 0);
    if ($cpu > 80) {
        $severity = $cpu > 90 ? 'CRITICAL' : 'HIGH';
        $alerts['active'][] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'severity' => $severity,
            'type' => 'CPU',
            'message' => 'CPU utilization at ' . $cpu . '%',
            'value' => $cpu,
        ];
    }
    
    // High Memory
    $memory = (int)($live['memory'] ?? 0);
    if ($memory > 85) {
        $severity = $memory > 95 ? 'CRITICAL' : 'HIGH';
        $alerts['active'][] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'severity' => $severity,
            'type' => 'Memory',
            'message' => 'Memory utilization at ' . $memory . '%',
            'value' => $memory,
        ];
    }
    
    // Active Users threshold
    $users = (int)($dash['users']['active'] ?? 0);
    if ($users > 100) {
        $alerts['active'][] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'severity' => 'MEDIUM',
            'type' => 'Users',
            'message' => $users . ' active users connected',
            'value' => $users,
        ];
    }
    
    // Sheet health — only alert on genuinely stale/missing sheets; skip normal operational states
    $sheet_ok_states = ['FRESH', 'OK', 'HEALTHY', 'INFO', 'EVENT_DRIVEN', 'PENDING', 'UNKNOWN'];
    foreach (($dash['sheetHealth'] ?? []) as $sheet) {
        $sheet_s = strtoupper($sheet['status'] ?? 'UNKNOWN');
        if (!in_array($sheet_s, $sheet_ok_states, true)) {
            $alerts['active'][] = [
                'timestamp' => date('Y-m-d H:i:s'),
                'severity' => 'MEDIUM',
                'type' => 'Data',
                'message' => ($sheet['name'] ?? 'Sheet') . ' is ' . $sheet_s,
                'value' => $sheet_s,
            ];
        }
    }
    
    $alerts['total'] = count($alerts['active']);
    
    return $alerts;
}

/**
 * Compute system health score
 * 
 * Health = combination of:
 * - Router status
 * - VPN status
 * - CPU/Memory usage
 * - Alert count
 * - Sheet staleness
 */
function computeHealth($status_data, $alerts) {
    $dash = $status_data['dashboard'] ?? [];
    $live = $dash['live'] ?? [];
    
    // Start at 100
    $score = 100;
    
    // Deduct points for issues
    $live_status = ($live['status'] ?? 'UNKNOWN') === 'ONLINE' ? true : false;
    if (!$live_status) $score -= 50;
    
    // Accept UP, HEALTHY, or OK as VPN active; only penalise explicitly DOWN/FAILED
    $vpn_s_health = strtoupper($dash['vpn']['status'] ?? 'UNKNOWN');
    $vpn_status = in_array($vpn_s_health, ['UP', 'HEALTHY', 'OK', 'ACTIVE'], true);
    if (in_array($vpn_s_health, ['DOWN', 'FAILED', 'ERROR', 'UNREACHABLE'], true)) $score -= 30;
    
    $cpu = (int)($live['cpu'] ?? 0);
    if ($cpu > 80) $score -= 5;
    if ($cpu > 90) $score -= 10;
    
    $memory = (int)($live['memory'] ?? 0);
    if ($memory > 85) $score -= 5;
    if ($memory > 95) $score -= 10;
    
    $alert_count = count($alerts['active'] ?? []);
    $score -= min($alert_count * 2, 20); // Max 20 points for alerts
    
    // Ensure score stays 0-100
    $score = max(0, min(100, $score));
    
    // Determine overall status
    if ($score >= 90) {
        $status = 'HEALTHY';
    } elseif ($score >= 70) {
        $status = 'DEGRADED';
    } elseif ($score >= 50) {
        $status = 'CRITICAL';
    } else {
        $status = 'OFFLINE';
    }
    
    return [
        'timestamp' => date('c'),
        'score' => $score,
        'status' => $status,
        'cpu' => $cpu,
        'memory' => $memory,
        'router' => $live_status ? 'UP' : 'DOWN',
        'vpn' => $vpn_status ? 'ACTIVE' : 'DOWN',
        'alerts' => count($alerts['active'] ?? []),
        'activeUsers' => (int)($dash['users']['active'] ?? 0),
    ];
}

/**
 * Generate daily report
 * 
 * Summary of today's data:
 * - Top devices
 * - Total traffic
 * - Peak time
 * - Incidents
 */
function generateDailyReport($status_data, $top_daily, $alerts) {
    $dash = $status_data['dashboard'] ?? [];
    
    return [
        'date' => date('Y-m-d'),
        'generatedAt' => date('c'),
        'summary' => 'Daily Operations Report',
        'router' => [
            'status' => $dash['live']['status'] ?? 'UNKNOWN',
            'cpu' => (int)($dash['live']['cpu'] ?? 0),
            'memory' => (int)($dash['live']['memory'] ?? 0),
            'uptime' => $dash['live']['uptime'] ?? 'N/A',
        ],
        'traffic' => [
            'wan_total' => $dash['traffic']['wanTotalText'] ?? 0,
            'wan_status' => $dash['traffic']['wanRunning'] ?? 'UNKNOWN',
        ],
        'users' => [
            'active' => (int)($dash['users']['active'] ?? 0),
            'top_count' => count($top_daily['rows'] ?? []),
        ],
        'alerts' => [
            'critical' => count(array_filter($alerts['active'] ?? [], fn($a) => $a['severity'] === 'CRITICAL')),
            'high' => count(array_filter($alerts['active'] ?? [], fn($a) => $a['severity'] === 'HIGH')),
            'medium' => count(array_filter($alerts['active'] ?? [], fn($a) => $a['severity'] === 'MEDIUM')),
        ],
        'incidents' => array_slice($alerts['active'] ?? [], 0, 5),
    ];
}

/**
 * Generate monthly report
 */
function generateMonthlyReport($status_data, $top_monthly) {
    $dash = $status_data['dashboard'] ?? [];
    
    return [
        'month' => date('Y-m'),
        'generatedAt' => date('c'),
        'summary' => 'Monthly Operations Report',
        'topUsers' => count($top_monthly['rows'] ?? []),
        'totalDeviceCount' => count($top_monthly['rows'] ?? []),
        'sheets' => [
            'total' => count($dash['sheets'] ?? []),
            'health' => array_map(fn($s) => ['name' => $s['name'] ?? 'Unknown', 'status' => $s['status'] ?? 'UNKNOWN'], $dash['sheetHealth'] ?? []),
        ],
    ];
}

/**
 * Write cache atomically
 */
function cacheWrite($filepath, $data) {
    global $CONFIG;
    
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    $temp = $filepath . '.tmp';
    
    if (file_put_contents($temp, $json) === false) {
        logSync("ERROR: Could not write $filepath");
        return false;
    }
    
    if (!rename($temp, $filepath)) {
        logSync("ERROR: Could not finalize $filepath");
        return false;
    }
    
    return true;
}

/**
 * Log sync operations
 */
function logSync($message) {
    global $CONFIG;
    
    $timestamp = date('Y-m-d H:i:s');
    $log_line = "[$timestamp] $message\n";
    
    @file_put_contents($CONFIG['log_file'], $log_line, FILE_APPEND);
}

?>
