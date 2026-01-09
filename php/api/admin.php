<?php
// Admin API endpoints

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
$pathParts = explode('/', $path);

// Route: GET /admin/stats
if ($method === 'GET' && $pathParts[0] === 'admin' && $pathParts[1] === 'stats') {
    handleGetStats();
}
// Route: GET /admin/users
elseif ($method === 'GET' && $pathParts[0] === 'admin' && $pathParts[1] === 'users' && !isset($pathParts[2])) {
    handleGetUsers();
}
// Route: GET /admin/users/{id}
elseif ($method === 'GET' && $pathParts[0] === 'admin' && $pathParts[1] === 'users' && isset($pathParts[2])) {
    handleGetUser($pathParts[2]);
}
// Route: PUT /admin/users/{id}
elseif ($method === 'PUT' && $pathParts[0] === 'admin' && $pathParts[1] === 'users' && isset($pathParts[2])) {
    handleUpdateUser($pathParts[2]);
}
// Route: DELETE /admin/users/{id}
elseif ($method === 'DELETE' && $pathParts[0] === 'admin' && $pathParts[1] === 'users' && isset($pathParts[2])) {
    handleDeleteUser($pathParts[2]);
}
// Route: GET /admin/transfers
elseif ($method === 'GET' && $pathParts[0] === 'admin' && $pathParts[1] === 'transfers') {
    handleGetTransfers();
}
// Route: DELETE /admin/transfers/{code}
elseif ($method === 'DELETE' && $pathParts[0] === 'admin' && $pathParts[1] === 'transfers' && isset($pathParts[2])) {
    handleDeleteAdminTransfer($pathParts[2]);
}
// Route: PUT /admin/settings
elseif ($method === 'PUT' && $pathParts[0] === 'admin' && $pathParts[1] === 'settings') {
    handleUpdateSettings();
}
// Route: GET /admin/settings
elseif ($method === 'GET' && $pathParts[0] === 'admin' && $pathParts[1] === 'settings') {
    handleGetAdminSettings();
}
// Route: POST /admin/change-password
elseif ($method === 'POST' && $pathParts[0] === 'admin' && $pathParts[1] === 'change-password') {
    handleChangePassword();
}
else {
    errorResponse('Not found', 404);
}

function handleGetStats() {
    $user = requireAdmin();
    
    $users = loadUsers();
    $transfers = loadTransfers();
    
    $totalSize = 0;
    $totalDownloads = 0;
    
    foreach ($transfers as $transfer) {
        foreach ($transfer['files'] as $file) {
            $totalSize += $file['size'];
        }
        $totalDownloads += $transfer['downloadCount'];
    }
    
    successResponse([
        'totalUsers' => count($users),
        'activeTransfers' => count($transfers),
        'totalDownloads' => $totalDownloads,
        'storageUsed' => $totalSize
    ]);
}

function handleGetUsers() {
    $user = requireAdmin();
    
    $users = loadUsers();
    $filteredUsers = [];
    
    foreach ($users as $u) {
        $filtered = $u;
        unset($filtered['password']);
        $filteredUsers[] = $filtered;
    }
    
    successResponse(['users' => $filteredUsers]);
}

function handleGetUser($id) {
    $user = requireAdmin();
    
    $users = loadUsers();
    
    foreach ($users as $u) {
        if ($u['id'] === $id) {
            $filtered = $u;
            unset($filtered['password']);
            return successResponse($filtered);
        }
    }
    
    errorResponse('User not found', 404);
}

function handleUpdateUser($id) {
    $user = requireAdmin();
    $input = getJsonInput();
    
    $users = loadUsers();
    $userIndex = -1;
    
    foreach ($users as $key => $u) {
        if ($u['id'] === $id) {
            $userIndex = $key;
            break;
        }
    }
    
    if ($userIndex === -1) {
        errorResponse('User not found', 404);
    }
    
    $targetUser = $users[$userIndex];
    
    // Prevent demoting superadmin unless you're superadmin
    if ($targetUser['role'] === 'superadmin' && $user['role'] !== 'superadmin') {
        errorResponse('Cannot modify super admin', 403);
    }
    
    // Prevent promoting to superadmin unless you're superadmin
    if (isset($input['role']) && $input['role'] === 'superadmin' && $user['role'] !== 'superadmin') {
        errorResponse('Cannot assign super admin role', 403);
    }
    
    if (isset($input['name'])) {
        $users[$userIndex]['name'] = $input['name'];
    }
    
    if (isset($input['email'])) {
        $users[$userIndex]['email'] = strtolower($input['email']);
    }
    
    if (isset($input['role']) && ($user['role'] === 'superadmin' || $input['role'] !== 'superadmin')) {
        $users[$userIndex]['role'] = $input['role'];
    }
    
    saveUsers($users);
    
    $updated = $users[$userIndex];
    unset($updated['password']);
    
    successResponse($updated);
}

