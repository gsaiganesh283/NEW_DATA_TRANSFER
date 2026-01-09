<?php
// File Transfer API endpoints

// Set error handler to catch all errors
error_reporting(E_ALL);
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) {
        return false;
    }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server error: ' . $errstr . ' in ' . $errfile . ':' . $errline]);
    exit;
});

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

// Fallback: if PATH_INFO is empty, try to extract from REQUEST_URI
if (empty($path) && isset($_SERVER['REQUEST_URI'])) {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $basePaths = ['/php/api/', '/api/'];
    foreach ($basePaths as $basePath) {
        if (strpos($uri, $basePath) === 0) {
            $path = substr($uri, strlen($basePath));
            break;
        }
    }
}

$pathParts = explode('/', $path);

// Route: POST /upload
if ($method === 'POST' && $pathParts[0] === 'upload') {
    handleUpload();
}
// Route: GET /files/{code}
elseif ($method === 'GET' && $pathParts[0] === 'files' && isset($pathParts[1])) {
    handleGetFileInfo($pathParts[1]);
}
// Route: POST /files/{code}/verify
elseif ($method === 'POST' && $pathParts[0] === 'files' && isset($pathParts[1]) && $pathParts[2] === 'verify') {
    handleVerifyPassword($pathParts[1]);
}
// Route: GET /download/{code}/{index}
elseif ($method === 'GET' && $pathParts[0] === 'download' && isset($pathParts[1], $pathParts[2])) {
    handleDownloadSingle($pathParts[1], $pathParts[2]);
}
// Route: GET /download-zip/{code}
elseif ($method === 'GET' && $pathParts[0] === 'download-zip' && isset($pathParts[1])) {
    handleDownloadZip($pathParts[1]);
}
// Route: DELETE /files/{code}
elseif ($method === 'DELETE' && $pathParts[0] === 'files' && isset($pathParts[1])) {
    handleDeleteTransfer($pathParts[1]);
}
// Route: GET /settings
elseif ($method === 'GET' && $pathParts[0] === 'settings') {
    handleGetPublicSettings();
}
// Route: GET /health
elseif ($method === 'GET' && $pathParts[0] === 'health') {
    handleHealth();
}
else {
    errorResponse('Not found', 404);
}

