<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, null, 'ֻ֧��POST����');
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    respond(false, null, '��Ч��JSON');
}

$room = $input['room'] ?? '';
$action = strtolower($input['action'] ?? '');
$targetId = $input['target_id'] ?? '';
$actorId = $input['client_id'] ?? '';

validateRoom($room);

$roomData = loadRoomData($room);
if (!isset($roomData['clients']) || !is_array($roomData['clients'])) {
    $roomData['clients'] = [];
}
if (!isset($roomData['kicked']) || !is_array($roomData['kicked'])) {
    $roomData['kicked'] = [];
}

$now = time();

if ($action === 'kick') {
    if (!$targetId) {
        respond(false, null, 'ȱ��target_id');
    }

    if (isset($roomData['clients'][$targetId])) {
        unset($roomData['clients'][$targetId]);
    }

    $roomData['kicked'][$targetId] = $now;

    if (!saveRoomData($room, $roomData)) {
        respond(false, null, '�����޷��Ͽ��豸');
    }

    respond(true, [
        'clients' => array_values($roomData['clients']),
        'kicked' => array_keys($roomData['kicked']),
        'actor' => $actorId
    ]);
}

respond(false, null, '��֧�ֵĲ���');
?>
