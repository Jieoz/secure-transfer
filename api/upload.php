<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, null, '只支持POST请求');
}

// 检查POST请求是否因为体积过大被截断
$postMaxSize = ini_get('post_max_size');
$uploadMaxSize = ini_get('upload_max_filesize');

if (empty($_POST) && !empty($_SERVER['CONTENT_LENGTH'])) {
    $contentLength = $_SERVER['CONTENT_LENGTH'];
    $maxSize = min(
        return_bytes($postMaxSize),
        return_bytes($uploadMaxSize)
    );

    if ($contentLength > $maxSize) {
        respond(false, null, "文件大小超过服务器限制。当前限制: upload_max_filesize={$uploadMaxSize}, post_max_size={$postMaxSize}。请联系管理员调整配置。");
    }
}

$room = $_POST['room'] ?? '';
if (empty($room)) {
    respond(false, null, '房间ID不能为空，无法上传文件。');
}

validateRoom($room);

if (!isset($_FILES['file'])) {
    respond(false, null, '没有收到要上传的文件');
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => '文件大小超过服务器限制',
        UPLOAD_ERR_FORM_SIZE => '文件大小超过表单限制',
        UPLOAD_ERR_PARTIAL => '文件上传不完整',
        UPLOAD_ERR_NO_FILE => '没有文件被上传',
        UPLOAD_ERR_NO_TMP_DIR => '临时目录不存在',
        UPLOAD_ERR_CANT_WRITE => '文件写入失败',
        UPLOAD_ERR_EXTENSION => '文件上传被扩展名禁止'
    ];

    $errorMessage = $errorMessages[$file['error']] ?? '未知的上传错误';
    respond(false, null, $errorMessage);
}

if ($file['size'] > MAX_FILE_SIZE) {
    respond(false, null, '文件大小不能超过 500MB');
}

$encrypted = ($_POST['encrypted'] ?? 'false') === 'true';
$originalName = $encrypted ? ($_POST['originalName'] ?? $file['name']) : $file['name'];
$originalType = $encrypted ? ($_POST['originalType'] ?? $file['type']) : $file['type'];
$originalSize = $encrypted ? intval($_POST['originalSize'] ?? $file['size']) : $file['size'];

$isVoice = (isset($_POST['isVoice']) && $_POST['isVoice'] === 'true');
$voiceDuration = isset($_POST['voiceDuration']) ? floatval($_POST['voiceDuration']) : 0;
$voiceMime = $_POST['voiceMime'] ?? '';

$allowedTypes = [
    // 文档类型
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/rtf',
    // 图片类型
    'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
    // 音视频类型
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'video/mp4', 'video/mpeg', 'video/quicktime',
    // 压缩包
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/gzip', 'application/x-tar',
    // 其他常见类型
    'application/json', 'application/xml', 'text/html', 'text/css', 'text/javascript'
];

if (!$encrypted && !in_array($file['type'], $allowedTypes) && $file['type'] !== 'application/octet-stream') {
    error_log("Blocked file upload: type={$file['type']}, name={$originalName}");
}

$dangerousExtensions = ['exe', 'bat', 'com', 'cmd', 'scr', 'pif', 'vbs', 'js', 'jar', 'php', 'asp', 'jsp'];
$fileExtension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

if (in_array($fileExtension, $dangerousExtensions)) {
    respond(false, null, '该文件类型不允许上传');
}

$extension = pathinfo($originalName, PATHINFO_EXTENSION);
$filename = uniqid() . '_' . time();
if ($extension) {
    $filename .= '.' . $extension;
}

$uploadPath = UPLOADS_DIR . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
    respond(false, null, '文件保存失败');
}

$roomData = loadRoomData($room);

$recordContent = [
    'name' => $originalName,
    'filename' => $filename,
    'type' => $originalType,
    'size' => $originalSize,
    'encrypted' => $encrypted
];

if ($isVoice) {
    $recordContent['voice'] = true;
    $recordContent['duration'] = $voiceDuration > 0 ? $voiceDuration : 0;
    $recordContent['mime'] = $voiceMime !== '' ? $voiceMime : ($originalType ?: 'audio/webm');
}

$fileRecord = [
    'id' => count($roomData['messages']) + count($roomData['files']) + 1,
    'type' => $isVoice ? 'voice' : 'file',
    'content' => json_encode($recordContent, JSON_UNESCAPED_UNICODE),
    'timestamp' => time(),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
];

$roomData['files'][] = $fileRecord;

if (saveRoomData($room, $roomData)) {
    respond(true, [
        'id' => $fileRecord['id'],
        'filename' => $filename,
        'originalName' => $originalName
    ]);
} else {
    unlink($uploadPath);
    respond(false, null, '保存文件记录失败');
}
?>
