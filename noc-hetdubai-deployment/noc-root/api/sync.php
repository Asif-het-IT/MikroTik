<?php
/**
 * NOC Dashboard - Central Sync Engine
 * 
 * This script is the heart of the cache layer.
 * It runs on a schedule (cron) and fetches data from the Apps Script backend,
 * processes it, and writes a cached snapshot that the dashboard reads from.
 * 
 * NEVER called by users - only by cron jobs.
 * NEVER triggers backend syncs - it IS the backend sync.
 * 
 * Security:
 * - Protected by X-Sync-Token header (secret)
 * - Only accepts POST requests
 * - Logs all sync attempts
 * - Returns minimal info (no secrets)
 */

// ============ CONFIGURATION ============

// Load server secrets (same as dashboard)
require_once __DIR__ . '/../config/app.php';

// Sync configuration
$SYNC_CONFIG = [
    'secret_token' => getenv('NOC_SYNC_TOKEN') ?: 'sync_secret_2026',
    'cache_dir' => __DIR__ . '/cache',
    'cache_file' => __DIR__ . '/cache/dashboard.json',
    'log_dir' => __DIR__ . '/logs',
    'log_file' => __DIR__ . '/logs/sync.log',
    'max_cache_age' => 600, // seconds (10 minutes before warning)
    'request_timeout' => 90, // seconds (same as dashboard timeout)
];

// Apps Script endpoints
$ENDPOINTS = [
    'status' => [
        'url' => NOC_ENDPOINT . '?admin=status&token=' . NOC_TOKEN,
        'timeout' => 90,
        'required' => true,
    ],
    'topusers_daily' => [
        'url' => NOC_ENDPOINT . '?admin=topusers&period=daily&limit=10&token=' . NOC_TOKEN,
        'timeout' => 45,
        'required' => false,
    ],
    'topusers_monthly' => [
        'url' => NOC_ENDPOINT . '?admin=topusers&period=monthly&limit=10&token=' . NOC_TOKEN,
        'timeout' => 45,
        'required' => false,
    ],
];

// ============ SECURITY ============

// 1. Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

