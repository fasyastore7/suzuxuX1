const crypto     = require("crypto");
const fsp        = require("fs/promises");
const path       = require("path");
const { dbPath } = require('@start/config/paths');
const fileHelper = require('@lib/fileHelper');
const logger     = require("@lib/logger");
const config     = require("@config");

/**
 * UserAccess - Robust user and owner management system
 * Handles user data, premium status, owner permissions with proper error handling
 */
class UserAccess {
    constructor() {
        this.lastSavedHashes = {};

        this.paths = {
            users: path.join(dbPath, 'users.json'),
            owners: path.join(dbPath, 'owner.json'),
            premium: path.join(dbPath, 'premium.json')
        };

        // In-memory databases
        this.db = {
            users: {},
            owners: [],
            premium: []
        };

        // Configuration
        this.config = {
            autosaveInterval: 60 * 1000, // 60 seconds
            msInDay: 24 * 60 * 60 * 1000,
            defaultUserData: {
                money: 0,
                limit: 0,
                level: 1,
                exp: 0,
                premium: null,
                banned: false,
                warning: 0
            }
        };

        // Internal state
        this.isInitialized = false;
        this.savingQueues = new Map();
        this.autosaveTimers = new Map();

        // Initialize saving queues
        Object.keys(this.paths).forEach(key => {
            this.savingQueues.set(key, Promise.resolve());
        });

        // Auto-initialize
        this.initialize().catch(error => {
            logger.error(
                "UserAccess",
                `Failed to initialize: ${error.message}`
            );
        });
    }

