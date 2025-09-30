// 应用程序逻辑

class SecureTransferApp {

    constructor() {

        this.currentRoom = null;

        this.pollInterval = null;

        this.lastMessageId = 0;

        this.lastClearId = null;  // 清空检查ID缓存

        this.isUploading = false;

        this.currentUpload = null;  // 存储当前上传的XMLHttpRequest

        this.apiBasePath = '/api/'; // 默认API路径，将在init中更新

        this.voiceSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

        this.voiceRecorder = null;

        this.voiceStream = null;

        this.voiceChunks = [];

        this.currentEncryption = { enabled: false, key: null };

        this.voiceRecordingStart = null;

        this.voiceRecordingTimer = null;

        this.voiceSendOnStop = false;

        this.voiceCache = new Map();

        this.voiceElements = {};

        this.clientJoinBaseline = 0;

        this.clientHeartbeatTimer = null;

        this.clientsRefreshTimer = null;



        this.init();

    }



    // 动态检测API基础路径 - 增强版本

    async detectApiPath() {

        const path = window.location.pathname;

        console.log('检测API路径 - 当前路径:', path);



        const possiblePaths = [];



        // 如果当前路径包含子目录（如 /ts/），添加子目录API路径

        if (path !== '/' && path !== '/index.html') {

            const pathParts = path.split('/').filter(part => part);

            console.log('路径部分:', pathParts);

            if (pathParts.length > 0) {

                const baseDir = pathParts[0];

                possiblePaths.push(`/${baseDir}/api/`);

            }

        }



        // 添加默认路径

        possiblePaths.push('/api/');



        // 测试每个可能的路径

        for (const testPath of possiblePaths) {

            console.log('测试API路径:', testPath);

            try {

                const response = await fetch(testPath + 'server-info.php', { method: 'HEAD' });

                if (response.ok || response.status === 405) { // 405 = Method Not Allowed，说明文件存在

                    console.log('找到有效的API路径:', testPath);

                    return testPath;

                }

            } catch (e) {

                console.log('路径测试失败:', testPath, e.message);

            }

        }



        // 如果所有测试都失败，使用默认路径

        console.log('使用默认API路径: /api/');

        return '/api/';

    }



    // 初始化API路径

    async initApiPath() {

        this.apiBasePath = await this.detectApiPath();

        console.log('最终API路径:', this.apiBasePath);

    }



    // 构建API URL

    getApiUrl(endpoint) {

        return this.apiBasePath + endpoint;

    }



    async init() {

        // 首先初始化API路径

        if (this.initApiPathV2) {

            await this.initApiPathV2();

        } else {

            await this.initApiPath();

        }



        // 初始化房间和密钥

        const roomInfo = await window.encryption.initializeRoom();

        this.currentRoom = roomInfo.roomId;

        await this.initializeClientSession();

        // 更新UI

        this.updateRoomInfo();

        this.updateEncryptionStatus();

        this.initializeTheme();

        this.bindEvents();



        // 加载初始历史记录

        await this.loadHistory();



        // 开始轮询消息

        this.startPolling();



        // 检查服务器配置（静默默认）

        this.checkServerConfig();

        // 如房间存在但未携带密钥，提示导入密钥

        try {

            this.startClientHeartbeat();

            this.refreshClientsPeriodically();

            this.loadClients();

        } catch (_) {}

    }



    // 检查服务器配置

    async checkServerConfig() {

        try {

            const response = await fetch(this.getApiUrl('server-info.php'));

            if (!response.ok) {

                console.warn('服务器信息接口不可用');

                return;

            }

            const config = await response.json();



            if (config.status === 'NEEDS_CONFIGURATION') {

                console.warn('服务器配置需要调整:', config.recommendations);

                // 只在需要配置时显示提示

                if (config.recommendations.length > 0) {

                    const msg = '检测到服务器配置问题，可能影响文件上传。请查看控制台或联系管理员。';

                    this.showNotification(msg, 'warning');

                }

            }

        } catch (error) {

            console.warn('无法获取服务器配置:', error);

        }

    }



    // 更新房间信息显示

    updateRoomInfo() {

        const roomInput = document.getElementById('roomIdInput');

        if (roomInput && this.currentRoom) {

            roomInput.value = this.currentRoom;

            roomInput.placeholder = '当前房间: ' + this.currentRoom;

        }

    }



    // 加入/创建房间

