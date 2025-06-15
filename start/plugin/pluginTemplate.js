class PluginTemplate {
    constructor() {
        // Metadata plugin - WAJIB diisi
        this.name = "template"; // Nama unik plugin (gunakan lowercase, tanpa spasi)
        this.description = "Template dasar untuk membuat plugin baru"; // Deskripsi singkat plugin
        this.version = "1.0.0"; // Versi plugin (semantic versioning)
        this.type = "command"; // Tipe plugin: 'command', 'listener', 'utility', 'middleware'

        // Dependencies plugin (untuk check compatibility)
        this.dependencies = []; // Contoh: ['baileys', 'sharp', 'axios']

        // Health status monitoring
        this.healthStatus = "ok"; // 'ok' | 'error' | 'disabled'
        this.lastHealthCheck = null;
        this.errorCount = 0;
        this.maxErrors = 5; // Max errors before marking as unhealthy

        // Konfigurasi plugin
        this.config = {
            enabled: true, // Status aktif plugin
            category: "general", // Kategori: general, fun, utility, admin, etc.
            usage: "/template [text]", // Cara penggunaan
            aliases: ["tmpl", "temp"], // Alias command (opsional)
            cooldown: 3000, // Cooldown dalam ms (opsional)
            ownerOnly: false, // Hanya owner yang bisa pakai
            groupOnly: false, // Hanya bisa dipakai di grup
            privateOnly: false, // Hanya bisa dipakai di private chat
            adminOnly: false, // Hanya admin grup yang bisa pakai
            nsfw: false, // Konten dewasa
            premium: false, // Fitur premium
            maintenance: false, // Mode maintenance
            minArgs: 0, // Minimum argumen yang diperlukan
            maxArgs: -1, // Maximum argumen (-1 = unlimited)
            expectedArgs: "<text>", // Format argumen yang diharapkan
            timeout: 30000, // Timeout execution dalam ms
            retryCount: 3 // Retry count untuk operation yang gagal
        };

        // State internal plugin
        this.state = {
            initialized: false,
            active: false,
            error: null,
            lastUsed: null,
            usageCount: 0,
            users: new Set(), // Track unique users
            lastUsedBy: new Map(), // Track last usage by user
            startTime: null,
            crashCount: 0
        };

        // Context yang disimpan dari register()
        this.context = null;

        // Data plugin yang akan di-cache
        this.data = {
            // Contoh: cache, temporary data, dll
        };

        // Timers dan intervals untuk cleanup
        this.timers = new Set();
        this.intervals = new Set();

        // Event listeners untuk cleanup
        this.eventListeners = new Map();

        // Execution queue untuk rate limiting
        this.executionQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Inisialisasi plugin saat pertama kali dimuat
     * Dipanggil oleh plugin loader sebelum plugin diaktifkan
     *
     * @param {Object} context - Context dari plugin system
     * @param {Object} context.socket - Baileys socket instance
     * @param {Object} context.messageSender - Service untuk mengirim pesan
     * @param {Object} context.config - ConfigManager instance dengan method .get()
     * @param {Object} context.store - Penyimpanan data
     * @param {Object} context.logger - Logger instance
     * @param {Object} context.utils - Utility functions
     * @returns {Promise<boolean>} - True jika berhasil, false jika gagal
     */
    async register(context) {
        try {
            // Simpan context untuk digunakan di method lain
            this.context = context;
            const { socket, messageSender, config, store, logger, utils } =
                context;

            // Log proses registrasi
            this.safeLog(
                "info",
                `Registering plugin: ${this.name} v${this.version}`
            );

            // Validasi dependencies
            await this.validateDependencies();

            // Validasi context yang diperlukan
            await this.validateContext(context);

            // Inisialisasi data plugin jika diperlukan
            await this.initData();

            // Setup event listeners jika plugin bertipe listener
            if (this.type === "listener") {
                await this.setupEventListeners(socket);
            }

            // Validasi konfigurasi plugin
            this.validateConfig();

            // Load plugin-specific configuration dari config
            this.loadPluginConfig(config);

            // Setup shutdown hook untuk cleanup
            this.registerShutdownHook();

            // Setup health monitoring
            this.setupHealthMonitoring();

            // Call onBeforeRegister hook
            await this.onBeforeRegister(context);

            // Mark sebagai initialized
            this.state.initialized = true;
            this.state.active = true;
            this.state.startTime = Date.now();
            this.healthStatus = "ok";
            this.lastHealthCheck = Date.now();

            // Call onAfterRegister hook
            await this.onAfterRegister(context);

            this.safeLog(
                "success",
                `Plugin ${this.name} registered successfully`
            );
            return true;
        } catch (error) {
            this.handleCriticalError("register", error);
            return false;
        }
    }

    /**
     * Eksekusi utama plugin ketika command dipanggil
     *
     * @param {Object} message - Pesan yang diterima dari WhatsApp
     * @param {Object} socket - Baileys socket instance
     * @param {Object} context - Context tambahan
     * @param {string} context.command - Command yang dipanggil
     * @param {Array} context.args - Argumen command
     * @param {string} context.fullText - Teks penuh pesan
     * @param {boolean} context.isGroup - Apakah dari grup
     * @param {string} context.sender - ID pengirim
     * @param {string} context.chatId - ID chat
     * @returns {Promise<boolean>} - True jika berhasil dieksekusi
     */
    async execute(message, socket, context) {
        // Validasi message kosong
        if (!message || !this.isValidMessage(message, context)) {
            this.safeLog("warn", "Invalid or empty message received");
            return false;
        }

        const executionId = this.generateExecutionId();
        const startTime = Date.now();

        try {
            // Call onBeforeExecute hook
            const beforeResult = await this.onBeforeExecute(
                message,
                socket,
                context
            );
            if (beforeResult === false) {
                return false;
            }

            // Update health check
            this.updateHealthStatus();

            // Check plugin health
            if (this.healthStatus !== "ok") {
                await this.sendErrorSafe(
                    message,
                    socket,
                    "Plugin sedang tidak sehat, coba lagi nanti"
                );
                return false;
            }

            // Update statistik usage
            this.updateUsageStats(context.sender, context.command);

            // Validasi plugin state
            if (!this.state.active) {
                await this.sendErrorSafe(
                    message,
                    socket,
                    "Plugin sedang tidak aktif"
                );
                return false;
            }

            if (this.config.maintenance) {
                await this.sendErrorSafe(
                    message,
                    socket,
                    "Plugin sedang dalam maintenance"
                );
                return false;
            }

            // Validasi permissions
            const permissionCheck = await this.checkPermissions(
                message,
                context
            );
            if (!permissionCheck.allowed) {
                await this.sendErrorSafe(
                    message,
                    socket,
                    permissionCheck.reason
                );
                return false;
            }

            // Validasi arguments
            const argsValidation = this.validateArguments(context.args);
            if (!argsValidation.valid) {
                await this.sendUsageSafe(
                    message,
                    socket,
                    argsValidation.reason
                );
                return false;
            }

            // Cooldown check
            const cooldownCheck = this.checkCooldown(
                context.sender,
                context.command
            );
            if (!cooldownCheck.allowed) {
                await this.sendErrorSafe(
                    message,
                    socket,
                    `Tunggu ${Math.ceil(
                        cooldownCheck.remaining / 1000
                    )} detik lagi`
                );
                return false;
            }

            // Setup execution timeout
            const timeoutPromise = new Promise((_, reject) => {
                const timer = setTimeout(() => {
                    reject(
                        new Error(
                            `Plugin execution timeout after ${this.config.timeout}ms`
                        )
                    );
                }, this.config.timeout);
                this.timers.add(timer);
            });

            // Execute with timeout
            const executePromise = this.executeCore(message, socket, context);
            const result = await Promise.race([executePromise, timeoutPromise]);

            // Call onAfterExecute hook
            await this.onAfterExecute(
                message,
                socket,
                context,
                result,
                Date.now() - startTime
            );

            // Log successful execution
            this.safeLog(
                "command",
                `Plugin ${this.name} executed by ${context.sender} in ${
                    Date.now() - startTime
                }ms`
            );

            // Reset error count on successful execution
            this.errorCount = Math.max(0, this.errorCount - 1);

            return result;
        } catch (error) {
            // Handle error dengan safe logging
            await this.handleExecutionError(
                error,
                message,
                socket,
                context,
                executionId
            );
            return false;
        } finally {
            // Cleanup timers
            this.cleanupTimers();
        }
    }

    /**
     * Core execution logic - Override this in your plugins
     */
    async executeCore(message, socket, context) {
        // IMPLEMENTASI LOGIKA PLUGIN DI SINI
        // ===================================

        // Contoh implementasi sederhana
        const { args, fullText } = context;
        const responseText =
            args.length > 0
                ? `Template response: ${args.join(" ")}`
                : "Halo! Ini adalah template plugin.";

        // Kirim response dengan safe method
        await this.safeReply(message, responseText);

        return true;
    }

    /**
     * Deaktivasi plugin - cleanup resources
     * Dipanggil saat plugin di-disable atau bot shutdown
     */
    async deactivate() {
        try {
            this.safeLog("info", `Deactivating plugin: ${this.name}`);

            // Mark as inactive immediately
            this.state.active = false;
            this.healthStatus = "disabled";

            // Cleanup timers dan intervals
            this.cleanupTimers();
            this.cleanupIntervals();

            // Cleanup event listeners
            await this.removeEventListeners();

            // Clear data cache
            this.data = {};

            // Clear user tracking
            this.state.users.clear();
            this.state.lastUsedBy.clear();

            // Clear execution queue
            this.executionQueue = [];

            // Reset state
            this.state.lastUsed = null;

            // Plugin-specific cleanup
            await this.cleanup();

            this.safeLog(
                "success",
                `Plugin ${this.name} deactivated successfully`
            );
        } catch (error) {
            this.safeLog(
                "error",
                `Error deactivating plugin ${this.name}:`,
                error
            );
        }
    }

    // ===============================
    // SAFE MESSAGING METHODS
    // ===============================

    /**
     * Get remote JID from message with validation
     */
    getRemoteJid(message) {
        try {
            return (
                message?.remoteJid ||
                message?.key?.remoteJid ||
                message?.m?.remoteJid ||
                null
            );
        } catch (error) {
            this.safeLog(
                "error",
                "[getRemoteJid] Gagal mengambil remoteJid:",
                error
            );
            return null;
        }
    }

    /**
     * Safe reply method with error handling
     */
    async safeReply(message, text, options = {}) {
        try {
            const remoteJid = this.getRemoteJid(message);
            if (!remoteJid || typeof text !== "string") {
                throw new Error("remoteJid atau isi pesan tidak valid");
            }

            const finalText =
                text.length > 4096
                    ? text.substring(0, 4086) + "...[cut]"
                    : text;

            const quotedMsg =
                message?.message?.key && message?.message?.message
                    ? message.message
                    : undefined;

            await this.context.messageSender.sendReply(
                remoteJid,
                finalText,
                quotedMsg,
                options
            );
            return true;
        } catch (err) {
            this.safeLog(
                "error",
                "[safeReply] ❌ Gagal mengirim balasan:",
                err
            );
            return false;
        }
    }

    /**
     * Send error message safely
     */
    async sendErrorSafe(message, socket, errorMsg, options = {}) {
        try {
            const prefix = options.prefix || "❌ Error: ";
            const fullMessage = `${prefix}${errorMsg}`;

            return await this.safeReply(message, fullMessage, options);
        } catch (error) {
            this.safeLog("error", "Failed to send error message:", error);
            return false;
        }
    }

    /**
     * Send usage message safely
     */
    async sendUsageSafe(message, socket, reason = "", options = {}) {
        try {
            let usageText = "";

            if (reason) {
                usageText = `❌ ${reason}\n\n`;
            }

            usageText += `📖 Usage: ${this.config.usage}`;

            if (
                this.config.expectedArgs &&
                this.config.expectedArgs !== "No example available"
            ) {
                usageText += `\n💡 Example: ${this.config.expectedArgs}`;
            }

            if (this.config.aliases && this.config.aliases.length > 0) {
                usageText += `\n🔄 Aliases: ${this.config.aliases.join(", ")}`;
            }

            return await this.safeReply(message, usageText, options);
        } catch (error) {
            this.safeLog("error", "Failed to send usage message:", error);
            return false;
        }
    }

    /**
     * Send success message safely
     */
    async sendSuccessSafe(message, socket, successMsg, options = {}) {
        try {
            const prefix = options.prefix || "✅ ";
            const fullMessage = `${prefix}${successMsg}`;

            return await this.safeReply(message, fullMessage, options);
        } catch (error) {
            this.safeLog("error", "Failed to send success message:", error);
            return false;
        }
    }

    // ===============================
    // LIFECYCLE HOOKS
    // ===============================

    /**
     * Called before plugin registration
     */
    async onBeforeRegister(context) {
        // Override in plugins that need pre-registration logic
        return true;
    }

    /**
     * Called after successful plugin registration
     */
    async onAfterRegister(context) {
        // Override in plugins that need post-registration logic
        return true;
    }

    /**
     * Called before command execution
     */
    async onBeforeExecute(message, socket, context) {
        // Override in plugins that need pre-execution logic
        // Return false to cancel execution
        return true;
    }

    /**
     * Called after command execution
     */
    async onAfterExecute(message, socket, context, result, executionTime) {
        // Override in plugins that need post-execution logic
        // Log performance if needed
        if (executionTime > 5000) {
            this.safeLog("warn", `Slow execution detected: ${executionTime}ms`);
        }
        return true;
    }

    // ===============================
    // VALIDATION METHODS
    // ===============================

    /**
     * Validate message object
     */
    isValidMessage(message, context) {
        const ref = message?.key?.remoteJid ? message : context?.m?.raw;
        return !!(ref && ref.key && typeof ref.key.remoteJid === "string");
    }

    /**
     * Validate plugin dependencies
     */
    async validateDependencies() {
        if (!this.dependencies || this.dependencies.length === 0) {
            return true;
        }

        const missingDeps = [];

        for (const dep of this.dependencies) {
            try {
                require.resolve(dep);
            } catch (error) {
                missingDeps.push(dep);
            }
        }

        if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(", ")}`);
        }

        return true;
    }

    /**
     * Validate context object
     */
    async validateContext(context) {
        const required = ["socket", "messageSender", "config", "logger"];
        const missing = [];

        for (const field of required) {
            if (!context[field]) {
                missing.push(field);
            }
        }

        if (missing.length > 0) {
            throw new Error(`Missing required context: ${missing.join(", ")}`);
        }

        // Validate messageSender methods
        if (typeof context.messageSender.sendReply !== "function") {
            throw new Error("MessageSender must have sendReply method");
        }

        // Validate config methods
        if (typeof context.config.get !== "function") {
            throw new Error("Config must have get method");
        }

        return true;
    }

    /**
     * Validasi konfigurasi plugin
     */
    validateConfig() {
        const required = ["name", "description", "version", "type"];
        for (const field of required) {
            if (!this[field]) {
                throw new Error(`Plugin missing required field: ${field}`);
            }
        }

        // Validasi tipe plugin
        const validTypes = ["command", "listener", "utility", "middleware"];
        if (!validTypes.includes(this.type)) {
            throw new Error(`Invalid plugin type: ${this.type}`);
        }

        // Validate version format
        const versionRegex = /^\d+\.\d+\.\d+$/;
        if (!versionRegex.test(this.version)) {
            throw new Error(`Invalid version format: ${this.version}`);
        }

        // Validate name format
        const nameRegex = /^[a-z0-9_-]+$/;
        if (!nameRegex.test(this.name)) {
            throw new Error(
                `Invalid name format: ${this.name}. Use lowercase letters, numbers, underscore, and dash only`
            );
        }
    }

    // ===============================
    // HEALTH MONITORING
    // ===============================

    /**
     * Setup health monitoring
     */
    setupHealthMonitoring() {
        // Check health every 5 minutes
        const healthCheckInterval = setInterval(
            () => {
                this.performHealthCheck();
            },
            5 * 60 * 1000
        );

        this.intervals.add(healthCheckInterval);
    }

    /**
     * Perform health check
     */
    performHealthCheck() {
        try {
            const now = Date.now();
            this.lastHealthCheck = now;

            // Check error rate
            if (this.errorCount >= this.maxErrors) {
                this.healthStatus = "error";
                this.safeLog(
                    "warn",
                    `Plugin ${this.name} marked as unhealthy due to high error count: ${this.errorCount}`
                );
                return;
            }

            // Check if plugin is responsive
            if (!this.state.active || !this.state.initialized) {
                this.healthStatus = "disabled";
                return;
            }

            // Plugin is healthy
            this.healthStatus = "ok";
        } catch (error) {
            this.healthStatus = "error";
            this.safeLog("error", "Health check failed:", error);
        }
    }

    /**
     * Update health status
     */
    updateHealthStatus() {
        if (this.healthStatus === "disabled") {
            return;
        }

        const now = Date.now();

        // Auto-recovery if enough time has passed without errors
        if (this.healthStatus === "error" && this.errorCount === 0) {
            this.healthStatus = "ok";
            this.safeLog(
                "info",
                `Plugin ${this.name} recovered to healthy status`
            );
        }

        this.lastHealthCheck = now;
    }

    // ===============================
    // ERROR HANDLING
    // ===============================

    /**
     * Handle critical errors
     */
    handleCriticalError(operation, error) {
        this.state.error = error.message;
        this.state.crashCount++;
        this.healthStatus = "error";
        this.errorCount++;

        this.safeLog(
            "error",
            `Critical error in plugin ${this.name} during ${operation}:`,
            error
        );

        // Auto-disable if too many crashes
        if (this.state.crashCount >= 3) {
            this.state.active = false;
            this.healthStatus = "disabled";
            this.safeLog(
                "error",
                `Plugin ${this.name} disabled due to excessive crashes`
            );
        }
    }

    /**
     * Handle execution errors
     */
    async handleExecutionError(error, message, socket, context, executionId) {
        this.errorCount++;

        // Log error dengan detail
        this.safeLog(
            "error",
            `Execution error in plugin ${this.name} [${executionId}]:`,
            {
                error: error.message,
                stack: error.stack,
                sender: context?.sender,
                command: context?.command,
                args: context?.args
            }
        );

        // Send safe error response
        await this.sendErrorSafe(
            message,
            socket,
            "Terjadi kesalahan saat menjalankan plugin"
        );

        // Check if we need to mark plugin as unhealthy
        if (this.errorCount >= this.maxErrors) {
            this.healthStatus = "error";
            this.safeLog("warn", `Plugin ${this.name} marked as unhealthy`);
        }
    }

    /**
     * Safe logging method
     */
    safeLog(level = "info", message, data = null) {
    try {
        const logLevel = typeof level === "string" ? level.toLowerCase() : "log";
        const loggerFn =
            (this.context?.logger?.[logLevel] || console[logLevel]) ?? console.log;

        const logPrefix = `[${this.name}]`;
        if (data) {
            loggerFn(`${logPrefix} ${message}`, data);
        } else {
            loggerFn(`${logPrefix} ${message}`);
        }
    } catch (error) {
        console.error(`[${this.name}] Logging failed:`, error);
    }
}

    // ===============================
    // UTILITY METHODS (Enhanced)
    // ===============================

    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `${this.name}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
    }

    /**
     * Cleanup timers
     */
    cleanupTimers() {
        for (const timer of this.timers) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }

    /**
     * Cleanup intervals
     */
    cleanupIntervals() {
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        this.intervals.clear();
    }

    /**
     * Enhanced statistics
     */
    getStats() {
        const uptime = this.state.startTime
            ? Date.now() - this.state.startTime
            : 0;

        return {
            name: this.name,
            version: this.version,
            type: this.type,
            healthStatus: this.healthStatus,
            enabled: this.state.active,
            usageCount: this.state.usageCount,
            uniqueUsers: this.state.users.size,
            errorCount: this.errorCount,
            crashCount: this.state.crashCount,
            uptime: uptime,
            lastUsed: this.state.lastUsed,
            lastHealthCheck: this.lastHealthCheck,
            initialized: this.state.initialized,
            dependencies: this.dependencies,
            error: this.state.error
        };
    }

    // ===============================
    // EXISTING METHODS (Enhanced dengan safe operations)
    // ===============================

    /**
     * Inisialisasi data plugin dengan error handling
     */
    async initData() {
        try {
            // Load data dari storage jika diperlukan
            if (this.context?.store) {
                const savedData = await this.context.store.get(
                    `plugin_${this.name}`
                );
                if (savedData) {
                    this.data = { ...this.data, ...savedData };
                }
            }

            // Inisialisasi data default
            this.data.initialized = true;
            this.data.createdAt = Date.now();

            this.safeLog("debug", `Plugin ${this.name} data initialized`);
        } catch (error) {
            this.safeLog(
                "error",
                `Error initializing data for plugin ${this.name}:`,
                error
            );
            // Don't throw, use default data
            this.data = {
                initialized: true,
                createdAt: Date.now()
            };
        }
    }

    /**
     * Load konfigurasi plugin dari config utama dengan safe access
     */
    loadPluginConfig(config) {
        try {
            const pluginConfig = config.get(`plugins.${this.name}`);
            if (pluginConfig && typeof pluginConfig === "object") {
                this.config = { ...this.config, ...pluginConfig };
                this.safeLog("debug", `Loaded config for plugin ${this.name}`);
            }
        } catch (error) {
            this.safeLog(
                "debug",
                `No specific config found for plugin ${this.name}, using defaults`
            );
        }
    }

    /**
     * Enhanced permission checking dengan better error handling
     */
    async checkPermissions(message, context) {
        const { sender, isGroup } = context;

        try {
            // Owner only check
            if (this.config.ownerOnly && !this.isOwner(sender)) {
                return { allowed: false, reason: "Command hanya untuk owner" };
            }

            // Group only check
            if (this.config.groupOnly && !isGroup) {
                return {
                    allowed: false,
                    reason: "Command hanya bisa digunakan di grup"
                };
            }

            // Private only check
            if (this.config.privateOnly && isGroup) {
                return {
                    allowed: false,
                    reason: "Command hanya bisa digunakan di private chat"
                };
            }

            // Admin only check (untuk grup)
            if (this.config.adminOnly && isGroup) {
                const isAdmin = await this.isGroupAdmin(message, sender);
                if (!isAdmin) {
                    return {
                        allowed: false,
                        reason: "Command hanya untuk admin grup"
                    };
                }
            }

            // Premium check
            if (this.config.premium && !this.isPremiumUser(sender)) {
                return { allowed: false, reason: "Fitur premium only" };
            }

            return { allowed: true };
        } catch (error) {
            this.safeLog(
                "error",
                `Error checking permissions for plugin ${this.name}:`,
                error
            );
            return { allowed: false, reason: "Error checking permissions" };
        }
    }

    /**
     * Enhanced argument validation
     */
    validateArguments(args) {
        if (!Array.isArray(args)) {
            return { valid: false, reason: "Invalid arguments format" };
        }

        if (this.config.minArgs > 0 && args.length < this.config.minArgs) {
            return {
                valid: false,
                reason: `Minimum ${this.config.minArgs} argumen diperlukan`
            };
        }

        if (this.config.maxArgs > 0 && args.length > this.config.maxArgs) {
            return {
                valid: false,
                reason: `Maximum ${this.config.maxArgs} argumen diperbolehkan`
            };
        }

        return { valid: true };
    }

    /**
     * Enhanced cooldown checking dengan per-user tracking
     */
    checkCooldown(userId, command) {
        if (!this.config.cooldown || this.config.cooldown <= 0) {
            return { allowed: true };
        }

        const key = `${userId}:${command}`;
        const lastUsed = this.state.lastUsedBy.get(key);
        if (!lastUsed) {
            return { allowed: true };
        }

        const timePassed = Date.now() - lastUsed;
        if (timePassed < this.config.cooldown) {
            return {
                allowed: false,
                remaining: this.config.cooldown - timePassed
            };
        }

        return { allowed: true };
    }

    /**
     * Enhanced usage stats tracking
     */
    updateUsageStats(userId, command) {
        const key = `${userId}:${command}`;
        this.state.usageCount++;
        this.state.users.add(userId);
        this.state.lastUsedBy.set(key, Date.now());
        this.state.lastUsed = Date.now();

        // Cleanup old usage data (keep only last 1000 users)
        if (this.state.lastUsedBy.size > 1000) {
            const entries = Array.from(this.state.lastUsedBy.entries());
            entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp

            // Remove oldest 200 entries
            for (let i = 0; i < 200; i++) {
                this.state.lastUsedBy.delete(entries[i][0]);
                this.state.users.delete(entries[i][0]);
            }
        }
    }

    /**
     * Setup event listeners untuk listener-type plugins
     */
    async setupEventListeners(socket) {
        if (this.type !== "listener") {
            return;
        }

        try {
            // Override this method in listener plugins
            // Example:
            // const messageHandler = (msg) => this.handleMessage(msg);
            // socket.ev.on('messages.upsert', messageHandler);
            // this.eventListeners.set('messages.upsert', messageHandler);

            this.safeLog(
                "debug",
                `Event listeners setup for plugin ${this.name}`
            );
        } catch (error) {
            this.safeLog(
                "error",
                `Error setting up event listeners for plugin ${this.name}:`,
                error
            );
        }
    }

    /**
     * Remove event listeners pada cleanup
     */
    async removeEventListeners() {
        try {
            if (this.context?.socket && this.eventListeners.size > 0) {
                for (const [event, handler] of this.eventListeners) {
                    this.context.socket.ev.off(event, handler);
                }
                this.eventListeners.clear();
                this.safeLog(
                    "debug",
                    `Event listeners removed for plugin ${this.name}`
                );
            }
        } catch (error) {
            this.safeLog(
                "error",
                `Error removing event listeners for plugin ${this.name}:`,
                error
            );
        }
    }

    /**
     * Register shutdown hook untuk graceful cleanup
     */
    registerShutdownHook() {
        try {
            if (this.context?.gracefulShutdown) {
                this.context.gracefulShutdown.registerShutdownHook(
                    async () => await this.deactivate(),
                    `plugin_${this.name}`,
                    10 // Priority
                );
            }
        } catch (error) {
            this.safeLog(
                "error",
                `Error registering shutdown hook for plugin ${this.name}:`,
                error
            );
        }
    }

    /**
     * Plugin-specific cleanup method - override in plugins
     */
    async cleanup() {
        try {
            // Override this method in plugins that need specific cleanup
            // Example: close database connections, cancel requests, etc.

            // Save important data before cleanup
            if (this.context?.store && Object.keys(this.data).length > 0) {
                await this.context.store.set(`plugin_${this.name}`, this.data);
            }

            this.safeLog("debug", `Cleanup completed for plugin ${this.name}`);
        } catch (error) {
            this.safeLog(
                "error",
                `Error during cleanup for plugin ${this.name}:`,
                error
            );
        }
    }

    // ===============================
    // HELPER METHODS FOR PERMISSIONS
    // ===============================

    /**
     * Check if user is owner
     */
    isOwner(userId) {
        try {
            const owner = this.context?.config?.owner;
            if (!owner) return false;

            // Support for multiple owners
            if (Array.isArray(owner)) {
                return owner.includes(userId);
            }

            return userId === owner;
        } catch (error) {
            this.safeLog("error", "Error checking owner status:", error);
            return false;
        }
    }

    /**
     * Check if user is group admin
     */
    async isGroupAdmin(message, userId) {
        try {
            const groupMetadata = await this.context.socket.groupMetadata(
                message.key.remoteJid
            );
            const participant = groupMetadata.participants.find(
                p => p.id === userId
            );
            return (
                participant &&
                (participant.admin === "admin" ||
                    participant.admin === "superadmin")
            );
        } catch (error) {
            this.safeLog("error", "Error checking admin status:", error);
            return false;
        }
    }

    /**
     * Check if user is premium
     */
    isPremiumUser(userId) {
        try {
            const premiumUsers =
                this.context?.config?.get("bot.premiumUsers") || [];
            return premiumUsers.includes(userId);
        } catch (error) {
            this.safeLog("error", "Error checking premium status:", error);
            return false;
        }
    }

    // ===============================
    // DATA PERSISTENCE METHODS
    // ===============================

    /**
     * Save plugin data to persistent storage
     */
    async saveData(key, value) {
        try {
            if (!this.context?.store) {
                this.safeLog("warn", "No store available for saving data");
                return false;
            }

            const dataKey = `plugin_${this.name}_${key}`;
            await this.context.store.set(dataKey, value);

            // Also update local data
            this.data[key] = value;

            return true;
        } catch (error) {
            this.safeLog("error", `Error saving data for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Load plugin data from persistent storage
     */
    async loadData(key, defaultValue = null) {
        try {
            if (!this.context?.store) {
                this.safeLog("warn", "No store available for loading data");
                return defaultValue;
            }

            const dataKey = `plugin_${this.name}_${key}`;
            const value = await this.context.store.get(dataKey);

            return value !== undefined ? value : defaultValue;
        } catch (error) {
            this.safeLog("error", `Error loading data for key ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Delete plugin data from persistent storage
     */
    async deleteData(key) {
        try {
            if (!this.context?.store) {
                return false;
            }

            const dataKey = `plugin_${this.name}_${key}`;
            await this.context.store.delete(dataKey);

            // Also remove from local data
            delete this.data[key];

            return true;
        } catch (error) {
            this.safeLog("error", `Error deleting data for key ${key}:`, error);
            return false;
        }
    }

    // ===============================
    // QUEUE MANAGEMENT FOR RATE LIMITING
    // ===============================

    /**
     * Add execution to queue
     */
    async queueExecution(executionFn) {
        return new Promise((resolve, reject) => {
            this.executionQueue.push({
                fn: executionFn,
                resolve,
                reject,
                timestamp: Date.now()
            });

            this.processQueue();
        });
    }

    /**
     * Process execution queue
     */
    async processQueue() {
        if (this.isProcessingQueue || this.executionQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            while (this.executionQueue.length > 0) {
                const execution = this.executionQueue.shift();

                // Check if execution is not too old (avoid stale executions)
                if (Date.now() - execution.timestamp > 30000) {
                    execution.reject(new Error("Execution timeout in queue"));
                    continue;
                }

                try {
                    const result = await execution.fn();
                    execution.resolve(result);
                } catch (error) {
                    execution.reject(error);
                }

                // Add small delay between executions
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            this.safeLog("error", "Error processing execution queue:", error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    // ===============================
    // ADVANCED UTILITY METHODS
    // ===============================

    /**
     * Create safe timeout that gets cleaned up
     */
    createTimeout(callback, delay) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            callback();
        }, delay);

        this.timers.add(timer);
        return timer;
    }

    /**
     * Create safe interval that gets cleaned up
     */
    createInterval(callback, delay) {
        const interval = setInterval(callback, delay);
        this.intervals.add(interval);
        return interval;
    }

    /**
     * Rate limiting utility
     */
    createRateLimiter(maxRequests, windowMs) {
        const requests = new Map();

        return userId => {
            const now = Date.now();
            const userRequests = requests.get(userId) || [];

            // Remove old requests outside the window
            const validRequests = userRequests.filter(
                time => now - time < windowMs
            );

            if (validRequests.length >= maxRequests) {
                return false;
            }

            validRequests.push(now);
            requests.set(userId, validRequests);

            // Cleanup old users periodically
            if (requests.size > 1000) {
                const cutoff = now - windowMs * 2;
                for (const [user, times] of requests.entries()) {
                    if (times.every(time => time < cutoff)) {
                        requests.delete(user);
                    }
                }
            }

            return true;
        };
    }

    /**
     * Retry utility with exponential backoff
     */
    async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (attempt === maxRetries) {
                    break;
                }

                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise(resolve =>
                    this.createTimeout(resolve, delay)
                );
            }
        }

        throw lastError;
    }

    /**
     * Memory usage monitoring
     */
    getMemoryUsage() {
        try {
            const usage = process.memoryUsage();
            return {
                rss: Math.round(usage.rss / 1024 / 1024), // MB
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
                external: Math.round(usage.external / 1024 / 1024) // MB
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Get detailed health report
     */
    getHealthReport() {
        const uptime = this.state.startTime
            ? Date.now() - this.state.startTime
            : 0;
        const memUsage = this.getMemoryUsage();

        return {
            plugin: this.name,
            version: this.version,
            status: this.healthStatus,
            uptime: {
                ms: uptime,
                readable: this.formatDuration(uptime)
            },
            statistics: {
                totalExecutions: this.state.usageCount,
                uniqueUsers: this.state.users.size,
                errorRate:
                    this.state.usageCount > 0
                        ? (
                              (this.errorCount / this.state.usageCount) *
                              100
                          ).toFixed(2) + "%"
                        : "0%",
                errors: this.errorCount,
                crashes: this.state.crashCount
            },
            performance: {
                lastHealthCheck: this.lastHealthCheck
                    ? new Date(this.lastHealthCheck).toISOString()
                    : null,
                lastUsed: this.state.lastUsed
                    ? new Date(this.state.lastUsed).toISOString()
                    : null,
                queueLength: this.executionQueue.length,
                activeTimers: this.timers.size,
                activeIntervals: this.intervals.size
            },
            memory: memUsage,
            config: {
                enabled: this.config.enabled,
                maintenance: this.config.maintenance,
                cooldown: this.config.cooldown,
                maxErrors: this.maxErrors,
                timeout: this.config.timeout
            },
            lastError: this.state.error
        };
    }

    /**
     * Format duration to human readable
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // ===============================
    // PLUGIN METADATA & INFO
    // ===============================

    /**
     * Get plugin information
     */
    getPluginInfo() {
        return {
            name: this.name,
            description: this.description,
            version: this.version,
            type: this.type,
            category: this.config.category,
            usage: this.config.usage,
            aliases: this.config.aliases,
            permissions: {
                ownerOnly: this.config.ownerOnly,
                groupOnly: this.config.groupOnly,
                privateOnly: this.config.privateOnly,
                adminOnly: this.config.adminOnly,
                premium: this.config.premium
            },
            settings: {
                cooldown: this.config.cooldown,
                minArgs: this.config.minArgs,
                maxArgs: this.config.maxArgs,
                nsfw: this.config.nsfw,
                maintenance: this.config.maintenance
            },
            dependencies: this.dependencies,
            status: {
                enabled: this.state.active,
                initialized: this.state.initialized,
                health: this.healthStatus
            }
        };
    }

    /**
     * Validate plugin integrity
     */
    validateIntegrity() {
        const issues = [];

        // Check required methods
        const requiredMethods = ["register", "execute", "deactivate"];
        for (const method of requiredMethods) {
            if (typeof this[method] !== "function") {
                issues.push(`Missing required method: ${method}`);
            }
        }

        // Check state consistency
        if (this.state.initialized && !this.context) {
            issues.push("Plugin marked as initialized but missing context");
        }

        // Check health status consistency
        if (this.healthStatus === "ok" && this.errorCount >= this.maxErrors) {
            issues.push("Health status inconsistent with error count");
        }

        // Check configuration
        if (
            this.config.minArgs > this.config.maxArgs &&
            this.config.maxArgs > 0
        ) {
            issues.push("Invalid argument configuration: minArgs > maxArgs");
        }

        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    /**
     * Reset plugin state (for debugging/recovery)
     */
    resetState() {
        this.safeLog("info", `Resetting state for plugin ${this.name}`);

        // Reset counters
        this.errorCount = 0;
        this.state.crashCount = 0;
        this.state.error = null;

        // Reset health
        this.healthStatus = "ok";
        this.lastHealthCheck = Date.now();

        // Clear queues
        this.executionQueue = [];
        this.isProcessingQueue = false;

        // Reset usage tracking
        this.state.lastUsedBy.clear();

        this.safeLog(
            "success",
            `State reset completed for plugin ${this.name}`
        );
    }

    /**
     * Export plugin configuration for backup
     */
    exportConfig() {
        return {
            name: this.name,
            version: this.version,
            config: { ...this.config },
            data: { ...this.data },
            statistics: {
                usageCount: this.state.usageCount,
                uniqueUsers: this.state.users.size,
                errorCount: this.errorCount,
                crashCount: this.state.crashCount
            }
        };
    }

    /**
     * Import plugin configuration from backup
     */
    importConfig(configData) {
        try {
            if (configData.name !== this.name) {
                throw new Error("Configuration name mismatch");
            }

            // Import config (but preserve critical settings)
            const criticalSettings = ["enabled", "maintenance"];
            const importedConfig = { ...configData.config };

            for (const setting of criticalSettings) {
                if (this.config.hasOwnProperty(setting)) {
                    importedConfig[setting] = this.config[setting];
                }
            }

            this.config = { ...this.config, ...importedConfig };

            // Import non-sensitive data
            this.data = { ...this.data, ...configData.data };

            this.safeLog(
                "success",
                `Configuration imported for plugin ${this.name}`
            );
            return true;
        } catch (error) {
            this.safeLog("error", `Error importing configuration:`, error);
            return false;
        }
    }
}

const cooldownMap = new Map(); // Map<key, timestamp>
// Export the template class
module.exports = PluginTemplate;
