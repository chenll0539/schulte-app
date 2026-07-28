/**
 * 舒尔特方格训练 APP - 主应用逻辑
 * 包含页面导航、训练流程、数据展示等所有功能
 */

const App = {
    // ========================================
    // 状态管理
    // ========================================
    state: {
        currentPage: 'home',
        selectedChild: null,
        currentMode: 'classic',      // classic, interference, challenge, custom
        currentDifficulty: 3,         // 方格尺寸 3-9
        interferenceLevel: 0,         // 干扰级别 0=无, 1=初级, 2=中级, 3=高级
        isTraining: false,
        isPaused: false,
        timer: null,
        startTime: null,
        elapsedTime: 0,              // 毫秒
        currentTarget: 1,            // 当前应该点击的数字
        totalCells: 0,               // 总格子数
        correctCount: 0,
        errorCount: 0,
        gridNumbers: [],             // 当前方格数字数组
        unlockedSizes: [3],          // 已解锁的难度
        restReminderShown: false,    // 本次训练是否已显示过休息提醒
        // 干扰相关状态
        interferenceTimers: [],      // 干扰动画定时器数组
        noiseAudioContext: null,     // 白噪音 AudioContext（复用）
        noiseAudioNode: null,        // 白噪音音频节点
        noiseGainNode: null,         // 音量控制节点
    },

    // ========================================
    // 初始化
    // ========================================
    init() {
        console.log('App initializing...');

        // 初始化音频
        AudioManager.init();

        // 加载设置
        this.loadSettings();

        // 加载已激活的儿童
        const activeChildId = Storage.getActiveChildId();
        if (activeChildId) {
            this.state.selectedChild = Storage.getActiveChild();
        }

        // 加载已解锁的难度
        this.loadUnlockedSizes();

        // 绑定事件
        this.bindEvents();

        // 渲染初始页面
        this.renderHomePage();
        this.updateNavigation('home');

        console.log('App initialized');
    },

    /**
     * 加载设置并应用
     */
    loadSettings() {
        const settings = Storage.getSettings();

        // 音效开关
        AudioManager.setEnabled(settings.soundEnabled);

        // 护眼模式
        if (settings.eyeCareMode) {
            document.body.classList.add('eye-care-mode');
            const eyeCareToggle = document.getElementById('setting-eye-care');
            if (eyeCareToggle) eyeCareToggle.checked = true;
        }
    },

    /**
     * 加载已解锁的难度
     */
    loadUnlockedSizes() {
        const child = Storage.getActiveChild();
        if (!child) {
            this.state.unlockedSizes = [3];
            return;
        }

        const bestScores = Storage.getBestScores(child.id);
        const unlocked = new Set([3]); // 默认解锁 3×3

        Object.keys(bestScores).forEach(key => {
            const size = parseInt(key.split('_')[1]);
            if (size) unlocked.add(size);
        });

        // 如果某个难度有记录，说明已经解锁了
        // 自动解锁逻辑：完成当前难度即可解锁下一级
        for (let size = 3; size <= 8; size++) {
            if (unlocked.has(size)) {
                unlocked.add(size + 1);
            }
        }

        this.state.unlockedSizes = Array.from(unlocked).sort((a, b) => a - b);
    },

    // ========================================
    // 事件绑定
    // ========================================
    bindEvents() {
        // 底部导航
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this.navigateTo(page);
                this.updateNavigation(page);
            });
        });

        // 添加儿童按钮
        document.getElementById('btn-add-child').addEventListener('click', () => {
            this.showAddChildModal();
        });

        // 模式选择按钮
        document.querySelectorAll('.btn-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.selectMode(mode);
            });
        });

        // 返回按钮（难度页）
        document.getElementById('btn-back-to-mode').addEventListener('click', () => {
            this.navigateTo('home');
        });

        // 暂停按钮
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.pauseTraining();
        });

        // 结果页按钮
        document.getElementById('btn-play-again').addEventListener('click', () => {
            this.startTraining(this.state.currentDifficulty);
        });
        document.getElementById('btn-back-to-home').addEventListener('click', () => {
            this.navigateTo('home');
            this.updateNavigation('home');
        });
        document.getElementById('btn-back-to-difficulty').addEventListener('click', () => {
            this.navigateTo('difficulty');
            this.renderDifficultyPage();
        });
        document.getElementById('btn-view-history').addEventListener('click', () => {
            this.navigateTo('data');
            this.updateNavigation('data');
            this.renderDataPage();
        });

        // 设置页面
        document.getElementById('setting-sound').addEventListener('change', (e) => {
            AudioManager.setEnabled(e.target.checked);
        });
        document.getElementById('setting-eye-care').addEventListener('change', (e) => {
            document.body.classList.toggle('eye-care-mode', e.target.checked);
            const settings = Storage.getSettings();
            settings.eyeCareMode = e.target.checked;
            Storage.saveSettings(settings);
        });

        // 家长设置入口
        document.getElementById('btn-parent-settings').addEventListener('click', () => {
            this.showParentModal();
        });

        // 家长弹窗关闭
        document.getElementById('btn-close-parent').addEventListener('click', () => {
            this.hideParentModal();
        });

        // 儿童表单提交
        document.getElementById('child-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveChild();
        });

        // 关闭儿童弹窗
        document.getElementById('btn-close-child-modal').addEventListener('click', () => {
            this.hideChildModal();
        });

        // 暂停弹窗按钮
        document.getElementById('btn-resume-training').addEventListener('click', () => {
            this.verifyAndResume();
        });
        document.getElementById('btn-end-training').addEventListener('click', () => {
            this.endTrainingEarly();
        });

        // 休息提醒关闭
        document.getElementById('btn-dismiss-rest').addEventListener('click', () => {
            this.hideRestModal();
        });

        // 密码输入框自动跳转
        document.querySelectorAll('.pwd-digit').forEach((input, index, inputs) => {
            input.addEventListener('input', () => {
                if (input.value.length === 1 && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    inputs[index - 1].focus();
                }
            });
        });

        // 家长密码验证
        document.getElementById('btn-verify-password')?.addEventListener('click', () => {
            this.verifyParentPassword();
        });

        // 保存家长设置
        document.getElementById('btn-save-parent-settings').addEventListener('click', () => {
            this.saveParentSettings();
        });

        // 家长后台添加儿童
        document.getElementById('btn-parent-add-child').addEventListener('click', () => {
            this.hideParentModal();
            this.showAddChildModal();
        });
    },

    // ========================================
    // 页面导航
    // ========================================
    navigateTo(pageId) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.state.currentPage = pageId;

            // 根据页面渲染内容
            switch (pageId) {
                case 'home':
                    this.renderHomePage();
                    break;
                case 'difficulty':
                    this.renderDifficultyPage();
                    break;
                case 'interference-level':
                    // 干扰级别选择页面已在 renderInterferenceLevelPage 中渲染
                    break;
                case 'data':
                    this.renderDataPage();
                    break;
                case 'achievements':
                    this.renderAchievementsPage();
                    break;
                case 'settings':
                    // 设置页面是静态的，无需额外渲染
                    break;
            }
        }
    },

    updateNavigation(activePage) {
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === activePage);
        });
    },

    // ========================================
    // 首页渲染
    // ========================================
    renderHomePage() {
        this.renderChildList();

        // 如果已选择儿童，显示模式选择
        if (this.state.selectedChild) {
            document.getElementById('mode-select').classList.remove('hidden');
        } else {
            document.getElementById('mode-select').classList.add('hidden');
        }
    },

    /**
     * 渲染儿童列表
     */
    renderChildList() {
        const container = document.getElementById('child-list');
        const children = Storage.getChildren();

        if (children.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted" style="padding: 20px;">
                    <p>还没有添加儿童档案</p>
                    <p class="mt-md">点击下方按钮添加</p>
                </div>
            `;
            return;
        }

        container.innerHTML = children.map(child => `
            <div class="child-card ${this.state.selectedChild?.id === child.id ? 'selected' : ''}"
                 data-child-id="${child.id}">
                <div class="child-avatar">${this.getAvatarEmoji(child.name)}</div>
                <span class="child-name">${child.name}</span>
                <span class="child-age">${child.age}岁</span>
            </div>
        `).join('');

        // 绑定点击事件
        container.querySelectorAll('.child-card').forEach(card => {
            card.addEventListener('click', () => {
                const childId = card.dataset.childId;
                this.selectChild(childId);
            });
        });
    },

    getAvatarEmoji(name) {
        const emojis = ['👦', '👧', '🧒', '👶', '🧑', '👱', '👩', '🧔'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return emojis[Math.abs(hash) % emojis.length];
    },

    /**
     * 选择儿童
     */
    selectChild(childId) {
        const children = Storage.getChildren();
        const child = children.find(c => c.id === childId);

        if (child) {
            this.state.selectedChild = child;
            Storage.setActiveChildId(childId);
            this.loadUnlockedSizes();
            this.renderHomePage();
            AudioManager.playClick();
        }
    },

    /**
     * 选择训练模式
     */
    selectMode(mode) {
        this.state.currentMode = mode;
        this.state.interferenceLevel = 0; // 重置干扰级别
        AudioManager.playClick();

        if (mode === 'interference') {
            // 干扰模式：先选难度，再选干扰级别
            this.navigateTo('difficulty');
        } else {
            this.navigateTo('difficulty');
        }
    },

    // ========================================
    // 难度选择页
    // ========================================
    renderDifficultyPage() {
        const container = document.getElementById('difficulty-grid');

        const difficulties = [];
        for (let size = 3; size <= 9; size++) {
            difficulties.push({
                size: size,
                label: `${size}×${size}`,
                unlocked: this.state.unlockedSizes.includes(size),
            });
        }

        container.innerHTML = difficulties.map(d => `
            <button class="difficulty-btn ${d.unlocked ? '' : 'locked'}"
                    data-size="${d.size}"
                    ${d.unlocked ? '' : 'disabled'}>
                <span class="difficulty-size">${d.label}</span>
                <span class="difficulty-label">${d.unlocked ? '点击开始' : '未解锁'}</span>
            </button>
        `).join('');

        // 绑定事件
        container.querySelectorAll('.difficulty-btn:not(.locked)').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                AudioManager.playClick();

                if (this.state.currentMode === 'interference') {
                    // 干扰模式：先保存难度，再显示干扰级别选择
                    this.state.currentDifficulty = size;
                    this.renderInterferenceLevelPage();
                    this.navigateTo('interference-level');
                } else {
                    this.startTraining(size);
                }
            });
        });
    },

    /**
     * 渲染干扰级别选择页面
     */
    renderInterferenceLevelPage() {
        const container = document.getElementById('interference-level-grid');

        // 绑定返回按钮
        const backBtn = document.getElementById('btn-back-to-difficulty');
        backBtn.onclick = () => {
            AudioManager.playClick();
            this.navigateTo('difficulty');
        };

        // 绑定级别选择按钮
        container.querySelectorAll('.interference-level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const level = parseInt(btn.dataset.level);
                this.state.interferenceLevel = level;
                AudioManager.playClick();
                this.startTraining(this.state.currentDifficulty);
            });
        });
    },

    // ========================================
    // 训练核心逻辑
    // ========================================

    /**
     * 开始训练
     */
    startTraining(gridSize) {
        this.state.currentDifficulty = gridSize;
        this.state.totalCells = gridSize * gridSize;
        this.state.currentTarget = 1;
        this.state.correctCount = 0;
        this.state.errorCount = 0;
        this.state.elapsedTime = 0;
        this.state.isPaused = false;
        this.state.isTraining = true;
        this.state.restReminderShown = false; // 重置休息提醒状态

        // 生成随机数字
        this.state.gridNumbers = this.generateGridNumbers(gridSize);

        // 切换到训练页
        this.navigateTo('training');

        // 更新标签
        const modeLabel = this.state.currentMode === 'classic' ? '经典模式' : '干扰强化';
        document.getElementById('training-mode-label').textContent = modeLabel;
        document.getElementById('training-difficulty-label').textContent =
            `${gridSize}×${gridSize}`;

        // 重置计时器显示
        document.getElementById('timer-display').textContent = '00:00.0';
        document.getElementById('current-target').textContent = '1';

        // 渲染方格
        this.renderGrid(gridSize);

        // 添加训练状态样式
        document.body.classList.add('training-active');

        // 如果是干扰模式，添加干扰样式类和指示器
        if (this.state.currentMode === 'interference' && this.state.interferenceLevel > 0) {
            document.body.classList.add('interference-mode', `interference-level-${this.state.interferenceLevel}`);
            this.showInterferenceIndicator();
        }

        // 开始倒计时
        this.startCountdown();
    },

    /**
     * 生成随机数字数组 1-N²
     */
    generateGridNumbers(size) {
        const total = size * size;
        const numbers = [];
        for (let i = 1; i <= total; i++) {
            numbers.push(i);
        }
        // Fisher-Yates 洗牌算法
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        return numbers;
    },

    /**
     * 渲染舒尔特方格
     */
    renderGrid(size) {
        const container = document.getElementById('schulte-grid');
        container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

        // 根据尺寸调整字体大小
        let fontSize = 'var(--font-size-xl)';
        if (size >= 7) fontSize = 'var(--font-size-lg)';
        if (size >= 8) fontSize = 'var(--font-size-base)';

        container.innerHTML = this.state.gridNumbers.map((num, index) => `
            <div class="grid-cell" data-number="${num}" data-index="${index}"
                 style="font-size: ${fontSize}">
                ${num}
            </div>
        `).join('');

        // 绑定点击事件
        container.querySelectorAll('.grid-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                this.handleCellClick(cell);
            });
        });
    },

    /**
     * 高亮当前目标数字所在的格子
     */
    highlightCurrentTarget() {
        // 移除之前的高亮
        document.querySelectorAll('.grid-cell.current-target').forEach(cell => {
            cell.classList.remove('current-target');
        });

        // 添加新的高亮
        const targetCell = document.querySelector(`.grid-cell[data-number="${this.state.currentTarget}"]`);
        if (targetCell && !targetCell.classList.contains('correct')) {
            targetCell.classList.add('current-target');
        }
    },

    /**
     * 处理格子点击
     */
    handleCellClick(cell) {
        if (!this.state.isTraining || this.state.isPaused) return;
        if (cell.classList.contains('correct') || cell.classList.contains('disabled')) return;

        const clickedNumber = parseInt(cell.dataset.number);

        if (clickedNumber === this.state.currentTarget) {
            // 正确！
            this.handleCorrectClick(cell);
        } else {
            // 错误
            this.handleErrorClick(cell);
        }
    },

    /**
     * 处理正确点击
     */
    handleCorrectClick(cell) {
        // 防止重复点击同一个格子
        if (cell.classList.contains('correct')) return;

        cell.classList.add('correct');
        cell.classList.remove('current-target');

        // 干扰模式下保持背景色不变（增加难度），经典模式恢复原始背景
        if (this.state.currentMode !== 'interference') {
            cell.style.backgroundColor = '';
        }

        this.state.correctCount++;
        this.state.currentTarget++;

        // 更新目标提示（醒目显示 + 动画反馈）
        const targetEl = document.getElementById('current-target');
        targetEl.textContent = this.state.currentTarget;
        // 重新触发脉冲动画，让数字变化更明显
        targetEl.style.animation = 'none';
        targetEl.offsetHeight; // 触发 reflow
        targetEl.style.animation = 'targetPulse 0.5s ease';

        // 播放正确音效
        AudioManager.playCorrect();

        // 不再高亮下一个目标格子，保持无提示状态

        // 检查是否完成（双重检查：状态计数 + DOM 元素数量）
        const allCells = document.querySelectorAll('.grid-cell');
        const correctCells = document.querySelectorAll('.grid-cell.correct');
        if (this.state.currentTarget > this.state.totalCells || correctCells.length >= this.state.totalCells) {
            this.completeTraining();
        }
    },

    /**
     * 处理错误点击
     */
    handleErrorClick(cell) {
        cell.classList.add('error');
        this.state.errorCount++;

        // 移除错误样式（允许继续）
        setTimeout(() => {
            cell.classList.remove('error');
        }, 400);

        // 播放错误音效
        AudioManager.playError();
    },

    /**
     * 开始倒计时
     */
    startCountdown() {
        const overlay = document.getElementById('countdown-overlay');
        const numberEl = document.getElementById('countdown-number');
        overlay.classList.remove('hidden');

        let count = 3;
        numberEl.textContent = count;
        AudioManager.playCountdown();

        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                numberEl.textContent = count;
                AudioManager.playCountdown();
            } else {
                clearInterval(countdownInterval);
                overlay.classList.add('hidden');
                this.startTimer();
            }
        }, 1000);
    },

    /**
     * 开始计时
     */
    startTimer() {
        this.state.startTime = Date.now();

        // 如果是干扰模式，启动干扰效果
        if (this.state.currentMode === 'interference' && this.state.interferenceLevel > 0) {
            this.startInterferenceEffects();
        }

        this.state.timer = setInterval(() => {
            if (!this.state.isPaused) {
                this.state.elapsedTime = Date.now() - this.state.startTime;
                this.updateTimerDisplay();

                // 检查休息提醒
                this.checkRestReminder();
            }
        }, 100); // 每100ms更新一次，确保精度
    },

    /**
     * 更新计时器显示
     */
    updateTimerDisplay() {
        const display = document.getElementById('timer-display');
        display.textContent = this.formatTime(this.state.elapsedTime);
    },

    /**
     * 格式化时间显示
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((ms % 1000) / 100);

        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
    },

    /**
     * 检查休息提醒 - 仅在连续训练达到设定时间时触发一次
     */
    checkRestReminder() {
        const parentSettings = Storage.getParentSettings();
        if (!parentSettings.restReminderEnabled) return;
        if (this.state.restReminderShown) return; // 本次训练已提醒过，不再重复

        const intervalMs = parentSettings.restIntervalMinutes * 60 * 1000;
        // 只有当累计训练时间达到或超过设定间隔时才触发
        if (this.state.elapsedTime >= intervalMs) {
            this.state.restReminderShown = true; // 标记已提醒
            this.showRestModal();
        }
    },

    // ========================================
    // 干扰强化模式核心逻辑
    // ========================================

    /**
     * 显示干扰级别指示器
     */
    showInterferenceIndicator() {
        // 移除已有的指示器
        const existing = document.querySelector('.interference-indicator');
        if (existing) existing.remove();

        const levelNames = ['', '初级', '中级', '高级'];
        const indicator = document.createElement('div');
        indicator.className = `interference-indicator level-${this.state.interferenceLevel}`;
        indicator.textContent = `🌪️ 干扰 ${levelNames[this.state.interferenceLevel]}`;
        document.body.appendChild(indicator);
    },

    /**
     * 启动干扰效果
     */
    startInterferenceEffects() {
        const level = this.state.interferenceLevel;

        // 初级干扰：每个格子单独的彩色背景（儿童友好马卡龙色）
        if (level >= 1) {
            this.startCellColorInterference(level === 1 ? 3000 : 1500);
        }

        // 视觉干扰：数字闪烁（中级及以上）
        if (level >= 2) {
            this.startNumberFlicker(level === 3 ? 800 : 1200); // 高级更频繁
        }

        // 听觉干扰：白噪音（中级及以上）
        if (level >= 2) {
            this.startWhiteNoise(level === 3 ? 0.08 : 0.05); // 高级音量稍大
        }
    },

    /**
     * 停止所有干扰效果
     */
    stopInterferenceEffects() {
        // 清除所有视觉干扰定时器
        this.state.interferenceTimers.forEach(timer => clearInterval(timer));
        this.state.interferenceTimers = [];

        // 恢复所有格子的背景色
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.style.backgroundColor = '';
            cell.classList.remove('flickering');
        });

        // 立即停止白噪音（不使用延迟，防止页面切换时 setTimeout 被挂起）
        if (this.state.noiseGainNode) {
            try {
                // 立即将音量设为0
                this.state.noiseGainNode.gain.cancelScheduledValues(0);
                this.state.noiseGainNode.gain.value = 0;
            } catch(e) {}
        }

        if (this.state.noiseAudioNode) {
            try { this.state.noiseAudioNode.stop(); } catch(e) {}
            try { this.state.noiseAudioNode.disconnect(); } catch(e) {}
            this.state.noiseAudioNode = null;
        }

        if (this.state.noiseGainNode) {
            try { this.state.noiseGainNode.disconnect(); } catch(e) {}
            this.state.noiseGainNode = null;
        }

        // 关闭 AudioContext 释放资源
        if (this.state.noiseAudioContext) {
            try { this.state.noiseAudioContext.close(); } catch(e) {}
            this.state.noiseAudioContext = null;
        }
    },

    /**
     * 启动数字闪烁效果
     * @param {number} interval - 闪烁间隔（毫秒）
     */
    startNumberFlicker(interval) {
        const flickerTimer = setInterval(() => {
            if (!this.state.isTraining || this.state.isPaused) return;

            const cells = document.querySelectorAll('.grid-cell:not(.correct)');
            if (cells.length === 0) return;

            // 随机选择 1-3 个格子进行闪烁
            const count = Math.min(3, cells.length, Math.ceil(cells.length / 4));
            const shuffled = Array.from(cells).sort(() => Math.random() - 0.5);

            for (let i = 0; i < count; i++) {
                const cell = shuffled[i];
                cell.classList.add('flickering');
                setTimeout(() => cell.classList.remove('flickering'), 500);
            }
        }, interval);

        this.state.interferenceTimers.push(flickerTimer);
    },

    /**
     * 启动方格底色干扰（初级及以上）
     * 每个格子单独显示不同的儿童友好马卡龙色块
     * @param {number} interval - 颜色更换间隔（毫秒）
     */
    startCellColorInterference(interval) {
        // 儿童友好的马卡龙色系（低饱和度、柔和）
        const pastelColors = [
            '#FFE4E1', // 薄荷红（ Misty Rose）
            '#E0FFE0', // 薄荷绿（Honeydew）
            '#E0E8FF', // 薄荷蓝（Alice Blue）
            '#FFF0E0', // 薄荷橙（Papaya Whip）
            '#F0E0FF', // 薄荷紫（Lavender Blush）
            '#FFFFD0', // 薄荷黄（Light Goldenrod）
            '#E0FFFF', // 薄荷青（Azure）
            '#FFE0F0', // 薄荷粉（Lavender Blush Pink）
        ];

        const colorTimer = setInterval(() => {
            if (!this.state.isTraining) return;

            const cells = document.querySelectorAll('.grid-cell:not(.correct)');
            if (cells.length === 0) return;

            // 为每个未完成的格子随机分配一个马卡龙色
            cells.forEach(cell => {
                const randomColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
                cell.style.backgroundColor = randomColor;
                // 添加平滑过渡动画
                cell.style.transition = 'background-color 0.5s ease';
            });
        }, interval);

        this.state.interferenceTimers.push(colorTimer);
    },

    /**
     * 启动白噪音背景音
     * @param {number} volume - 音量 (0-1)
     */
    startWhiteNoise(volume) {
        try {
            // 复用或创建 AudioContext（保存引用以便后续关闭）
            if (!this.state.noiseAudioContext || this.state.noiseAudioContext.state === 'closed') {
                this.state.noiseAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const audioContext = this.state.noiseAudioContext;
            const bufferSize = 2 * audioContext.sampleRate;
            const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const output = noiseBuffer.getChannelData(0);

            // 生成白噪音数据
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            // 创建音频节点
            this.state.noiseAudioNode = audioContext.createBufferSource();
            this.state.noiseAudioNode.buffer = noiseBuffer;
            this.state.noiseAudioNode.loop = true;

            this.state.noiseGainNode = audioContext.createGain();
            this.state.noiseGainNode.gain.value = 0; // 从静音开始，淡入
            this.state.noiseGainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 1);

            // 连接节点：noise -> gain -> destination
            this.state.noiseAudioNode.connect(this.state.noiseGainNode);
            this.state.noiseGainNode.connect(audioContext.destination);

            // 开始播放
            this.state.noiseAudioNode.start();
        } catch (e) {
            console.warn('白噪音启动失败:', e);
        }
    },

    /**
     * 完成训练
     */
    completeTraining() {
        // 停止计时
        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }

        // 停止所有干扰效果
        this.stopInterferenceEffects();

        this.state.isTraining = false;
        document.body.classList.remove('training-active');
        document.body.classList.remove('interference-mode', 'interference-level-1', 'interference-level-2', 'interference-level-3');

        // 移除干扰指示器
        const indicator = document.querySelector('.interference-indicator');
        if (indicator) indicator.remove();

        // 计算统计数据
        const totalTime = this.state.elapsedTime;
        const accuracy = Math.round((this.state.correctCount / (this.state.correctCount + this.state.errorCount)) * 100);
        const speed = (this.state.correctCount / (totalTime / 1000)).toFixed(1);

        // 保存训练记录（包含干扰级别信息）
        const record = {
            childId: this.state.selectedChild?.id,
            mode: this.state.currentMode,
            gridSize: this.state.currentDifficulty,
            interferenceLevel: this.state.interferenceLevel, // 干扰级别
            time: totalTime,
            errors: this.state.errorCount,
            accuracy: accuracy,
            speed: parseFloat(speed),
        };

        // 添加记录（这会自动处理打卡、最佳成绩、勋章检查）
        Storage.addTrainingRecord(record);

        // 检查是否新纪录
        const isNewRecord = Storage.updateBestScore(
            this.state.selectedChild?.id,
            record
        );

        // 检查新获得的勋章
        const newBadges = Storage.checkAndAwardBadges(
            this.state.selectedChild?.id,
            record
        );

        // 播放完成音效
        AudioManager.playComplete();

        // 如果是新纪录或获得勋章，播放额外音效
        if (isNewRecord || newBadges.length > 0) {
            setTimeout(() => AudioManager.playAchievement(), 500);
        }

        // 显示结果页
        this.showResultPage({
            time: totalTime,
            errors: this.state.errorCount,
            accuracy: accuracy,
            speed: speed,
            isNewRecord: isNewRecord,
            newBadges: newBadges,
        });

        // 重新加载解锁状态（可能解锁了新难度）
        this.loadUnlockedSizes();
    },

    /**
     * 显示结果页
     */
    showResultPage(result) {
        this.navigateTo('result');

        // 填充数据
        document.getElementById('result-time').textContent = this.formatTime(result.time);
        document.getElementById('result-errors').textContent = result.errors;
        document.getElementById('result-accuracy').textContent = `${result.accuracy}%`;
        document.getElementById('result-speed').textContent = result.speed;

        // 对比信息
        const bestScores = Storage.getBestScores(this.state.selectedChild?.id);
        const key = `${this.state.currentMode}_${this.state.currentDifficulty}`;
        const best = bestScores[key];

        if (best) {
            document.getElementById('result-best').textContent = this.formatTime(best.time);
        } else {
            document.getElementById('result-best').textContent = '--';
        }

        const avgTime = Storage.getAverageTime(
            this.state.selectedChild?.id,
            this.state.currentMode,
            this.state.currentDifficulty
        );
        document.getElementById('result-average').textContent =
            avgTime ? this.formatTime(avgTime) : '--';

        // 新纪录提示
        const recordBanner = document.getElementById('new-record-banner');
        if (result.isNewRecord) {
            recordBanner.classList.remove('hidden');
        } else {
            recordBanner.classList.add('hidden');
        }

        // 勋章获得提示
        const badgeEarned = document.getElementById('badge-earned');
        if (result.newBadges && result.newBadges.length > 0) {
            const badgeDefs = Storage.BADGE_DEFINITIONS;
            const badgeNames = result.newBadges.map(id =>
                badgeDefs[id] ? badgeDefs[id].name : id
            ).join('、');

            badgeEarned.innerHTML = `🏆 获得勋章：${badgeNames}`;
            badgeEarned.classList.remove('hidden');
        } else {
            badgeEarned.classList.add('hidden');
        }
    },

    /**
     * 暂停训练
     */
    pauseTraining() {
        this.state.isPaused = true;
        this.showPauseModal();
    },

    /**
     * 验证密码并恢复训练
     */
    verifyAndResume() {
        const pwd = this.getPasswordFromInputs('pause-pwd');
        if (Storage.verifyParentPassword(pwd)) {
            this.hidePauseModal();
            this.state.isPaused = false;
            this.clearPasswordInputs('pause-pwd');
        } else {
            alert('密码错误，请重试');
            this.clearPasswordInputs('pause-pwd');
        }
    },

    /**
     * 提前结束训练
     */
    endTrainingEarly() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }

        // 停止所有干扰效果
        this.stopInterferenceEffects();

        this.state.isTraining = false;
        this.state.isPaused = false;
        document.body.classList.remove('training-active');
        document.body.classList.remove('interference-mode', 'interference-level-1', 'interference-level-2', 'interference-level-3');

        // 移除干扰指示器
        const indicator = document.querySelector('.interference-indicator');
        if (indicator) indicator.remove();

        // 恢复格子背景色
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.style.backgroundColor = '';
            cell.classList.remove('flickering');
        });

        this.hidePauseModal();
        this.navigateTo('home');
    },

    // ========================================
    // 数据中心页面
    // ========================================
    renderDataPage() {
        const childId = this.state.selectedChild?.id;

        // 概览数据
        document.getElementById('today-count').textContent = Storage.getTodayCount(childId);
        document.getElementById('week-count').textContent = Storage.getWeekCount(childId);
        document.getElementById('total-count').textContent = Storage.getTotalCount(childId);
        document.getElementById('streak-days').textContent = Storage.getStreakDays(childId);

        // 最佳成绩榜
        this.renderBestScores(childId);

        // 最近训练记录
        this.renderHistory(childId);
    },

    /**
     * 渲染最佳成绩榜
     */
    renderBestScores(childId) {
        const container = document.getElementById('best-scores');
        const bestScores = Storage.getBestScores(childId);

        const sortedScores = Object.entries(bestScores)
            .sort((a, b) => {
                const sizeA = parseInt(a[0].split('_')[1]);
                const sizeB = parseInt(b[0].split('_')[1]);
                return sizeA - sizeB;
            });

        if (sortedScores.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">暂无记录，快去训练吧！</p>';
            return;
        }

        container.innerHTML = sortedScores.map(([key, score]) => {
            const [mode, size] = key.split('_');
            const modeName = this.getModeDisplayName(mode);
            return `
                <div class="score-item">
                    <span class="score-difficulty">${modeName} ${size}×${size}</span>
                    <span class="score-time">${this.formatTime(score.time)}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * 渲染最近训练记录
     */
    renderHistory(childId) {
        const container = document.getElementById('training-history');
        const records = Storage.getTrainingRecords(childId);

        // 按时间倒序，取最近20条
        const recentRecords = records.slice(-20).reverse();

        if (recentRecords.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">暂无训练记录</p>';
            return;
        }

        container.innerHTML = recentRecords.map(record => {
            const date = new Date(record.createdAt);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

            return `
                <div class="history-item">
                    <div>
                        <span class="history-date">${dateStr} ${timeStr}</span>
                        <span class="history-details">
                            ${this.getModeDisplayName(record.mode)}
                            ${record.gridSize}×${record.gridSize}
                            ${record.interferenceLevel > 0 ? ` L${record.interferenceLevel}` : ''}
                        </span>
                    </div>
                    <div class="history-details">
                        <span class="history-time">${this.formatTime(record.time)}</span>
                        <span class="history-accuracy">${record.accuracy}%</span>
                        ${record.errors > 0 ? `<span>错${record.errors}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    // ========================================
    // 勋章墙页面
    // ========================================
    renderAchievementsPage() {
        const childId = this.state.selectedChild?.id;

        // 打卡日历
        this.renderCheckinCalendar(childId);

        // 勋章列表
        this.renderBadgeList(childId);
    },

    /**
     * 渲染打卡日历
     */
    renderCheckinCalendar(childId) {
        const container = document.getElementById('checkin-calendar');
        const checkins = Storage.getCheckins(childId);
        const today = new Date();

        // 获取当月信息
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0=周日

        // 表头
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        let html = weekDays.map(day =>
            `<div class="calendar-header">${day}</div>`
        ).join('');

        // 空白填充
        for (let i = 0; i < startDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // 日期
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isChecked = checkins[dateStr];
            const isToday = day === today.getDate();

            html += `
                <div class="calendar-day ${isChecked ? 'checked' : ''} ${isToday ? 'today' : ''}">
                    ${day}
                </div>
            `;
        }

        container.innerHTML = html;
    },

    /**
     * 渲染勋章列表
     */
    renderBadgeList(childId) {
        const container = document.getElementById('badge-list');
        const earnedBadges = Storage.getBadges(childId);
        const allBadges = Object.values(Storage.BADGE_DEFINITIONS);

        container.innerHTML = allBadges.map(badge => {
            const isUnlocked = earnedBadges.includes(badge.id);
            return `
                <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}">
                    <span class="badge-icon">${badge.icon}</span>
                    <span class="badge-name">${badge.name}</span>
                    <span class="badge-desc">${badge.description}</span>
                </div>
            `;
        }).join('');
    },

    // ========================================
    // 弹窗/模态框管理
    // ========================================

    /**
     * 显示添加/编辑儿童弹窗
     */
    showAddChildModal(editChild = null) {
        const modal = document.getElementById('child-modal');
        const title = document.getElementById('child-modal-title');
        const form = document.getElementById('child-form');

        title.textContent = editChild ? '编辑儿童' : '添加儿童';
        form.reset();

        if (editChild) {
            document.getElementById('child-name').value = editChild.name;
            document.getElementById('child-age').value = editChild.age;
            form.dataset.editId = editChild.id;
        } else {
            delete form.dataset.editId;
        }

        modal.classList.remove('hidden');
    },

    hideChildModal() {
        document.getElementById('child-modal').classList.add('hidden');
    },

    /**
     * 保存儿童信息
     */
    saveChild() {
        const name = document.getElementById('child-name').value.trim();
        const age = parseInt(document.getElementById('child-age').value);

        if (!name || !age || age < 7 || age > 12) {
            alert('请填写正确的姓名和年龄（7-12岁）');
            return;
        }

        const form = document.getElementById('child-form');
        const editId = form.dataset.editId;

        if (editId) {
            // 编辑现有儿童
            Storage.updateChild(editId, { name, age });
            if (this.state.selectedChild?.id === editId) {
                this.state.selectedChild = { ...this.state.selectedChild, name, age };
            }
        } else {
            // 添加新儿童
            const child = Storage.addChild({ name, age });
            if (!this.state.selectedChild) {
                this.selectChild(child.id);
            }
        }

        this.hideChildModal();
        this.renderHomePage();
        AudioManager.playClick();
    },

    /**
     * 显示家长管理后台
     */
    showParentModal() {
        const modal = document.getElementById('parent-modal');
        modal.classList.remove('hidden');

        // 重置到密码验证界面
        document.getElementById('parent-password-section').classList.remove('hidden');
        document.getElementById('parent-settings-section').classList.add('hidden');
        this.clearPasswordInputs('pwd');

        // 加载当前设置
        this.loadParentSettingsToForm();
    },

    hideParentModal() {
        document.getElementById('parent-modal').classList.add('hidden');
    },

    /**
     * 验证家长密码
     */
    verifyParentPassword() {
        const pwd = this.getPasswordFromInputs('pwd');
        if (Storage.verifyParentPassword(pwd)) {
            // 验证通过，显示设置界面
            document.getElementById('parent-password-section').classList.add('hidden');
            document.getElementById('parent-settings-section').classList.remove('hidden');
            this.clearPasswordInputs('pwd');
        } else {
            alert('密码错误');
            this.clearPasswordInputs('pwd');
        }
    },

    /**
     * 加载家长设置到表单
     */
    loadParentSettingsToForm() {
        const settings = Storage.getParentSettings();

        document.getElementById('setting-daily-limit').value = settings.dailyLimitMinutes;
        document.getElementById('setting-unlock-mode').value = settings.unlockMode;
        document.getElementById('setting-rest-reminder').checked = settings.restReminderEnabled;
        document.getElementById('setting-rest-interval').value = settings.restIntervalMinutes;

        // 渲染儿童列表（家长后台用）
        this.renderParentChildList();
    },

    /**
     * 渲染家长后台的儿童列表
     */
    renderParentChildList() {
        const container = document.getElementById('parent-child-list');
        const children = Storage.getChildren();

        if (children.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无儿童档案</p>';
            return;
        }

        container.innerHTML = children.map(child => `
            <div class="parent-child-item">
                <span>${child.name} (${child.age}岁)</span>
                <button class="btn btn-sm btn-secondary" onclick="App.deleteChild('${child.id}')">删除</button>
            </div>
        `).join('');
    },

    /**
     * 删除儿童（从家长后台）
     */
    deleteChild(childId) {
        if (confirm('确定要删除该儿童档案吗？相关训练数据也会被删除。')) {
            Storage.removeChild(childId);
            if (this.state.selectedChild?.id === childId) {
                this.state.selectedChild = null;
            }
            this.loadParentSettingsToForm();
            this.renderHomePage();
        }
    },

    /**
     * 保存家长设置
     */
    saveParentSettings() {
        const settings = Storage.getParentSettings();
        settings.dailyLimitMinutes = parseInt(document.getElementById('setting-daily-limit').value);
        settings.unlockMode = document.getElementById('setting-unlock-mode').value;
        settings.restReminderEnabled = document.getElementById('setting-rest-reminder').checked;
        settings.restIntervalMinutes = parseInt(document.getElementById('setting-rest-interval').value);

        Storage.saveParentSettings(settings);
        alert('设置已保存');
        this.hideParentModal();
    },

    /**
     * 显示暂停弹窗
     */
    showPauseModal() {
        document.getElementById('pause-modal').classList.remove('hidden');
        this.clearPasswordInputs('pause-pwd');
    },

    hidePauseModal() {
        document.getElementById('pause-modal').classList.add('hidden');
    },

    /**
     * 显示休息提醒弹窗
     */
    showRestModal() {
        const modal = document.getElementById('rest-modal');
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            this.startRestTimer();
        }
    },

    hideRestModal() {
        document.getElementById('rest-modal').classList.add('hidden');
    },

    /**
     * 休息倒计时
     */
    startRestTimer() {
        let seconds = 20;
        const display = document.getElementById('rest-timer');
        display.textContent = seconds;

        const interval = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(interval);
                display.textContent = '0';
            } else {
                display.textContent = seconds;
            }
        }, 1000);
    },

    // ========================================
    // 工具方法
    // ========================================

    /**
     * 获取模式显示名称
     */
    getModeDisplayName(mode) {
        const names = {
            'classic': '经典',
            'interference': '干扰',
            'challenge': '闯关',
            'custom': '自定义'
        };
        return names[mode] || mode;
    },

    /**
     * 从密码输入框获取密码字符串
     */
    getPasswordFromInputs(prefix) {
        let pwd = '';
        for (let i = 1; i <= 4; i++) {
            const input = document.getElementById(`${prefix}-${i}`);
            if (input) pwd += input.value;
        }
        return pwd;
    },

    /**
     * 清空密码输入框
     */
    clearPasswordInputs(prefix) {
        for (let i = 1; i <= 4; i++) {
            const input = document.getElementById(`${prefix}-${i}`);
            if (input) {
                input.value = '';
                if (i === 1) input.focus();
            }
        }
    },
};

// ========================================
// 启动应用
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