    async joinOrCreateRoom() {

        const inputValue = document.getElementById('roomIdInput').value.trim();



        if (!inputValue) {

            // 输入为空，创建新房间

            return this.createNewRoom();

        }



        try {

            let roomId;



            // 检查是否为完整链接

            if (inputValue.includes('room=')) {

                const url = new URL(inputValue.startsWith('http') ? inputValue : window.location.origin + '/' + inputValue);

                // URL 跳转：如果输入的是包含 room 的链接，直接跳转过去

                window.location.href = url.toString();

                return;

                roomId = url.searchParams.get('room');

                // 解析链接片段中的 key（#key=...），并导入到本地

                try {

                    const hashParams = new URLSearchParams((url.hash || '').replace(/^#/, ''));

                    const keyFromLink = hashParams.get('key');

                    if (keyFromLink) {

                        const keyB64 = decodeURIComponent(keyFromLink);

                        await window.encryption.importRoomKey(keyB64, { roomId: this.currentRoom });

                    }

                } catch (_) { /* ignore */ }

            } else {

                // 直接作为房间代码

                roomId = inputValue;

            }



            if (!roomId) {

                this.showNotification('无效的房间号或链接', 'error');

                return;

            }



            // 验证房间格式：PIN码

            if (!/^\d{6}$/.test(roomId) &&                      // 6位数字PIN

                !/^[a-zA-Z0-9]{3,12}$/.test(roomId) &&          // 简化的自定义房间号

                !/^[a-zA-Z]+-[a-f0-9]{6}$/.test(roomId) &&      // 旧版本格式

                !/^[a-f0-9]{16}$/.test(roomId)) {               // 最旧版本格式

                this.showNotification('房间格式无效，支持6位数字或3-12位字母数字', 'error');

                return;

            }



            // 停止当前轮询

            this.stopPolling();



            // 切换到新房间

            this.currentRoom = roomId;

            this.lastMessageId = 0;

            this.lastClearId = null;

            if (this.voiceCache) {

                this.voiceCache.clear();

            }



            // 重新初始化加密

            await window.encryption.initializeRoom(roomId);

            await this.initializeClientSession();

            // 更新URL和UI

            this.updateURL();

            this.updateRoomInfo();

            this.updateEncryptionStatus();

    

            // 清空历史记录显示

            this.clearHistoryDisplay();



            // 重新开始轮询和加载历史

            await this.loadHistory();

            this.startPolling();



            this.showNotification(`已加入房间 ${roomId}`, 'success');



        } catch (error) {

            console.error('加入房间失败:', error);

            this.showNotification('加入房间失败: ' + error.message, 'error');

        }

    }



    // 创建新房间

    async createNewRoom() {

        try {

            // 停止当前轮询

            this.stopPolling();



            // 生成6位PIN码

            const roomId = Math.floor(100000 + Math.random() * 900000).toString();



            this.currentRoom = roomId;

            this.lastMessageId = 0;

            this.lastClearId = null;

            if (this.voiceCache) {

                this.voiceCache.clear();

            }



            // 重新初始化加密

            await window.encryption.initializeRoom(roomId);

            await this.initializeClientSession();

            // 更新URL和UI

            this.updateURL();

            this.updateRoomInfo();

            this.updateEncryptionStatus();



            // 清空历史记录显示

            this.clearHistoryDisplay();



            // 重新开始轮询和加载历史

            await this.loadHistory();

            this.startPolling();



            this.showNotification(`已创建新房间 ${roomId}`, 'success');



        } catch (error) {

            console.error('创建房间失败:', error);

            this.showNotification('创建房间失败: ' + error.message, 'error');

        }

    }



    // 更新URL

    updateURL() {

        if (!this.currentRoom) {

            return;

        }

        const newUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(this.currentRoom)}`;

        window.history.replaceState({}, '', newUrl);

    }



    // 复制房间链接

    copyRoomLink() {

        if (!this.currentRoom) {

            this.showNotification('请先创建或加入房间', 'error');

            return;

        }



        const link = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(this.currentRoom)}`;

        this.copyTextToClipboard(link);

    }



    fallbackCopyText(text) {

        const textArea = document.createElement('textarea');

        textArea.value = text;

        textArea.style.position = 'fixed';

        textArea.style.left = '-999999px';

        textArea.style.top = '-999999px';

        document.body.appendChild(textArea);

        textArea.focus();

        textArea.select();



        try {

            document.execCommand('copy');

            this.showNotification('房间链接已复制到剪贴板', 'success');

        } catch (err) {

            console.error('降级复制也失败:', err);

            this.showNotification('复制失败，请手动复制链接', 'error');

        }



        document.body.removeChild(textArea);

    }



    // 更新加密状态显示

    updateEncryptionStatus() {

        const encryptionIcon = document.getElementById('encryptionIcon');

        const encryptionText = document.getElementById('encryptionText');



        if (!encryptionIcon || !encryptionText) {

            return;

        }



        const iconMarkup = '<path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>';

        const parent = encryptionIcon.parentElement;

        const encryption = window.encryption;



        if (!encryption || !encryption.isSupported) {

            encryptionIcon.innerHTML = iconMarkup;

            encryptionText.textContent = '端到端加密不可用';

            if (parent) parent.style.color = '#F44336';

            return;

        }



        if (encryption.roomKey) {

            encryptionIcon.innerHTML = iconMarkup;

            encryptionText.textContent = '端到端加密已启用';

            if (parent) parent.style.color = '#4CAF50';

        } else {

            encryptionIcon.innerHTML = iconMarkup;

            encryptionText.textContent = '未加密模式（降级）';

            if (parent) parent.style.color = '#FF9800';

        }

    }



    // 主题初始化

    initializeTheme() {

        const savedTheme = localStorage.getItem('theme') || 'auto';

        this.applyTheme(savedTheme);

    }



    // 应用主题

    applyTheme(theme) {

        const html = document.documentElement;

        const themeToggle = document.getElementById('themeToggle');

        const lightIcon = themeToggle.querySelector('.theme-light');

        const darkIcon = themeToggle.querySelector('.theme-dark');



        let actualTheme = theme;



        if (theme === 'auto') {

            // 跟随系统主题

            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

        }



        if (actualTheme === 'dark') {

            html.setAttribute('data-theme', 'dark');

            lightIcon.style.display = 'none';

            darkIcon.style.display = 'block';

        } else {

            html.setAttribute('data-theme', 'light');

            lightIcon.style.display = 'block';

            darkIcon.style.display = 'none';

        }



        localStorage.setItem('theme', theme);

    }



    // 切换主题

    toggleTheme() {

        const currentTheme = localStorage.getItem('theme') || 'auto';

        let nextTheme;



        switch (currentTheme) {

            case 'light': nextTheme = 'dark'; break;

            case 'dark': nextTheme = 'auto'; break;

            default: nextTheme = 'light'; break;

        }



        this.applyTheme(nextTheme);

    }



    // 绑定事件

    bindEvents() {

        // 发送消息

        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());

        document.getElementById('messageInput').addEventListener('keypress', (e) => {

            if (e.key === 'Enter' && !e.shiftKey) {

                e.preventDefault();

                this.sendMessage();

            }

        });



        // 粘贴按钮

        document.getElementById('pasteBtn').addEventListener('click', () => this.pasteFromClipboard());



        // 文件上传

        document.getElementById('uploadArea').addEventListener('click', () => {

            if (!this.isUploading) {

                document.getElementById('fileInput').click();

            }

        });



        document.getElementById('uploadArea').addEventListener('dragover', (e) => {

            e.preventDefault();

            e.stopPropagation();

            e.currentTarget.classList.add('dragover');

        });



        document.getElementById('uploadArea').addEventListener('dragleave', (e) => {

            e.preventDefault();

            e.stopPropagation();

            e.currentTarget.classList.remove('dragover');

        });



        document.getElementById('uploadArea').addEventListener('drop', (e) => {

            e.preventDefault();

            e.stopPropagation();

            e.currentTarget.classList.remove('dragover');



            if (!this.isUploading && e.dataTransfer.files.length > 0) {

                this.handleFileSelect({ target: { files: e.dataTransfer.files } });

            }

        });



        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));

        document.getElementById('cancelUploadBtn').addEventListener('click', () => this.cancelUpload());



        // 房间操作

        document.getElementById('joinRoomBtn').addEventListener('click', () => this.joinOrCreateRoom());

        document.getElementById('copyRoomBtn').addEventListener('click', () => this.copyRoomLink());

        document.getElementById('newRoomBtn').addEventListener('click', () => this.createNewRoom());



        // 其他操作

        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        document.getElementById('clearRoomBtn').addEventListener('click', () => this.clearRoom());

        document.getElementById('refreshBtn').addEventListener('click', () => this.loadHistory(true));



        // 关闭提示横幅

        const dismissBtn = document.getElementById('dismissBanner');

        if (dismissBtn) {

            dismissBtn.addEventListener('click', () => {

                document.querySelector('.info-banner').style.display = 'none';

                localStorage.setItem('bannerDismissed', 'true');

            });

        }



        // 检查是否已关闭横幅

        if (localStorage.getItem('bannerDismissed') === 'true') {

            const banner = document.querySelector('.info-banner');

            if (banner) banner.style.display = 'none';

        }



        // 模态框

        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());

        document.getElementById('modal').addEventListener('click', (e) => {

            if (e.target.id === 'modal') {

                this.closeModal();

            }

        });



        // 房间输入框回车

        document.getElementById('roomIdInput').addEventListener('keypress', (e) => {

            if (e.key === 'Enter') {

                this.joinOrCreateRoom();

            }

        });



        this.initializeVoiceControls();



        // 系统主题变化监听

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {

            const currentTheme = localStorage.getItem('theme') || 'auto';

            if (currentTheme === 'auto') {

                this.applyTheme('auto');

            }

        });

    }



    // 从剪贴板粘贴

    async pasteFromClipboard() {

        try {

            const text = await navigator.clipboard.readText();

            const messageInput = document.getElementById('messageInput');

            const start = messageInput.selectionStart;

            const end = messageInput.selectionEnd;

            const currentValue = messageInput.value;



            messageInput.value = currentValue.substring(0, start) + text + currentValue.substring(end);

            messageInput.selectionStart = messageInput.selectionEnd = start + text.length;

            messageInput.focus();



        } catch (error) {

            console.warn('剪贴板访问失败:', error);

            this.showNotification('剪贴板访问失败，请手动粘贴', 'warning');

        }

    }



    // 发送消息

    async sendMessage() {

        const messageInput = document.getElementById('messageInput');

        const message = messageInput.value.trim();



        if (!message) {

            return;

        }



        if (!this.currentRoom) {

            this.showNotification('请先创建或加入房间', 'error');

            return;

        }



        try {

            // 加密消息

            const encryptedMessage = await window.encryption.encryptMessage(message);



            const response = await fetch(this.getApiUrl('send-message.php'), {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                },

                body: JSON.stringify({

                    room: this.currentRoom,

                    message: encryptedMessage

                })

            });



            const result = await response.json();



            if (result.success) {

                messageInput.value = '';

                messageInput.focus();

                // 立即刷新历史记录

                this.loadHistory();

            } else {

                this.showNotification('发送失败: ' + result.error, 'error');

            }

        } catch (error) {

            console.error('发送消息失败:', error);

            this.showNotification('发送失败: ' + error.message, 'error');

        }

    }



    // 文件选择处理

    async handleFileSelect(event) {

        const files = event.target.files;



        if (!files || files.length === 0) {

            return;

        }



        if (!this.currentRoom) {

            this.showNotification('请先创建或加入房间', 'error');

            return;

        }



        if (this.isUploading) {

            this.showNotification('请等待当前上传完成', 'warning');

            return;

        }



        const file = files[0];

        const maxSize = 500 * 1024 * 1024; // 500MB



        if (file.size > maxSize) {

            this.showNotification('文件大小不能超过 500MB', 'error');

            return;

        }



        try {

            await this.uploadFile(file);

        } catch (error) {

            console.error('文件上传失败:', error);

            this.showNotification('上传失败: ' + error.message, 'error');

        }

    }



    // 上传文件

    async uploadFile(file, options = {}) {

        this.isUploading = true;

        this.showUploadProgress(0);



        try {

            const formData = new FormData();

            const voiceOptions = options || {};

            const isVoice = voiceOptions.isVoice === true;



            let encryptedFile = file;

            let originalName = file.name;

            let originalType = file.type;

            let originalSize = file.size;



            if (isVoice) {

                formData.append('isVoice', 'true');

                formData.append('voiceDuration', String(voiceOptions.duration || 0));

                formData.append('voiceMime', voiceOptions.mime || file.type || 'audio/webm');

            }



            if (file.size <= window.encryption.maxEncryptSize && window.encryption.isSupported && window.encryption.roomKey) {

                try {

                    encryptedFile = await window.encryption.encryptFile(file);

                    formData.append('encrypted', 'true');

                    formData.append('originalName', originalName);

                    formData.append('originalType', originalType);

                    formData.append('originalSize', originalSize.toString());

                } catch (encError) {

                    console.warn('文件加密失败，使用非加密方式:', encError);

                    formData.append('encrypted', 'false');

                }

            } else {

                formData.append('encrypted', 'false');

            }



            if (encryptedFile && typeof encryptedFile === 'object' && 'encrypted' in encryptedFile) {

                if (encryptedFile.encrypted) {

                    encryptedFile = encryptedFile.data || file;

                } else {

                    try { formData.set('encrypted', 'false'); } catch (_) { /* ignore */ }

                    encryptedFile = encryptedFile.data || file;

                }

            }



            formData.append('file', encryptedFile);

            formData.append('room', this.currentRoom);



            const xhr = new XMLHttpRequest();

            this.currentUpload = xhr;



            return new Promise((resolve, reject) => {

                xhr.upload.addEventListener('progress', (e) => {

                    if (e.lengthComputable) {

                        const percentComplete = (e.loaded / e.total) * 100;

                        this.showUploadProgress(percentComplete);

                    }

                });



                xhr.addEventListener('load', () => {

                    this.isUploading = false;

                    this.hideUploadProgress();

                    this.currentUpload = null;



                    try {

                        const result = JSON.parse(xhr.responseText);

                        if (result.success) {

                            if (isVoice) {

                                this.showNotification('语音消息已发送', 'success');

                            } else {

                                this.showNotification('文件上传成功', 'success');

                            }

                            this.loadHistory();

                            resolve(result);

                        } else {

                            reject(new Error(result.error || '上传失败'));

                        }

                    } catch (parseError) {

                        reject(new Error('服务器响应格式错误'));

                    }

                });



                xhr.addEventListener('error', () => {

                    this.isUploading = false;

                    this.hideUploadProgress();

                    this.currentUpload = null;

                    reject(new Error('网络错误'));

                });



                xhr.addEventListener('abort', () => {

                    this.isUploading = false;

                    this.hideUploadProgress();

                    this.currentUpload = null;

                    reject(new Error('上传已取消'));

                });



                xhr.open('POST', this.getApiUrl('upload.php'));

                xhr.send(formData);

            });



        } catch (error) {

            this.isUploading = false;

            this.hideUploadProgress();

            this.currentUpload = null;

            throw error;

        }

    }





    // 取消上传

    cancelUpload() {

        if (this.currentUpload) {

            this.currentUpload.abort();

            this.currentUpload = null;

        }

        this.isUploading = false;

        this.hideUploadProgress();

        this.showNotification('上传已取消', 'info');

    }



    // 显示上传进度

    showUploadProgress(percent) {

        const uploadArea = document.getElementById('uploadArea');

        const uploadProgress = document.getElementById('uploadProgress');

        const progressFill = document.getElementById('progressFill');

        const progressText = document.getElementById('progressText');



        uploadArea.style.display = 'none';

        uploadProgress.style.display = 'block';



        progressFill.style.width = percent + '%';

        progressText.textContent = Math.round(percent) + '%';

    }



    // 隐藏上传进度

    hideUploadProgress() {

        const uploadArea = document.getElementById('uploadArea');

        const uploadProgress = document.getElementById('uploadProgress');



        uploadArea.style.display = 'block';

        uploadProgress.style.display = 'none';

    }



    // 开始轮询

    startPolling() {

        this.stopPolling(); // 确保没有重复的定时器



        this.pollInterval = setInterval(() => {

            this.loadHistory();

        }, 2000); // 每2秒检查一次

    }



    // 停止轮询

    stopPolling() {

        if (this.pollInterval) {

            clearInterval(this.pollInterval);

            this.pollInterval = null;

        }

    }



    // 加载历史记录

    async loadHistory(force = false) {

        if (!this.currentRoom) {

            return;

        }



        const baseline = typeof this.clientJoinBaseline === 'number' ? this.clientJoinBaseline : 0;
        const knownLast = typeof this.lastMessageId === 'number' ? this.lastMessageId : 0;
        const effectiveAfter = Math.max(knownLast, baseline);

        if (knownLast < effectiveAfter || typeof this.lastMessageId !== 'number') {

            this.lastMessageId = effectiveAfter;

        }

        try {

            const params = new URLSearchParams({

                room: this.currentRoom,

                after: String(effectiveAfter),

                clear_check: '1'

            });

            if (this.clientId) {

                params.set('client_id', this.clientId);

            }

            const response = await fetch(`${this.getApiUrl('get-history.php')}?${params.toString()}`);



            if (!response.ok) {

                throw new Error(`HTTP ${response.status}`);

            }



            const result = await response.json();



            if (result.success) {

                if (result.data && typeof result.data.baseline_id === 'number') {

                    this.updateClientBaseline(result.data.baseline_id, { persist: false, clientId: this.clientId });

                }

                if (result.data && Object.prototype.hasOwnProperty.call(result.data, 'encryption')) {

                    await this.syncEncryptionState(result.data.encryption);

                } else {

                    await this.syncEncryptionState(null);

                }



                const history = (result.data && result.data.history) || [];



                // 检查是否有新消息或强制刷新

                if (history.length > 0 || force) {

                    this.displayHistory(history);



                    // 更新最后消息ID

                    if (history.length > 0) {

                        this.lastMessageId = Math.max(...history.map(item => item.id));

                    }

                }



                // 更新统计信息

                this.updateStats(result.data);



            } else {

                console.error('加载历史记录失败:', result.error);

            }

        } catch (error) {

            console.error('Load history error:', error);

        }

    }



    // 显示历史记录

    async displayHistory(history) {

        const historyList = document.getElementById('historyList');



        // 如果是首次加载，清空现有内容

        if (this.lastMessageId === 0) {

            historyList.innerHTML = '';

        }



        for (const item of history) {

            const existingItem = document.querySelector(`[data-id="${item.id}"]`);

            if (existingItem) {

                continue; // 跳过已存在的项目

            }



            const historyItem = document.createElement('div');

            historyItem.className = 'history-item';

            historyItem.setAttribute('data-id', item.id);



            if (item.type === 'message') {

                await this.renderMessage(historyItem, item);

            } else if (item.type === 'file' || item.type === 'voice') {

                await this.renderFile(historyItem, item);

            }



            historyList.appendChild(historyItem);

        }



        // 滚动到底部

        this.scrollToBottom();

    }



    // 渲染消息

    async renderMessage(container, item) {

        try {

            const decryptedContent = await window.encryption.decryptMessage(item.content);

            const isEncrypted = item.content.encrypted === true;



            container.innerHTML = `

                <div class="history-header">

                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor">

                        <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z"/>

                    </svg>

                    <span class="history-type">消息</span>

                    <span class="history-time">${this.formatTime(item.timestamp)}</span>

                    ${isEncrypted ? '<span class="encrypted-badge">🔒</span>' : '<span class="plain-badge">📝</span>'}

                </div>

                <div class="history-content message-content">

                    ${this.escapeHtml(decryptedContent).replace(/\r?\n/g, '<br>')}

                </div>

            `;

        } catch (error) {

            console.error('消息渲染失败:', error, item);

            container.innerHTML = `

                <div class="history-header">

                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor">

                        <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z"/>

                    </svg>

                    <span class="history-type">消息</span>

                    <span class="history-time">${this.formatTime(item.timestamp)}</span>

                    <span class="error-badge">❌</span>

                </div>

                <div class="history-content message-content">

                    <em>消息解密失败</em>

                </div>

            `;

        }

    }



    // 渲染文件

    async renderFile(container, item) {

        const fileInfo = JSON.parse(item.content);



        if (fileInfo && fileInfo.voice) {

            const durationLabel = this.formatVoiceDuration(fileInfo.duration || 0);

            container.innerHTML = `

                <div class="history-header">

                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor">

                        <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 8a1 1 0 0 0-1 1v1a7 7 0 0 0 6 6.92V22h2v-2.08A7 7 0 0 0 20 13v-1a1 1 0 0 0-1-1h-1v2a6 6 0 1 1-12 0v-2Z"/>

                    </svg>

                    <span class="history-type">消息</span>

                    <span class="history-time">${this.formatTime(item.timestamp)}</span>

                    ${fileInfo.encrypted ? '<span class=\"encrypted-badge\">??</span>' : ''}

                </div>

                <div class="history-content voice-content">

                    <div class="voice-meta">

                        <span class="voice-duration">${durationLabel}</span>

                        <span class="voice-name">${this.escapeHtml(fileInfo.name || '语音消息')}</span>

                    </div>

                    <div class="voice-controls">

                        <button type="button" class="voice-play-btn btn-secondary" data-filename="${this.escapeHtml(fileInfo.filename)}" data-name="${this.escapeHtml(fileInfo.name || 'voice.webm')}" data-encrypted="${fileInfo.encrypted ? 'true' : 'false'}" data-mime="${this.escapeHtml(fileInfo.mime || fileInfo.type || 'audio/webm')}">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                            </svg>
                            播放
                        </button>

                        <audio class="voice-audio" style="display:none" controls></audio>

                    </div>

                </div>

            `;



            const playBtn = container.querySelector('.voice-play-btn');

            const audioEl = container.querySelector('.voice-audio');

            if (playBtn && audioEl) {

                playBtn.addEventListener('click', () => this.playVoiceMessage(playBtn, audioEl, fileInfo));

            }

            return;

        }



        container.innerHTML = `

            <div class="history-header">

                <svg class="icon" viewBox="0 0 24 24" fill="currentColor">

                    <path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/>

                </svg>

                <span class="history-type">文件</span>

                <span class="history-time">${this.formatTime(item.timestamp)}</span>

                ${fileInfo.encrypted ? '<span class=\"encrypted-badge\">??</span>' : ''}

            </div>

            <div class="history-content file-content">

                <div class="file-info">

                    <div class="file-name">${this.escapeHtml(fileInfo.name)}</div>

                    <div class="file-details">

                        <span class="file-size">${this.formatFileSize(fileInfo.size)}</span>

                        <span class="file-type">${this.escapeHtml(fileInfo.type || '未知类型')}</span>

                    </div>

                </div>

                <button class="download-btn">

                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor">

                        <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>

                    </svg>

                    下载

                </button>

            </div>

        `;



        const downloadBtn = container.querySelector('.download-btn');

        if (downloadBtn) {

            downloadBtn.addEventListener('click', () => this.downloadFile(

                fileInfo.filename,

                fileInfo.name,

                !!fileInfo.encrypted

            ));

        }

    }



    async downloadFile(filename, originalName, isEncrypted) {

        try {

            const url = this.getApiUrl('download.php') + `?room=${encodeURIComponent(this.currentRoom)}&file=${encodeURIComponent(filename)}`;



            if (isEncrypted && window.encryption.isSupported && window.encryption.roomKey) {

                // 加密文件需要解密

                const response = await fetch(url);

                if (!response.ok) {

                    throw new Error('下载失败');

                }



                const encryptedBuffer = await response.arrayBuffer();

                const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

                const decryptedBlob = await window.encryption.decryptFile(encryptedBlob, originalName);

                if (!decryptedBlob) { throw new Error('解密失败'); }

                const downloadUrl = URL.createObjectURL(decryptedBlob);



                const a = document.createElement('a');

                a.href = downloadUrl;

                a.download = originalName || 'download';

                document.body.appendChild(a);

                a.click();

                document.body.removeChild(a);



                URL.revokeObjectURL(downloadUrl);

            } else {

                // 非加密文件直接下载

                const a = document.createElement('a');

                a.href = url;

                a.download = originalName;

                document.body.appendChild(a);

                a.click();

                document.body.removeChild(a);

            }



            this.showNotification('下载开始', 'success');

        } catch (error) {

            console.error('下载失败:', error);

            this.showNotification('下载失败: ' + error.message, 'error');

        }

    }



    // 清空房间

    async clearRoom() {

        if (!this.currentRoom) {

            this.showNotification('请先创建或加入房间', 'error');

            return;

        }



        if (!confirm('确定要清空当前房间的所有消息和文件吗？此操作不可撤销。')) {

            return;

        }



        try {

            const response = await fetch(this.getApiUrl('clear-room.php'), {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                },

                body: JSON.stringify({

                    room: this.currentRoom

                })

            });



            const result = await response.json();



            if (result.success) {

                this.clearHistoryDisplay();

                this.lastMessageId = 0;

                this.updateStats({ messageCount: 0, fileCount: 0, totalSize: 0 });

                if (this.voiceCache) {

                    this.voiceCache.clear();

                }

                this.showNotification('房间已清空', 'success');

            } else {

                this.showNotification('清空失败: ' + result.error, 'error');

            }

        } catch (error) {

            console.error('清空房间失败:', error);

            this.showNotification('清空失败: ' + error.message, 'error');

        }

    }



    // 清空历史记录显示

    clearHistoryDisplay() {

        const historyList = document.getElementById('historyList');

        historyList.innerHTML = '<div class="empty-state">暂无消息</div>';

    }



    // 更新统计信息

    updateStats(data) {

        if (!data) return;



        const messageCount = data.messageCount || 0;

        const fileCount = data.fileCount || 0;

        const totalSize = data.totalSize || 0;



        document.getElementById('messageCount').textContent = messageCount;

        document.getElementById('fileCount').textContent = fileCount;

        document.getElementById('totalSize').textContent = this.formatFileSize(totalSize);

    }



    // 滚动到底部

    scrollToBottom() {

        const historyList = document.getElementById('historyList');

        historyList.scrollTop = historyList.scrollHeight;

    }



    // 格式化时间

    formatTime(timestamp) {

        const date = new Date(timestamp * 1000);

        const now = new Date();



        if (date.toDateString() === now.toDateString()) {

            // 今天，只显示时间

            return date.toLocaleTimeString('zh-CN', {

                hour: '2-digit',

                minute: '2-digit'

            });

        } else {

            // 其他日期，显示月日和时间

            return date.toLocaleString('zh-CN', {

                month: '2-digit',

                day: '2-digit',

                hour: '2-digit',

                minute: '2-digit'

            });

        }

    }



    // 格式化文件大小

    formatFileSize(bytes) {

        if (bytes === 0) return '0 B';

        const k = 1024;

        const sizes = ['B', 'KB', 'MB', 'GB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];

    }



    // HTML转义

    escapeHtml(text) {

        const div = document.createElement('div');

        div.textContent = text;

        return div.innerHTML;

    }



    // 显示通知

    showNotification(message, type = 'info') {

        // 创建通知元素

        const notification = document.createElement('div');

        notification.className = `notification notification-${type}`;

        notification.innerHTML = `

            <span class="notification-message">${this.escapeHtml(message)}</span>

            <button class="notification-close">×</button>

        `;



        // 添加到页面

        document.body.appendChild(notification);



        // 绑定关闭事件

        const closeBtn = notification.querySelector('.notification-close');

        closeBtn.addEventListener('click', () => {

            notification.remove();

        });



        // 自动关闭

        setTimeout(() => {

            if (notification.parentNode) {

                notification.remove();

            }

        }, 5000);



        // 添加显示动画

        setTimeout(() => {

            notification.classList.add('show');

        }, 10);

    }



    // 显示模态框

    showModal(title, content) {

        document.getElementById('modalTitle').textContent = title;

        document.getElementById('modalBody').innerHTML = content;

        document.getElementById('modal').style.display = 'flex';

    }



    // 关闭模态框

    closeModal() {

        document.getElementById('modal').style.display = 'none';

    }

}



