<?php

declare(strict_types=1);
require_once __DIR__ . '/../../src/LayoutValidator.php';
require_once __DIR__ . '/../../src/DashboardRepository.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_THROW_ON_ERROR);
    exit;
}
try {
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET', 'PUT'], true)) {
        header('Allow: GET, PUT');
        respond(405, ['error' => 'Method not allowed.']);
    }
    if ($method === 'PUT') {
        if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) respond(403, ['error' => 'Refresh the page before saving.']);
        if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) respond(415, ['error' => 'Use application/json.']);
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 7 * 1024 * 1024) respond(413, ['error' => 'Dashboard is too large (7 MB maximum).']);
        $raw = file_get_contents('php://input', false, null, 0, 7 * 1024 * 1024 + 1);
        if (strlen($raw) > 7 * 1024 * 1024) respond(413, ['error' => 'Dashboard is too large.']);
        $input = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($input) || !is_string($input['name'] ?? null) || trim($input['name']) === '' || strlen($input['name']) > 120 || !is_int($input['version'] ?? null) || $input['version'] < 1) respond(422, ['error' => 'Provide a name and positive integer version.']);
        $layout = LayoutValidator::validate($input['layout'] ?? null);
    }
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = getenv('DB_PORT') ?: '3306';
    $name = getenv('DB_NAME') ?: 'dashboard_builder';
    $db = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", getenv('DB_USER') ?: 'dashboard', getenv('DB_PASSWORD') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
    $repository = new DashboardRepository($db);
    if ($method === 'GET') {
        $dashboard = $repository->find(1);
        if (!$dashboard) respond(404, ['error' => 'Import database/sample.sql to create the dashboard.']);
        respond(200, ['dashboard' => $dashboard, 'csrfToken' => $_SESSION['csrf']]);
    }
    $dashboard = $repository->save(1, trim($input['name']), $layout, $input['version']);
    if (!$dashboard) respond(409, ['error' => 'Another tab saved a newer version. Export your changes, then reload to continue.']);
    respond(200, ['dashboard' => $dashboard]);
} catch (JsonException $error) {
    respond(400, ['error' => 'Malformed JSON.']);
} catch (InvalidArgumentException $error) {
    respond(422, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log((string)$error);
    respond(503, ['error' => 'Database unavailable. Check your database configuration.']);
}
