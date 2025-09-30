<?php
// 简单的API服务器状态检查工具
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// 检查所需的API文件
$apiFiles = [
    'server-info.php',
    'get-history.php',
    'send-message.php',
    'upload.php',
    'download.php',
    'clear-room.php',
    'config.php'
];

$status = [];
$missingFiles = [];

foreach ($apiFiles as $file) {
    $fullPath = __DIR__ . '/' . $file;
    if (file_exists($fullPath)) {
        $status[$file] = 'exists';
    } else {
        $status[$file] = 'missing';
        $missingFiles[] = $file;
    }
}

// 检查目录权限
$directories = [
    '../rooms' => is_dir(__DIR__ . '/../rooms') && is_writable(__DIR__ . '/../rooms'),
    '../uploads' => is_dir(__DIR__ . '/../uploads') && is_writable(__DIR__ . '/../uploads')
];

echo json_encode([
    'success' => true,
    'api_files' => $status,
    'missing_files' => $missingFiles,
    'directories' => $directories,
    'current_dir' => __DIR__,
    'server_info' => [
        'php_version' => phpversion(),
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
        'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'unknown'
    ]
], JSON_PRETTY_PRINT);
?>