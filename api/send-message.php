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
$message = $input['message'] ?? '';

validateRoom($room);

if (!$message || !is_array($message)) {
    respond(false, null, '消息内容不能为空');
}

// 验证加密消息格式
if (!isset($message['encrypted']) || !isset($message['data'])) {
    respond(false, null, '无效的消息格式');
}

if ($message['encrypted'] && !is_string($message['data'])) {
    respond(false, null, '加密消息数据必须是字符串');
}

if (!$message['encrypted'] && strlen($message['data']) > 5000) {
    respond(false, null, '消息长度不能超过5000字符');
}

// 加载房间数据
$roomData = loadRoomData($room);

// 创建消息记录
$messageRecord = [
    'id' => count($roomData['messages']) + 1,
    'type' => 'message',
    'content' => $message,
    'timestamp' => time(),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
];

// 添加到房间数据
$roomData['messages'][] = $messageRecord;

// 保存房间数据
if (saveRoomData($room, $roomData)) {
    respond(true, ['id' => $messageRecord['id']]);
} else {
    respond(false, null, '保存消息失败');
}
?>