// 初始化应用

// ---- Enhanced API path detection helpers ----

SecureTransferApp.prototype.normalizeBasePath = function(p) {

    if (!p) return '/api/';

    try {

        if (/^https?:\/\//i.test(p)) {

            const u = new URL(p);

            p = u.pathname || '/api/';

        }

    } catch (_) { /* ignore */ }

    if (!p.startsWith('/')) p = '/' + p;

    if (!p.endsWith('/')) p += '/';

    return p;

};



SecureTransferApp.prototype.detectApiPathV2 = async function() {

    const path = window.location.pathname;

    console.log('检测API路径 - 当前路径:', path);



    // 允许通过查询参数覆盖（?api=/ts/api/ 或 ?apiBase=/ts/api/）

    try {

        const url = new URL(window.location.href);

        const override = url.searchParams.get('api') || url.searchParams.get('apiBase');

        if (override) {

            const normalized = this.normalizeBasePath(override);

            console.log('使用参数覆盖的API路径:', normalized);

            return normalized;

        }

    } catch (_) { /* ignore */ }



    // 候选路径集合

    const candidates = new Set();

    const parts = path.split('/').filter(Boolean);

    console.log('路径部分:', parts);

    if (parts.length > 0) {

        candidates.add(this.normalizeBasePath(`/${parts[0]}/api/`));

    }

    try {

        const relativeApi = new URL('api/', window.location.href);

        candidates.add(this.normalizeBasePath(relativeApi.pathname));

    } catch (_) { /* ignore */ }

    candidates.add('/api/');



    // 逐个验证：GET status-check -> GET server-info -> HEAD server-info

    for (const testPath of candidates) {

        console.log('测试API路径:', testPath);

        try {

            let resp = await fetch(testPath + 'status-check.php', { method: 'GET', cache: 'no-store' });

            if (resp.ok) {

                console.log('找到有效的API路径:', testPath);

                return testPath;

            }

            resp = await fetch(testPath + 'server-info.php', { method: 'GET', cache: 'no-store' });

            if (resp.ok) {

                console.log('找到有效的API路径:', testPath);

                return testPath;

            }

            resp = await fetch(testPath + 'server-info.php', { method: 'HEAD', cache: 'no-store' });

            if (resp.ok || resp.status === 405) {

                console.log('找到有效的API路径:', testPath);

                return testPath;

            }

        } catch (e) {

            console.warn('路径校验失败:', testPath, e.message);

        }

    }



    // 全部失败：按目录结构回退

    if (parts.length > 0) {

        const fallback = this.normalizeBasePath(`/${parts[0]}/api/`);

        console.log('使用目录回退API路径:', fallback);

        return fallback;

    }

    console.log('使用默认API路径: /api/');

    return '/api/';

};



