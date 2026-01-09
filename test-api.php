<?php
// Simple API endpoint test
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Set error handler
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) {
        return false;
    }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server error: ' . $errstr . ' in ' . $errfile . ':' . $errline]);
    exit;
});

require_once __DIR__ . '/php/config.php';

echo json_encode([
    'status' => 'ok',
    'method' => $_SERVER['REQUEST_METHOD'],
    'path' => $_SERVER['REQUEST_URI'],
    'pathinfo' => $_SERVER['PATH_INFO'] ?? 'NOT SET',
    'test' => 'API is working'
]);
?>
