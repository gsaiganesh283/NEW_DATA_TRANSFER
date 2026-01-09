<?php
// Authentication endpoints

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = trim($_SERVER['PATH_INFO'] ?? '', '/');

if ($method === 'POST' && $path === 'signup') {
    handleSignup();
} elseif ($method === 'POST' && $path === 'login') {
    handleLogin();
} elseif ($method === 'GET' && $path === 'verify') {
    handleVerify();
} elseif ($method === 'POST' && $path === 'logout') {
    handleLogout();
} else {
    errorResponse('Not found', 404);
}

function handleSignup() {
    $input = getJsonInput();
    
    if (!isset($input['email']) || !isset($input['password'])) {
        errorResponse('Email and password are required', 400);
    }
    
    $email = strtolower(trim($input['email']));
    $password = $input['password'];
    $name = $input['name'] ?? '';
    
    if (strlen($password) < 6) {
        errorResponse('Password must be at least 6 characters', 400);
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('Invalid email format', 400);
    }
    
    $users = loadUsers();
    
    // Check if email already exists
    foreach ($users as $user) {
        if ($user['email'] === $email) {
            errorResponse('Email already registered', 400);
        }
    }
    
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $newUser = [
        'id' => generateUUID(),
        'name' => $name ?: explode('@', $email)[0],
        'email' => $email,
        'password' => $hashedPassword,
        'role' => 'user',
        'provider' => 'local',
        'createdAt' => date('c')
    ];
    
    $users[] = $newUser;
    saveUsers($users);
    
    $token = generateJWT($newUser);
    $userResponse = $newUser;
    unset($userResponse['password']);
    
    successResponse([
        'token' => $token,
        'user' => $userResponse
    ]);
}

function handleLogin() {
    $input = getJsonInput();
    
    if (!isset($input['email']) || !isset($input['password'])) {
        errorResponse('Email and password are required', 400);
    }
    
    $email = strtolower(trim($input['email']));
    $password = $input['password'];
    
    $users = loadUsers();
    $user = null;
    
    foreach ($users as $u) {
        if ($u['email'] === $email) {
            $user = $u;
            break;
        }
    }
    
    if (!$user) {
        errorResponse('Invalid email or password', 401);
    }
    
    if ($user['provider'] === 'google') {
        errorResponse('Please login with Google', 401);
    }
    
    if (!password_verify($password, $user['password'])) {
        errorResponse('Invalid email or password', 401);
    }
    
    $token = generateJWT($user);
    $userResponse = $user;
    unset($userResponse['password']);
    
    successResponse([
        'token' => $token,
        'user' => $userResponse
    ]);
}

function handleVerify() {
    $user = authenticateToken();
    
    // Reload user from database to ensure it still exists
    $users = loadUsers();
    $currentUser = null;
    
    foreach ($users as $u) {
        if ($u['id'] === $user['id']) {
            $currentUser = $u;
            break;
        }
    }
    
    if (!$currentUser) {
        errorResponse('User not found', 401);
    }
    
    $userResponse = $currentUser;
    unset($userResponse['password']);
    
    successResponse([
        'valid' => true,
        'user' => $userResponse
    ]);
}

function handleLogout() {
    authenticateToken(); // Just verify the token is valid
    successResponse(['success' => true]);
}
?>
