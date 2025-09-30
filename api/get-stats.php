<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(false, null, '只支持GET请求');
}

$room = $_GET['room'] ?? '';
validateRoom($room);

// 加载房间数据
$roomData = loadRoomData($room);

$messageCount = count($roomData['messages']);
$fileCount = count($roomData['files']);
$totalSize = 0;

// 计算总文件大小
foreach ($roomData['files'] as $fileRecord) {
    $fileInfo = json_decode($fileRecord['content'], true);
    if ($fileInfo && isset($fileInfo['size'])) {
        $totalSize += $fileInfo['size'];
    }
}

respond(true, [
    'messageCount' => $messageCount,
    'fileCount' => $fileCount,
    'totalSize' => formatFileSize($totalSize)
]);
?>