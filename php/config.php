<?php
// Configuration file for File Transfer Application

// Database settings (using JSON files instead of traditional DB)
define('DATA_DIR', __DIR__ . '/../data');
define('UPLOADS_DIR', __DIR__ . '/../uploads');
define('MAX_FILE_SIZE', 2000); // MB
define('MAX_FILES', 50);
define('EXPIRY_TIME', 24); // hours
define('ALLOW_ANONYMOUS', true);

// JWT Secret
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'your-super-secret-jwt-key-change-in-production');
define('JWT_EXPIRES_IN', 7 * 24 * 60 * 60); // 7 days in seconds

// Google OAuth (optional)
define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '');
define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: '');
define('GOOGLE_CALLBACK_URL', getenv('GOOGLE_CALLBACK_URL') ?: 'http://localhost/php/auth/google/callback.php');

// Create directories if they don't exist
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
}
if (!is_dir(UPLOADS_DIR)) {
    mkdir(UPLOADS_DIR, 0755, true);
}

// Error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// JSON response helper
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Error response helper
function errorResponse($message, $statusCode = 400) {
    jsonResponse(['error' => $message], $statusCode);
}

// Success response helper
function successResponse($data, $statusCode = 200) {
    if (!isset($data['success'])) {
        $data['success'] = true;
    }
    jsonResponse($data, $statusCode);
}

// Get request method
function getRequestMethod() {
    return strtoupper($_SERVER['REQUEST_METHOD']);
}

// Get JSON input
function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true);
}

// Generate random string
function generateRandomString($length = 6) {
    $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $result = '';
    for ($i = 0; $i < $length; $i++) {
        $result .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $result;
}

// Load users from JSON file
function loadUsers() {
    $file = DATA_DIR . '/users.json';
    if (!file_exists($file)) {
        return [];
    }
    $json = file_get_contents($file);
    return json_decode($json, true) ?: [];
}

// Save users to JSON file
function saveUsers($users) {
    $file = DATA_DIR . '/users.json';
    file_put_contents($file, json_encode($users, JSON_PRETTY_PRINT));
}

// Load transfers from JSON file
function loadTransfers() {
    $file = DATA_DIR . '/transfers.json';
    if (!file_exists($file)) {
        return [];
    }
    $json = file_get_contents($file);
    return json_decode($json, true) ?: [];
}

// Save transfers to JSON file
function saveTransfers($transfers) {
    $file = DATA_DIR . '/transfers.json';
    file_put_contents($file, json_encode($transfers, JSON_PRETTY_PRINT));
}

// Load settings from JSON file
function loadSettings() {
    $file = DATA_DIR . '/settings.json';
    if (!file_exists($file)) {
        return getDefaultSettings();
    }
    $json = file_get_contents($file);
    $settings = json_decode($json, true) ?: getDefaultSettings();
    return array_merge(getDefaultSettings(), $settings);
}

// Save settings to JSON file
function saveSettings($settings) {
    $file = DATA_DIR . '/settings.json';
    file_put_contents($file, json_encode($settings, JSON_PRETTY_PRINT));
}

// Get default settings
function getDefaultSettings() {
    return [
        'maxFileSize' => 2000, // MB
        'maxFiles' => 50,
        'expiryTime' => 24, // hours
        'allowAnonymous' => true,
        'storagePath' => 'uploads',
        'enableCloudStorage' => false,
        'cloudProvider' => 'local',
        'cloudBucket' => '',
        'cloudRegion' => ''
    ];
}

// Initialize super admin if not exists
function initializeSuperAdmin() {
    $users = loadUsers();
    
    $superadminExists = false;
    foreach ($users as $user) {
        if ($user['role'] === 'superadmin') {
            $superadminExists = true;
            break;
        }
    }
    
    if (!$superadminExists) {
        $hashedPassword = password_hash('admin123', PASSWORD_BCRYPT);
        $users[] = [
            'id' => generateUUID(),
            'name' => 'Super Admin',
            'email' => 'admin@filetransfer.com',
            'password' => $hashedPassword,
            'role' => 'superadmin',
            'provider' => 'local',
            'createdAt' => date('c')
        ];
        saveUsers($users);
    }
}

// Generate UUID v4
function generateUUID() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Cleanup expired files
function cleanupExpiredFiles() {
    $transfers = loadTransfers();
    $settings = loadSettings();
    $expirySeconds = $settings['expiryTime'] * 60 * 60;
    $now = time() * 1000; // Convert to milliseconds for consistency
    $cleaned = false;
    
    $updated = [];
    foreach ($transfers as $code => $fileInfo) {
        if ($now - $fileInfo['uploadedAt'] > $expirySeconds * 1000) {
            // Delete files from disk
            foreach ($fileInfo['files'] as $file) {
                if (file_exists($file['path'])) {
                    unlink($file['path']);
                }
            }
            $cleaned = true;
        } else {
            $updated[$code] = $fileInfo;
        }
    }
    
    if ($cleaned) {
        saveTransfers($updated);
    }
}

// Initialize on every request
initializeSuperAdmin();

// Run cleanup (can be triggered separately to avoid slowdown)
if (rand(1, 100) == 1) { // 1% chance to run cleanup on each request
    cleanupExpiredFiles();
}
?>
