const path = require("path");
const fs = require("fs").promises;
const chokidar = require("chokidar");
const semver = require("semver");
const logger = require("@lib/logger");
const { registerShutdownHook } = require("@start/connection/shutdown");

// Plugin storage dan state management
const plugins = new Map();
const activePlugins = new Set();
const pluginHealth = new Map();
const pluginMetrics = new Map();
const pluginDependencies = new Map();

// File watcher untuk auto-reload
let fileWatcher = null;
let watcherEnabled = false;

// Configuration dengan defaults yang lebih comprehensive
const config = {
    pluginsDir: path.join(process.cwd(), "core", "plugins"),
    customPluginsDir: path.join(process.cwd(), "plugins"),
    excludedFiles: ["index.js", "README.md", ".DS_Store", "Thumbs.db"],
    corePluginsOnly: false,
    autoReload: true,
    healthCheckInterval: 30000, // 30 detik
    maxExecutionTime: 10000, // 10 detik timeout per plugin
    enableMetrics: true,
    securityChecks: true,
    watchOptions: {
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: true
    }
};

// Health check timer
let healthTimer = null;

/**
 * Initialize plugin system dengan semua fitur production-ready
 * @param {Object} options - Plugin system options
 * @param {Object} context - Bot context
 * @returns {Promise<Map>} - Map of loaded plugins
 */
async function initializePlugins(options = {}, context = null) {
    // Update config
    Object.assign(config, options);

    logger.info("🔌 Initializing production plugin system...");

    try {
        // Load core plugins
        await loadPluginsFromDirectory(config.pluginsDir, "core");

        // Load custom plugins jika tidak hanya core
        if (!config.corePluginsOnly) {
            await ensureCustomPluginsDir();
            await loadPluginsFromDirectory(config.customPluginsDir, "custom");
        }

        // Initialize file watcher untuk auto-reload
        if (config.autoReload) {
            await initializeFileWatcher();
        }

        // Start health monitoring
        startHealthMonitoring();

        // Register built-in management commands
        registerManagementCommands(context);

        logger.success(
            `🚀 Plugin system initialized with ${plugins.size} plugins`
        );
        logger.info(
            `📊 Active: ${activePlugins.size}, Health monitoring: ${
                config.healthCheckInterval / 1000
            }s`
        );

        return plugins;
    } catch (error) {
        logger.error(`❌ Failed to initialize plugin system: ${error.message}`);
        throw error;
    }
}

/**
 * Load plugins dari directory dengan recursive support
 * @param {string} directory - Directory path
 * @param {string} type - Plugin type ('core' or 'custom')
 */
async function loadPluginsFromDirectory(directory, type = "core") {
    try {
        logger.info(`📂 Loading ${type} plugins from: ${directory}`);
        let loadedCount = 0;

        async function processDirectory(currentDir) {
            try {
                const entries = await fs.readdir(currentDir, {
                    withFileTypes: true
                });

                for (const entry of entries) {
                    const entryPath = path.join(currentDir, entry.name);

                    if (entry.isDirectory()) {
                        await processDirectory(entryPath);
                    } else if (
                        entry.isFile() &&
                        entry.name.endsWith(".js") &&
                        !config.excludedFiles.includes(entry.name)
                    ) {
                        const pluginName = path.basename(entry.name, ".js");
                        const success = await loadPlugin(
                            entryPath,
                            pluginName,
                            type
                        );
                        if (success) loadedCount++;
                    }
                }
            } catch (error) {
                if (error.code !== "ENOENT") {
                    logger.error(
                        `Error reading directory ${currentDir}: ${error.message}`
                    );
                }
            }
        }

        await processDirectory(directory);
        logger.info(`✅ Loaded ${loadedCount} ${type} plugins`);
    } catch (error) {
        logger.error(
            `❌ Error loading plugins from ${directory}: ${error.message}`
        );
        throw error;
    }
}

/**
 * Load single plugin dengan enhanced validation
 * @param {string} filePath - Path to plugin file
 * @param {string} pluginName - Plugin name
 * @param {string} type - Plugin type
 * @returns {Promise<boolean>} - Success status
 */
