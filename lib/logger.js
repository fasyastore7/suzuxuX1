const fs          = require("fs");
const path        = require("path");
const chalk       = require("chalk");
const winston     = require("winston");

// Folder dan file log
const logsDir     = path.join(process.cwd(), "logs");
const fallbackLog = path.join(logsDir, "combined-fallback.log");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Helper waktu
const timestamp = () =>
    new Date().toISOString().replace("T", " ").substring(0, 19);
const shortTime = () =>
    new Date().toLocaleTimeString("id-ID", { hour12: false });

// Fungsi fallback log ke file
const appendLogLine = (level, message) => {
    const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFileSync(fallbackLog, line);
};

// Winston format & instance
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
        ({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`
    )
);

const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const baseLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || "debug",
    transports: [
        new winston.transports.Console({ format: consoleFormat }),
        new winston.transports.File({
            filename: path.join(logsDir, "combined.log"),
            format: fileFormat
        }),
        new winston.transports.File({
            filename: path.join(logsDir, "error.log"),
            level: "error",
            format: fileFormat
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, "exceptions.log"),
            format: fileFormat
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, "rejections.log"),
            format: fileFormat
        })
    ],
    exitOnError: false
});

// Enhanced logger
const logger = {
    // Winston-passthrough
    info: (...args) => baseLogger.info(...args),
    warn: (...args) => baseLogger.warn(...args),
    error: (...args) => {
        const msg = args
            .map(arg => {
                if (arg instanceof Error) return arg.stack;
                if (typeof arg === "object") return JSON.stringify(arg);
                return String(arg);
            })
            .join(" | ");
        baseLogger.error(msg);
    },
    debug: (label, msg) => {
        if (!msg) return;
        baseLogger.debug(`[${label}] ${msg}`);
    },
    verbose: (...args) => baseLogger.verbose(...args),
    trace: (msg, meta = {}) => {
        if (
            process.env.LOG_LEVEL === "trace" ||
            process.env.NODE_ENV === "development"
        ) {
            baseLogger.debug(`[TRACE] ${msg}`, meta);
        }
    },

    // CLI-visual methods
    success(title = "SUCCESS", msg = "") {
        const formatted =
            chalk.bgGreen.black(` ${title} `) + " " + chalk.greenBright(msg);
        console.log(formatted);
        appendLogLine("success", `${title}: ${msg}`);
    },

    danger(title = "ERROR", msg = "") {
        const formatted =
            chalk.bgRed.white(` ${title} `) + " " + chalk.redBright(msg);
        console.log(formatted);
        appendLogLine("danger", `${title}: ${msg}`);
    },

    logWithTime(source = "System", message = "", color = "cyan") {
        const time = chalk.gray(`[${shortTime()}]`);
        const label = chalk.yellow(source);
        const colored = chalk[color]?.(message) || message;
        console.log(`${time} ${label}: ${colored}`);
        appendLogLine(color, `${source}: ${message}`);
    },

    logToFileOnly(level = "info", msg = "") {
        appendLogLine(level, msg);
    },

    // Akses mentah winston jika dibutuhkan
    getWinston() {
        return baseLogger;
    }
};

module.exports = logger;
