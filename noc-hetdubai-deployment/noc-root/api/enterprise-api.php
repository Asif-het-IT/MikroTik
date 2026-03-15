<?php
/**
 * Enterprise NOC Cached API
 * 
 * یہ read-only endpoint ہے جو dashboard ko cache serve کرتا ہے
 * 
 * کوئی بھی sync/processing یہاں نہیں ہوتا
 * صرف JSON فائل سے پڑھ کر بھیجا جاتا ہے
 * 
 * Endpoints:
 * GET /api/cached-api.php                    → Full dashboard state
 * GET /api/cached-api.php?view=status        → Router status only
 * GET /api/cached-api.php?view=topusers      → Top users only
 * GET /api/cached-api.php?view=alerts        → Alerts only  
 * GET /api/cached-api.php?view=health        → Health score only
 * GET /api/cached-api.php?view=reports       → Reports only
 * GET /api/cached-api.php?view=devices       → Device mapping only
 */

set_time_limit(10);
error_reporting(0);

// Cache files location
$cache_files = [
    'dashboard' => __DIR__ . '/cache/dashboard.json',
    'device_mapping' => __DIR__ . '/cache/device-mapping.json',
    'top_daily' => __DIR__ . '/cache/top-users-daily.json',
    'top_monthly' => __DIR__ . '/cache/top-users-monthly.json',
    'alerts' => __DIR__ . '/cache/alerts.json',
    'health' => __DIR__ . '/cache/health.json',
    'daily_report' => __DIR__ . '/cache/daily-report.json',
    'monthly_report' => __DIR__ . '/cache/monthly-report.json',
];

// Get cache view parameter
$view = $_GET['view'] ?? 'full';

// Set headers
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Access-Control-Allow-Origin: *');

// Check if cache exists
$dashboard_file = $cache_files['dashboard'];
if (!file_exists($dashboard_file)) {
    http_response_code(503);
    echo json_encode([
        'error' => 'Cache not ready',
        'message' => 'Sync engine has not run yet',
        'status' => 'initializing',
    ]);
    exit;
}

// Read main cache
$cache_content = file_get_contents($dashboard_file);
if ($cache_content === false) {
    http_response_code(503);
    echo json_encode(['error' => 'Cache read failed']);
    exit;
}

$cache_data = json_decode($cache_content, true);
if (!is_array($cache_data)) {
    http_response_code(503);
    echo json_encode(['error' => 'Cache corrupted']);
    exit;
}

// Calculate cache age
$sync_time = strtotime($cache_data['meta']['timestamp'] ?? date('c'));
$cache_age_seconds = time() - $sync_time;

// Add cache metadata to response
$response = [
    '_cache' => [
        'age' => $cache_age_seconds,
        'ageText' => formatCacheAge($cache_age_seconds),
        'synced' => $cache_data['meta']['timestamp'] ?? null,
        'nextSync' => $cache_data['meta']['nextSync'] ?? null,
        'freshness' => getFreshness($cache_age_seconds),
    ],
    '_version' => $cache_data['meta']['version'] ?? '2.0',
];

// Serve based on view parameter
switch ($view) {
    case 'status':
        // Router status only
        $response['status'] = $cache_data['status'] ?? null;
        break;
        
    case 'topusers':
        // Daily and monthly top users
        $response['topDaily'] = loadAndAge($cache_files['top_daily']);
        $response['topMonthly'] = loadAndAge($cache_files['top_monthly']);
        break;
        
    case 'alerts':
        // Current active alerts
        $response['alerts'] = loadAndAge($cache_files['alerts']);
        break;
        
    case 'health':
        // System health score
        $response['health'] = loadAndAge($cache_files['health']);
        break;
        
    case 'reports':
        // Daily and monthly reports
        $response['reports'] = [
            'daily' => loadAndAge($cache_files['daily_report']),
            'monthly' => loadAndAge($cache_files['monthly_report']),
        ];
        break;
        
    case 'devices':
        // Device mapping
        $response['devices'] = loadAndAge($cache_files['device_mapping']);
        break;
        
    case 'full':
    default:
        // Complete system state
        $response['status'] = $cache_data['status'] ?? null;
        $response['topDaily'] = loadAndAge($cache_files['top_daily']);
        $response['topMonthly'] = loadAndAge($cache_files['top_monthly']);
        $response['alerts'] = loadAndAge($cache_files['alerts']);
        $response['health'] = loadAndAge($cache_files['health']);
        $response['devices'] = loadAndAge($cache_files['device_mapping']);
        $response['reports'] = [
            'daily' => loadAndAge($cache_files['daily_report']),
            'monthly' => loadAndAge($cache_files['monthly_report']),
        ];
        $response['meta'] = $cache_data['meta'] ?? [];
        break;
}

// HTTP status
if ($cache_age_seconds > 600) {
    // Cache older than 10 minutes = warning status
    http_response_code(206); // Partial content - serve but mark as stale
} else {
    http_response_code(200);
}

// Output response
echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
exit;

// ============ HELPER FUNCTIONS ============

/**
 * Load cache file if it exists
 */
function loadAndAge($filepath) {
    if (!file_exists($filepath)) {
        return null;
    }
    
    $content = json_decode(file_get_contents($filepath), true);
    if (!is_array($content)) {
        return null;
    }
    
    return $content;
}

/**
 * Format cache age in human-readable format
 */
function formatCacheAge($seconds) {
    if ($seconds < 60) {
        return $seconds . 's ago';
    }
    if ($seconds < 3600) {
        return floor($seconds / 60) . 'm ago';
    }
    return floor($seconds / 3600) . 'h ago';
}

/**
 * Get cache freshness status
 */
function getFreshness($seconds) {
    if ($seconds < 300) { // 0-5 min
        return 'fresh';
    }
    if ($seconds < 600) { // 5-10 min
        return 'aging';
    }
    if ($seconds < 900) { // 10-15 min
        return 'stale';
    }
    return 'very-stale';
}

?>