SecureTransferApp.prototype.initApiPathV2 = async function() {

    this.apiBasePath = await this.detectApiPathV2();

    console.log('最终API路径:', this.apiBasePath);

};



SecureTransferApp.prototype.initializeVoiceControls = function() {
    const recordBtn = document.getElementById('voiceRecordBtn');
    const cancelBtn = document.getElementById('cancelVoiceBtn');
    const indicator = document.getElementById('voiceIndicator');
    const timer = document.getElementById('voiceTimer');

    this.voiceElements = {
        recordBtn: recordBtn || null,
        cancelBtn: cancelBtn || null,
        indicator: indicator || null,
        timer: timer || null,
        initialLabel: recordBtn ? recordBtn.textContent.trim() : ''
    };

    if (!recordBtn || !indicator || !timer) {
        return;
    }

    if (recordBtn.dataset.voiceReady === 'true') {
        this.voiceElements.initialLabel = recordBtn.textContent.trim();
        this.voiceElements.recordBtn = recordBtn;
        this.voiceElements.cancelBtn = cancelBtn || null;
        this.voiceElements.indicator = indicator;
        this.voiceElements.timer = timer;
        return;
    }

    indicator.style.display = 'none';
    timer.textContent = '00:00';

    recordBtn.disabled = false;
    recordBtn.classList.remove('recording');

    if (!this.voiceSupported) {
        recordBtn.disabled = true;
        recordBtn.title = 'Voice recording is not supported in this browser';
        recordBtn.dataset.voiceReady = 'true';
        return;
    }

    recordBtn.title = '';
    recordBtn.dataset.voiceReady = 'true';
    recordBtn.addEventListener('click', () => {
        if (!this.voiceRecorder || this.voiceRecorder.state !== 'recording') {
            this.startVoiceRecording().catch((err) => {
                console.error('startVoiceRecording failed:', err);
                this.showNotification('Unable to start recording: ' + (err && err.message ? err.message : err), 'error');
            });
        } else {
            this.stopVoiceRecording(true);
        }
    });

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.cancelVoiceRecording());
    }
};

