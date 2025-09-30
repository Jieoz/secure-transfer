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
$clientId = $input['client_id'] ?? '';

validateRoom($room);

$roomData = loadRoomData($room);
$defaultEncryption = [
    'enabled' => false,
    'key' => null,
    'updated_at' => null,
    'updated_by' => null
];

if (!isset($roomData['encryption']) || !is_array($roomData['encryption'])) {
    $roomData['encryption'] = $defaultEncryption;
}

if ($action === 'enable') {
    try {
        $bytes = random_bytes(32);
        $keyB64 = base64_encode($bytes);
    } catch (Exception $e) {
        respond(false, null, '���ɼ���Կʧ��');
    }

    $roomData['encryption'] = [
        'enabled' => true,
        'key' => $keyB64,
        'updated_at' => time(),
        'updated_by' => $clientId ?: 'unknown'
    ];

    if (!saveRoomData($room, $roomData)) {
        respond(false, null, '�������ö˵��˼���ʧ��');
    }

    respond(true, [
        'encryption' => $roomData['encryption']
    ]);
} elseif ($action === 'disable') {
    $roomData['encryption'] = $defaultEncryption;

    if (!saveRoomData($room, $roomData)) {
        respond(false, null, '�޷��رն˵��˼���');
    }

    respond(true, [
        'encryption' => $roomData['encryption']
    ]);
}

respond(false, null, '��֧�ֵĲ���');
?>
