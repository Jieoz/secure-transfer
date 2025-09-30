<?php
require_once 'config.php';

// 服务器信息端点
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理OPTIONS请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 只允许GET和HEAD方法
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'])) {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// HEAD请求只返回状态码
if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
    http_response_code(200);
    exit();
}

// 返回服务器基本信息
echo json_encode([
    'success' => true,
    'server' => 'SecureTransfer API',
    'version' => '1.0',
    'php_version' => phpversion(),
    'timestamp' => time(),
    'max_file_size' => MAX_FILE_SIZE,
    'upload_dir' => UPLOAD_DIR,
    'rooms_dir' => ROOMS_DIR
], JSON_PRETTY_PRINT);
?>