SecureTransferApp.prototype.startVoiceRecording = async function() {
    if (!this.voiceSupported) {
        this.showNotification('Voice recording is not supported in this browser', 'warning');
        return;
    }

    if (this.voiceRecorder && this.voiceRecorder.state === 'recording') {
        return;
    }

    const elements = this.voiceElements || {};
    const recordBtn = elements.recordBtn || null;
    const indicator = elements.indicator || null;
    const timer = elements.timer || null;

    try {
        const activeStream = this.voiceStream && this.voiceStream.active ? this.voiceStream : await navigator.mediaDevices.getUserMedia({ audio: true });
        this.voiceStream = activeStream;

        const options = {};
        if (window.MediaRecorder && typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options.mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options.mimeType = 'audio/webm';
            }
        }

        const recorder = Object.keys(options).length > 0 ? new MediaRecorder(activeStream, options) : new MediaRecorder(activeStream);
        this.voiceRecorder = recorder;
        this.voiceChunks = [];
        this.voiceSendOnStop = true;

        recorder.addEventListener('dataavailable', (event) => {
            if (event.data && event.data.size > 0) {
                this.voiceChunks.push(event.data);
            }
        });

        recorder.addEventListener('stop', () => {
            this.handleVoiceRecorderStop().catch((err) => {
                console.error('handleVoiceRecorderStop failed:', err);
            });
        });

        recorder.addEventListener('error', (event) => {
            console.error('MediaRecorder error:', event.error || event);
            this.showNotification('Voice recorder error: ' + (event.error && event.error.message ? event.error.message : 'unknown'), 'error');
            this.voiceSendOnStop = false;
            try {
                recorder.stop();
            } catch (_) {}
            this.voiceRecorder = null;
            this.voiceChunks = [];
            if (this.voiceRecordingTimer) {
                clearInterval(this.voiceRecordingTimer);
                this.voiceRecordingTimer = null;
            }
            this.cleanupVoiceStream();
            this.resetVoiceUI();
        });

        this.voiceRecordingStart = Date.now();
        if (this.voiceRecordingTimer) {
            clearInterval(this.voiceRecordingTimer);
        }
        this.voiceRecordingTimer = setInterval(() => this.updateVoiceTimer(), 250);
        this.updateVoiceTimer();

        if (indicator) {
            indicator.style.display = 'flex';
        }
        if (timer) {
            timer.textContent = '00:00';
        }
        if (recordBtn) {
            recordBtn.disabled = false;
            recordBtn.classList.add('recording');
            recordBtn.textContent = 'Stop';
        }

        recorder.start();
    } catch (err) {
        console.error('startVoiceRecording failed:', err);
        this.showNotification('Unable to start recording: ' + (err && err.message ? err.message : err), 'error');
        this.cleanupVoiceStream();
        this.resetVoiceUI();
    }
};

SecureTransferApp.prototype.stopVoiceRecording = function(send = true) {
    this.voiceSendOnStop = !!send;

    const elements = this.voiceElements || {};
    const recordBtn = elements.recordBtn || null;
    if (recordBtn) {
        recordBtn.disabled = true;
        recordBtn.textContent = 'Processing...';
    }

    if (this.voiceRecorder && this.voiceRecorder.state === 'recording') {
        try {
            this.voiceRecorder.stop();
        } catch (err) {
            console.error('stopVoiceRecording failed:', err);
            this.voiceSendOnStop = false;
            this.cleanupVoiceStream();
            this.resetVoiceUI();
        }
    } else {
        this.handleVoiceRecorderStop().catch((err) => {
            console.error('handleVoiceRecorderStop failed:', err);
        });
    }
};

SecureTransferApp.prototype.cancelVoiceRecording = function() {
    this.voiceSendOnStop = false;

    if (this.voiceRecorder && this.voiceRecorder.state === 'recording') {
        try {
            this.voiceRecorder.stop();
        } catch (err) {
            console.error('cancelVoiceRecording failed:', err);
        }
    } else {
        this.voiceChunks = [];
        this.cleanupVoiceStream();
        this.resetVoiceUI();
    }

    this.showNotification('Voice recording cancelled', 'info');
};