function handleUpload() {
    $settings = loadSettings();
    $user = getOptionalUser();
    
    if (!$settings['allowAnonymous'] && !$user) {
        errorResponse('Login required to upload files', 401);
    }
    
    // Check if files were uploaded
    if (!isset($_FILES['files']) || empty($_FILES['files']['name'][0])) {
        errorResponse('No files uploaded', 400);
    }
    
    // Get password and other metadata
    $password = $_POST['password'] ?? null;
    $expiryTime = isset($_POST['expiryTime']) ? (int)$_POST['expiryTime'] : $settings['expiryTime'];
    $message = $_POST['message'] ?? null;
    $folderPaths = isset($_POST['folderPaths']) ? json_decode($_POST['folderPaths'], true) : null;
    
    // Check file count
    $fileCount = count($_FILES['files']['name']);
    if ($fileCount > $settings['maxFiles']) {
        errorResponse('Too many files. Maximum: ' . $settings['maxFiles'], 400);
    }
    
    $transferCode = strtoupper(generateRandomString(6));
    $uploadDir = UPLOADS_DIR . '/' . date('Y-m-d');
    
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $files = [];
    $totalSize = 0;
    
    for ($i = 0; $i < $fileCount; $i++) {
        if ($_FILES['files']['error'][$i] !== UPLOAD_ERR_OK) {
            errorResponse('File upload error for file ' . $_FILES['files']['name'][$i], 400);
        }
        
        $fileSize = $_FILES['files']['size'][$i];
        $maxSizeBytes = $settings['maxFileSize'] * 1024 * 1024;
        
        if ($fileSize > $maxSizeBytes) {
            errorResponse('File too large: ' . $_FILES['files']['name'][$i] . '. Maximum size: ' . $settings['maxFileSize'] . 'MB', 400);
        }
        
        $originalName = $_FILES['files']['name'][$i];
        $tmpName = $_FILES['files']['tmp_name'][$i];
        $mimeType = $_FILES['files']['type'][$i];
        
        // Generate unique filename
        $ext = pathinfo($originalName, PATHINFO_EXTENSION);
        $uniqueName = bin2hex(random_bytes(16)) . ($ext ? '.' . $ext : '');
        $filePath = $uploadDir . '/' . $uniqueName;
        
        if (!move_uploaded_file($tmpName, $filePath)) {
            errorResponse('Failed to save file: ' . $originalName, 500);
        }
        
        $files[] = [
            'originalName' => $originalName,
            'filename' => $uniqueName,
            'path' => $filePath,
            'size' => $fileSize,
            'mimetype' => $mimeType,
            'folderPath' => $folderPaths && isset($folderPaths[$i]) ? $folderPaths[$i] : null
        ];
        
        $totalSize += $fileSize;
    }
    
    // Hash password if provided
    $hashedPassword = $password ? password_hash($password, PASSWORD_BCRYPT) : null;
    
    $transfers = loadTransfers();
    $transfers[$transferCode] = [
        'files' => $files,
        'uploadedAt' => time() * 1000,
        'expiresAt' => (time() + ($expiryTime * 60 * 60)) * 1000,
        'downloadCount' => 0,
        'uploadedBy' => $user ? $user['email'] : null,
        'password' => $hashedPassword,
        'message' => $message,
        'hasPassword' => !!$password
    ];
    
    saveTransfers($transfers);
    
    successResponse([
        'transferCode' => $transferCode,
        'fileCount' => $fileCount,
        'totalSize' => $totalSize,
        'expiresIn' => $expiryTime . ' hour(s)',
        'hasPassword' => !!$password,
        'hasMessage' => !!$message
    ]);
}

function handleGetFileInfo($code) {
    $code = strtoupper($code);
    $transfers = loadTransfers();
    
    if (!isset($transfers[$code])) {
        errorResponse('Transfer code not found or expired', 404);
    }
    
    $fileInfo = $transfers[$code];
    
    // Check if expired
    if ($fileInfo['expiresAt'] && time() * 1000 > $fileInfo['expiresAt']) {
        unset($transfers[$code]);
        saveTransfers($transfers);
        errorResponse('Transfer has expired', 404);
    }
    
    $files = [];
    foreach ($fileInfo['files'] as $file) {
        $files[] = [
            'name' => $file['originalName'],
            'size' => $file['size'],
            'type' => $file['mimetype'],
            'folderPath' => $file['folderPath']
        ];
    }
    
    successResponse([
        'files' => $files,
        'uploadedAt' => $fileInfo['uploadedAt'],
        'expiresAt' => $fileInfo['expiresAt'],
        'downloadCount' => $fileInfo['downloadCount'],
        'hasPassword' => $fileInfo['hasPassword'] ?? false,
        'message' => $fileInfo['message'] ?? null
    ]);
}

function handleVerifyPassword($code) {
    $code = strtoupper($code);
    $input = getJsonInput();
    $password = $input['password'] ?? '';
    
    $transfers = loadTransfers();
    
    if (!isset($transfers[$code])) {
        errorResponse('Transfer code not found or expired', 404);
    }
    
    $fileInfo = $transfers[$code];
    
    if (!$fileInfo['password']) {
        successResponse(['verified' => true]);
    }
    
    if (!password_verify($password, $fileInfo['password'])) {
        errorResponse('Incorrect password', 401);
    }
    
    successResponse(['verified' => true]);
}