async function loadPlugin(filePath, pluginName, type) {
    try {
        // Clear require cache untuk fresh loading
        delete require.cache[require.resolve(filePath)];

        const pluginModule = require(filePath);

        let plugin;
        try {
            plugin =
                typeof pluginModule === "function"
                    ? new pluginModule()
                    : pluginModule;
        } catch (err) {
            logger.error(
                `❌ Failed to instantiate plugin ${pluginName}:\n${err.stack}`
            );
            return false;
        }

        // ✅ sekarang plugin bisa digunakan di sini
        const validationResult = validatePlugin(plugin, pluginName);
        if (!validationResult.valid) {
            logger.warn(
                `⚠️ Invalid plugin ${pluginName}: ${validationResult.reason}`
            );
            return false;
        }

        // Apply defaults untuk missing properties
        applyPluginDefaults(plugin, pluginName);

        // Add comprehensive metadata
        plugin.meta = {
            type,
            filePath,
            loadedAt: new Date(),
            enabled: false,
            lastHealthCheck: null,
            errorCount: 0,
            executionCount: 0,
            averageExecutionTime: 0,
            lastError: null
        };

        // Check dependencies
        const depCheck = await checkPluginDependencies(plugin);
        if (!depCheck.satisfied) {
            logger.error(
                `❌ Plugin ${pluginName} dependencies not satisfied: ${depCheck.missing.join(
                    ", "
                )}`
            );
            return false;
        }

        // Store plugin
        plugins.set(plugin.name, plugin);
        initializePluginHealth(plugin.name);
        initializePluginMetrics(plugin.name);

        logger.debug(
            `📦 Loaded plugin: ${plugin.name} v${plugin.version} (${type})`
        );
        return true;
    } catch (error) {
        logger.error(
            `❌ Failed to load plugin ${pluginName}: ${error.message}`
        );
        return false;
    }
}

/**
 * Validate plugin structure dan security
 * @param {Object} plugin - Plugin object
 * @param {string} pluginName - Plugin name
 * @returns {Object} - Validation result
 */
function validatePlugin(plugin, pluginName) {
    // Basic structure validation
    if (!plugin || typeof plugin !== "object") {
        return { valid: false, reason: "Plugin must be an object" };
    }

    if (typeof plugin.register !== "function") {
        return { valid: false, reason: "Missing register function" };
    }

    if (typeof plugin.execute !== "function") {
        return { valid: false, reason: "Missing execute function" };
    }

    // Security checks
    if (config.securityChecks) {
        const securityCheck = performSecurityCheck(plugin);
        if (!securityCheck.safe) {
            return {
                valid: false,
                reason: `Security check failed: ${securityCheck.reason}`
            };
        }
    }

    return { valid: true };
}

/**
 * Security check untuk plugin
 * @param {Object} plugin - Plugin object
 * @returns {Object} - Security check result
 */
function performSecurityCheck(plugin) {
    // Check untuk dangerous patterns
    const pluginString = plugin.toString();
    const dangerousPatterns = [
        /require\(['"`]child_process['"`]\)/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\.exit/,
        /require\(['"`]fs['"`]\).*unlink/
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(pluginString)) {
            return {
                safe: false,
                reason: "Contains potentially dangerous code"
            };
        }
    }

    return { safe: true };
}

/**
 * Apply default values untuk plugin properties
 * @param {Object} plugin - Plugin object
 * @param {string} pluginName - Plugin name
 */
function applyPluginDefaults(plugin, pluginName) {
    if (!plugin.name || typeof plugin.name !== "string") {
        plugin.name = pluginName;
    }

    if (!plugin.description) {
        plugin.description = `${pluginName} plugin`;
    }

    if (!plugin.version) {
        plugin.version = "1.0.0";
    }

    if (!plugin.author) {
        plugin.author = "Unknown";
    }

    if (!plugin.dependencies) {
        plugin.dependencies = {};
    }

    if (!plugin.config) {
        plugin.config = {};
    }

    if (!plugin.aliases) {
        plugin.aliases = [];
    }
}

/**
 * Check plugin dependencies
 * @param {Object} plugin - Plugin object
 * @returns {Promise<Object>} - Dependency check result
 */
async function checkPluginDependencies(plugin) {
    const result = {
        satisfied: true,
        missing: [],
        versions: {}
    };

    if (!plugin.dependencies || Object.keys(plugin.dependencies).length === 0) {
        return result;
    }

    for (const [depName, requiredVersion] of Object.entries(
        plugin.dependencies
    )) {
        try {
            // Check jika dependency adalah plugin lain
            if (plugins.has(depName)) {
                const depPlugin = plugins.get(depName);
                if (!semver.satisfies(depPlugin.version, requiredVersion)) {
                    result.missing.push(`${depName}@${requiredVersion}`);
                    result.satisfied = false;
                } else {
                    result.versions[depName] = depPlugin.version;
                }
            } else {
                // Check npm package
                try {
                    const pkg = require(`${depName}/package.json`);
                    if (!semver.satisfies(pkg.version, requiredVersion)) {
                        result.missing.push(`${depName}@${requiredVersion}`);
                        result.satisfied = false;
                    } else {
                        result.versions[depName] = pkg.version;
                    }
                } catch (error) {
                    result.missing.push(`${depName}@${requiredVersion}`);
                    result.satisfied = false;
                }
            }
        } catch (error) {
            result.missing.push(`${depName}@${requiredVersion}`);
            result.satisfied = false;
        }
    }

    pluginDependencies.set(plugin.name, result);
    return result;
}

/**
 * Run plugin dengan safety measures dan monitoring
 * @param {Object} plugin - Plugin object
 * @param {Object} message - WhatsApp message
 * @param {Object} socket - WhatsApp socket
 * @param {Object} context - Bot context
 * @returns {Promise<Object>} - Execution result
 */
async function runPluginSafely(plugin, message, socket, context) {
    const startTime = Date.now();
    const pluginName = plugin.name;

    try {
        // Pre-execution checks
        if (!activePlugins.has(pluginName)) {
            return { success: false, error: "Plugin not active" };
        }

        const health = pluginHealth.get(pluginName);
        if (health && health.status === "critical") {
            return { success: false, error: "Plugin in critical state" };
        }

        // Set execution timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
                () => reject(new Error("Plugin execution timeout")),
                config.maxExecutionTime
            );
        });

        // Execute plugin dengan timeout
        const executionPromise = plugin.execute(message, socket, context);
        const result = await Promise.race([executionPromise, timeoutPromise]);

        // Update metrics
        const executionTime = Date.now() - startTime;
        updatePluginMetrics(pluginName, executionTime, true);
        updatePluginHealth(pluginName, "healthy", null);

        logger.debug(
            `✅ Plugin ${pluginName} executed successfully in ${executionTime}ms`
        );

        return { success: true, result, executionTime };
    } catch (error) {
        const executionTime = Date.now() - startTime;

        // Update metrics dan health
        updatePluginMetrics(pluginName, executionTime, false);
        updatePluginHealth(pluginName, "error", error);

        // Log error
        logger.error(
            `❌ Plugin ${pluginName} execution failed: ${error.message}`
        );

        // Check jika plugin perlu di-disable karena terlalu banyak error
        const health = pluginHealth.get(pluginName);
        if (health && health.errorCount > 5) {
            logger.warn(
                `🔴 Plugin ${pluginName} disabled due to excessive errors`
            );
            await disablePlugin(pluginName);
        }

        return { success: false, error: error.message, executionTime };
    }
}

