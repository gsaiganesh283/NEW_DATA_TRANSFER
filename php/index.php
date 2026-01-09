<?php
// Main router for the application

// Set error handler
error_reporting(E_ALL);
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) {
        return false;
    }
    error_log("PHP Error: $errstr in $errfile:$errline");
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server error']);
    exit;
});

require_once __DIR__ . '/config.php';

// Set headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/php'; // Adjust based on your deployment

// Remove query string
$path = parse_url($requestUri, PHP_URL_PATH);

// Remove base path
if (strpos($path, $basePath) === 0) {
    $path = substr($path, strlen($basePath));
}

// Handle requests that were rewritten from root .htaccess
// These might come in as /api/..., /auth/..., /admin/... pointing to php/index.php
// We need to check if the path starts with these
if (strpos($path, '/api/') === 0 || strpos($path, '/auth/') === 0 || strpos($path, '/admin/') === 0) {
    // Path already starts with /api, /auth, or /admin - use as is
} else if (strpos($path, 'api/') === 0 || strpos($path, 'auth/') === 0 || strpos($path, 'admin/') === 0) {
    // Path starts with api/, auth/, or admin/ - add leading slash
    $path = '/' . $path;
}

// Remove leading and trailing slashes
$path = trim($path, '/');

// Route to appropriate handler
if (strpos($path, 'auth/') === 0) {
    $_SERVER['PATH_INFO'] = '/' . substr($path, 5);
    require __DIR__ . '/api/auth.php';
}
elseif (strpos($path, 'api/') === 0) {
    $_SERVER['PATH_INFO'] = '/' . substr($path, 4);
    require __DIR__ . '/api/files.php';
}
elseif (strpos($path, 'admin/') === 0 || strpos($path, 'api/admin/') === 0) {
    $_SERVER['PATH_INFO'] = '/' . (strpos($path, 'api/admin/') === 0 ? substr($path, 10) : substr($path, 6));
    require __DIR__ . '/api/admin.php';
}
else {
    // Serve static files or index.html
    $publicPath = __DIR__ . '/..';
    $filePath = $publicPath . '/' . $path;
    
    if ($path === '' || $path === '/') {
        // Serve index.html
        header('Content-Type: text/html; charset=utf-8');
        readfile($publicPath . '/index.html');
    }
    elseif (file_exists($filePath) && is_file($filePath)) {
        // Serve the file
        $ext = pathinfo($filePath, PATHINFO_EXTENSION);
        $mimeTypes = [
            'html' => 'text/html',
            'js' => 'application/javascript',
            'css' => 'text/css',
            'json' => 'application/json',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf'
        ];
        $mimeType = $mimeTypes[$ext] ?? 'application/octet-stream';
        header('Content-Type: ' . $mimeType);
        readfile($filePath);
    }
    elseif (preg_match('/\.(html|js|css|json)$/', $path)) {
        // Try to serve HTML/JS/CSS files
        $filePath = $publicPath . '/' . $path;
        if (file_exists($filePath)) {
            $ext = pathinfo($filePath, PATHINFO_EXTENSION);
            $mimeTypes = [
                'html' => 'text/html',
                'js' => 'application/javascript',
                'css' => 'text/css',
                'json' => 'application/json'
            ];
            header('Content-Type: ' . ($mimeTypes[$ext] ?? 'text/plain'));
            readfile($filePath);
        } else {
            header('HTTP/1.1 404 Not Found');
            echo 'File not found';
        }
    }
    else {
        // Default to index.html for SPA routing
        header('Content-Type: text/html; charset=utf-8');
        readfile($publicPath . '/index.html');
    }
}
?>