function handleDownloadSingle($code, $index) {
    $code = strtoupper($code);
    $index = (int)$index;
    $password = $_GET['password'] ?? null;
    
    $transfers = loadTransfers();
    
    if (!isset($transfers[$code])) {
        errorResponse('Transfer code not found or expired', 404);
    }
    
    $fileInfo = $transfers[$code];
    
    // Check password if protected
    if ($fileInfo['password']) {
        if (!$password || !password_verify($password, $fileInfo['password'])) {
            errorResponse('Password required', 401);
        }
    }
    
    if ($index < 0 || $index >= count($fileInfo['files'])) {
        errorResponse('File not found', 404);
    }
    
    $file = $fileInfo['files'][$index];
    
    if (!file_exists($file['path'])) {
        errorResponse('File no longer available', 404);
    }
    
    // Update download count
    $fileInfo['downloadCount']++;
    $transfers[$code] = $fileInfo;
    saveTransfers($transfers);
    
    // Send file
    header('Content-Type: ' . ($file['mimetype'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . rawurlencode($file['originalName']) . '"');
    header('Content-Length: ' . filesize($file['path']));
    
    readfile($file['path']);
    exit;
}

function handleDownloadZip($code) {
    $code = strtoupper($code);
    $password = $_GET['password'] ?? null;
    $indexes = isset($_GET['indexes']) ? array_map('intval', explode(',', $_GET['indexes'])) : null;
    
    $transfers = loadTransfers();
    
    if (!isset($transfers[$code])) {
        errorResponse('Transfer code not found or expired', 404);
    }
    
    $fileInfo = $transfers[$code];
    
    // Check password if protected
    if ($fileInfo['password']) {
        if (!$password || !password_verify($password, $fileInfo['password'])) {
            errorResponse('Password required', 401);
        }
    }
    
    $filesToZip = [];
    if ($indexes) {
        foreach ($indexes as $idx) {
            if ($idx >= 0 && $idx < count($fileInfo['files'])) {
                $filesToZip[] = $fileInfo['files'][$idx];
            }
        }
    } else {
        $filesToZip = $fileInfo['files'];
    }
    
    if (empty($filesToZip)) {
        errorResponse('No files to download', 404);
    }
    
    // Create zip file in memory
    $zipFile = tempnam(sys_get_temp_dir(), 'zip');
    $zip = new ZipArchive();
    $zip->open($zipFile, ZipArchive::CREATE);
    
    foreach ($filesToZip as $file) {
        if (file_exists($file['path'])) {
            $archivePath = $file['folderPath'] ?: $file['originalName'];
            $zip->addFile($file['path'], $archivePath);
        }
    }
    
    $zip->close();
    
    // Update download count
    $fileInfo['downloadCount']++;
    $transfers[$code] = $fileInfo;
    saveTransfers($transfers);
    
    // Send zip file
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="transfer-' . $code . '.zip"');
    header('Content-Length: ' . filesize($zipFile));
    
    readfile($zipFile);
    unlink($zipFile);
    exit;
}

function handleDeleteTransfer($code) {
    $code = strtoupper($code);
    $transfers = loadTransfers();
    
    if (!isset($transfers[$code])) {
        errorResponse('Transfer code not found', 404);
    }
    
    $fileInfo = $transfers[$code];
    
    // Delete files from disk
    foreach ($fileInfo['files'] as $file) {
        if (file_exists($file['path'])) {
            unlink($file['path']);
        }
    }
    
    unset($transfers[$code]);
    saveTransfers($transfers);
    
    successResponse(['message' => 'Files deleted']);
}

function handleGetPublicSettings() {
    $settings = loadSettings();
    
    successResponse([
        'settings' => [
            'maxFileSize' => $settings['maxFileSize'],
            'maxFiles' => $settings['maxFiles'],
            'expiryTime' => $settings['expiryTime'],
            'allowAnonymous' => $settings['allowAnonymous']
        ]
    ]);
}

function handleHealth() {
    $transfers = loadTransfers();
    
    successResponse([
        'status' => 'ok',
        'activeTransfers' => count($transfers)
    ]);
}
?>