/**
 * Initialize plugin health tracking
 * @param {string} pluginName - Plugin name
 */
function initializePluginHealth(pluginName) {
    pluginHealth.set(pluginName, {
        status: "unknown",
        lastCheck: new Date(),
        errorCount: 0,
        consecutiveErrors: 0,
        uptime: 0,
        lastError: null
    });
}

/**
 * Initialize plugin metrics tracking
 * @param {string} pluginName - Plugin name
 */
function initializePluginMetrics(pluginName) {
    pluginMetrics.set(pluginName, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        totalExecutionTime: 0,
        lastExecutionTime: null,
        peakExecutionTime: 0
    });
}

/**
 * Update plugin metrics
 * @param {string} pluginName - Plugin name
 * @param {number} executionTime - Execution time in ms
 * @param {boolean} success - Execution success status
 */
function updatePluginMetrics(pluginName, executionTime, success) {
    if (!config.enableMetrics) return;

    const metrics = pluginMetrics.get(pluginName);
    if (!metrics) return;

    metrics.totalExecutions++;
    metrics.totalExecutionTime += executionTime;
    metrics.lastExecutionTime = new Date();

    if (success) {
        metrics.successfulExecutions++;
    } else {
        metrics.failedExecutions++;
    }

    metrics.averageExecutionTime =
        metrics.totalExecutionTime / metrics.totalExecutions;

    if (executionTime > metrics.peakExecutionTime) {
        metrics.peakExecutionTime = executionTime;
    }

    // Update plugin meta
    const plugin = plugins.get(pluginName);
    if (plugin) {
        plugin.meta.executionCount = metrics.totalExecutions;
        plugin.meta.averageExecutionTime = metrics.averageExecutionTime;
    }
}

/**
 * Update plugin health status
 * @param {string} pluginName - Plugin name
 * @param {string} status - Health status
 * @param {Error} error - Error object if any
 */
function updatePluginHealth(pluginName, status, error = null) {
    const health = pluginHealth.get(pluginName);
    if (!health) return;

    health.status = status;
    health.lastCheck = new Date();

    if (error) {
        health.errorCount++;
        health.consecutiveErrors++;
        health.lastError = {
            message: error.message,
            timestamp: new Date(),
            stack: error.stack
        };
    } else {
        health.consecutiveErrors = 0;
    }

    // Determine overall status
    if (health.consecutiveErrors > 3) {
        health.status = "critical";
    } else if (health.consecutiveErrors > 1) {
        health.status = "warning";
    } else if (status === "error") {
        health.status = "warning";
    }

    // Update plugin meta
    const plugin = plugins.get(pluginName);
    if (plugin) {
        plugin.meta.lastHealthCheck = health.lastCheck;
        plugin.meta.errorCount = health.errorCount;
        plugin.meta.lastError = health.lastError;
    }
}

/**
 * Get comprehensive plugin health status
 * @returns {Object} - Health status untuk semua plugin
 */
