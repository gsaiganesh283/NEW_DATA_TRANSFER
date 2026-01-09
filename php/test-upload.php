<?php
// Simple test for upload endpoint
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/jwt.php';

// Test 1: Check if directories exist and are writable
echo "=== Directory Tests ===\n";
echo "DATA_DIR: " . DATA_DIR . " - " . (is_writable(DATA_DIR) ? "WRITABLE" : "NOT WRITABLE") . "\n";
echo "UPLOADS_DIR: " . UPLOADS_DIR . " - " . (is_writable(UPLOADS_DIR) ? "WRITABLE" : "NOT WRITABLE") . "\n";

// Test 2: Check if we can load settings
echo "\n=== Settings Test ===\n";
$settings = loadSettings();
echo "Settings loaded: " . json_encode($settings) . "\n";

// Test 3: Check file upload processing
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['testfile'])) {
    echo "\n=== File Upload Test ===\n";
    $file = $_FILES['testfile'];
    echo "File name: " . $file['name'] . "\n";
    echo "File size: " . $file['size'] . "\n";
    echo "File error: " . $file['error'] . "\n";
    echo "File temp: " . $file['tmp_name'] . "\n";
    
    if (file_exists($file['tmp_name'])) {
        echo "Temp file EXISTS\n";
        
        $uploadDir = UPLOADS_DIR . '/' . date('Y-m-d');
        if (!is_dir($uploadDir)) {
            if (mkdir($uploadDir, 0755, true)) {
                echo "Created upload directory: " . $uploadDir . "\n";
            } else {
                echo "FAILED to create upload directory\n";
            }
        } else {
            echo "Upload directory already exists\n";
        }
        
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $uniqueName = bin2hex(random_bytes(16)) . ($ext ? '.' . $ext : '');
        $filePath = $uploadDir . '/' . $uniqueName;
        echo "Target path: " . $filePath . "\n";
        
        if (move_uploaded_file($file['tmp_name'], $filePath)) {
            echo "File UPLOADED successfully\n";
        } else {
            echo "FAILED to move uploaded file\n";
        }
    } else {
        echo "Temp file DOES NOT EXIST\n";
    }
} else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo "\n=== GET Request - Form Below ===\n";
    echo <<<HTML
    <form method="POST" enctype="multipart/form-data">
        <input type="file" name="testfile">
        <button type="submit">Upload Test File</button>
    </form>
    HTML;
}
?>
