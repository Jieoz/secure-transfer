<?php
// 基础配置
header('Content-Type: application/json; charset=utf-8');

// 安全的CORS配置 - 生产环境应限制具体域名
$allowedOrigins = [
    'http://localhost',
    'https://localhost',
    'http://127.0.0.1',
    'https://127.0.0.1'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins) ||
    (isset($_SERVER['HTTP_HOST']) && $_SERVER['HTTP_HOST'] === parse_url($origin, PHP_URL_HOST))) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: *'); // 开发环境临时允许
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

// 处理OPTIONS请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 配置常量
define('ROOMS_DIR', __DIR__ . '/../rooms');
define('UPLOADS_DIR', __DIR__ . '/../uploads');
define('MAX_FILE_SIZE', 500 * 1024 * 1024); // 500MB
define('FILE_TTL', 60 * 60); // 1小时无活动后清理

// 确保目录存在
if (!is_dir(ROOMS_DIR)) {
    mkdir(ROOMS_DIR, 0755, true);
}
if (!is_dir(UPLOADS_DIR)) {
    mkdir(UPLOADS_DIR, 0755, true);
}

// 工具函数
function respond($success, $data = null, $error = null) {
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error
    ]);
    exit();
}

function return_bytes($val) {
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = intval($val);
    switch($last) {
        case 'g':
            $val *= 1024;
        case 'm':
            $val *= 1024;
        case 'k':
            $val *= 1024;
    }
    return $val;
}

function validateRoom($room) {
    if (!$room) {
        respond(false, null, '房间ID不能为空');
    }

    // 支持格式：
    // - PIN码：6位数字
    // - 自定义房间号：字母、数字，3-12位（简化）
    // - 旧版本兼容
    if (!preg_match('/^\d{6}$/', $room) &&                     // 6位数字PIN
        !preg_match('/^[a-zA-Z0-9]{3,12}$/', $room) &&         // 简化的自定义房间号
        !preg_match('/^[a-zA-Z]+-[a-f0-9]{6}$/', $room) &&     // 旧版本单词+hex
        !preg_match('/^[a-f0-9]{16}$/', $room)) {              // 最旧版本hex
        respond(false, null, '无效的房间ID格式');
    }

    return true;
}

function getRoomFile($room) {
    return ROOMS_DIR . '/' . $room . '.json';
}

function loadRoomData($room) {
    $file = getRoomFile($room);
    $defaults = [
        'messages' => [],
        'files' => [],
        'created' => time(),
        'clients' => [],
        'encryption' => [
            'enabled' => false,
            'key' => null,
            'updated_at' => null,
            'updated_by' => null
        ],
        'kicked' => []
    ];

    if (!file_exists($file)) {
        return $defaults;
    }

    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) {
        $data = [];
    }

    $data = array_merge($defaults, $data);

    if (!isset($data['messages']) || !is_array($data['messages'])) {
        $data['messages'] = [];
    }
    if (!isset($data['files']) || !is_array($data['files'])) {
        $data['files'] = [];
    }
    if (!isset($data['clients']) || !is_array($data['clients'])) {
        $data['clients'] = [];
    }
    if (!isset($data['kicked']) || !is_array($data['kicked'])) {
        $data['kicked'] = [];
    }

    if (!isset($data['encryption']) || !is_array($data['encryption'])) {
        $data['encryption'] = $defaults['encryption'];
    } else {
        $data['encryption'] = array_merge($defaults['encryption'], $data['encryption']);
        $data['encryption']['enabled'] = !empty($data['encryption']['enabled']);
        if (!$data['encryption']['enabled']) {
            $data['encryption']['key'] = null;
        }
    }

    return $data;
}

function saveRoomData($room, $data) {
    $file = getRoomFile($room);
    return file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE));
}

function formatFileSize($bytes) {
    if ($bytes === 0) return '0 B';
    $sizes = ['B', 'KB', 'MB', 'GB'];
    $factor = floor(log($bytes, 1024));
    return round($bytes / pow(1024, $factor), 2) . ' ' . $sizes[$factor];
}

function cleanupOldFiles() {
    $now = time();

    // 清理超过1小时未访问的房间
    $files = glob(ROOMS_DIR . '/*.json');
    foreach ($files as $file) {
        $data = json_decode(file_get_contents($file), true);
        if ($data) {
            $lastAccess = $data['last_access'] ?? filemtime($file);
            if (($now - $lastAccess) > FILE_TTL) {
                // 删除关联的上传文件
                if (isset($data['files'])) {
                    foreach ($data['files'] as $fileRecord) {
                        $fileInfo = json_decode($fileRecord['content'], true);
                        if ($fileInfo && isset($fileInfo['filename'])) {
                            $uploadFile = UPLOADS_DIR . '/' . $fileInfo['filename'];
                            if (file_exists($uploadFile)) {
                                unlink($uploadFile);
                            }
                        }
                    }
                }
                // 删除房间文件
                unlink($file);
            }
        }
    }

    // 清理孤立的上传文件（超过1小时的）
    $uploadFiles = glob(UPLOADS_DIR . '/*');
    foreach ($uploadFiles as $file) {
        if (($now - filemtime($file)) > FILE_TTL) {
            unlink($file);
        }
    }
}

// 定期清理（10%概率）
if (rand(1, 10) === 1) {
    cleanupOldFiles();
}
?>
