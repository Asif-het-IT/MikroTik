<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/../config/app.php';

@set_time_limit(60);

$view = isset($_GET['view']) ? strtolower(trim((string)$_GET['view'])) : 'status';
$period = isset($_GET['period']) ? strtolower(trim((string)$_GET['period'])) : 'daily';
$limit = isset($_GET['limit']) ? max(1, min(50, (int)$_GET['limit'])) : 10;

if (!in_array($period, ['daily', 'monthly'], true)) {
  $period = 'daily';
}

$endpoint = NOC_ENDPOINT;
$token = NOC_TOKEN;

if ($endpoint === 'PUT_YOUR_APPS_SCRIPT_EXEC_URL_HERE' || $token === 'PUT_YOUR_MONITOR_TOKEN_HERE') {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'Proxy not configured. Update config/app.php first.'
  ]);
  exit;
}

function noc_call_upstream(string $url): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_HTTPHEADER => ['Accept: application/json']
  ]);

  $body = curl_exec($ch);
  $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlErr = curl_error($ch);
  curl_close($ch);

  if ($body === false) {
    return ['ok' => false, 'http' => 502, 'error' => 'Curl failed: ' . $curlErr];
  }

  $decoded = json_decode((string)$body, true);
  if (!is_array($decoded)) {
    return ['ok' => false, 'http' => 502, 'error' => 'Invalid JSON from upstream', 'raw' => substr((string)$body, 0, 400)];
  }

  return ['ok' => $httpCode >= 200 && $httpCode < 300, 'http' => $httpCode, 'data' => $decoded];
}

function noc_call_upstream_stream(string $url): array {
  $ctx = stream_context_create([
    'http' => [
      'method' => 'GET',
      'timeout' => 55,
      'header' => "Accept: application/json\r\n"
    ],
    'ssl' => [
      'verify_peer' => true,
      'verify_peer_name' => true
    ]
  ]);

  $body = @file_get_contents($url, false, $ctx);
  if ($body === false) {
    return ['ok' => false, 'http' => 502, 'error' => 'Stream fallback failed'];
  }

  $decoded = json_decode((string)$body, true);
  if (!is_array($decoded)) {
    return ['ok' => false, 'http' => 502, 'error' => 'Invalid JSON from stream fallback', 'raw' => substr((string)$body, 0, 400)];
  }

  return ['ok' => true, 'http' => 200, 'data' => $decoded];
}

$query = ['token' => $token];

if ($view === 'status') {
  $query['admin'] = 'status';
} elseif ($view === 'topusers') {
  $query['admin'] = 'topusers';
  $query['period'] = $period;
  $query['limit'] = (string)$limit;
} else {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Unsupported view']);
  exit;
}

$url = $endpoint . ((strpos($endpoint, '?') !== false) ? '&' : '?') . http_build_query($query);
$res = noc_call_upstream($url);

// Some shared hosting stacks intermittently timeout on cURL for long Apps Script responses.
if (!$res['ok'] && $view === 'status') {
  $res = noc_call_upstream_stream($url);
}

if (!$res['ok']) {
  http_response_code((int)($res['http'] ?? 502));
  echo json_encode($res);
  exit;
}

echo json_encode($res['data']);
