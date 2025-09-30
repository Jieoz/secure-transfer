<?php
require_once 'config.php';

// 开启错误日志记录
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug.log');

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

// 调试信息：检查目录状态
$roomsDir = ROOMS_DIR;
$debugInfo = [];

// 检查目录是否存在
if (!is_dir($roomsDir)) {
    $debugInfo[] = "目录不存在: $roomsDir";
    // 尝试创建目录
    if (!mkdir($roomsDir, 0755, true)) {
        respond(false, null, "无法创建目录: $roomsDir");
    }
    $debugInfo[] = "已创建目录: $roomsDir";
}

// 检查目录权限
if (!is_writable($roomsDir)) {
    $debugInfo[] = "目录不可写: $roomsDir";
    respond(false, null, "目录权限错误: $roomsDir 不可写");
}

// 加载房间数据
try {
    $roomData = loadRoomData($room);
    $debugInfo[] = "成功加载房间数据";
} catch (Exception $e) {
    respond(false, null, '加载房间数据失败: ' . $e->getMessage());
}

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

// 获取文件路径
$roomFile = getRoomFile($room);
$debugInfo[] = "房间文件路径: $roomFile";

// 检查父目录
$parentDir = dirname($roomFile);
if (!is_dir($parentDir)) {
    $debugInfo[] = "父目录不存在: $parentDir";
    if (!mkdir($parentDir, 0755, true)) {
        respond(false, null, "无法创建父目录: $parentDir");
    }
}

// 检查父目录权限
if (!is_writable($parentDir)) {
    $debugInfo[] = "父目录不可写: $parentDir";
    respond(false, null, "父目录权限错误: $parentDir 不可写");
}

// 尝试JSON编码
$jsonData = json_encode($roomData, JSON_UNESCAPED_UNICODE);
if ($jsonData === false) {
    $debugInfo[] = "JSON编码失败: " . json_last_error_msg();
    respond(false, null, 'JSON编码失败: ' . json_last_error_msg());
}

// 尝试保存文件
$bytesWritten = file_put_contents($roomFile, $jsonData);
if ($bytesWritten === false) {
    $error = error_get_last();
    $debugInfo[] = "文件写入失败";
    if ($error) {
        $debugInfo[] = "错误信息: " . $error['message'];
    }

    // 记录调试信息到日志
    error_log("Debug info: " . implode(", ", $debugInfo));

    respond(false, null, '保存消息失败 - 调试信息已记录到日志');
} else {
    $debugInfo[] = "成功写入 $bytesWritten 字节";
    // 记录成功信息
    error_log("成功保存消息: " . implode(", ", $debugInfo));

    respond(true, [
        'id' => $messageRecord['id'],
        'debug' => $debugInfo // 临时添加调试信息
    ]);
}
?>