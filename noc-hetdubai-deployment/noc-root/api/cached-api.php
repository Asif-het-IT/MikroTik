<?php
/**
 * NOC Dashboard - Cached API
 * 
 * This is the read-only API that the dashboard calls.
 * It simply returns the cached JSON snapshot.
 * 
 * Performance:
 * - No processing
 * - No API calls to Apps Script
 * - Just reads a local file and returns JSON
 * - Sub-millisecond response time
 * 
 * Called by: Dashboard (every 15-30 seconds for auto-refresh)
 * Does NOT call: Apps Script (that's what sync.php does)
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');

$cache_file = __DIR__ . '/cache/dashboard.json';

// ============ SECURITY ============

// Verify the cache directory exists and is protected
$cache_dir = dirname($cache_file);
if (!is_dir($cache_dir)) {
    http_response_code(503);
    die(json_encode(['error' => 'Cache system not initialized']));
}

// ============ READ CACHE ============

if (!file_exists($cache_file)) {
    // Cache doesn't exist yet (first sync hasn't run)
    http_response_code(503);
    die(json_encode([
        'error' => 'Cache not ready',
        'message' => 'Waiting for first sync to complete. Check back in a moment.',
        'cached' => false,
    ]));
}

// Read cache file
$cache_content = file_get_contents($cache_file);
if ($cache_content === false) {
    http_response_code(503);
    die(json_encode(['error' => 'Could not read cache file']));
}

// Parse JSON
$cached_data = json_decode($cache_content, true);
if ($cached_data === null) {
    http_response_code(503);
    die(json_encode(['error' => 'Cache file is corrupted']));
}

// ============ OPTIONAL: FILTER BY VIEW ============

$view = $_GET['view'] ?? 'full';

switch ($view) {
    case 'status':
        // Return only status data
        $response = [
            'meta' => $cached_data['meta'] ?? [],
            'status' => $cached_data['status'] ?? null,
        ];
        break;
    
    case 'topusers':
        // Return only top users data
        $response = [
            'meta' => $cached_data['meta'] ?? [],
            'topDaily' => $cached_data['topDaily'] ?? null,
            'topMonthly' => $cached_data['topMonthly'] ?? null,
        ];
        break;
    
    case 'full':
    default:
        // Return all cached data
        $response = $cached_data;
        break;
}

// Add cache age
if (isset($response['meta']['timestamp'])) {
    $response['meta']['cacheAge'] = time() - strtotime($response['meta']['timestamp']);
}

http_response_code(200);
die(json_encode($response, JSON_UNESCAPED_SLASHES));
?>
