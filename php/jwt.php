<?php
// JWT Token handling

require_once __DIR__ . '/config.php';

// Generate JWT token
function generateJWT($user) {
    $header = base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    
    $payload = [
        'id' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'iat' => time(),
        'exp' => time() + JWT_EXPIRES_IN
    ];
    
    $payload_encoded = base64UrlEncode(json_encode($payload));
    
    $signature = hash_hmac('sha256', "$header.$payload_encoded", JWT_SECRET, true);
    $signature_encoded = base64UrlEncode($signature);
    
    return "$header.$payload_encoded.$signature_encoded";
}

// Verify JWT token
function verifyJWT($token) {
    $parts = explode('.', $token);
    
    if (count($parts) !== 3) {
        return null;
    }
    
    list($header_encoded, $payload_encoded, $signature_encoded) = $parts;
    
    $signature = hash_hmac('sha256', "$header_encoded.$payload_encoded", JWT_SECRET, true);
    $signature_expected = base64UrlEncode($signature);
    
    if ($signature_encoded !== $signature_expected) {
        return null;
    }
    
    $payload = json_decode(base64UrlDecode($payload_encoded), true);
    
    if ($payload['exp'] < time()) {
        return null;
    }
    
    return $payload;
}

// Base64 URL encode
function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// Base64 URL decode
function base64UrlDecode($data) {
    $data = strtr($data, '-_', '+/');
    return base64_decode($data . str_repeat('=', 4 - (strlen($data) % 4)));
}

// Get token from Authorization header
function getAuthToken() {
    $headers = getallheaders();
    
    if (isset($headers['Authorization'])) {
        $auth = $headers['Authorization'];
        if (preg_match('/Bearer\s+(.*)$/i', $auth, $matches)) {
            return $matches[1];
        }
    }
    
    return null;
}

// Get current user from token
function getCurrentUser() {
    $token = getAuthToken();
    
    if (!$token) {
        return null;
    }
    
    $payload = verifyJWT($token);
    
    if (!$payload) {
        return null;
    }
    
    $users = loadUsers();
    foreach ($users as $user) {
        if ($user['id'] === $payload['id']) {
            return $user;
        }
    }
    
    return null;
}

// Authenticate token middleware
function authenticateToken() {
    $user = getCurrentUser();
    
    if (!$user) {
        errorResponse('Access token required', 401);
    }
    
    return $user;
}

// Require admin role
function requireAdmin() {
    $user = authenticateToken();
    
    if ($user['role'] !== 'admin' && $user['role'] !== 'superadmin') {
        errorResponse('Admin access required', 403);
    }
    
    return $user;
}

// Require superadmin role
function requireSuperAdmin() {
    $user = authenticateToken();
    
    if ($user['role'] !== 'superadmin') {
        errorResponse('Super Admin access required', 403);
    }
    
    return $user;
}

// Optional authentication
function getOptionalUser() {
    return getCurrentUser();
}

// Get compatibility layer for getallheaders (some servers don't have it)
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$name] = $value;
            } elseif ($name == 'CONTENT_TYPE') {
                $headers['Content-Type'] = $value;
            } elseif ($name == 'CONTENT_LENGTH') {
                $headers['Content-Length'] = $value;
            }
        }
        return $headers;
    }
}
?>
