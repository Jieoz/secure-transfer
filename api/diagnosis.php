<?php
echo "<h2>安全传输工具 - 环境诊断</h2>";

// 基础路径配置
$currentDir = __DIR__;
$rootDir = dirname($currentDir);
$roomsDir = $rootDir . '/rooms';
$uploadsDir = $rootDir . '/uploads';

echo "<h3>1. 目录检查</h3>";
echo "<p>当前目录: $currentDir</p>";
echo "<p>根目录: $rootDir</p>";
echo "<p>Rooms目录: $roomsDir</p>";
echo "<p>Uploads目录: $uploadsDir</p>";

// 检查目录状态
function checkDirectory($path, $name) {
    echo "<h4>$name 目录状态：</h4>";
    echo "<ul>";

    if (file_exists($path)) {
        echo "<li>✅ 目录存在</li>";

        if (is_dir($path)) {
            echo "<li>✅ 是目录</li>";
        } else {
            echo "<li>❌ 不是目录</li>";
        }

        if (is_readable($path)) {
            echo "<li>✅ 可读</li>";
        } else {
            echo "<li>❌ 不可读</li>";
        }

        if (is_writable($path)) {
            echo "<li>✅ 可写</li>";
        } else {
            echo "<li>❌ 不可写</li>";
        }

        // 显示权限
        $perms = fileperms($path);
        $perms_str = substr(sprintf('%o', $perms), -4);
        echo "<li>权限: $perms_str</li>";

        // 显示所有者
        if (function_exists('posix_getpwuid')) {
            $owner = posix_getpwuid(fileowner($path));
            echo "<li>所有者: " . ($owner['name'] ?? 'unknown') . "</li>";
        }

    } else {
        echo "<li>❌ 目录不存在</li>";

        // 尝试创建
        if (mkdir($path, 0755, true)) {
            echo "<li>✅ 已自动创建</li>";
            checkDirectory($path, $name . " (重新检查)");
            return;
        } else {
            echo "<li>❌ 无法创建目录</li>";
        }
    }

    echo "</ul>";
}

checkDirectory($roomsDir, "Rooms");
checkDirectory($uploadsDir, "Uploads");

echo "<h3>2. PHP配置检查</h3>";
echo "<ul>";
echo "<li>PHP版本: " . PHP_VERSION . "</li>";
echo "<li>错误报告: " . (error_reporting() ? '启用' : '禁用') . "</li>";
echo "<li>上传最大大小: " . ini_get('upload_max_filesize') . "</li>";
echo "<li>POST最大大小: " . ini_get('post_max_size') . "</li>";
echo "<li>内存限制: " . ini_get('memory_limit') . "</li>";
echo "<li>执行时间限制: " . ini_get('max_execution_time') . "秒</li>";
echo "</ul>";

echo "<h3>3. 文件写入测试</h3>";

// 测试写入
$testFile = $roomsDir . '/test_' . time() . '.json';
$testData = ['test' => 'data', 'timestamp' => time()];
$jsonData = json_encode($testData, JSON_UNESCAPED_UNICODE);

if (file_put_contents($testFile, $jsonData)) {
    echo "<p>✅ 文件写入测试成功</p>";

    // 测试读取
    $readData = file_get_contents($testFile);
    if ($readData === $jsonData) {
        echo "<p>✅ 文件读取测试成功</p>";
    } else {
        echo "<p>❌ 文件读取测试失败</p>";
    }

    // 清理测试文件
    unlink($testFile);
    echo "<p>✅ 测试文件已清理</p>";

} else {
    echo "<p>❌ 文件写入测试失败</p>";
    $error = error_get_last();
    if ($error) {
        echo "<p>错误信息: " . $error['message'] . "</p>";
    }
}

echo "<h3>4. JSON编码测试</h3>";
$testMessage = [
    'encrypted' => false,
    'data' => '测试消息 - Test Message'
];

$encoded = json_encode($testMessage, JSON_UNESCAPED_UNICODE);
if ($encoded !== false) {
    echo "<p>✅ JSON编码测试成功</p>";
    echo "<p>编码结果: $encoded</p>";
} else {
    echo "<p>❌ JSON编码测试失败</p>";
    echo "<p>错误: " . json_last_error_msg() . "</p>";
}

echo "<h3>5. 修复建议</h3>";
echo "<div style='background: #f0f0f0; padding: 10px; margin: 10px 0;'>";
echo "<h4>如果遇到权限问题，请执行以下命令：</h4>";
echo "<pre>";
echo "# 设置目录权限\n";
echo "chmod 755 $roomsDir\n";
echo "chmod 755 $uploadsDir\n\n";
echo "# 如果是Apache服务器\n";
echo "chown -R www-data:www-data $rootDir\n\n";
echo "# 如果是Nginx服务器\n";
echo "chown -R nginx:nginx $rootDir\n";
echo "</pre>";
echo "</div>";
?>

<style>
body { font-family: Arial, sans-serif; margin: 20px; }
h2, h3, h4 { color: #333; }
ul { margin: 10px 0; }
li { margin: 5px 0; }
pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
</style>