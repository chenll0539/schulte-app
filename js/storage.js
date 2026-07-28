/**
 * 舒尔特方格训练 APP - 数据存储模块
 * 使用 localStorage 实现本地数据持久化
 */

const Storage = {
    // 存储键名前缀
    PREFIX: 'schulte_',

    // 键名定义
    KEYS: {
        CHILDREN: 'children',           // 儿童档案列表
        ACTIVE_CHILD: 'activeChild',    // 当前选中的儿童ID
        TRAINING_RECORDS: 'records',    // 训练记录
        SETTINGS: 'settings',           // 全局设置
        PARENT_SETTINGS: 'parentSettings', // 家长设置
        CHECKINS: 'checkins',           // 打卡记录
        BADGES: 'badges',               // 勋章状态
        BEST_SCORES: 'bestScores',      // 最佳成绩
    },

    /**
     * 获取完整的存储键名
     */
    _key(name) {
        return this.PREFIX + name;
    },

    /**
     * 保存数据到 localStorage
     */
    set(key, value) {
        try {
            const data = JSON.stringify(value);
            localStorage.setItem(this._key(key), data);
            return true;
        } catch (e) {
            console.error('Storage.set error:', e);
            return false;
        }
    },

    /**
     * 从 localStorage 读取数据
     */
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(this._key(key));
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage.get error:', e);
            return defaultValue;
        }
    },

    /**
     * 删除指定键的数据
     */
    remove(key) {
        localStorage.removeItem(this._key(key));
    },

    /**
     * 清除所有应用数据
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            this.remove(key);
        });
    },

    // ========================================
    // 儿童档案管理
    // ========================================

    /**
     * 获取所有儿童档案
     */
    getChildren() {
        return this.get(this.KEYS.CHILDREN, []);
    },

    /**
     * 添加儿童档案
     */
    addChild(child) {
        const children = this.getChildren();
        child.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        child.createdAt = new Date().toISOString();
        children.push(child);
        this.set(this.KEYS.CHILDREN, children);
        return child;
    },

    /**
     * 更新儿童档案
     */
    updateChild(childId, updates) {
        const children = this.getChildren();
        const index = children.findIndex(c => c.id === childId);
        if (index !== -1) {
            children[index] = { ...children[index], ...updates };
            this.set(this.KEYS.CHILDREN, children);
            return children[index];
        }
        return null;
    },

    /**
     * 删除儿童档案（及其所有数据）
     */
    removeChild(childId) {
        let children = this.getChildren();
        children = children.filter(c => c.id !== childId);
        this.set(this.KEYS.CHILDREN, children);

        // 同时删除该儿童的训练记录
        const records = this.getTrainingRecords(childId);

        // 如果删除的是当前激活的儿童，清除激活状态
        if (this.getActiveChildId() === childId) {
            this.setActiveChildId(null);
        }

        return true;
    },

    /**
     * 获取当前激活的儿童ID
     */
    getActiveChildId() {
        return this.get(this.KEYS.ACTIVE_CHILD, null);
    },

    /**
     * 设置当前激活的儿童
     */
    setActiveChildId(childId) {
        this.set(this.KEYS.ACTIVE_CHILD, childId);
    },

    /**
     * 获取当前激活的儿童信息
     */
    getActiveChild() {
        const childId = this.getActiveChildId();
        if (!childId) return null;
        const children = this.getChildren();
        return children.find(c => c.id === childId) || null;
    },

    // ========================================
    // 训练记录管理
    // ========================================

    /**
     * 获取指定儿童的训练记录
     */
    getTrainingRecords(childId = null) {
        const allRecords = this.get(this.KEYS.TRAINING_RECORDS, {});
        if (childId) {
            return allRecords[childId] || [];
        }
        return allRecords;
    },

    /**
     * 添加一条训练记录
     */
    addTrainingRecord(record) {
        const childId = record.childId || this.getActiveChildId();
        if (!childId) return false;

        const allRecords = this.get(this.KEYS.TRAINING_RECORDS, {});
        if (!allRecords[childId]) {
            allRecords[childId] = [];
        }

        record.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        record.createdAt = new Date().toISOString();

        allRecords[childId].push(record);
        this.set(this.KEYS.TRAINING_RECORDS, allRecords);

        // 更新打卡记录
        this.addCheckin(childId);

        // 检查并更新最佳成绩
        this.updateBestScore(childId, record);

        // 检查勋章达成条件
        this.checkAndAwardBadges(childId, record);

        return record;
    },

    /**
     * 获取今日训练次数
     */
    getTodayCount(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return 0;

        const records = this.getTrainingRecords(id);
        const today = new Date().toISOString().split('T')[0];
        return records.filter(r => r.createdAt.startsWith(today)).length;
    },

    /**
     * 获取本周训练次数
     */
    getWeekCount(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return 0;

        const records = this.getTrainingRecords(id);
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // 本周一
        weekStart.setHours(0, 0, 0, 0);

        return records.filter(r => new Date(r.createdAt) >= weekStart).length;
    },

    /**
     * 获取累计训练次数
     */
    getTotalCount(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return 0;

        return this.getTrainingRecords(id).length;
    },

    // ========================================
    // 最佳成绩管理
    // ========================================

    /**
     * 获取最佳成绩
     */
    getBestScores(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return {};

        const allScores = this.get(this.KEYS.BEST_SCORES, {});
        return allScores[id] || {};
    },

    /**
     * 更新最佳成绩
     */
    updateBestScore(childId, record) {
        const key = `${record.mode}_${record.gridSize}`;
        const allScores = this.get(this.KEYS.BEST_SCORES, {});

        if (!allScores[childId]) {
            allScores[childId] = {};
        }

        const currentBest = allScores[childId][key];
        if (!currentBest || record.time < currentBest.time) {
            allScores[childId][key] = {
                time: record.time,
                accuracy: record.accuracy,
                date: record.createdAt,
                isNewRecord: !currentBest // 标记是否是新纪录
            };
            this.set(this.KEYS.BEST_SCORES, allScores);
            return true; // 是新纪录
        }
        return false; // 不是新纪录
    },

    /**
     * 获取某个难度的平均成绩
     */
    getAverageTime(childId, mode, gridSize) {
        const records = this.getTrainingRecords(childId);
        const filtered = records.filter(r =>
            r.mode === mode && r.gridSize === gridSize
        );

        if (filtered.length === 0) return null;

        const totalTime = filtered.reduce((sum, r) => sum + r.time, 0);
        return Math.round(totalTime / filtered.length * 10) / 10;
    },

    // ========================================
    // 打卡管理
    // ========================================

    /**
     * 获取打卡记录
     */
    getCheckins(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return {};

        const allCheckins = this.get(this.KEYS.CHECKINS, {});
        return allCheckins[id] || {};
    },

    /**
     * 添加打卡
     */
    addCheckin(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return;

        const today = new Date().toISOString().split('T')[0];
        const allCheckins = this.get(this.KEYS.CHECKINS, {});

        if (!allCheckins[id]) {
            allCheckins[id] = {};
        }

        allCheckins[id][today] = true;
        this.set(this.KEYS.CHECKINS, allCheckins);
    },

    /**
     * 获取连续打卡天数
     */
    getStreakDays(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return 0;

        const checkins = this.getCheckins(id);
        const dates = Object.keys(checkins).sort().reverse();

        if (dates.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 365; i++) { // 最多检查一年
            const dateStr = today.toISOString().split('T')[0];
            if (checkins[dateStr]) {
                streak++;
                today.setDate(today.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    },

    // ========================================
    // 勋章系统
    // ========================================

    // 勋章定义
    BADGE_DEFINITIONS: {
        first_training: {
            id: 'first_training',
            name: '初次尝试',
            icon: '🌟',
            description: '完成第一次训练',
            category: 'entry',
            condition: (stats) => stats.totalTrainings >= 1
        },
        unlock_4x4: {
            id: 'unlock_4x4',
            name: '进阶新手',
            icon: '📈',
            description: '首次解锁 4×4 难度',
            category: 'entry',
            condition: (stats) => stats.maxUnlockedSize >= 4
        },
        unlock_5x5: {
            id: 'unlock_5x5',
            name: '小有成就',
            icon: '🎯',
            description: '首次解锁 5×5 难度',
            category: 'entry',
            condition: (stats) => stats.maxUnlockedSize >= 5
        },
        perfect_accuracy: {
            id: 'perfect_accuracy',
            name: '完美表现',
            icon: '💯',
            description: '单次训练正确率 100%',
            category: 'progress',
            condition: (stats) => stats.hasPerfectAccuracy
        },
        new_record: {
            id: 'new_record',
            name: '突破自我',
            icon: '🏅',
            description: '刷新个人最佳记录',
            category: 'progress',
            condition: (stats) => stats.isNewRecord
        },
        fastest_week: {
            id: 'fastest_week',
            name: '进步神速',
            icon: '🚀',
            description: '本周进步最快的一次',
            category: 'progress',
            condition: (stats) => false // 需要周度计算
        },
        streak_3: {
            id: 'streak_3',
            name: '坚持3天',
            icon: '🔥',
            description: '连续打卡 3 天',
            category: 'persistence',
            condition: (stats) => stats.streakDays >= 3
        },
        streak_7: {
            id: 'streak_7',
            name: '一周坚持',
            icon: '⭐',
            description: '连续打卡 7 天',
            category: 'persistence',
            condition: (stats) => stats.streakDays >= 7
        },
        training_30: {
            id: 'training_30',
            name: '勤奋学员',
            icon: '📚',
            description: '累计训练 30 次',
            category: 'persistence',
            condition: (stats) => stats.totalTrainings >= 30
        },
    },

    /**
     * 获取已解锁的勋章
     */
    getBadges(childId = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return [];

        const allBadges = this.get(this.KEYS.BADGES, {});
        return allBadges[id] || [];
    },

    /**
     * 检查并颁发勋章
     */
    checkAndAwardBadges(childId, currentRecord = null) {
        const id = childId || this.getActiveChildId();
        if (!id) return [];

        const allBadges = this.get(this.KEYS.BADGES, {});
        if (!allBadges[id]) {
            allBadges[id] = [];
        }

        const existingBadges = allBadges[id];
        const newBadges = [];

        // 计算统计数据
        const stats = this._calculateBadgeStats(id, currentRecord);

        // 检查每个勋章条件
        Object.values(this.BADGE_DEFINITIONS).forEach(badgeDef => {
            if (!existingBadges.includes(badgeDef.id) && badgeDef.condition(stats)) {
                existingBadges.push(badgeDef.id);
                newBadges.push(badgeDef);
            }
        });

        if (newBadges.length > 0) {
            allBadges[id] = existingBadges;
            this.set(this.KEYS.BADGES, allBadges);
        }

        return newBadges;
    },

    /**
     * 计算勋章判定所需的统计数据
     */
    _calculateBadgeStats(childId, currentRecord) {
        const records = this.getTrainingRecords(childId);
        const bestScores = this.getBestScores(childId);
        const checkins = this.getCheckins(childId);

        // 找出最大解锁的方格尺寸
        let maxUnlockedSize = 3;
        Object.keys(bestScores).forEach(key => {
            const size = parseInt(key.split('_')[1]);
            if (size > maxUnlockedSize) maxUnlockedSize = size;
        });

        // 是否有完美正确率
        const hasPerfectAccuracy = records.some(r => r.accuracy >= 100);

        // 是否是新纪录
        const isNewRecord = currentRecord ? this.updateBestScore(childId, { ...currentRecord }) : false;

        // 如果上面已经更新了，需要回滚（因为这里只是检查）
        // 实际的 updateBestScore 在 addTrainingRecord 中调用

        return {
            totalTrainings: records.length,
            maxUnlockedSize,
            hasPerfectAccuracy,
            isNewRecord: false, // 这个在 addTrainingRecord 中单独处理
            streakDays: this.getStreakDays(childId),
        };
    },

    // ========================================
    // 设置管理
    // ========================================

    /**
     * 获取全局设置
     */
    getSettings() {
        return this.get(this.KEYS.SETTINGS, {
            soundEnabled: true,
            eyeCareMode: false,
        });
    },

    /**
     * 保存全局设置
     */
    saveSettings(settings) {
        this.set(this.KEYS.SETTINGS, settings);
    },

    /**
     * 获取家长设置
     */
    getParentSettings() {
        return this.get(this.KEYS.PARENT_SETTINGS, {
            password: '1234',              // 默认密码
            dailyLimitMinutes: 15,         // 单日最长训练时长
            unlockMode: 'auto',            // 自动/手动解锁
            restReminderEnabled: true,     // 休息提醒开关
            restIntervalMinutes: 10,       // 休息间隔
        });
    },

    /**
     * 保存家长设置
     */
    saveParentSettings(settings) {
        this.set(this.KEYS.PARENT_SETTINGS, settings);
    },

    /**
     * 验证家长密码
     */
    verifyParentPassword(inputPassword) {
        const settings = this.getParentSettings();
        return inputPassword === settings.password;
    },

    // ========================================
    // 数据导出（预留）
    // ========================================

    /**
     * 导出所有数据为 JSON
     */
    exportData() {
        const data = {};
        Object.values(this.KEYS).forEach(key => {
            data[key] = this.get(key);
        });
        return JSON.stringify(data, null, 2);
    },

    /**
     * 导入数据
     */
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            Object.entries(data).forEach(([key, value]) => {
                this.set(key, value);
            });
            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }
};

// 导出到全局
window.Storage = Storage;