function getPluginHealth() {
    const healthReport = {
        overview: {
            total: plugins.size,
            active: activePlugins.size,
            healthy: 0,
            warning: 0,
            critical: 0,
            unknown: 0
        },
        plugins: {}
    };

    for (const [name, health] of pluginHealth.entries()) {
        const plugin = plugins.get(name);
        const metrics = pluginMetrics.get(name);

        healthReport.plugins[name] = {
            status: health.status,
            enabled: activePlugins.has(name),
            lastCheck: health.lastCheck,
            errorCount: health.errorCount,
            consecutiveErrors: health.consecutiveErrors,
            lastError: health.lastError,
            uptime: plugin ? Date.now() - plugin.meta.loadedAt.getTime() : 0,
            metrics: metrics
                ? {
                      totalExecutions: metrics.totalExecutions,
                      successRate:
                          metrics.totalExecutions > 0
                              ? (
                                    (metrics.successfulExecutions /
                                        metrics.totalExecutions) *
                                    100
                                ).toFixed(2)
                              : 0,
                      averageExecutionTime: Math.round(
                          metrics.averageExecutionTime
                      ),
                      peakExecutionTime: metrics.peakExecutionTime
                  }
                : null
        };

        // Count status untuk overview
        healthReport.overview[health.status]++;
    }

    return healthReport;
}

/**
 * Start health monitoring system
 */
function startHealthMonitoring() {
    if (healthTimer) {
        clearInterval(healthTimer);
    }

    healthTimer = setInterval(() => {
        performHealthCheck();
    }, config.healthCheckInterval);

    logger.info(
        `🏥 Health monitoring started (${
            config.healthCheckInterval / 1000
        }s interval)`
    );
}

/**
 * Perform health check untuk semua active plugins
 */
async function performHealthCheck() {
    for (const pluginName of activePlugins) {
        const plugin = plugins.get(pluginName);
        if (!plugin) continue;

        try {
            // Basic health check - pastikan plugin masih loadable
            if (typeof plugin.execute !== "function") {
                updatePluginHealth(
                    pluginName,
                    "critical",
                    new Error("Plugin corrupted")
                );
                continue;
            }

            // Check jika plugin punya custom health check
            if (typeof plugin.healthCheck === "function") {
                const healthResult = await plugin.healthCheck();
                updatePluginHealth(
                    pluginName,
                    healthResult.status || "healthy",
                    healthResult.error
                );
            } else {
                // Default health check - pastikan tidak ada consecutive errors
                const health = pluginHealth.get(pluginName);
                if (health && health.consecutiveErrors === 0) {
                    updatePluginHealth(pluginName, "healthy");
                }
            }
        } catch (error) {
            updatePluginHealth(pluginName, "error", error);
        }
    }
}

/**
 * Initialize file watcher untuk auto-reload
 */
async function initializeFileWatcher() {
    if (fileWatcher) {
        await fileWatcher.close();
    }

    const watchPaths = [config.pluginsDir];
    if (!config.corePluginsOnly) {
        watchPaths.push(config.customPluginsDir);
    }

    fileWatcher = chokidar.watch(watchPaths, config.watchOptions);

    fileWatcher.on("change", async filePath => {
        if (!filePath.endsWith(".js")) return;

        const pluginName = path.basename(filePath, ".js");
        logger.info(`🔄 File changed: ${pluginName}, reloading...`);

        try {
            await reloadPlugin(pluginName, null); // Context akan di-pass dari bot utama
            logger.success(`✅ Plugin ${pluginName} reloaded successfully`);
        } catch (error) {
            logger.error(
                `❌ Failed to reload plugin ${pluginName}: ${error.message}`
            );
        }
    });

    fileWatcher.on("add", async filePath => {
        if (!filePath.endsWith(".js")) return;

        const pluginName = path.basename(filePath, ".js");
        const type = filePath.includes(config.customPluginsDir)
            ? "custom"
            : "core";

        logger.info(`➕ New plugin detected: ${pluginName}`);

        try {
            await loadPlugin(filePath, pluginName, type);
            logger.success(`✅ New plugin ${pluginName} loaded successfully`);
        } catch (error) {
            logger.error(
                `❌ Failed to load new plugin ${pluginName}: ${error.message}`
            );
        }
    });

    fileWatcher.on("unlink", async filePath => {
        if (!filePath.endsWith(".js")) return;

        const pluginName = path.basename(filePath, ".js");

        if (plugins.has(pluginName)) {
            logger.info(`➖ Plugin file deleted: ${pluginName}, removing...`);

            try {
                await disablePlugin(pluginName);
                plugins.delete(pluginName);
                pluginHealth.delete(pluginName);
                pluginMetrics.delete(pluginName);
                pluginDependencies.delete(pluginName);

                logger.success(`✅ Plugin ${pluginName} removed successfully`);
            } catch (error) {
                logger.error(
                    `❌ Failed to remove plugin ${pluginName}: ${error.message}`
                );
            }
        }
    });

    watcherEnabled = true;
    logger.info(`👁️ File watcher initialized for auto-reload`);
}

