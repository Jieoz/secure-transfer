// 端到端加密模块
class E2EEncryption {
    constructor() {
        this.isSupported = this.checkSupport();
        this.keyPair = null;
        this.roomKey = null;
        this.keyBase64 = null; // cached key (base64) for sync export
        this.activeRoomId = null;
        this.maxEncryptSize = 32 * 1024 * 1024; // 32MB
    }

    // 检查浏览器是否支持 Web Crypto API
    checkSupport() {
        // 检查核心API
        if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
            console.warn('Web Crypto API not supported');
            return false;
        }

        // 检查编码器
        if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
            console.warn('TextEncoder/TextDecoder not supported');
            return false;
        }

        // 检查Fetch API
        if (typeof fetch === 'undefined') {
            console.warn('Fetch API not supported');
            return false;
        }

        // 检查Promise和async/await（间接检查）
        if (typeof Promise === 'undefined') {
            console.warn('Promise not supported');
            return false;
        }

        return true;
    }

    // 生成房间密钥（AES-GCM）- 基于房间ID确定性生成
    async generateRoomKey(roomId) {
        if (!this.isSupported) {
            console.warn('E2E encryption not supported, falling back to plain text');
            return null;
        }

        try {
            // 使用房间ID作为种子，通过PBKDF2生成确定性密钥
            const encoder = new TextEncoder();
            const roomIdData = encoder.encode(roomId);

            // 使用固定的盐值，这样相同房间ID会产生相同的密钥
            const salt = encoder.encode('secure-transfer-room-salt');

            // 导入房间ID作为基础密钥材料
            const baseKey = await window.crypto.subtle.importKey(
                'raw',
                roomIdData,
                'PBKDF2',
                false,
                ['deriveKey']
            );

            // 派生AES-GCM密钥
            this.roomKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                baseKey,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,
                ['encrypt', 'decrypt']
            );

            return this.roomKey;
        } catch (error) {
            console.error('Failed to generate room key:', error);
            this.isSupported = false;
            return null;
        }
    }

    // 从Base64字符串导入密钥
    async importRoomKey(keyData) {
        if (!this.isSupported || !keyData) return null;

        try {
            const keyBuffer = this.base64ToArrayBuffer(keyData);
            this.roomKey = await window.crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                true,
                ['encrypt', 'decrypt']
            );
            return this.roomKey;
        } catch (error) {
            console.error('Failed to import room key:', error);
            return null;
        }
    }

    // 导出密钥为Base64字符串
    async exportRoomKey() {
        if (!this.isSupported || !this.roomKey) return null;

        try {
            const keyData = await window.crypto.subtle.exportKey('raw', this.roomKey);
            return this.arrayBufferToBase64(keyData);
        } catch (error) {
            console.error('Failed to export room key:', error);
            return null;
        }
    }

    // 加密文本消息
    async encryptMessage(message) {
        if (!this.isSupported || !this.roomKey) {
            return { encrypted: false, data: message };
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(message);

            // 生成随机IV
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // 加密数据
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.roomKey,
                data
            );

            // 合并IV和加密数据
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);

            return {
                encrypted: true,
                data: this.arrayBufferToBase64(combined)
            };
        } catch (error) {
            console.error('Encryption failed:', error);
            return { encrypted: false, data: message };
        }
    }

    // 解密文本消息
    async decryptMessage(encryptedData) {
        if (!this.isSupported || !this.roomKey || !encryptedData.encrypted) {
            return encryptedData.data;
        }

        try {
            const combined = this.base64ToArrayBuffer(encryptedData.data);

            // 分离IV和加密数据
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            // 解密数据
            const decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.roomKey,
                encrypted
            );

            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('Decryption failed:', error);
            return '[解密失败]';
        }
    }

    // 加密文件（小文件）
    async encryptFile(file) {
        if (!this.isSupported || !this.roomKey || file.size > this.maxEncryptSize) {
            return { encrypted: false, data: file };
        }

        try {
            const arrayBuffer = await file.arrayBuffer();

            // 生成随机IV
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // 加密文件数据
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.roomKey,
                arrayBuffer
            );

            // 合并IV和加密数据
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);

            // 创建加密后的文件对象
            const encryptedFile = new File([combined], file.name + '.encrypted', {
                type: 'application/octet-stream'
            });

            return {
                encrypted: true,
                data: encryptedFile,
                originalName: file.name,
                originalType: file.type,
                originalSize: file.size
            };
        } catch (error) {
            console.error('File encryption failed:', error);
            return { encrypted: false, data: file };
        }
    }

    // 解密文件
    async decryptFile(encryptedFile, originalName, originalType) {
        console.log('decryptFile调用:', {
            hasSupport: this.isSupported,
            hasRoomKey: !!this.roomKey,
            fileType: encryptedFile.constructor.name,
            fileSize: encryptedFile.size
        });

        if (!this.isSupported || !this.roomKey) {
            console.log('不支持加密或没有房间密钥');
            return encryptedFile;
        }

        try {
            console.log('开始获取arrayBuffer');
            const arrayBuffer = await encryptedFile.arrayBuffer();
            console.log('arrayBuffer大小:', arrayBuffer.byteLength);

            // 分离IV和加密数据
            const iv = arrayBuffer.slice(0, 12);
            const encrypted = arrayBuffer.slice(12);
            console.log('IV长度:', iv.byteLength, '加密数据长度:', encrypted.byteLength);

            console.log('开始解密');
            // 解密文件数据
            const decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.roomKey,
                encrypted
            );
            console.log('解密成功，数据长度:', decryptedData.byteLength);

            // 创建解密后的文件对象
            const result = new Blob([decryptedData], {
                type: originalType || 'application/octet-stream'
            });
            console.log('创建Blob成功，大小:', result.size);
            return result;
        } catch (error) {
            console.error('File decryption failed:', error);
            return null;
        }
    }

    // 工具函数：ArrayBuffer 转 Base64
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // 工具函数：Base64 转 ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // 生成房间ID（PIN码风格）
    generateRoomId() {
        // 生成6位数字PIN码，避免容易混淆的数字
        const digits = '123456789'; // 避免0，因为容易和O混淆
        let pin = '';
        for (let i = 0; i < 6; i++) {
            const randomIndex = Math.floor(Math.random() * digits.length);
            pin += digits[randomIndex];
        }
        return pin;
    }

    // 验证房间ID格式
    validateRoomId(roomId) {
        // 支持格式：
        // - PIN码：6位数字
        // - 自定义房间号：字母、数字，3-12位（简化）
        // - 旧版本兼容
        return /^\d{6}$/.test(roomId) ||                    // 6位数字PIN
               /^[a-zA-Z0-9]{3,12}$/.test(roomId) ||        // 简化的自定义房间号
               /^[a-zA-Z]+-[a-f0-9]{6}$/.test(roomId) ||    // 旧版本单词+hex
               /^[a-f0-9]{16}$/.test(roomId);               // 最旧版本hex
    }

    // 从URL获取或生成房间信息
    async initializeRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('room');

        if (!roomId) {
            // 生成新房间
            roomId = this.generateRoomId();

            // 更新URL但不刷新页面
            const newUrl = `${window.location.pathname}?room=${roomId}`;
            window.history.replaceState({}, '', newUrl);
        }

        // 为房间生成确定性密钥
        await this.generateRoomKey(roomId);

        return {
            roomId: roomId,
            hasEncryption: !!this.roomKey
        };
    }

    // 获取当前房间的分享链接
    getShareLink() {
        const url = new URL(window.location);
        return url.toString();
    }

    // 获取加密状态信息
    getEncryptionStatus() {
        if (!this.isSupported) {
            return {
                enabled: false,
                reason: '浏览器不支持加密功能',
                icon: 'warning'
            };
        }

        if (!this.roomKey) {
            return {
                enabled: false,
                reason: '加密密钥未加载',
                icon: 'warning'
            };
        }

        return {
            enabled: true,
            reason: '端到端加密已启用',
            icon: 'lock'
        };
    }

    // 检查文件是否可以加密
    canEncryptFile(file) {
        return this.isSupported && this.roomKey && file.size <= this.maxEncryptSize;
    }

    // 导出密钥为Base64字符串
    async exportKey() {
        if (!this.isSupported || !this.roomKey) {
            return null;
        }

        try {
            const keyData = await window.crypto.subtle.exportKey('raw', this.roomKey);
            return this.arrayBufferToBase64(keyData);
        } catch (error) {
            console.error('Failed to export key:', error);
            return null;
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
}

// 创建全局加密实例
window.encryption = new E2EEncryption();

// ---- Overrides for shared room encryption ----
E2EEncryption.prototype.initializeRoom = async function(roomOverride) {
    let roomId = roomOverride;
    try {
        const url = new URL(window.location.href);
        if (!roomId) {
            roomId = url.searchParams.get('room');
        }
        if (!roomId) {
            roomId = this.generateRoomId();
            url.searchParams.set('room', roomId);
            window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
        }
    } catch (_) {
        if (!roomId) {
            roomId = this.generateRoomId();
        }
    }

    this.activeRoomId = roomId;
    this.clearKey();
    return { roomId, hasEncryption: false };
};

E2EEncryption.prototype.importRoomKey = async function(keyData, options = {}) {
    if (!this.isSupported || !keyData) return null;
    const roomId = options.roomId || this.activeRoomId || null;

    try {
        const keyBuffer = this.base64ToArrayBuffer(keyData);
        this.roomKey = await window.crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
        this.keyBase64 = this.arrayBufferToBase64(keyBuffer);
        this.activeRoomId = roomId;
        return this.roomKey;
    } catch (error) {
        console.error('Failed to import room key:', error);
        return null;
    }
};

E2EEncryption.prototype.exportRoomKey = async function() {
    if (!this.isSupported || !this.roomKey) return null;
    if (this.keyBase64) return this.keyBase64;
    try {
        const keyData = await window.crypto.subtle.exportKey('raw', this.roomKey);
        this.keyBase64 = this.arrayBufferToBase64(keyData);
        return this.keyBase64;
    } catch (error) {
        console.error('Failed to export key:', error);
        return null;
    }
};

E2EEncryption.prototype.exportKey = function() {
    return this.keyBase64 || null;
};

E2EEncryption.prototype.clearKey = function() {
    this.roomKey = null;
    this.keyBase64 = null;
};

E2EEncryption.prototype.getActiveRoomId = function() {
    return this.activeRoomId;
};

E2EEncryption.prototype.decryptFile = async function(encryptedFile, originalName, originalType) {
    if (!this.isSupported || !this.roomKey) {
        return encryptedFile;
    }

    try {
        const arrayBuffer = (encryptedFile && typeof encryptedFile.arrayBuffer === 'function')
            ? await encryptedFile.arrayBuffer()
            : (encryptedFile instanceof ArrayBuffer ? encryptedFile : await new Blob([encryptedFile]).arrayBuffer());

        const iv = arrayBuffer.slice(0, 12);
        const encrypted = arrayBuffer.slice(12);

        const decryptedData = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            this.roomKey,
            encrypted
        );

        return new Blob([decryptedData], { type: originalType || 'application/octet-stream' });
    } catch (error) {
        console.error('File decryption failed:', error);
        return null;
    }
};
