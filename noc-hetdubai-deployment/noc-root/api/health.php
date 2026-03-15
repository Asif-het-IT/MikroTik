<?php
/**
 * NOC System Health Monitor
 * 
 * یہ endpoint system کی صحت کو ریئل ٹائم میں ٹریک کرتا ہے
 * 
 * Tracks:
 * - Sync engine status
 * - Cache freshness
 * - Last router update
 * - Peak user count
 * - Active alerts
 * - Sheet health
 * 
 * Endpoint:
 * GET /api/health.php
 */

set_time_limit(5);
error_reporting(0);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$cache_dir = __DIR__ . '/cache';

// Start health status
$health = [
    'timestamp' => date('c'),
    'system' => [
        'status' => 'LOADING',
        'score' => 0,
    ],
    'sync' => [
        'status' => 'checking',
        'lastRun' => null,
        'nextRun' => null,
        'duration' => null,
    ],
    'cache' => [
        'status' => 'checking',
        'age' => null,
        'files' => [],
    ],
    'monitoring' => [
        'router' => 'unknown',
        'vpn' => 'unknown',
        'activeUsers' => 0,
        'alertCount' => 0,
    ],
    'logs' => [],
];

// ============ CHECK SYNC STATUS ============

$dashboard_cache = $cache_dir . '/dashboard.json';
$sync_log = dirname($cache_dir) . '/logs/sync.log';

if (file_exists($dashboard_cache)) {
    $data = json_decode(file_get_contents($dashboard_cache), true);
    
    if ($data && isset($data['meta'])) {
        $meta = $data['meta'];
        $sync_time = strtotime($meta['timestamp'] ?? date('c'));
        $cache_age = time() - $sync_time;
        
        $health['sync']['lastRun'] = $meta['timestamp'] ?? null;
        $health['sync']['duration'] = $meta['syncDuration'] ?? null;
        $health['sync']['nextRun'] = $meta['nextSync'] ?? null;
        
        // Sync status
        if ($meta['status'] === 'success' && $cache_age < 600) {
            $health['sync']['status'] = 'HEALTHY';
        } elseif ($cache_age < 900) {
            $health['sync']['status'] = 'AGING';
        } else {
            $health['sync']['status'] = 'STALE';
        }
        
        // Cache status
        $health['cache']['age'] = $cache_age;
        $health['cache']['ageText'] = formatAge($cache_age);
        $health['cache']['status'] = $cache_age < 600 ? 'FRESH' : 'STALE';
        
        // System health
        if (isset($data['health'])) {
            $health['system']['score'] = $data['health']['score'] ?? 0;
            $health['system']['status'] = $data['health']['status'] ?? 'UNKNOWN';
            $health['monitoring']['router'] = $data['health']['router'] ?? 'unknown';
            $health['monitoring']['vpn'] = $data['health']['vpn'] ?? 'unknown';
            $health['monitoring']['activeUsers'] = $data['health']['activeUsers'] ?? 0;
        }
        
        // Alerts count
        if (isset($data['alerts'])) {
            $health['monitoring']['alertCount'] = count($data['alerts']['active'] ?? []);
        }
        
        // Cache files
        $cache_files = [
            'dashboard',
            'device-mapping',
            'top-users-daily',
            'top-users-monthly',
            'alerts',
            'health',
            'daily-report',
            'monthly-report',
        ];
        
        foreach ($cache_files as $file) {
            $path = $cache_dir . '/' . $file . '.json';
            if (file_exists($path)) {
                $age = time() - filemtime($path);
                $health['cache']['files'][$file] = [
                    'exists' => true,
                    'age' => $age,
                    'ageText' => formatAge($age),
                ];
            } else {
                $health['cache']['files'][$file] = [
                    'exists' => false,
                    'age' => null,
                ];
            }
        }
    }
} else {
    $health['sync']['status'] = 'NOT_RUN';
    $health['cache']['status'] = 'NOT_FOUND';
}

// ============ CHECK RECENT LOGS ============

if (file_exists($sync_log)) {
    $log_lines = array_filter(array_map('trim', file($sync_log)));
    $recent_logs = array_slice($log_lines, -10); // Last 10 lines
    
    foreach ($recent_logs as $line) {
        if (preg_match('/\[(\d{2}:\d{2}:\d{2})\](.*)/', $line, $m)) {
            $health['logs'][] = [
                'time' => $m[1],
                'message' => trim($m[2]),
            ];
        }
    }
}

// ============ DETERMINE OVERALL STATUS ============

if ($health['cache']['status'] === 'FRESH' && $health['sync']['status'] === 'HEALTHY') {
    $health['status'] = 'operational';
    http_response_code(200);
} elseif ($health['cache']['status'] === 'STALE' || $health['sync']['status'] === 'AGING') {
    $health['status'] = 'degraded';
    http_response_code(206);
} else {
    $health['status'] = 'critical';
    http_response_code(503);
}

echo json_encode($health, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

// ============ HELPERS ============

function formatAge($seconds) {
    if ($seconds < 60) return $seconds . 's';
    if ($seconds < 3600) return floor($seconds / 60) . 'm';
    return floor($seconds / 3600) . 'h';
}

?>