    /**
     * Initialize the UserAccess system
     */
    async initialize() {
        try {
            logger.info("UserAccess", "Initializing user access system...");

            // Load all databases
            await Promise.all([
                this.loadUsers(),
                this.loadOwners(),
                this.loadPremium()
            ]);

            // Start autosave intervals
            this.startAutosave();

            this.isInitialized = true;
            logger.success(
                "UserAccess",
                "User access system initialized successfully"
            );

            // Setup graceful shutdown
            this.setupGracefulShutdown();
        } catch (error) {
            logger.error(
                "UserAccess",
                `Initialization failed: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Ensure system is initialized before operations
     */
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error(
                "UserAccess system not initialized. Please wait for initialization to complete."
            );
        }
    }

    // ====== FILE OPERATIONS ======

    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fsp.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Safe JSON file loading with validation
     */
    async loadJsonFile(filePath, defaultValue = null, validator = null) {
        try {
            if (!(await this.fileExists(filePath))) {
                await fileHelper.saveJsonFile(filePath, defaultValue);
                return defaultValue;
            }

            const data = await fsp.readFile(filePath, "utf8");
            const parsed = JSON.parse(data);

            // Validate data if validator provided
            if (validator && !validator(parsed)) {
                logger.warn(
                    "UserAccess",
                    `Invalid data format in ${filePath}, using default`
                );
                return defaultValue;
            }

            return parsed;
        } catch (error) {
            logger.error(
                "UserAccess",
                `Error loading ${filePath}: ${error?.message || error}`
            );
            return defaultValue;
        }
    }

    /**
     * Safe data saving with queue system
     */
    async saveData(type, data) {
    const queue = this.savingQueues.get(type);
    const filePath = this.paths[type];

    this.savingQueues.set(
        type,
        queue.then(async () => {
            try {
                const currentHash = this.getHash(data);

                if (this.lastSavedHashes[type] === currentHash) {
                    logger.debug("UserAccess", `No changes detected in ${type}, skipping save`);
                    return;
                }

                await fileHelper.saveJsonFile(filePath, data);
                this.lastSavedHashes[type] = currentHash;

                logger.debug("UserAccess", `Saved ${type} data successfully`);
            } catch (error) {
                logger.error("UserAccess", `Failed to save ${type} data: ${error?.message || error}`);
                throw error;
            }
        })
    );

    return this.savingQueues.get(type);
}

    // ====== DATABASE LOADERS ======

    /**
     * Load users database
     */
    async loadUsers() {
        const validator = data =>
            typeof data === "object" && !Array.isArray(data);
        this.db.users = await this.loadJsonFile(
            this.paths.users,
            {},
            validator
        );
        this.lastSavedHashes.users = this.getHash(this.db.users);
        logger.info(
            "UserAccess",
            `Loaded ${Object.keys(this.db.users).length} users`
        );
    }

    /**
     * Load owners database
     */
    async loadOwners() {
        const validator = data => Array.isArray(data);
        this.db.owners = await this.loadJsonFile(
            this.paths.owners,
            [],
            validator
        );
        this.lastSavedHashes.owners = this.getHash(this.db.owners);
        logger.info(
            "UserAccess",
            `Loaded ${this.db.owners.length} additional owners`
        );
    }

    /**
     * Load premium users database
     */
    async loadPremium() {
        const validator = data => Array.isArray(data);
        this.db.premium = await this.loadJsonFile(
            this.paths.premium,
            [],
            validator
        );
        this.lastSavedHashes.premium = this.getHash(this.db.premium);
        logger.info(
            "UserAccess",
            `Loaded ${this.db.premium.length} premium users`
        );
    }

    // ====== USER MANAGEMENT ======

    /**
     * Get all users data
     */
    getAllUsers() {
        this.ensureInitialized();
        return { ...this.db.users };
    }

    /**
     * Add new user with validation
     */
    addUser(userId, userData = {}) {
        this.ensureInitialized();

        if (!userId || typeof userId !== "string") {
            throw new Error("Invalid user ID provided");
        }

        if (this.db.users[userId]) {
            return false; // User already exists
        }

        // Validate and sanitize user data
        const sanitizedData = this.sanitizeUserData(userData);

        this.db.users[userId] = {
            ...this.config.defaultUserData,
            ...sanitizedData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        logger.debug("UserAccess", `Added new user: ${userId}`);
        return true;
    }

    /**
     * Update user data with validation
     */
    updateUser(userId, updateData) {
        this.ensureInitialized();

        if (!userId || !this.db.users[userId]) {
            return false;
        }

        // Sanitize update data
        const sanitizedData = this.sanitizeUserData(updateData);

        this.db.users[userId] = {
            ...this.db.users[userId],
            ...sanitizedData,
            updatedAt: new Date().toISOString()
        };

        logger.debug("UserAccess", `Updated user: ${userId}`);
        return true;
    }

    /**
     * Delete user
     */
    deleteUser(userId) {
        this.ensureInitialized();

        if (!userId || !this.db.users[userId]) {
            return false;
        }

        delete this.db.users[userId];
        logger.debug("UserAccess", `Deleted user: ${userId}`);
        return true;
    }

    /**
     * Find user by ID
     */
    findUser(userId) {
        this.ensureInitialized();
        return this.db.users[userId] ? { ...this.db.users[userId] } : null;
    }

    /**
     * Get or create user (ensures user exists)
     */
    getOrCreateUser(userId, initialData = {}) {
        this.ensureInitialized();

        if (!this.db.users[userId]) {
            this.addUser(userId, initialData);
        }

        return this.findUser(userId);
    }

    /**
     * Sanitize user data
     */
    sanitizeUserData(data) {
        const sanitized = {};

        // Numeric fields
        ["money", "limit", "level", "exp", "warning"].forEach(field => {
            if (data[field] !== undefined) {
                const value = Number(data[field]);
                sanitized[field] = isNaN(value)
                    ? 0
                    : Math.max(0, Math.floor(value));
            }
        });

        // Boolean fields
        ["banned"].forEach(field => {
            if (data[field] !== undefined) {
                sanitized[field] = Boolean(data[field]);
            }
        });

        // Date fields
        ["premium"].forEach(field => {
            if (data[field] !== undefined) {
                if (data[field] === null) {
                    sanitized[field] = null;
                } else {
                    const date = new Date(data[field]);
                    sanitized[field] = isNaN(date.getTime())
                        ? null
                        : date.toISOString();
                }
            }
        });

        // String fields
        ["name", "status"].forEach(field => {
            if (data[field] !== undefined) {
                sanitized[field] = String(data[field]).trim();
            }
        });

        return sanitized;
    }

    // ====== USER QUERIES ======

    /**
     * Get inactive users
     */
    getInactiveUsers(days = 7) {
        this.ensureInitialized();
        const cutoffTime = Date.now() - days * this.config.msInDay;

        return Object.entries(this.db.users)
            .filter(([_, userData]) => {
                if (!userData.updatedAt) return true;
                return new Date(userData.updatedAt).getTime() < cutoffTime;
            })
            .map(([id, userData]) => ({
                id,
                updatedAt: userData.updatedAt,
                daysSinceUpdate: Math.floor(
                    (Date.now() - new Date(userData.updatedAt).getTime()) /
                        this.config.msInDay
                )
            }));
    }

    /**
     * Get active users
     */
    getActiveUsers(days = 7) {
        this.ensureInitialized();
        const cutoffTime = Date.now() - days * this.config.msInDay;

        return Object.entries(this.db.users)
            .filter(([_, userData]) => {
                if (!userData.updatedAt) return false;
                return new Date(userData.updatedAt).getTime() >= cutoffTime;
            })
            .map(([id, userData]) => ({
                id,
                updatedAt: userData.updatedAt,
                daysSinceUpdate: Math.floor(
                    (Date.now() - new Date(userData.updatedAt).getTime()) /
                        this.config.msInDay
                )
            }));
    }

    /**
     * Get user statistics
     */
    getUserStats() {
        this.ensureInitialized();
        const totalUsers = Object.keys(this.db.users).length;
        const activeUsers = this.getActiveUsers(7).length;
        const premiumUsers = Object.values(this.db.users).filter(user =>
            this.isPremiumUser(user)
        ).length;
        const bannedUsers = Object.values(this.db.users).filter(
            user => user.banned
        ).length;

        return {
            total: totalUsers,
            active: activeUsers,
            inactive: totalUsers - activeUsers,
            premium: premiumUsers,
            banned: bannedUsers
        };
    }

    // ====== PREMIUM MANAGEMENT ======

    /**
     * Check if user is premium
     */
    isPremiumUser(userIdOrData) {
        this.ensureInitialized();

        let userData;
        if (typeof userIdOrData === "string") {
            userData = this.db.users[userIdOrData];
        } else {
            userData = userIdOrData;
        }

        if (!userData || !userData.premium) return false;

        const premiumDate = new Date(userData.premium);
        return !isNaN(premiumDate.getTime()) && premiumDate > new Date();
    }

    /**
     * Add premium to user
     */
    addPremium(userId, duration = 30, unit = "days") {
        this.ensureInitialized();

        const user = this.getOrCreateUser(userId);
        const currentDate = new Date();

        // If user already has premium, extend from current expiry
        const startDate = this.isPremiumUser(user)
            ? new Date(user.premium)
            : currentDate;

        let premiumEnd;
        switch (unit) {
            case "hours":
                premiumEnd = new Date(
                    startDate.getTime() + duration * 60 * 60 * 1000
                );
                break;
            case "days":
                premiumEnd = new Date(
                    startDate.getTime() + duration * this.config.msInDay
                );
                break;
            case "months":
                premiumEnd = new Date(startDate);
                premiumEnd.setMonth(premiumEnd.getMonth() + duration);
                break;
            default:
                throw new Error(
                    "Invalid duration unit. Use: hours, days, or months"
                );
        }

        this.updateUser(userId, { premium: premiumEnd.toISOString() });
        logger.info(
            "UserAccess",
            `Added ${duration} ${unit} premium to user: ${userId}`
        );

        return premiumEnd;
    }

    /**
     * Remove premium from user
     */
    removePremium(userId) {
        this.ensureInitialized();
        return this.updateUser(userId, { premium: null });
    }

    // ====== OWNER MANAGEMENT ======

    /**
     * Check if user is owner
     */
    isOwner(remoteJid) {
        this.ensureInitialized();

        // Get JID without @s.whatsapp.net for comparison
        const cleanJid = remoteJid.replace("@s.whatsapp.net", "");

        // Check config owners
        const configOwners = config.owner_number || [];
        if (configOwners.includes(cleanJid)) return true;

        // Check database owners
        return this.db.owners.some(owner => {
            const ownerNumber =
                typeof owner === "object" ? owner.number : owner;
            return ownerNumber === cleanJid;
        });
    }

    /**
     * Get all owners
     */
    getAllOwners() {
        this.ensureInitialized();
        const configOwners = (config.owner_number || []).map(number => ({
            number,
            type: "config",
            added_at: null,
            added_by: "system"
        }));

        const dbOwners = this.db.owners.map(owner => {
            if (typeof owner === "object") {
                return { ...owner, type: "database" };
            }
            return {
                number: owner,
                type: "database",
                added_at: null,
                added_by: "unknown"
            };
        });

        return [...configOwners, ...dbOwners];
    }

    /**
     * Add owner
     */
    addOwner(number, addedBy = "system") {
        this.ensureInitialized();

        if (!number || typeof number !== "string") {
            throw new Error("Invalid phone number provided");
        }

        const cleanNumber = number.replace(/[^\d]/g, "");
        if (!cleanNumber) {
            throw new Error("Phone number must contain digits");
        }

        // Check if already owner
        if (this.isOwner(`${cleanNumber}@s.whatsapp.net`)) {
            return false;
        }

        const ownerData = {
            number: cleanNumber,
            added_by: addedBy,
            added_at: new Date().toISOString()
        };

        this.db.owners.push(ownerData);
        logger.info("UserAccess", `Added new owner: ${cleanNumber}`);
        return true;
    }

    /**
     * Remove owner
     */
    removeOwner(number) {
        this.ensureInitialized();

        const cleanNumber = number.replace(/[^\d]/g, "");
        const initialLength = this.db.owners.length;

        this.db.owners = this.db.owners.filter(owner => {
            const ownerNumber =
                typeof owner === "object" ? owner.number : owner;
            return ownerNumber !== cleanNumber;
        });

        const removed = this.db.owners.length < initialLength;
        if (removed) {
            logger.info("UserAccess", `Removed owner: ${cleanNumber}`);
        }

        return removed;
    }

    // ====== BULK OPERATIONS ======

    /**
     * Reset specific user field for all users
     */
    async resetUserField(field, value = 0) {
        this.ensureInitialized();

        if (!this.config.defaultUserData.hasOwnProperty(field)) {
            throw new Error(`Invalid field: ${field}`);
        }

        let resetCount = 0;
        for (const userId in this.db.users) {
            if (this.db.users[userId][field] !== undefined) {
                this.db.users[userId][field] = value;
                this.db.users[userId].updatedAt = new Date().toISOString();
                resetCount++;
            }
        }

        logger.info("UserAccess", `Reset ${field} for ${resetCount} users`);
        return resetCount;
    }

    /**
     * Clean up inactive users
     */
    async cleanupInactiveUsers(days = 30) {
        this.ensureInitialized();

        const inactiveUsers = this.getInactiveUsers(days);
        let deletedCount = 0;

        for (const { id } of inactiveUsers) {
            if (this.deleteUser(id)) {
                deletedCount++;
            }
        }

        logger.info(
            "UserAccess",
            `Cleaned up ${deletedCount} inactive users (${days}+ days)`
        );
        return deletedCount;
    }

    /**
     * Reset all users
     */
    async resetAllUsers() {
        this.ensureInitialized();
        const userCount = Object.keys(this.db.users).length;
        this.db.users = {};
        logger.warn(
            "UserAccess",
            `Reset all users database (${userCount} users removed)`
        );
        return userCount;
    }

    /**
     * Reset all owners
     */
    async resetAllOwners() {
        this.ensureInitialized();
        const ownerCount = this.db.owners.length;
        this.db.owners = [];
        logger.warn(
            "UserAccess",
            `Reset all owners database (${ownerCount} owners removed)`
        );
        return ownerCount;
    }

    // ====== AUTOSAVE SYSTEM ======

    /**
     * Start autosave intervals
     */
    startAutosave() {
        Object.keys(this.paths).forEach(type => {
            const timer = setInterval(() => {
                this.saveData(type, this.db[type]).catch(error => {
                    logger.error(
                        "UserAccess",
                        `Autosave failed for ${type}: ${
                            error?.message || error
                        }`
                    );
                });
            }, this.config.autosaveInterval);

            this.autosaveTimers.set(type, timer);
        });

        logger.info(
            "UserAccess",
            `Autosave started (interval: ${
                this.config.autosaveInterval / 1000
            }s)`
        );
    }

    /**
     * Stop autosave intervals
     */
    stopAutosave() {
        this.autosaveTimers.forEach((timer, type) => {
            clearInterval(timer);
            logger.debug("UserAccess", `Stopped autosave for ${type}`);
        });
        this.autosaveTimers.clear();
    }

    /**
     * Manual save all data
     */
    async saveAll() {
        this.ensureInitialized();

        const savePromises = Object.entries(this.db).map(([type, data]) =>
            this.saveData(type, data)
        );

        await Promise.all(savePromises);
        logger.info("UserAccess", "Manual save completed for all databases");
    }

    // ====== SYSTEM MANAGEMENT ======

    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const shutdownHandler = async signal => {
            logger.info(
                "UserAccess",
                `Received ${signal}, performing graceful shutdown...`
            );
            await this.shutdown();
            process.exit(0);
        };

        process.on("SIGINT", shutdownHandler);
        process.on("SIGTERM", shutdownHandler);
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        try {
            logger.info("UserAccess", "Shutting down user access system...");

            // Stop autosave
            this.stopAutosave();

            // Save all data
            await this.saveAll();

            logger.success(
                "UserAccess",
                "User access system shutdown completed"
            );
        } catch (error) {
            logger.error(
                "UserAccess",
                `Shutdown error: ${error?.message || error}`
            );
            throw error;
        }
    }

    /**
     * Get system health status
     */
    getHealthStatus() {
        return {
            initialized: this.isInitialized,
            databases: {
                users: Object.keys(this.db.users).length,
                owners: this.db.owners.length,
                premium: this.db.premium.length
            },
            autosave: this.autosaveTimers.size > 0,
            uptime: process.uptime()
        };
    }
    
    getHash(data) {
    return crypto.createHash("sha1").update(JSON.stringify(data)).digest("hex");
    }
}

// Create singleton instance
const userAccess = new UserAccess();

// Export both class and instance for flexibility
module.exports = userAccess;
module.exports.UserAccess = UserAccess;
