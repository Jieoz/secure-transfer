<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, null, '仅支持POST请求');
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    respond(false, null, '无效的JSON');
}

$room = $input['room'] ?? '';
$id = intval($input['id'] ?? 0);

validateRoom($room);
if ($id <= 0) {
    respond(false, null, '无效的消息ID');
}

$data = loadRoomData($room);

$found = false;
if (isset($data['messages']) && is_array($data['messages'])) {
    foreach ($data['messages'] as $idx => $msg) {
        if (isset($msg['id']) && intval($msg['id']) === $id) {
            // 仅允许消费文本消息
            if (!isset($msg['type']) || $msg['type'] !== 'message') {
                respond(false, null, '只能消费文本消息');
            }
            // 从数组中移除该消息
            array_splice($data['messages'], $idx, 1);
            $found = true;
            break;
        }
    }
}

if (!$found) {
    respond(false, null, '消息不存在或已被处理');
}

if (saveRoomData($room, $data)) {
    respond(true, [ 'removed_id' => $id ]);
} else {
    respond(false, null, '保存失败');
}
?>