SecureTransferApp.prototype.handleVoiceRecorderStop = async function() {
    if (this.voiceRecordingTimer) {
        clearInterval(this.voiceRecordingTimer);
        this.voiceRecordingTimer = null;
    }

    const elements = this.voiceElements || {};
    const indicator = elements.indicator || null;
    const timer = elements.timer || null;
    const recordBtn = elements.recordBtn || null;

    const durationMs = this.voiceRecordingStart ? Date.now() - this.voiceRecordingStart : 0;
    const durationSeconds = Math.max(0, Math.round(durationMs / 1000));
    this.voiceRecordingStart = null;

    if (indicator) {
        indicator.style.display = 'none';
    }
    if (timer) {
        timer.textContent = this.formatVoiceDuration(durationSeconds);
    }

    const chunks = this.voiceChunks.slice();
    this.voiceChunks = [];
    const sendVoice = this.voiceSendOnStop === true;
    this.voiceSendOnStop = false;
    const recorder = this.voiceRecorder || null;
    this.voiceRecorder = null;

    if (!sendVoice) {
        if (recordBtn) {
            recordBtn.disabled = false;
        }
        this.resetVoiceUI();
        this.cleanupVoiceStream();
        return;
    }

    if (durationSeconds < 1 || chunks.length === 0) {
        this.showNotification('Recording is too short', 'warning');
        if (recordBtn) {
            recordBtn.disabled = false;
        }
        this.resetVoiceUI();
        this.cleanupVoiceStream();
        return;
    }

    if (recordBtn) {
        recordBtn.disabled = true;
        recordBtn.textContent = 'Uploading...';
    }

    try {
        let mimeType = 'audio/webm';
        if (recorder && recorder.mimeType) {
            mimeType = recorder.mimeType;
        } else if (chunks[0] && chunks[0].type) {
            mimeType = chunks[0].type;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const fileName = `voice-${Date.now()}.webm`;
        let voiceFile;
        try {
            voiceFile = new File([blob], fileName, { type: blob.type });
        } catch (_) {
            voiceFile = blob;
            try {
                Object.defineProperty(voiceFile, 'name', { value: fileName });
            } catch (defineErr) {
                try {
                    voiceFile.name = fileName;
                } catch (_) {}
            }
            try {
                Object.defineProperty(voiceFile, 'lastModified', { value: Date.now() });
            } catch (defineErr) {
                try {
                    voiceFile.lastModified = Date.now();
                } catch (_) {}
            }
        }

        await this.uploadFile(voiceFile, {
            isVoice: true,
            duration: durationSeconds,
            mime: blob.type || mimeType
        });
    } catch (err) {
        console.error('Failed to send voice message:', err);
        this.showNotification('Failed to send voice message: ' + (err && err.message ? err.message : err), 'error');
    } finally {
        if (recordBtn) {
            recordBtn.disabled = false;
        }
        this.resetVoiceUI();
        this.cleanupVoiceStream();
    }
};

SecureTransferApp.prototype.resetVoiceUI = function() {
    const elements = this.voiceElements || {};
    const indicator = elements.indicator || null;
    const timer = elements.timer || null;
    const recordBtn = elements.recordBtn || null;
    const initialLabel = elements.initialLabel && elements.initialLabel.length > 0 ? elements.initialLabel : 'Record';

    if (indicator) {
        indicator.style.display = 'none';
    }

    if (timer) {
        timer.textContent = '00:00';
    }

    if (recordBtn) {
        recordBtn.disabled = false;
        recordBtn.classList.remove('recording');
        recordBtn.title = '';
        recordBtn.textContent = initialLabel;
    }
};

SecureTransferApp.prototype.updateVoiceTimer = function() {
    if (!this.voiceRecordingStart) {
        return;
    }

    const elements = this.voiceElements || {};
    const timer = elements.timer || null;
    if (!timer) {
        return;
    }

    const elapsed = Math.max(0, Math.round((Date.now() - this.voiceRecordingStart) / 1000));
    timer.textContent = this.formatVoiceDuration(elapsed);
};

SecureTransferApp.prototype.cleanupVoiceStream = function() {
    if (this.voiceStream) {
        try {
            this.voiceStream.getTracks().forEach((track) => track.stop());
        } catch (err) {
            console.warn('Failed to stop voice stream tracks:', err);
        }
    }
    this.voiceStream = null;
};

SecureTransferApp.prototype.formatVoiceDuration = function(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    const paddedMins = mins.toString().padStart(2, '0');
    const paddedSecs = secs.toString().padStart(2, '0');
    return paddedMins + ':' + paddedSecs;
};

SecureTransferApp.prototype.playVoiceMessage = async function(button, audioEl, fileInfo) {
    if (!button || !audioEl || !fileInfo) {
        return;
    }

    const playLabel = button.dataset.playLabel || button.textContent.trim() || 'Play';
    const stopLabel = button.dataset.stopLabel || 'Stop';
    button.dataset.playLabel = playLabel;
    button.dataset.stopLabel = stopLabel;

    const cleanup = () => {
        audioEl.onended = null;
        audioEl.onpause = null;
        if (audioEl.dataset.objectUrl) {
            URL.revokeObjectURL(audioEl.dataset.objectUrl);
            audioEl.removeAttribute('data-object-url');
        }
        audioEl.dataset.state = 'stopped';
        if (!audioEl.paused) {
            try {
                audioEl.pause();
            } catch (_) {}
        }
        try {
            audioEl.currentTime = 0;
        } catch (_) {}
        audioEl.removeAttribute('src');
        audioEl.style.display = 'none';
        button.textContent = playLabel;
    };

    if (audioEl.dataset.state === 'playing') {
        cleanup();
        return;
    }

    button.disabled = true;
    button.textContent = 'Loading...';
    audioEl.dataset.state = 'loading';

    try {
        let blob = this.voiceCache ? this.voiceCache.get(fileInfo.filename) : null;
        if (!blob) {
            const downloadUrl = this.getApiUrl('download.php') + `?room=${encodeURIComponent(this.currentRoom)}&file=${encodeURIComponent(fileInfo.filename)}`;
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error('Download failed');
            }

            if (fileInfo.encrypted && window.encryption && window.encryption.isSupported && window.encryption.roomKey) {
                const buffer = await response.arrayBuffer();
                const encryptedBlob = new Blob([buffer], { type: 'application/octet-stream' });
                blob = await window.encryption.decryptFile(encryptedBlob, fileInfo.name || 'voice.webm');
            } else {
                blob = await response.blob();
            }

            if (!blob) {
                throw new Error('Unable to decode voice message');
            }

            if (this.voiceCache) {
                this.voiceCache.set(fileInfo.filename, blob);
            }
        }

        const objectUrl = URL.createObjectURL(blob);
        audioEl.src = objectUrl;
        audioEl.dataset.objectUrl = objectUrl;
        audioEl.dataset.state = 'playing';
        audioEl.style.display = 'block';
        button.textContent = stopLabel;

        audioEl.onended = () => cleanup();
        audioEl.onpause = () => {
            if (audioEl.dataset.state === 'playing') {
                cleanup();
            }
        };

        await audioEl.play();
    } catch (err) {
        console.error('Failed to play voice message:', err);
        this.showNotification('Failed to play voice message: ' + (err && err.message ? err.message : err), 'error');
        cleanup();
    } finally {
        button.disabled = false;
        if (audioEl.dataset.state !== 'playing') {
            cleanup();
        }
    }
};

let app;

document.addEventListener('DOMContentLoaded', () => {

    app = new SecureTransferApp();

});



SecureTransferApp.prototype.copyTextToClipboard = function(text) {

    return navigator.clipboard.writeText(text).then(() => {

        this.showNotification('房间链接已复制到剪贴板', 'success');

    }).catch(err => {

        console.error('复制失败:', err);

        this.fallbackCopyText(text);

    });

};

















// ---- Encryption controls & presence helpers ----

