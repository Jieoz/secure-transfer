// 主题管理器 - 增强版
class ThemeManager {
    constructor() {
        this.theme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getStoredTheme() {
        return localStorage.getItem('theme');
    }

    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // 更新主题切换按钮图标
        this.updateThemeToggleIcon();

        // 触发主题切换事件
        this.dispatchThemeChange();

        // 添加主题切换动画
        this.playThemeTransition();
    }

    playThemeTransition() {
        // 创建一个覆盖层来实现平滑的主题切换动画
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, ${this.theme === 'dark' ? '#0a0a0a' : '#ffffff'} 0%, transparent 70%);
            pointer-events: none;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;

        document.body.appendChild(overlay);

        // 触发动画
        requestAnimationFrame(() => {
            overlay.style.opacity = '0.8';
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                }, 500);
            }, 200);
        });
    }

    toggleTheme() {
        // 添加过渡类
        document.documentElement.classList.add('theme-transition');

        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);

        // 添加视觉反馈
        window.animationManager?.showNotification(
            `已切换到${newTheme === 'dark' ? '深色' : '浅色'}模式`,
            'info',
            2000
        );

        // 移除过渡类
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 500);
    }

    updateThemeToggleIcon() {
        const lightIcon = document.querySelector('.theme-light');
        const darkIcon = document.querySelector('.theme-dark');

        if (this.theme === 'dark') {
            lightIcon.style.display = 'none';
            darkIcon.style.display = 'block';
        } else {
            lightIcon.style.display = 'block';
            darkIcon.style.display = 'none';
        }
    }

    dispatchThemeChange() {
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: this.theme }
        }));
    }

    init() {
        // 应用初始主题
        this.setTheme(this.theme);

        // 监听系统主题变化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });

        // 绑定主题切换按钮
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }
}

// 动画管理器 - 增强版
class AnimationManager {
    constructor() {
        this.init();
    }

    // 添加进入动画—增强版
    addEnterAnimation(element, type = 'fadeUp') {
        const animations = {
            fadeUp: {
                initial: { opacity: '0', transform: 'translateY(30px) scale(0.95)' },
                final: { opacity: '1', transform: 'translateY(0) scale(1)' }
            },
            fadeIn: {
                initial: { opacity: '0', transform: 'scale(0.9)' },
                final: { opacity: '1', transform: 'scale(1)' }
            },
            slideLeft: {
                initial: { opacity: '0', transform: 'translateX(-30px)' },
                final: { opacity: '1', transform: 'translateX(0)' }
            },
            bounce: {
                initial: { opacity: '0', transform: 'translateY(-20px) scale(0.8)' },
                final: { opacity: '1', transform: 'translateY(0) scale(1)' }
            }
        };

        const anim = animations[type] || animations.fadeUp;

        // 设置初始状态
        Object.assign(element.style, anim.initial);

        // 触发重排
        element.offsetHeight;

        // 应用动画
        element.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        Object.assign(element.style, anim.final);

        // 清理过渡样式
        setTimeout(() => {
            element.style.transition = '';
        }, 600);
    }

    // 添加点击涟漪效果 - 增强版
    addRippleEffect(button, event) {
        const rect = button.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height) * 1.2;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        // 获取按钮的主色调
        const buttonStyle = getComputedStyle(button);
        const isLight = button.classList.contains('btn-primary') || button.classList.contains('btn-danger');
        const rippleColor = isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(59, 130, 246, 0.3)';

        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: ${rippleColor};
            transform: scale(0);
            animation: rippleEffect 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            pointer-events: none;
            z-index: 1000;
        `;

        button.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 800);
    }

    // 添加加载状态
    addLoadingState(element) {
        const originalContent = element.innerHTML;
        const spinner = '<div class="loading"></div>';

        element.innerHTML = spinner;
        element.disabled = true;

        return () => {
            element.innerHTML = originalContent;
            element.disabled = false;
        };
    }

    // 平滑滚动到元素
    smoothScrollTo(element, offset = 0) {
        const targetPosition = element.offsetTop - offset;
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }

    // 通知动画 - 增强版
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        // 创建图标
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        const iconSvg = this.getNotificationIcon(type);
        icon.innerHTML = iconSvg;

        // 创建文本
        const text = document.createElement('span');
        text.textContent = message;

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.hideNotification(notification);

        notification.appendChild(icon);
        notification.appendChild(text);
        notification.appendChild(closeBtn);

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 20px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            transform: translateX(100%) scale(0.9);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            max-width: 400px;
            min-width: 300px;
        `;

        // 设置背景色
        const colors = {
            info: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            success: 'linear-gradient(135deg, #10b981, #047857)',
            warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
            error: 'linear-gradient(135deg, #ef4444, #dc2626)'
        };
        notification.style.background = colors[type] || colors.info;