/**
 * Register built-in management commands
 * @param {Object} context - Bot context
 */
function registerManagementCommands(context) {
    if (!context) return;

    // Command: .plugins - list semua plugin
    const pluginsCommand = {
        name: "plugins",
        description: "List all available plugins",
        aliases: ["pluginlist", "listplugins"],
        execute: async (message, socket) => {
            const pluginList = getPluginList(true);
            let response = `📦 *Plugin List* (${pluginList.length} total)\n\n`;

            for (const plugin of pluginList) {
                const status = plugin.enabled ? "✅" : "❌";
                const health = pluginHealth.get(plugin.name);
                const healthIcon = health ? getHealthIcon(health.status) : "❓";

                response += `${status} ${healthIcon} *${plugin.name}* v${plugin.version}\n`;
                response += `   📝 ${plugin.description}\n`;
                response += `   🏷️ Type: ${plugin.type}\n`;
                if (plugin.enabled && health) {
                    response += `   📊 Executions: ${
                        health.errorCount > 0
                            ? `${plugin.executionCount} (${health.errorCount} errors)`
                            : plugin.executionCount
                    }\n`;
                }
                response += "\n";
            }

            await socket.sendMessage(message.key.remoteJid, { text: response });
        }
    };

    // Command: .pluginstatus - detailed status
    const statusCommand = {
        name: "pluginstatus",
        description: "Show detailed plugin status and health",
        aliases: ["pstatus", "pluginhealth"],
        execute: async (message, socket) => {
            const health = getPluginHealth();

            let response = `🏥 *Plugin Health Report*\n\n`;
            response += `📊 *Overview:*\n`;
            response += `• Total: ${health.overview.total}\n`;
            response += `• Active: ${health.overview.active}\n`;
            response += `• 🟢 Healthy: ${health.overview.healthy}\n`;
            response += `• 🟡 Warning: ${health.overview.warning}\n`;
            response += `• 🔴 Critical: ${health.overview.critical}\n`;
            response += `• ❓ Unknown: ${health.overview.unknown}\n\n`;

            response += `📋 *Plugin Details:*\n`;
            for (const [name, pluginHealth] of Object.entries(health.plugins)) {
                const icon = getHealthIcon(pluginHealth.status);
                const enabledIcon = pluginHealth.enabled ? "✅" : "❌";

                response += `${enabledIcon} ${icon} *${name}*\n`;
                if (pluginHealth.metrics) {
                    response += `   📈 ${pluginHealth.metrics.totalExecutions} execs, ${pluginHealth.metrics.successRate}% success\n`;
                    response += `   ⏱️ Avg: ${pluginHealth.metrics.averageExecutionTime}ms\n`;
                }
                if (pluginHealth.errorCount > 0) {
                    response += `   ⚠️ ${pluginHealth.errorCount} errors\n`;
                }
                response += "\n";
            }

            await socket.sendMessage(message.key.remoteJid, { text: response });
        }
    };

    // Command: .reloadplugin <name> - reload specific plugin
    const reloadCommand = {
        name: "reloadplugin",
        description: "Reload a specific plugin",
        aliases: ["preload", "pluginreload"],
        execute: async (message, socket) => {
            const args = message.body.split(" ");
            if (args.length < 2) {
                await socket.sendMessage(message.key.remoteJid, {
                    text: "❌ Usage: .reloadplugin <plugin_name>"
                });
                return;
            }

            const pluginName = args[1];

            try {
                const success = await reloadPlugin(pluginName, context);
                if (success) {
                    await socket.sendMessage(message.key.remoteJid, {
                        text: `✅ Plugin *${pluginName}* reloaded successfully`
                    });
                } else {
                    await socket.sendMessage(message.key.remoteJid, {
                        text: `❌ Failed to reload plugin *${pluginName}*`
                    });
                }
            } catch (error) {
                await socket.sendMessage(message.key.remoteJid, {
                    text: `❌ Error reloading plugin *${pluginName}*: ${error.message}`
                });
            }
        }
    };

    // Register commands ke context jika tersedia command handler
    if (context.commandHandler) {
        context.commandHandler.register(pluginsCommand);
        context.commandHandler.register(statusCommand);
        context.commandHandler.register(reloadCommand);
    }
}

/**
 * Get health status icon
 * @param {string} status - Health status
 * @returns {string} - Icon
 */
function getHealthIcon(status) {
    switch (status) {
        case "healthy":
            return "🟢";
        case "warning":
            return "🟡";
        case "critical":
            return "🔴";
        case "error":
            return "🔴";
        default:
            return "❓";
    }
}

/**
 * Ensure custom plugins directory exists
 */