// 2. Verify token
$provided_token = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? null;
if ($provided_token !== $SYNC_CONFIG['secret_token']) {
    logSync('DENIED: Invalid or missing sync token');
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

// 3. Verify localhost or trusted IPs (optional, can be configured)
$allowed_ips = ['127.0.0.1', '::1', 'localhost'];
$client_ip = $_SERVER['REMOTE_ADDR'] ?? '';
// Uncomment to strictly enforce localhost-only
// if (!in_array($client_ip, $allowed_ips) && !getenv('NOC_ALLOW_REMOTE_SYNC')) {
//     logSync("DENIED: Request from untrusted IP: $client_ip");
//     http_response_code(403);
//     die(json_encode(['error' => 'Forbidden']));
// }

logSync('START: Sync initiated by ' . $client_ip);

// ============ CREATE DIRECTORIES ============

if (!is_dir($SYNC_CONFIG['cache_dir'])) {
    mkdir($SYNC_CONFIG['cache_dir'], 0755, true);
    logSync('Created cache directory: ' . $SYNC_CONFIG['cache_dir']);
}

if (!is_dir($SYNC_CONFIG['log_dir'])) {
    mkdir($SYNC_CONFIG['log_dir'], 0755, true);
    logSync('Created log directory: ' . $SYNC_CONFIG['log_dir']);
}

// ============ FETCH DATA FROM APPS SCRIPT ============

logSync('Fetching data from Apps Script endpoints...');

$data = [
    'meta' => [
        'version' => '1.0',
        'timestamp' => date('c'),
        'lastSync' => date('c'),
        'nextSync' => date('c', time() + 300), // 5 minutes
        'syncSuccess' => false,
        'syncDuration' => 0,
        'errors' => [],
    ],
    'status' => null,
    'topDaily' => null,
    'topMonthly' => null,
];

$start_time = microtime(true);

// Fetch status endpoint (required)
logSync('Fetching: status');
$status_result = fetchWithFallback($ENDPOINTS['status']['url'], $ENDPOINTS['status']['timeout']);
if ($status_result['success']) {
    $data['status'] = $status_result['data'];
    logSync('✓ Status fetched successfully');
} else {
    $data['meta']['errors'][] = 'status: ' . $status_result['error'];
    logSync('✗ Status fetch failed: ' . $status_result['error']);
    // Status is required, but continue anyway (cache may be stale but better than error page)
}

// Fetch top users daily (optional)
logSync('Fetching: topusers_daily');
$daily_result = fetchWithFallback($ENDPOINTS['topusers_daily']['url'], $ENDPOINTS['topusers_daily']['timeout']);
if ($daily_result['success']) {
    $data['topDaily'] = $daily_result['data'];
    logSync('✓ Top users daily fetched successfully');
} else {
    $data['meta']['errors'][] = 'topusers_daily: ' . $daily_result['error'];
    logSync('⚠ Top users daily fetch failed: ' . $daily_result['error']);
}

// Fetch top users monthly (optional)
logSync('Fetching: topusers_monthly');
$monthly_result = fetchWithFallback($ENDPOINTS['topusers_monthly']['url'], $ENDPOINTS['topusers_monthly']['timeout']);
if ($monthly_result['success']) {
    $data['topMonthly'] = $monthly_result['data'];
    logSync('✓ Top users monthly fetched successfully');
} else {
    $data['meta']['errors'][] = 'topusers_monthly: ' . $monthly_result['error'];
    logSync('⚠ Top users monthly fetch failed: ' . $monthly_result['error']);
}

$duration = microtime(true) - $start_time;
$data['meta']['syncDuration'] = round($duration, 3);

// ============ VALIDATE & WRITE CACHE ============

// If we got status data, consider it a success
if ($data['status'] !== null) {
    $data['meta']['syncSuccess'] = true;
    logSync('Sync successful');
} else {
    logSync('Sync failed: Could not fetch status endpoint');
}

// Write cache atomically (write to temp, then rename)
$cache_json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
$temp_file = $SYNC_CONFIG['cache_file'] . '.tmp';

if (file_put_contents($temp_file, $cache_json) === false) {
    logSync('ERROR: Could not write temp cache file: ' . $temp_file);
    http_response_code(500);
    die(json_encode(['error' => 'Could not write cache', 'details' => error_get_last()]));
}

// Atomic rename
if (!rename($temp_file, $SYNC_CONFIG['cache_file'])) {
    logSync('ERROR: Could not rename cache file');
    http_response_code(500);
    die(json_encode(['error' => 'Could not finalize cache']));
}

logSync('Cache file written: ' . $SYNC_CONFIG['cache_file'] . ' (' . strlen($cache_json) . ' bytes)');

// ============ RESPONSE ============

logSync('END: Sync completed in ' . number_format($duration, 3) . 's');

http_response_code(200);
die(json_encode([
    'status' => 'success',
    'timestamp' => $data['meta']['timestamp'],
    'duration' => $data['meta']['syncDuration'],
    'cached' => true,
    'errors' => $data['meta']['errors'],
    'next_sync' => $data['meta']['nextSync'],
]));

// ============ HELPER FUNCTIONS ============

/**
 * Fetch data from upstream using cURL with fallback to streams
 * 
 * This mirrors the strategy used in proxy.php but simplified for sync engine.
 */
function fetchWithFallback($url, $timeout) {
    // Try cURL first (preferred)
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            return ['success' => false, 'error' => 'cURL: ' . $error];
        }
        
        if ($http_code !== 200) {
            return ['success' => false, 'error' => "HTTP $http_code"];
        }
        
        $data = json_decode($response, true);
        if ($data === null) {
            return ['success' => false, 'error' => 'Invalid JSON response'];
        }
        
        return ['success' => true, 'data' => $data];
    }
    
    // Fallback to streams
    $context = stream_context_create([
        'http' => [
            'timeout' => $timeout,
            'method' => 'GET',
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
        ],
    ]);
    
    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        return ['success' => false, 'error' => 'Stream: ' . error_get_last()['message']];
    }
    
    $data = json_decode($response, true);
    if ($data === null) {
        return ['success' => false, 'error' => 'Invalid JSON response'];
    }
    
    return ['success' => true, 'data' => $data];
}

/**
 * Log sync operations
 */
function logSync($message) {
    global $SYNC_CONFIG;
    
    $timestamp = date('Y-m-d H:i:s');
    $log_line = "[$timestamp] $message\n";
    
    if (!is_dir($SYNC_CONFIG['log_dir'])) {
        @mkdir($SYNC_CONFIG['log_dir'], 0755, true);
    }
    
    @file_put_contents($SYNC_CONFIG['log_file'], $log_line, FILE_APPEND);
}
?>