SecureTransferApp.prototype.updateEncryptionStatus = function() {

    const icon = document.getElementById('encryptionIcon');

    const textEl = document.getElementById('encryptionText');

    if (!icon || !textEl) {

        return;

    }



    const iconMarkup = '<path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>';

    const container = icon.parentElement;

    const encryption = window.encryption;



    icon.innerHTML = iconMarkup;



    if (!encryption || !encryption.isSupported) {

        textEl.textContent = '端到端加密不可用';

        if (container) container.style.color = '#F44336';

        try { this.ensureToggleE2EEButton(); } catch (_) {}

        return;

    }



    const enabled = !!(this.currentEncryption && this.currentEncryption.enabled && encryption.roomKey);

    if (enabled) {

        textEl.textContent = '端到端加密已开启';

        if (container) container.style.color = '#4CAF50';

    } else {

        textEl.textContent = '当前为明文传输';

        if (container) container.style.color = '#FF9800';

    }



    try { this.ensureToggleE2EEButton(); } catch (_) {}

};



SecureTransferApp.prototype.ensureToggleE2EEButton = function() {

    try {

        const status = document.querySelector('.encryption-status');

        if (!status) return;

        let btn = document.getElementById('toggleE2EEBtn');

        if (!btn) {

            btn = document.createElement('button');

            btn.id = 'toggleE2EEBtn';

            btn.className = 'btn-primary';

            btn.style.marginLeft = '8px';

            btn.addEventListener('click', () => this.toggleE2EE());

            status.appendChild(btn);

        }



        const encryption = window.encryption || {};

        const supported = !!encryption.isSupported;

        const hasRoom = !!this.currentRoom;

        const on = supported && hasRoom && this.currentEncryption && this.currentEncryption.enabled && !!encryption.roomKey;



        btn.disabled = !supported || !hasRoom;

        if (!supported) {

            btn.textContent = '加密不可用';

            btn.title = '当前环境不支持端到端加密';

        } else if (!hasRoom) {

            btn.textContent = '开启加密';

            btn.title = '加入房间后可开启端到端加密';

        } else {

            btn.textContent = on ? '关闭加密' : '开启加密';

            btn.title = on ? '切换为明文传输' : '为当前房间开启端到端加密';

        }

    } catch (_) {}

};



SecureTransferApp.prototype.clearLocalEncryption = function() {

    const encryption = window.encryption;

    if (encryption) {

        if (typeof encryption.clearKey === 'function') {

            encryption.clearKey();

        } else {

            encryption.roomKey = null;

            if (typeof encryption.keyBase64 !== 'undefined') {

                encryption.keyBase64 = null;

            }

        }

    }

    this.currentEncryption = { enabled: false, key: null };

    this.updateEncryptionStatus();

};



SecureTransferApp.prototype.syncEncryptionState = async function(serverState) {

    const encryption = window.encryption;

    const nextState = (serverState && typeof serverState === 'object') ? serverState : null;

    const shouldEnable = !!(nextState && nextState.enabled && nextState.key);

    const incomingKey = shouldEnable ? String(nextState.key) : null;



    if (!encryption || !encryption.isSupported) {

        this.currentEncryption = { enabled: false, key: null };

        this.updateEncryptionStatus();

        return;

    }



    try {

        if (shouldEnable) {

            if (encryption.keyBase64 !== incomingKey) {

                await encryption.importRoomKey(incomingKey, { roomId: this.currentRoom });

            }

            this.currentEncryption = { enabled: true, key: incomingKey };

        } else {

            if (typeof encryption.clearKey === 'function') {

                encryption.clearKey();

            } else {

                encryption.roomKey = null;

                if (typeof encryption.keyBase64 !== 'undefined') {

                    encryption.keyBase64 = null;

                }

            }

            this.currentEncryption = { enabled: false, key: null };

        }

    } catch (err) {

        console.error('同步加密状态失败:', err);

        this.showNotification('同步加密状态失败: ' + (err && err.message ? err.message : err), 'error');

    }



    this.updateEncryptionStatus();

};



SecureTransferApp.prototype.getOrCreateClientId = function() {

    try {

        const key = `clientId-${this.currentRoom || ''}`;

        let id = localStorage.getItem(key);

        if (!id) {

            id = Array.from(window.crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');

            localStorage.setItem(key, id);

        }

        return id;

    } catch (_) {

        return Math.random().toString(16).slice(2, 18);

    }

};



SecureTransferApp.prototype.getClientBaselineStorageKey = function(clientId) {

    const room = this.currentRoom || '';

    const id = clientId || this.clientId || '';

    return `clientBaseline-${room}-${id}`;

};



SecureTransferApp.prototype.getStoredClientBaseline = function(clientId) {

    try {

        const key = this.getClientBaselineStorageKey(clientId);

        const raw = localStorage.getItem(key);

        if (raw === null || raw === '') {

            return null;

        }

        const value = Number(raw);

        if (Number.isNaN(value) || value < 0) {

            return null;

        }

        return value;

    } catch (_) {

        return null;

    }

};



SecureTransferApp.prototype.persistClientBaseline = function(baseline, clientId) {

    const value = Number(baseline);

    if (Number.isNaN(value) || value < 0) {

        return;

    }

    try {

        const key = this.getClientBaselineStorageKey(clientId);

        localStorage.setItem(key, String(value));

    } catch (_) {}

};



SecureTransferApp.prototype.clearStoredClientBaseline = function(clientId) {

    try {

        const key = this.getClientBaselineStorageKey(clientId);

        localStorage.removeItem(key);

    } catch (_) {}

};



SecureTransferApp.prototype.updateClientBaseline = function(baseline, options = {}) {

    const value = Number(baseline);

    if (Number.isNaN(value) || value < 0) {

        return;

    }

    const current = typeof this.clientJoinBaseline === 'number' ? this.clientJoinBaseline : 0;

    if (current > value) {

        if (options.persist !== false) {

            this.persistClientBaseline(current, options.clientId);

        }

        return;

    }

    this.clientJoinBaseline = value;

    if (typeof this.lastMessageId !== 'number' || this.lastMessageId < value) {

        this.lastMessageId = value;

    }

    if (options.persist !== false) {

        this.persistClientBaseline(value, options.clientId);

    }

};



SecureTransferApp.prototype.initializeClientSession = async function(options = {}) {

    if (!this.currentRoom) {

        return null;

    }

    this.clientId = this.getOrCreateClientId();

    const storedBaseline = this.getStoredClientBaseline(this.clientId);

    if (storedBaseline !== null) {

        this.updateClientBaseline(storedBaseline, { persist: false, clientId: this.clientId });

    } else if (typeof this.clientJoinBaseline !== 'number') {

        this.clientJoinBaseline = 0;

    }

    const data = await this.registerClientPresence({

        includeClients: options.includeClients !== false,

        persistBaseline: options.persistBaseline !== false

    });

    if (!data && storedBaseline !== null) {

        this.updateClientBaseline(storedBaseline, { persist: false, clientId: this.clientId });

    }

    return data;

};



SecureTransferApp.prototype.registerClientPresence = async function(options = {}) {

    if (!this.currentRoom || !this.clientId) {

        return null;

    }

    const includeClients = options.includeClients !== false;

    const persistBaseline = options.persistBaseline !== false;

    try {

        const res = await fetch(this.getApiUrl('client-ping.php'), {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                room: this.currentRoom,

                client_id: this.clientId,

                ua: navigator.userAgent || ''

            })

        });

        const payload = await res.json().catch(() => null);

        if (!payload) {

            return null;

        }

        if (!payload.success) {

            if (payload.error === 'FORCE_DISCONNECT') {

                this.handleForcedDisconnect();

            }

            return null;

        }

        const data = payload.data || {};

        if (data.encryption) {

            await this.syncEncryptionState(data.encryption);

        }

        if (data.client && typeof data.client.baseline_id === 'number') {

            this.updateClientBaseline(data.client.baseline_id, {

                persist: persistBaseline,

                clientId: this.clientId

            });

        }

        if (includeClients && Array.isArray(data.clients)) {

            this.renderClients(data.clients);

        }

        return data;

    } catch (err) {

        console.warn('client ping failed:', err);

        return null;

    }

};



SecureTransferApp.prototype.clientPing = async function() {

    if (!this.currentRoom || !this.clientId) return;

    await this.registerClientPresence();

};



SecureTransferApp.prototype.startClientHeartbeat = function() {

    if (this.clientHeartbeatTimer) {

        clearInterval(this.clientHeartbeatTimer);

    }

    this.clientPing();

    this.clientHeartbeatTimer = setInterval(() => this.clientPing(), 15000);

};



SecureTransferApp.prototype.refreshClientsPeriodically = function() {

    if (this.clientsRefreshTimer) {

        clearInterval(this.clientsRefreshTimer);

    }

    this.clientsRefreshTimer = setInterval(() => this.loadClients(), 10000);

};