        document.body.appendChild(notification);

        // 触发动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0) scale(1)';
        }, 10);

        // 自动消失
        setTimeout(() => {
            this.hideNotification(notification);
        }, duration);
    }

    hideNotification(notification) {
        notification.style.transform = 'translateX(100%) scale(0.9)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 400);
    }

    getNotificationIcon(type) {
        const icons = {
            info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>',
            success: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13,14H11V10H13M13,18H11V16H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>'
        };
        return icons[type] || icons.info;
    }

    // 错误抖动动画
    addShakeAnimation(element) {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    }

    init() {
        // 添加CSS动画 - 增强版
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rippleEffect {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
                20%, 40%, 60%, 80% { transform: translateX(8px); }
            }

            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }

            @keyframes glow {
                0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
                50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
            }

            @keyframes slideInBounce {
                0% {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.8);
                }
                60% {
                    opacity: 1;
                    transform: translateY(10px) scale(1.05);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .shake {
                animation: shake 0.6s ease-in-out;
            }

            .float {
                animation: float 3s ease-in-out infinite;
            }

            .notification {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideInBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }

            .notification-icon {
                width: 24px;
                height: 24px;
                flex-shrink: 0;
            }

            .notification-icon svg {
                width: 100%;
                height: 100%;
            }

            .notification-close {
                background: none;
                border: none;
                color: currentColor;
                font-size: 20px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background-color 0.2s ease;
                flex-shrink: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .notification-close:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }

            .fade-in {
                animation: fadeInPage 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            }

            @keyframes fadeInPage {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* 新增的微动效 */
            .micro-bounce {
                animation: microBounce 0.3s ease;
            }

            @keyframes microBounce {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .pulse-glow {
                animation: pulseGlow 2s ease-in-out infinite;
            }

            @keyframes pulseGlow {
                0%, 100% {
                    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
                    transform: scale(1);
                }
                50% {
                    box-shadow: 0 0 25px rgba(59, 130, 246, 0.6);
                    transform: scale(1.02);
                }
            }
        `;
        document.head.appendChild(style);

        // 为按钮添加涟漪效果 - 增强版
        document.addEventListener('click', (e) => {
            const button = e.target.closest('.btn, .btn-primary, .btn-secondary, .btn-danger, .btn-icon');
            if (button && !button.disabled) {
                this.addRippleEffect(button, e);

                // 添加微动效
                button.classList.add('micro-bounce');
                setTimeout(() => {
                    button.classList.remove('micro-bounce');
                }, 300);
            }
        });

        // 为新添加的历史记录项添加进入动画 - 增强版
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.classList.contains('history-item')) {
                            this.addEnterAnimation(node, 'fadeUp');
                        } else if (node.classList.contains('client-item')) {
                            this.addEnterAnimation(node, 'slideLeft');
                        } else if (node.classList.contains('panel')) {
                            this.addEnterAnimation(node, 'fadeIn');
                        }
                    }
                });
            });
        });

        const historyList = document.getElementById('historyList');
        if (historyList) {
            observer.observe(historyList, { childList: true });
        }

        const clientsList = document.getElementById('clientsList');
        if (clientsList) {
            observer.observe(clientsList, { childList: true });
        }

        // 添加页面元素的微交互动画
        this.addInteractiveAnimations();
    }

    // 添加交互动画
    addInteractiveAnimations() {
        // 为所有输入框添加聚焦动画
        document.addEventListener('focus', (e) => {
            if (e.target.matches('input, textarea')) {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.transition = 'transform 0.2s ease';
            }
        }, true);

        document.addEventListener('blur', (e) => {
            if (e.target.matches('input, textarea')) {
                e.target.style.transform = 'scale(1)';
            }
        }, true);

        // 为面板添加悬停发光效果
        document.querySelectorAll('.panel').forEach(panel => {
            panel.addEventListener('mouseenter', () => {
                panel.classList.add('pulse-glow');
            });
            panel.addEventListener('mouseleave', () => {
                panel.classList.remove('pulse-glow');
            });
        });

        // 为上传区域添加浮动效果
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.add('float');
        }
    }
}

// 性能监控器
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            uploadSpeed: [],
            downloadSpeed: [],
            apiResponseTime: []
        };
    }

    startMeasure(type) {
        return performance.now();
    }

    endMeasure(type, startTime, dataSize = 0) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (dataSize > 0) {
            const speed = (dataSize / 1024 / 1024) / (duration / 1000); // MB/s
            this.metrics[type].push(speed);

            // 保留最近10次记录
            if (this.metrics[type].length > 10) {
                this.metrics[type].shift();
            }
        }

        return duration;
    }

    getAverageSpeed(type) {
        const speeds = this.metrics[type];
        if (speeds.length === 0) return 0;
        return speeds.reduce((a, b) => a + b, 0) / speeds.length;
    }
}

// 键盘快捷键管理器
class KeyboardManager {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }

    register(key, callback, description = '') {
        this.shortcuts.set(key, { callback, description });
    }

    init() {
        document.addEventListener('keydown', (e) => {
            const key = this.getKeyString(e);
            const shortcut = this.shortcuts.get(key);

            if (shortcut && this.shouldTrigger(e)) {
                e.preventDefault();
                shortcut.callback(e);
            }
        });

        // 注册默认快捷键
        this.register('ctrl+enter', () => {
            const sendBtn = document.getElementById('sendBtn');
            if (sendBtn && !sendBtn.disabled) {
                sendBtn.click();
            }
        }, '发送消息');

        this.register('ctrl+d', () => {
            const themeManager = window.themeManager;
            if (themeManager) {
                themeManager.toggleTheme();
            }
        }, '切换主题');

        this.register('ctrl+r', () => {
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) {
                refreshBtn.click();
            }
        }, '刷新历史记录');

        this.register('escape', () => {
            const modal = document.getElementById('modal');
            if (modal && modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        }, '关闭模态框');
    }

    getKeyString(e) {
        if (!e) {
            return '';
        }

        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey) parts.push('meta');

        let rawKey = typeof e.key === 'string' ? e.key : '';
        if (!rawKey || rawKey === 'Unidentified') {
            if (typeof e.code === 'string') {
                rawKey = e.code;
            } else if (typeof e.keyCode === 'number') {
                const special = {
                    8: 'backspace',
                    9: 'tab',
                    13: 'enter',
                    27: 'escape',
                    32: 'space',
                };
                rawKey = special[e.keyCode] || String.fromCharCode(e.keyCode);
            }
        }

        if (rawKey.startsWith('Key')) {
            rawKey = rawKey.slice(3);
        } else if (rawKey.startsWith('Digit')) {
            rawKey = rawKey.slice(5);
        }

        const key = (rawKey || '').toString().toLowerCase();
        if (key && !['control', 'alt', 'shift', 'meta'].includes(key)) {
            parts.push(key);
        }

        return parts.join('+');
    }

    shouldTrigger(e) {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();

        // 不在输入框中触发快捷键（除了特殊快捷键）
        if (['input', 'textarea', 'select'].includes(tagName)) {
            const key = this.getKeyString(e);
            return ['ctrl+enter', 'escape'].includes(key);
        }

        return true;
    }
}

// 增强的剪贴板管理器
class ClipboardManager {
    constructor() {
        this.init();
    }

    async copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            window.animationManager?.showNotification('已复制到剪贴板', 'success', 2000);
            return true;
        } catch (err) {
            console.warn('复制失败，使用备用方法', err);
            return this.fallbackCopy(text);
        }
    }

    async paste() {
        try {
            const text = await navigator.clipboard.readText();
            return text;
        } catch (err) {
            console.warn('粘贴失败', err);
            window.animationManager?.showNotification('粘贴失败，请手动粘贴', 'error');
            return null;
        }
    }

    fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = 'position: fixed; top: -1000px; left: -1000px;';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                window.animationManager?.showNotification('已复制到剪贴板', 'success', 2000);
                return true;
            }
        } catch (err) {
            document.body.removeChild(textArea);
            console.error('复制失败', err);
        }

        return false;
    }

    init() {
        // 绑定粘贴按钮
        const pasteBtn = document.getElementById('pasteBtn');
        if (pasteBtn) {
            pasteBtn.addEventListener('click', async () => {
                const text = await this.paste();
                if (text) {
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        messageInput.value = text;
                        messageInput.focus();
                    }
                }
            });
        }

        // 绑定所有复制按钮
        document.addEventListener('click', (e) => {
            if (e.target.matches('.copy-btn') || e.target.closest('.copy-btn')) {
                const button = e.target.matches('.copy-btn') ? e.target : e.target.closest('.copy-btn');
                const content = button.dataset.content || button.getAttribute('data-content');
                if (content) {
                    this.copy(content);
                }
            }
        });
    }
}

// 初始化所有管理器
document.addEventListener('DOMContentLoaded', () => {
    // 全局实例
    window.themeManager = new ThemeManager();
    window.animationManager = new AnimationManager();
    window.performanceMonitor = new PerformanceMonitor();
    window.keyboardManager = new KeyboardManager();
    window.clipboardManager = new ClipboardManager();

    // 添加页面加载完成的淡入动画
    document.body.classList.add('fade-in');

    console.log('🎨 现代化界面增强功能已加载');
});
