# 🔒 安全传输工具 - 专业版

> **简洁、安全、易用的端到端加密文件传输解决方案**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PHP](https://img.shields.io/badge/PHP-7.4+-blue)
![Modern UI](https://img.shields.io/badge/UI-Modern_Design-purple)

## ✨ 项目概述

**安全传输（Secure Transfer）** 是一个现代化的"临时房间"文本/文件传输工具，专注于提供安全、便捷的文件共享体验。

### 🚀 核心特性

- **🏠 房间系统**：基于 PIN 码的临时房间，支持多人协作
- **🔐 端到端加密**：可选的 E2EE 加密，保护数据安全
- **📁 文件传输**：支持小文件加密传输，大文件快速传输
- **💬 实时消息**：支持文本消息和语音消息
- **👥 在线状态**：实时显示房间内活跃用户
- **🎨 现代化UI**：响应式设计，支持深色/浅色主题
- **⚡ 自动清理**：1小时无活动自动清理，保护隐私

### 🛡️ 安全特性

- **端到端加密**：使用 AES-GCM 256位加密
- **密钥管理**：支持密钥消息一键导入和消费
- **隐私保护**：所有数据临时存储，定期自动清理
- **明文可选**：默认明文通信，可一键启用加密

## 📋 技术架构

### 前端技术栈
- **HTML5**：语义化结构，无障碍支持
- **CSS3**：现代化设计系统，CSS变量，响应式布局
- **Vanilla JavaScript**：原生ES6+，模块化架构
- **Web Crypto API**：浏览器原生加密实现

### 后端技术栈
- **PHP 7.4+**：轻量级后端服务
- **文件系统**：基于文件的数据存储
- **RESTful API**：标准化API接口设计

## 📁 项目结构

```
secure-transfer/
├── 前端文件
│   ├── index.html          # 主页面 - 现代化UI结构
│   ├── style.css           # 样式文件 - 1900+行现代化CSS
│   ├── app.js              # 核心逻辑 - 完整的应用功能
│   ├── crypto.js           # 加密模块 - Web Crypto封装
│   └── enhanced-ui.js      # UI增强 - 主题、动画、交互管理
├── 后端API
│   ├── config.php          # 基础配置和工具函数
│   ├── get-history.php     # 获取聊天历史
│   ├── send-message.php    # 发送消息
│   ├── upload.php          # 文件上传
│   ├── download.php        # 文件下载
│   ├── clear-room.php      # 清空房间
│   ├── client-ping.php     # 客户端心跳
│   ├── consume-message.php # 消费密钥消息
│   ├── set-encryption.php  # 加密设置
│   └── status-check.php    # 系统状态检查
├── 数据目录
│   ├── rooms/              # 房间数据存储
│   └── uploads/            # 上传文件存储
└── readme.md               # 项目文档
```

## 🚀 快速开始

### 环境要求

- **Web服务器**：Apache/Nginx 或 PHP内置服务器
- **PHP版本**：7.4 或更高版本
- **浏览器**：支持 Web Crypto API 的现代浏览器

### 安装部署

1. **下载项目**
   ```bash
   git clone https://github.com/Jieoz/secure-transfer.git
   cd secure-transfer
   ```

2. **启动服务器**
   ```bash
   # 使用PHP内置服务器（开发环境）
   php -S localhost:8080

   # 或者配置到Apache/Nginx（生产环境）
   ```

3. **访问应用**
   ```
   http://localhost:8080/index.html
   ```

### 首次使用

1. **创建房间**：输入6位PIN码或自定义房间号
2. **邀请协作者**：分享房间链接给其他用户
3. **开始传输**：发送消息或上传文件
4. **启用加密**：可选开启端到端加密保护

## 🎨 UI设计系统

### 设计原则
- **简洁优雅**：现代化扁平设计，减少视觉干扰
- **响应式**：完美适配桌面、平板、手机设备
- **无障碍**：支持键盘导航和屏幕阅读器
- **主题支持**：自动适配系统主题，支持手动切换

### 色彩系统
- **主色调**：科技蓝（#3b82f6）传达安全感
- **成功色**：翠绿色（#22c55e）表示安全状态
- **警告色**：琥珀色（#f59e0b）提示注意事项
- **错误色**：红色（#ef4444）表示错误状态

### 动画效果
- **微交互**：精心设计的悬停和点击反馈
- **流畅过渡**：使用现代缓动函数的平滑动画
- **性能优化**：硬件加速，避免布局抖动

## 🔧 核心功能详解

### 房间管理
- **PIN码系统**：6位数字快速加入
- **自定义房间**：支持字母数字组合
- **房间链接**：一键分享房间访问链接
- **自动清理**：1小时无活动自动清理数据

### 加密系统
- **可选加密**：默认明文，可一键启用E2EE
- **AES-GCM**：使用256位密钥的AES-GCM加密
- **密钥管理**：支持密钥分享和导入
- **文件加密**：小文件（≤32MB）自动加密

### 文件传输
- **多文件上传**：支持批量文件选择
- **拖拽上传**：直观的拖拽上传体验
- **进度显示**：实时显示上传进度
- **文件预览**：支持常见文件格式预览

### 实时通信
- **文本消息**：支持富文本和表情符号
- **语音消息**：录制和播放语音消息
- **在线状态**：实时显示活跃用户列表
- **消息历史**：持久化存储聊天记录

## 🔐 安全机制

### 加密实现
```javascript
// 使用Web Crypto API实现AES-GCM加密
const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"]
);
```

### 数据保护
- **临时存储**：所有数据仅临时存储
- **自动清理**：定期清理过期房间数据
- **无日志**：不记录用户行为日志
- **本地优先**：敏感操作在客户端完成

## 🌐 浏览器兼容性

| 浏览器 | 最低版本 | Web Crypto | 文件API | 响应式 |
|--------|----------|------------|---------|--------|
| Chrome | 63+ | ✅ | ✅ | ✅ |
| Firefox | 57+ | ✅ | ✅ | ✅ |
| Safari | 11+ | ✅ | ✅ | ✅ |
| Edge | 79+ | ✅ | ✅ | ✅ |

## 📱 移动端支持

- **响应式布局**：完美适配各种屏幕尺寸
- **触摸优化**：优化触摸目标大小和间距
- **手势支持**：支持拖拽上传等手势操作
- **PWA就绪**：可作为渐进式Web应用安装

## 🔧 开发指南

### 本地开发
```bash
# 启动开发服务器
php -S localhost:8080

# 访问主应用
http://localhost:8080/index.html

```

### 自定义配置
编辑 `api/config.php` 修改基础配置：
```php
// 修改文件大小限制
define('MAX_FILE_SIZE', 500 * 1024 * 1024); // 500MB

// 修改房间清理时间
define('ROOM_CLEANUP_TIME', 3600); // 1小时
```

### 主题定制
在 `style.css` 中修改CSS变量：
```css
:root {
  --primary-500: #your-color;
  --border-radius: 12px;
  /* 自定义其他设计变量 */
}
```


## 📄 API文档

### 消息API
```http
POST /api/send-message.php
Content-Type: application/json

{
  "room": "123456",
  "message": "Hello World",
  "type": "text",
  "encrypted": false
}
```

### 文件上传API
```http
POST /api/upload.php
Content-Type: multipart/form-data

room: 123456
file: [File Object]
encrypted: false
```

### 历史记录API
```http
GET /api/get-history.php?room=123456&after=1234567890
```

## 🤝 贡献指南

1. **Fork项目**并创建特性分支
2. **提交代码**遵循代码规范
3. **编写测试**确保功能正常
4. **提交PR**并描述修改内容

### 代码规范
- **HTML**：语义化标签，无障碍属性
- **CSS**：BEM命名规范，CSS变量
- **JavaScript**：ES6+语法，JSDoc注释
- **PHP**：PSR-4标准，安全编码

## 📜 开源协议

本项目采用 [MIT协议](LICENSE) 开源。

## 🙏 致谢

感谢所有为这个项目贡献代码、建议和反馈的开发者！

---

<div align="center">

**🔒 安全传输工具 - 让文件传输更安全、更简单**

[🌟 给个Star](https://github.com/Jieoz/secure-transfer) • [🐛 报告问题](https://github.com/Jieoz/secure-transfer/issues) • [💡 功能建议](https://github.com/Jieoz/secure-transfer/discussions)

</div>