SecureTransferApp.prototype.loadClients = async function() {

    if (!this.currentRoom) return;

    try {

        const res = await fetch(this.getApiUrl('client-ping.php') + `?room=${encodeURIComponent(this.currentRoom)}`);

        if (!res.ok) return;

        const data = await res.json().catch(() => null);

        if (!data) return;



        if (data.success) {

            if (data.data && Object.prototype.hasOwnProperty.call(data.data, 'encryption')) {

                await this.syncEncryptionState(data.data.encryption);

            }

            if (data.data && Array.isArray(data.data.clients)) {

                this.renderClients(data.data.clients);

            } else {

                this.renderClients([]);

            }

        } else if (data.error === 'FORCE_DISCONNECT') {

            this.handleForcedDisconnect();

        }

    } catch (err) {

        console.warn('loadClients failed:', err);

    }

};





SecureTransferApp.prototype.toggleE2EE = async function() {

    if (!this.currentRoom) {

        this.showNotification('请先加入房间', 'warning');

        return;

    }

    const enable = !(this.currentEncryption && this.currentEncryption.enabled);

    try {

        const res = await fetch(this.getApiUrl('set-encryption.php'), {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                room: this.currentRoom,

                action: enable ? 'enable' : 'disable',

                client_id: this.clientId || ''

            })

        });

        const result = await res.json();

        if (!res.ok || !result.success) {

            throw new Error(result.error || '服务器错误');

        }



        const state = result.data ? result.data.encryption : null;

        await this.syncEncryptionState(state);

        this.updateURL();

        const message = enable ? '已开启端到端加密，所有设备将同步使用新密钥' : '已切换为明文传输';

        this.showNotification(message, enable ? 'success' : 'info');

    } catch (err) {

        console.error('切换加密失败:', err);

        this.showNotification('切换加密失败: ' + (err && err.message ? err.message : err), 'error');

        this.updateEncryptionStatus();

    }

};



SecureTransferApp.prototype.handleForcedDisconnect = function() {

    try {

        this.showNotification('你已被移出房间', 'error');

    } catch (_) {}



    this.clearLocalEncryption();

    this.stopPolling();

    if (this.clientHeartbeatTimer) {

        clearInterval(this.clientHeartbeatTimer);

        this.clientHeartbeatTimer = null;

    }

    if (this.clientsRefreshTimer) {

        clearInterval(this.clientsRefreshTimer);

        this.clientsRefreshTimer = null;

    }



    try {

        if (this.currentRoom) {

            this.clearStoredClientBaseline(this.clientId);

            localStorage.removeItem(`clientId-${this.currentRoom}`);

        }

    } catch (_) {}



    setTimeout(() => {

        window.location.href = window.location.pathname;

    }, 1200);

};



SecureTransferApp.prototype.renderClients = function(clients) {

    const box = document.getElementById('clientsList');

    if (!box) return;



    if (!Array.isArray(clients) || clients.length === 0) {

        box.innerHTML = '<div class="empty-state">暂无设备</div>';

        return;

    }



    const now = Math.floor(Date.now() / 1000);

    const html = clients

        .sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0))

        .map(client => {

            const idFull = client.id || '';

            const idShort = this.escapeHtml(idFull.slice(0, 8));

            const isMe = idFull === this.clientId;

            const meTag = isMe ? '<span class="tag">本机</span>' : '';

            const seconds = Math.max(0, now - (client.last_seen || now));

            const rel = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;

            const ua = this.escapeHtml((client.ua || '').split(')')[0].slice(0, 48));

            const kickBtn = !isMe ? `<button type="button" class="btn-link kick-client" data-client="${this.escapeHtml(idFull)}">断开</button>` : '';

            return `<div class="client-item" data-client="${this.escapeHtml(idFull)}"><span class="cid">${idShort}</span> ${meTag}<span class="ago">${rel}前</span><span class="u">${ua}</span>${kickBtn}</div>`;

        })

        .join('');



    box.innerHTML = html;

    this.attachClientActions();

};



SecureTransferApp.prototype.attachClientActions = function() {

    const buttons = document.querySelectorAll('.kick-client');

    buttons.forEach(btn => {

        btn.addEventListener('click', () => {

            const target = btn.getAttribute('data-client');

            if (!target) return;

            if (target === this.clientId) {

                this.showNotification('无法断开当前设备', 'info');

                return;

            }

            this.kickClient(target);

        });

    });

};



SecureTransferApp.prototype.kickClient = async function(targetId) {

    if (!this.currentRoom || !targetId) return;

    try {

        const res = await fetch(this.getApiUrl('client-manage.php'), {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                room: this.currentRoom,

                action: 'kick',

                target_id: targetId,

                client_id: this.clientId || ''

            })

        });

        const result = await res.json();

        if (!res.ok || !result.success) {

            throw new Error(result.error || '操作失败');

        }



        if (result.data && Array.isArray(result.data.clients)) {

            this.renderClients(result.data.clients);

        } else {

            this.loadClients();

        }

        this.showNotification('已断开指定设备', 'success');

    } catch (err) {

        console.error('断开设备失败:', err);

        this.showNotification('断开设备失败: ' + (err && err.message ? err.message : err), 'error');

    }

};



SecureTransferApp.prototype.updateURL = function() {

    if (!this.currentRoom) return;

    const url = `${window.location.origin}${window.location.pathname}?room=${this.currentRoom}`;

    window.history.replaceState({}, '', url);

};



SecureTransferApp.prototype.copyRoomLink = function() {

    if (!this.currentRoom) {

        this.showNotification('请先加入房间', 'error');

        return;

    }

    const link = `${window.location.origin}${window.location.pathname}?room=${this.currentRoom}`;

    this.copyTextToClipboard(link);

};



SecureTransferApp.prototype.joinOrCreateRoom = async function() {

    const input = document.getElementById('roomIdInput');

    const rawValue = (input && input.value || '').trim();



    if (!rawValue) {

        return this.createNewRoom();

    }



    try {

        if (rawValue.includes('room=')) {

            const url = new URL(rawValue.startsWith('http') ? rawValue : `${window.location.origin}/${rawValue}`);

            window.location.href = url.toString();

            return;

        }



        const roomId = rawValue;

        if (!/^\d{6}$/.test(roomId) &&

            !/^[a-zA-Z0-9]{3,12}$/.test(roomId) &&

            !/^[a-zA-Z]+-[a-f0-9]{6}$/.test(roomId) &&

            !/^[a-f0-9]{16}$/.test(roomId)) {

            this.showNotification('房间格式无效，仅支持 6 位数字或 3-12 位字母数字', 'error');

            return;

        }



        this.stopPolling();

        this.currentRoom = roomId;

        this.lastMessageId = 0;

        this.lastClearId = null;

        if (this.voiceCache) {

            this.voiceCache.clear();

        }



        this.clearLocalEncryption();

        await window.encryption.initializeRoom(roomId);

        await this.initializeClientSession();

        this.updateURL();

        this.updateRoomInfo();

        this.clearHistoryDisplay();

        await this.loadHistory();

        this.startPolling();

        this.startClientHeartbeat();

        this.refreshClientsPeriodically();

        this.loadClients();



        this.showNotification(`已进入房间 ${roomId}`, 'success');

    } catch (error) {

        console.error('加入房间失败:', error);

        this.showNotification('加入房间失败: ' + (error && error.message ? error.message : error), 'error');

    }

};



SecureTransferApp.prototype.createNewRoom = async function() {

    try {

        this.stopPolling();



        const roomId = Math.floor(100000 + Math.random() * 900000).toString();

        this.currentRoom = roomId;

        this.lastMessageId = 0;

        this.lastClearId = null;

        if (this.voiceCache) {

            this.voiceCache.clear();

        }



        this.clearLocalEncryption();

        await window.encryption.initializeRoom(roomId);

        await this.initializeClientSession();

        this.updateURL();

        this.updateRoomInfo();



        this.clearHistoryDisplay();

        await this.loadHistory();

        this.startPolling();

        this.startClientHeartbeat();

        this.refreshClientsPeriodically();

        this.loadClients();



        this.showNotification(`已创建新房间 ${roomId}`, 'success');

    } catch (error) {

        console.error('创建房间失败:', error);

        this.showNotification('创建房间失败: ' + (error && error.message ? error.message : error), 'error');

    }

};