async function ensureCustomPluginsDir() {
    try {
        await fs.access(config.customPluginsDir);
    } catch (error) {
        if (error.code === "ENOENT") {
            await fs.mkdir(config.customPluginsDir, { recursive: true });
            logger.info(
                `📁 Created custom plugins directory: ${config.customPluginsDir}`
            );
        } else {
            throw error;
        }
    }
}

/**
 * Enable plugin dengan enhanced error handling
 * @param {string} pluginName - Plugin name
 * @param {Object} context - Bot context
 * @returns {Promise<boolean>} - Success status
 */
async function enablePlugin(pluginName, context) {
    try {
        const plugin = plugins.get(pluginName);

        if (!plugin) {
            logger.error(`❌ Plugin not found: ${pluginName}`);
            return false;
        }

        if (activePlugins.has(pluginName)) {
            logger.warn(`⚠️ Plugin ${pluginName} is already enabled`);
            return true;
        }

        // Check dependencies sebelum enable
        const depCheck = pluginDependencies.get(pluginName);
        if (depCheck && !depCheck.satisfied) {
            logger.error(
                `❌ Cannot enable ${pluginName}: dependencies not satisfied`
            );
            return false;
        }

        // Call plugin register function
        await plugin.register(context);

        // Mark as active
        activePlugins.add(pluginName);
        plugin.meta.enabled = true;
        plugin.meta.enabledAt = new Date();

        // Initialize health sebagai healthy
        updatePluginHealth(pluginName, "healthy");

        logger.success(`✅ Enabled plugin: ${pluginName}`);
        return true;
    } catch (error) {
        logger.error(
            `❌ Error enabling plugin ${pluginName}:\n${
                error.stack || error.message
            }`
        );
        updatePluginHealth(pluginName, "critical", error);
        return false;
    }
}

/**
 * Disable plugin dengan cleanup
 * @param {string} pluginName - Plugin name
 * @returns {Promise<boolean>} - Success status
 */
async function disablePlugin(pluginName) {
    try {
        const plugin = plugins.get(pluginName);

        if (!plugin) {
            logger.warn(`⚠️ Plugin not found: ${pluginName}`);
            return false;
        }

        if (!activePlugins.has(pluginName)) {
            logger.warn(`⚠️ Plugin ${pluginName} is already disabled`);
            return true;
        }

        // Call plugin deactivate function jika ada
        if (typeof plugin.deactivate === "function") {
            try {
                await plugin.deactivate();
            } catch (error) {
                logger.warn(
                    `⚠️ Error during plugin ${pluginName} deactivation: ${error.message}`
                );
            }
        }

        // Remove from active plugins
        activePlugins.delete(pluginName);
        plugin.meta.enabled = false;
        plugin.meta.disabledAt = new Date();

        // Update health status
        updatePluginHealth(pluginName, "disabled");

        logger.success(`✅ Disabled plugin: ${pluginName}`);
        return true;
    } catch (error) {
        logger.error(
            `❌ Error disabling plugin ${pluginName}: ${error.message}`
        );
        return false;
    }
}

/**
 * Enable all plugins
 * @param {Object} context - Bot context
 * @returns {Promise<Object>} - Results summary
 */
async function enableAllPlugins(context) {
    const results = {
        total: plugins.size,
        enabled: 0,
        failed: 0,
        errors: []
    };

    logger.info(`🚀 Enabling all plugins (${plugins.size} total)...`);

    for (const [pluginName] of plugins) {
        try {
            const success = await enablePlugin(pluginName, context);
            if (success) {
                results.enabled++;
            } else {
                results.failed++;
                results.errors.push(`${pluginName}: Failed to enable`);
            }
        } catch (error) {
            results.failed++;
            results.errors.push(`${pluginName}: ${error.message}`);
        }
    }

    logger.info(
        `✅ Plugin enablement complete: ${results.enabled}/${results.total} enabled`
    );

    if (results.failed > 0) {
        logger.warn(`⚠️ ${results.failed} plugins failed to enable`);
        results.errors.forEach(error => logger.error(`  - ${error}`));
    }

    return results;
}

/**
 * Reload specific plugin
 * @param {string} pluginName - Plugin name
 * @param {Object} context - Bot context
 * @returns {Promise<boolean>} - Success status
 */
