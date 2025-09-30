<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, null, '只支持POST请求');
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    respond(false, null, '无效的JSON数据');
}

$room = $input['room'] ?? '';
validateRoom($room);

// 加载房间数据
$roomData = loadRoomData($room);

// 删除所有关联的文件
foreach ($roomData['files'] as $fileRecord) {
    $fileInfo = json_decode($fileRecord['content'], true);
    if ($fileInfo && isset($fileInfo['filename'])) {
        $filePath = UPLOADS_DIR . '/' . $fileInfo['filename'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
    }
}

// 不完全删除房间文件，而是创建一个清空标记
$clearTime = time();
$roomData = [
    'messages' => [],
    'files' => [],
    'created' => $roomData['created'] ?? $clearTime,
    'last_clear' => $clearTime,  // 记录清空时间戳
    'clear_id' => uniqid(),      // 清空ID用于客户端检测
    'clients' => [],
    'encryption' => [
        'enabled' => false,
        'key' => null,
        'updated_at' => null,
        'updated_by' => null
    ],
    'kicked' => []
];

// 保存更新后的房间数据
if (saveRoomData($room, $roomData)) {
    respond(true, [
        'message' => '房间已清空',
        'clear_time' => $clearTime,
        'clear_id' => $roomData['clear_id']
    ]);
} else {
    respond(false, null, '清空失败');
}
?>