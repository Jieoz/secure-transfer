<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo '只支持GET请求';
    exit();
}

$room = $_GET['room'] ?? '';
$filename = $_GET['file'] ?? '';

validateRoom($room);

if (!$filename) {
    http_response_code(400);
    echo '文件名不能为空';
    exit();
}

// 验证文件名格式（防止路径遍历攻击）
if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $filename)) {
    http_response_code(400);
    echo '无效的文件名';
    exit();
}

$filePath = UPLOADS_DIR . '/' . $filename;

if (!file_exists($filePath)) {
    http_response_code(404);
    echo '文件不存在';
    exit();
}

// 加载房间数据验证文件访问权限
$roomData = loadRoomData($room);
$fileExists = false;
$originalName = $filename;

foreach ($roomData['files'] as $fileRecord) {
    $fileInfo = json_decode($fileRecord['content'], true);
    if ($fileInfo && $fileInfo['filename'] === $filename) {
        $fileExists = true;
        $originalName = $fileInfo['name'];
        break;
    }
}

if (!$fileExists) {
    http_response_code(403);
    echo '无权访问此文件';
    exit();
}

// 设置下载头
$fileSize = filesize($filePath);
$mimeType = mime_content_type($filePath) ?: 'application/octet-stream';

// 清除之前的输出缓冲
if (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: ' . $mimeType);
header('Content-Length: ' . $fileSize);
header('Content-Disposition: attachment; filename="' . addslashes($originalName) . '"');
header('Cache-Control: no-cache, must-revalidate');
header('Pragma: no-cache');

// 支持断点续传
if (isset($_SERVER['HTTP_RANGE'])) {
    $range = $_SERVER['HTTP_RANGE'];
    $ranges = explode('=', $range);
    $offsets = explode('-', $ranges[1]);
    $offset = intval($offsets[0]);
    $length = intval($offsets[1]) ?: $fileSize - 1;

    if ($offset > 0 || $length < $fileSize - 1) {
        http_response_code(206);
        header('Accept-Ranges: bytes');
        header('Content-Range: bytes ' . $offset . '-' . $length . '/' . $fileSize);
        header('Content-Length: ' . ($length - $offset + 1));

        $fp = fopen($filePath, 'rb');
        fseek($fp, $offset);
        echo fread($fp, $length - $offset + 1);
        fclose($fp);
        exit();
    }
}

// 普通下载
readfile($filePath);
exit();
?>