async function reloadPlugin(pluginName, context) {
    try {
        const plugin = plugins.get(pluginName);

        if (!plugin) {
            logger.error(`❌ Plugin not found: ${pluginName}`);
            return false;
        }

        const wasEnabled = activePlugins.has(pluginName);
        const filePath = plugin.meta.filePath;
        const type = plugin.meta.type;

        logger.info(`🔄 Reloading plugin: ${pluginName}`);

        // Disable plugin terlebih dahulu
        if (wasEnabled) {
            await disablePlugin(pluginName);
        }

        // Remove dari semua tracking
        plugins.delete(pluginName);
        pluginHealth.delete(pluginName);
        pluginMetrics.delete(pluginName);
        pluginDependencies.delete(pluginName);

        // Reload plugin
        const loadSuccess = await loadPlugin(filePath, pluginName, type);

        if (!loadSuccess) {
            logger.error(`❌ Failed to reload plugin: ${pluginName}`);
            return false;
        }

        // Enable kembali jika sebelumnya enabled
        if (wasEnabled && context) {
            const enableSuccess = await enablePlugin(pluginName, context);
            if (!enableSuccess) {
                logger.warn(
                    `⚠️ Plugin ${pluginName} reloaded but failed to enable`
                );
                return false;
            }
        }

        logger.success(`✅ Plugin ${pluginName} reloaded successfully`);
        return true;
    } catch (error) {
        logger.error(
            `❌ Error reloading plugin ${pluginName}: ${error.message}`
        );
        return false;
    }
}

/**
 * Get plugin list dengan detailed info
 * @param {boolean} detailed - Include detailed info
 * @returns {Array} - Plugin list
 */
