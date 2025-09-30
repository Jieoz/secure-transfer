<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(false, null, '只支持GET请求');
}

$room = $_GET['room'] ?? '';
$after = intval($_GET['after'] ?? 0);
$clearCheck = isset($_GET['clear_check']);
$clientId = $_GET['client_id'] ?? '';

validateRoom($room);

// 加载房间数据
$roomData = loadRoomData($room);

$clientBaseline = 0;
if ($clientId && isset($roomData['clients']) && isset($roomData['clients'][$clientId])) {
    $baselineRaw = $roomData['clients'][$clientId]['baseline_id'] ?? 0;
    if (is_numeric($baselineRaw)) {
        $clientBaseline = max(0, (int)$baselineRaw);
    }
}

$effectiveAfter = max($after, $clientBaseline);

// 更新最后访问时间
$roomData['last_access'] = time();
saveRoomData($room, $roomData);

// 合并消息和文件，按时间排序
$history = [];

// 添加消息
foreach ($roomData['messages'] as $message) {
    if ($message['id'] > $effectiveAfter) {
        $history[] = $message;
    }
}

// 添加文件
foreach ($roomData['files'] as $file) {
    if ($file['id'] > $effectiveAfter) {
        $history[] = $file;
    }
}

// 按ID排序
usort($history, function($a, $b) {
    return $a['id'] - $b['id'];
});

// 计算统计信息
$messageCount = count($roomData['messages']);
$fileCount = count($roomData['files']);
$totalSize = 0;

foreach ($roomData['files'] as $file) {
    $fileInfo = json_decode($file['content'], true);
    if ($fileInfo && isset($fileInfo['size'])) {
        $totalSize += $fileInfo['size'];
    }
}

// 构建响应数据
$responseData = [
    'history' => $history,
    'messageCount' => $messageCount,
    'fileCount' => $fileCount,
    'totalSize' => $totalSize,
    'baseline_id' => $clientBaseline,
    'encryption' => $roomData['encryption'] ?? [
        'enabled' => false,
        'key' => null,
        'updated_at' => null,
        'updated_by' => null
    ]
];

// 如果请求清空检查，返回房间信息
if ($clearCheck) {
    $responseData['room_info'] = [
        'clear_id' => $roomData['clear_id'] ?? null,
        'last_clear' => $roomData['last_clear'] ?? null
    ];
}

respond(true, $responseData);
?>