function handleDeleteUser($id) {
    $user = requireAdmin();
    
    $users = loadUsers();
    $userIndex = -1;
    
    foreach ($users as $key => $u) {
        if ($u['id'] === $id) {
            $userIndex = $key;
            break;
        }
    }
    
    if ($userIndex === -1) {
        errorResponse('User not found', 404);
    }
    
    $targetUser = $users[$userIndex];
    
    if ($targetUser['role'] === 'superadmin') {
        errorResponse('Cannot delete super admin', 403);
    }
    
    if ($targetUser['id'] === $user['id']) {
        errorResponse('Cannot delete yourself', 403);
    }
    
    array_splice($users, $userIndex, 1);
    saveUsers($users);
    
    successResponse(['success' => true]);
}

function handleGetTransfers() {
    $user = requireAdmin();
    
    $transfers = loadTransfers();
    $settings = loadSettings();
    $expirySeconds = $settings['expiryTime'] * 60 * 60;
    
    $result = [];
    foreach ($transfers as $code => $info) {
        $totalSize = 0;
        foreach ($info['files'] as $file) {
            $totalSize += $file['size'];
        }
        
        $result[] = [
            'code' => $code,
            'fileCount' => count($info['files']),
            'totalSize' => $totalSize,
            'downloadCount' => $info['downloadCount'],
            'uploadedBy' => $info['uploadedBy'] ?: 'Anonymous',
            'uploadedAt' => $info['uploadedAt'],
            'expiresAt' => ($info['uploadedAt'] / 1000 + $expirySeconds) * 1000
        ];
    }
    
    successResponse(['transfers' => $result]);
}

function handleDeleteAdminTransfer($code) {
    $user = requireAdmin();
    
    $code = strtoupper($code);
    $transfers = loadTransfers();
    
    if (!isset($transfers[$code])) {
        errorResponse('Transfer not found', 404);
    }
    
    $fileInfo = $transfers[$code];
    
    foreach ($fileInfo['files'] as $file) {
        if (file_exists($file['path'])) {
            unlink($file['path']);
        }
    }
    
    unset($transfers[$code]);
    saveTransfers($transfers);
    
    successResponse(['success' => true]);
}

function handleUpdateSettings() {
    $user = requireSuperAdmin();
    $input = getJsonInput();
    
    $settings = loadSettings();
    
    if (isset($input['maxFileSize'])) {
        $settings['maxFileSize'] = (int)$input['maxFileSize'];
    }
    
    if (isset($input['maxFiles'])) {
        $settings['maxFiles'] = (int)$input['maxFiles'];
    }
    
    if (isset($input['expiryTime'])) {
        $settings['expiryTime'] = (int)$input['expiryTime'];
    }
    
    if (isset($input['allowAnonymous'])) {
        $settings['allowAnonymous'] = (bool)$input['allowAnonymous'];
    }
    
    if (isset($input['storagePath'])) {
        $settings['storagePath'] = $input['storagePath'];
        $fullPath = $input['storagePath'];
        if (!is_dir($fullPath)) {
            mkdir($fullPath, 0755, true);
        }
    }
    
    if (isset($input['enableCloudStorage'])) {
        $settings['enableCloudStorage'] = (bool)$input['enableCloudStorage'];
    }
    
    if (isset($input['cloudProvider'])) {
        $settings['cloudProvider'] = $input['cloudProvider'];
    }
    
    if (isset($input['cloudBucket'])) {
        $settings['cloudBucket'] = $input['cloudBucket'];
    }
    
    if (isset($input['cloudRegion'])) {
        $settings['cloudRegion'] = $input['cloudRegion'];
    }
    
    saveSettings($settings);
    
    successResponse([
        'message' => 'Settings updated',
        'settings' => $settings
    ]);
}

function handleGetAdminSettings() {
    $user = requireAdmin();
    
    $settings = loadSettings();
    
    successResponse(['settings' => $settings]);
}

function handleChangePassword() {
    $user = authenticateToken();
    $input = getJsonInput();
    
    if (!isset($input['currentPassword']) || !isset($input['newPassword'])) {
        errorResponse('Current and new password required', 400);
    }
    
    $currentPassword = $input['currentPassword'];
    $newPassword = $input['newPassword'];
    
    if (strlen($newPassword) < 6) {
        errorResponse('Password must be at least 6 characters', 400);
    }
    
    $users = loadUsers();
    $userIndex = -1;
    
    foreach ($users as $key => $u) {
        if ($u['id'] === $user['id']) {
            $userIndex = $key;
            break;
        }
    }
    
    if ($userIndex === -1) {
        errorResponse('User not found', 404);
    }
    
    $currentUser = $users[$userIndex];
    
    if ($currentUser['provider'] === 'google') {
        errorResponse('Cannot change password for Google accounts', 400);
    }
    
    if (!password_verify($currentPassword, $currentUser['password'])) {
        errorResponse('Current password is incorrect', 401);
    }
    
    $users[$userIndex]['password'] = password_hash($newPassword, PASSWORD_BCRYPT);
    saveUsers($users);
    
    successResponse(['success' => true]);
}
?>