function getPluginList(detailed = false) {
    const pluginList = [];

    for (const [name, plugin] of plugins) {
        const baseInfo = {
            name: plugin.name,
            description: plugin.description,
            version: plugin.version,
            author: plugin.author,
            type: plugin.meta.type,
            enabled: activePlugins.has(name),
            aliases: plugin.aliases || []
        };

        if (detailed) {
            const health = pluginHealth.get(name);
            const metrics = pluginMetrics.get(name);

            baseInfo.health = health
                ? {
                      status: health.status,
                      errorCount: health.errorCount,
                      lastCheck: health.lastCheck
                  }
                : null;

            baseInfo.metrics = metrics
                ? {
                      totalExecutions: metrics.totalExecutions,
                      successRate:
                          metrics.totalExecutions > 0
                              ? (
                                    (metrics.successfulExecutions /
                                        metrics.totalExecutions) *
                                    100
                                ).toFixed(2)
                              : 0,
                      averageExecutionTime: Math.round(
                          metrics.averageExecutionTime
                      )
                  }
                : null;

            baseInfo.meta = {
                loadedAt: plugin.meta.loadedAt,
                executionCount: plugin.meta.executionCount,
                filePath: plugin.meta.filePath
            };
        }

        pluginList.push(baseInfo);
    }

    // Sort by name
    return pluginList.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get plugin by name
 * @param {string} name - Plugin name
 * @returns {Object|null} - Plugin object or null
 */
function getPlugin(name) {
    return plugins.get(name) || null;
}

/**
 * Check if plugin is enabled
 * @param {string} name - Plugin name
 * @returns {boolean} - Enabled status
 */
function isPluginEnabled(name) {
    return activePlugins.has(name);
}

/**
 * Check if plugin exists (alias for hasPlugin)
 * @param {string} name - Plugin name
 * @returns {boolean} - Exists status
 */
function hasPlugin(name) {
    return plugins.has(name);
}

/**
 * Get plugin by alias
 * @param {string} alias - Plugin alias
 * @returns {Object|null} - Plugin object or null
 */
function getPluginByAlias(alias) {
    for (const [, plugin] of plugins) {
        if (plugin.aliases && plugin.aliases.includes(alias)) {
            return plugin;
        }
    }
    return null;
}

/**
 * Register plugin shutdown hooks
 */
function registerPluginShutdownHook() {
    registerShutdownHook(
        async () => {
            logger.info("🔌 Shutting down plugin system...");

            // Stop health monitoring
            if (healthTimer) {
                clearInterval(healthTimer);
                healthTimer = null;
            }

            // Stop file watcher
            if (fileWatcher) {
                await fileWatcher.close();
                fileWatcher = null;
                watcherEnabled = false;
            }

            // Disable all plugins
            const disablePromises = [];
            for (const pluginName of activePlugins) {
                disablePromises.push(disablePlugin(pluginName));
            }

            await Promise.allSettled(disablePromises);

            // Clear all data
            plugins.clear();
            activePlugins.clear();
            pluginHealth.clear();
            pluginMetrics.clear();
            pluginDependencies.clear();

            logger.success("✅ Plugin system shutdown complete");
        },
        "Plugin System",
        800
    ); // High priority untuk cleanup yang proper
}

/**
 * Get plugin execution statistics
 * @returns {Object} - Execution statistics
 */
function getPluginStats() {
    const stats = {
        overview: {
            totalPlugins: plugins.size,
            activePlugins: activePlugins.size,
            totalExecutions: 0,
            totalExecutionTime: 0,
            successfulExecutions: 0,
            failedExecutions: 0
        },
        plugins: {}
    };

    for (const [name, metrics] of pluginMetrics) {
        stats.overview.totalExecutions += metrics.totalExecutions;
        stats.overview.totalExecutionTime += metrics.totalExecutionTime;
        stats.overview.successfulExecutions += metrics.successfulExecutions;
        stats.overview.failedExecutions += metrics.failedExecutions;

        stats.plugins[name] = {
            executions: metrics.totalExecutions,
            successRate:
                metrics.totalExecutions > 0
                    ? (
                          (metrics.successfulExecutions /
                              metrics.totalExecutions) *
                          100
                      ).toFixed(2)
                    : 0,
            averageTime: Math.round(metrics.averageExecutionTime),
            peakTime: metrics.peakExecutionTime,
            lastExecution: metrics.lastExecutionTime
        };
    }

    stats.overview.averageExecutionTime =
        stats.overview.totalExecutions > 0
            ? Math.round(
                  stats.overview.totalExecutionTime /
                      stats.overview.totalExecutions
              )
            : 0;

    stats.overview.overallSuccessRate =
        stats.overview.totalExecutions > 0
            ? (
                  (stats.overview.successfulExecutions /
                      stats.overview.totalExecutions) *
                  100
              ).toFixed(2)
            : 0;

    return stats;
}

/**
 * Cleanup plugin metrics (remove old data)
 * @param {number} maxAge - Maximum age in milliseconds
 */
function cleanupMetrics(maxAge = 24 * 60 * 60 * 1000) {
    // Default 24 hours
    const cutoffTime = Date.now() - maxAge;

    for (const [pluginName, metrics] of pluginMetrics) {
        if (
            metrics.lastExecutionTime &&
            metrics.lastExecutionTime.getTime() < cutoffTime
        ) {
            // Reset metrics untuk plugin yang tidak digunakan dalam waktu lama
            metrics.totalExecutions = 0;
            metrics.successfulExecutions = 0;
            metrics.failedExecutions = 0;
            metrics.totalExecutionTime = 0;
            metrics.averageExecutionTime = 0;
            metrics.peakExecutionTime = 0;
            metrics.lastExecutionTime = null;

            logger.debug(`🧹 Cleaned up metrics for plugin: ${pluginName}`);
        }
    }
}

/**
 * Export configuration untuk external access
 * @returns {Object} - Current configuration
 */
function getPluginConfig() {
    return { ...config };
}

/**
 * Update plugin system configuration
 * @param {Object} newConfig - New configuration
 */
function updatePluginConfig(newConfig) {
    Object.assign(config, newConfig);
    logger.info("⚙️ Plugin system configuration updated");
}

/**
 * Get plugin dependency tree
 * @returns {Object} - Dependency tree
 */
function getDependencyTree() {
    const tree = {};

    for (const [pluginName, plugin] of plugins) {
        tree[pluginName] = {
            dependencies: Object.keys(plugin.dependencies || {}),
            dependents: []
        };
    }

    // Find dependents
    for (const [pluginName, plugin] of plugins) {
        const deps = Object.keys(plugin.dependencies || {});
        for (const dep of deps) {
            if (tree[dep]) {
                tree[dep].dependents.push(pluginName);
            }
        }
    }

    return tree;
}

/**
 * Validate plugin can be safely disabled (no dependents)
 * @param {string} pluginName - Plugin name
 * @returns {Object} - Validation result
 */
function validatePluginDisable(pluginName) {
    const tree = getDependencyTree();
    const plugin = tree[pluginName];

    if (!plugin) {
        return { valid: false, reason: "Plugin not found" };
    }

    const activeDependents = plugin.dependents.filter(dep =>
        activePlugins.has(dep)
    );

    if (activeDependents.length > 0) {
        return {
            valid: false,
            reason: `Plugin has active dependents: ${activeDependents.join(
                ", "
            )}`
        };
    }

    return { valid: true };
}

async function reloadAll() {
    await initializePlugins();
    return getPluginList().length;
}

// Auto-cleanup metrics setiap jam
setInterval(
    () => {
        cleanupMetrics();
    },
    60 * 60 * 1000
);

// Register shutdown hook
registerPluginShutdownHook();

// Export semua functions
module.exports = {
    // Core functions
    initializePlugins,
    loadPluginsFromDirectory,
    loadPlugin,
    runPluginSafely,
    registerManagementCommands,

    // Plugin management
    enablePlugin,
    disablePlugin,
    enableAllPlugins,
    reloadPlugin,
    reloadAll,

    // Plugin info
    getPluginList,
    getPlugin,
    isPluginEnabled,
    hasPlugin,
    getPluginByAlias,

    // Health & monitoring
    getPluginHealth,
    getPluginStats,
    cleanupMetrics,

    // Configuration
    getPluginConfig,
    updatePluginConfig,

    // Dependencies
    checkPluginDependencies,
    getDependencyTree,
    validatePluginDisable,

    // Internal state (for debugging/advanced usage)
    _getInternalState: () => ({
        plugins: plugins,
        activePlugins: activePlugins,
        pluginHealth: pluginHealth,
        pluginMetrics: pluginMetrics,
        config: config,
        watcherEnabled: watcherEnabled
    })
};
