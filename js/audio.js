/**
 * 舒尔特方格训练 APP - 音效模块
 * 使用 Web Audio API 生成轻柔音效，无需外部音频文件
 */

const AudioManager = {
    context: null,
    enabled: true,

    /**
     * 初始化音频上下文
     */
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = Storage.getSettings().soundEnabled;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    },

    /**
     * 确保音频上下文已激活（需要用户交互后才能播放）
     */
    ensureContext() {
        if (!this.context) {
            this.init();
        }
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    },

    /**
     * 设置音效开关
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        const settings = Storage.getSettings();
        settings.soundEnabled = enabled;
        Storage.saveSettings(settings);
    },

    /**
     * 播放正确音效 - 短促清脆的"叮"声
     */
    playCorrect() {
        if (!this.enabled) return;
        this.ensureContext();

        const ctx = this.context;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // 正弦波，高频清脆音
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1); // 升到 E6

        // 音量包络：快速起音，柔和衰减
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
    },

    /**
     * 播放错误音效 - 低沉的提示音
     */
    playError() {
        if (!this.enabled) return;
        this.ensureContext();

        const ctx = this.context;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // 低频方波，柔和提示
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);

        // 较低的音量
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
    },

    /**
     * 播放完成/达标音效 - 轻快的完成音
     */
    playComplete() {
        if (!this.enabled) return;
        this.ensureContext();

        const ctx = this.context;

        // 播放三个上升音符，营造成就感
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5（C大调和弦）
        const duration = 0.15;

        notes.forEach((freq, index) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, ctx.currentTime + index * duration);

            gainNode.gain.setValueAtTime(0.25, ctx.currentTime + index * duration);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * duration + 0.3);

            oscillator.start(ctx.currentTime + index * duration);
            oscillator.stop(ctx.currentTime + index * duration + 0.3);
        });
    },

    /**
     * 播放倒计时音效
     */
    playCountdown() {
        if (!this.enabled) return;
        this.ensureContext();

        const ctx = this.context;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4

        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.15);
    },

    /**
     * 播放新纪录/勋章获得音效
     */
    playAchievement() {
        if (!this.enabled) return;
        this.ensureContext();

        const ctx = this.context;

        // 更华丽的和弦
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const duration = 0.12;

        notes.forEach((freq, index) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, ctx.currentTime + index * duration);

            gainNode.gain.setValueAtTime(0.2, ctx.currentTime + index * duration);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * duration + 0.4);

            oscillator.start(ctx.currentTime + index * duration);
            oscillator.stop(ctx.currentTime + index * duration + 0.4);
        });
    },

    /**
     * 播放点击按钮音效
     */
    playClick() {
        if (!this.enabled) return;
        this.ensureContext();

        const ctx = this.context;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);

        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.05);
    },
};

// 导出到全局
window.AudioManager = AudioManager;
