<?php
require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');

function get_latest_item_id($roomData) {
    $maxId = 0;

    if (isset($roomData['messages']) && is_array($roomData['messages'])) {
        foreach ($roomData['messages'] as $message) {
            $id = isset($message['id']) ? (int)$message['id'] : 0;
            if ($id > $maxId) {
                $maxId = $id;
            }
        }
    }

    if (isset($roomData['files']) && is_array($roomData['files'])) {
        foreach ($roomData['files'] as $file) {
            $id = isset($file['id']) ? (int)$file['id'] : 0;
            if ($id > $maxId) {
                $maxId = $id;
            }
        }
    }

    return $maxId;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$now = time();

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        respond(false, null, '��Ч��JSON');
    }

    $room = $input['room'] ?? '';
    $clientId = $input['client_id'] ?? '';
    $ua = substr($input['ua'] ?? '', 0, 255);

    validateRoom($room);
    if (!$clientId) {
        respond(false, null, 'ȱ��client_id');
    }

    $roomData = loadRoomData($room);

    if (!isset($roomData['kicked']) || !is_array($roomData['kicked'])) {
        $roomData['kicked'] = [];
    }

    // Cleanup old kick records (older than 1 hour)
    foreach ($roomData['kicked'] as $kId => $ts) {
        if (($now - (int)$ts) > 3600) {
            unset($roomData['kicked'][$kId]);
        }
    }

    // Forced disconnect check
    if (isset($roomData['kicked'][$clientId])) {
        respond(false, null, 'FORCE_DISCONNECT');
    }

    if (!isset($roomData['clients']) || !is_array($roomData['clients'])) {
        $roomData['clients'] = [];
    }

    $existingClient = $roomData['clients'][$clientId] ?? null;
    $clientRecord = is_array($existingClient) ? $existingClient : [];

    $clientRecord['id'] = $clientId;
    $clientRecord['ua'] = $ua;
    $clientRecord['ip'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $clientRecord['last_seen'] = $now;

    if (!isset($clientRecord['joined_at']) || !is_int($clientRecord['joined_at'])) {
        $clientRecord['joined_at'] = $existingClient && isset($existingClient['joined_at'])
            ? (int)$existingClient['joined_at']
            : $now;
    }

    if (!isset($clientRecord['baseline_id'])) {
        if ($existingClient) {
            $clientRecord['baseline_id'] = isset($existingClient['baseline_id'])
                ? (int)$existingClient['baseline_id']
                : 0;
        } else {
            $clientRecord['baseline_id'] = get_latest_item_id($roomData);
        }
    } else {
        $clientRecord['baseline_id'] = max(0, (int)$clientRecord['baseline_id']);
    }

    $roomData['clients'][$clientId] = $clientRecord;

    // Optional cleanup: drop stale clients (>5 minutes)
    foreach ($roomData['clients'] as $id => $client) {
        $lastSeen = isset($client['last_seen']) ? (int)$client['last_seen'] : $now;
        if (($now - $lastSeen) > 300) {
            unset($roomData['clients'][$id]);
        }
    }

    saveRoomData($room, $roomData);

    respond(true, [
        'clients' => array_values($roomData['clients']),
        'client' => $roomData['clients'][$clientId],
        'latest_message_id' => get_latest_item_id($roomData),
        'encryption' => $roomData['encryption'] ?? [
            'enabled' => false,
            'key' => null,
            'updated_at' => null,
            'updated_by' => null
        ]
    ]);
} elseif ($method === 'GET') {
    $room = $_GET['room'] ?? '';
    validateRoom($room);

    $roomData = loadRoomData($room);
    $clients = isset($roomData['clients']) && is_array($roomData['clients']) ? array_values($roomData['clients']) : [];

    respond(true, [
        'clients' => $clients,
        'latest_message_id' => get_latest_item_id($roomData),
        'encryption' => $roomData['encryption'] ?? [
            'enabled' => false,
            'key' => null,
            'updated_at' => null,
            'updated_by' => null
        ]
    ]);
} else {
    respond(false, null, '��֧��GET/POST');
}
?>
