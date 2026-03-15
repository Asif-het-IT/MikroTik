<?php
/**
 * Temporary manual sync trigger (no SSH required)
 *
 * Usage:
 * /api/run-sync.php?token=sync_secret_2026
 *
 * Security:
 * - Requires ?token=
 * - Calls core-engine.php via internal POST + X-Sync-Token header
 * - Delete this file after successful first sync
 */

header('Content-Type: application/json; charset=utf-8');

$expected = getenv('NOC_SYNC_TOKEN') ?: 'sync_secret_2026';
$provided = $_GET['token'] ?? '';

if ($provided !== $expected) {
    http_response_code(403);
    echo json_encode([
        'ok' => false,
        'error' => 'Invalid token',
        'hint' => 'Use /api/run-sync.php?token=YOUR_SYNC_TOKEN'
    ]);
    exit;
}

$target = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . '/api/core-engine.php';

$ch = curl_init($target);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 120);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'X-Sync-Token: ' . $expected,
    'Accept: application/json'
]);

$body = curl_exec($ch);
$errno = curl_errno($ch);
$error = curl_error($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($errno) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'cURL failed',
        'details' => $error,
    ]);
    exit;
}

http_response_code($http ?: 200);
echo $body ?: json_encode([
    'ok' => false,
    'error' => 'Empty response from core-engine'
]);
