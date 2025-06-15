const os                    = require("os");
const chalk                 = require("chalk");
const figlet                = require("figlet");
const axios                 = require("axios");
const config                = require("@config");
const logger                = require("@lib/logger");
const { connectToWhatsApp } = require("@start/connection/connection");

const TERMINAL_WIDTH        = process.stdout.columns || 45; // Default ke 45 jika tidak tersedia
const ALIGNMENT_PADDING     = 5;

const horizontalLine = (length = TERMINAL_WIDTH, char = "=") =>
    char.repeat(length);

let cachedIP = null;
const getPublicIP = async () => {
    try {
        // Jika IP sudah ada di cache, gunakan dari cache
        if (cachedIP) {
            return cachedIP;
        }
        const response = await axios.get("https://api.ipify.org?format=json");
        cachedIP = response.data.ip; // Simpan IP ke dalam cache
        return cachedIP;
    } catch (error) {
        throw new Error("Tidak dapat mengambil IP publik");
    }
};

const getServerSpecs = async () => ({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    totalMemory: `${(os.totalmem() / 1024 ** 3).toFixed(2)} GB`,
    freeMemory: `${(os.freemem() / 1024 ** 3).toFixed(2)} GB`,
    uptime: `${(os.uptime() / 3600).toFixed(2)} hours`,
    publicIp: await getPublicIP(),
    mode: config.mode
});

const getStatusApikey = async () => {
    try {
        const response = await axios.get(
            `https://api.syystore.com/check_apikey?apikey=${config.APIKEY}`
        );
        const { limit_apikey } = response.data || {};
        if (limit_apikey <= 0) return chalk.redBright("Limit Habis");
        return chalk.green(limit_apikey);
    } catch (error) {
        if (error.response) {
            const { status, data } = error.response;
            const errorCode = data?.error_code;
            const errorMessage = data?.message;

            // Tangani status kode HTTP tertentu
            if (status === 403) return status;
            if (status === 404)
                return chalk.redBright(
                    "Not Found: Invalid endpoint or resource"
                );
            if (status === 401)
                return chalk.redBright(
                    "Unauthorized: API key is missing or invalid"
                );

            // Tangani error kode khusus dalam response
            if (errorCode === "LIMIT_REACHED")
                return chalk.redBright(
                    `LIMIT_REACHED (${errorMessage || "No message"})`
                );
            if (errorCode === "INVALID_API_KEY")
                return chalk.redBright("INVALID_API_KEY");
        }
        return chalk.red("Error fetching API status");
    }
};

async function showServerInfo(e = {}) {
    const { title: t = "FASYA", borderChar: o = "=", color: i = "cyan" } = e,
        n = {
            horizontalLayout: TERMINAL_WIDTH > 40 ? "default" : "fitted",
            width: Math.min(TERMINAL_WIDTH - 4, 40)
        },
        a = await getServerSpecs(),
        s = await getStatusApikey();
    if (403 == s) {
        console.log("--------------------"),
            danger("Error ⚠️", "Forbidden: API key is not authorized"),
            danger(
                "Error ⚠️",
                `Solusi: Tambahkan ip anda ${await getPublicIP()} ke dalam whitelist`
            ),
            success("IP", await getPublicIP()),
            success("Info", "Kunjungi linknya dan tambahkan ip kamu"),
            console.log("https://syystore.com/services/rest-api"),
            console.log("--------------------");
        const e = e => new Promise(t => setTimeout(t, e));
        return await e(3e4), void process.exit();
    }
    const r = [
            "◧ Hostname",
            "◧ Platform",
            "◧ Architecture",
            "◧ Total Memory",
            "◧ Free Memory",
            "◧ Uptime",
            "◧ Public IP",
            "◧ Mode"
        ],
        l = Object.values(a),
        c = Math.max(...r.map(e => e.length)),
        u = r
            .map(
                (e, t) =>
                    `${chalk.green(e.padEnd(c + ALIGNMENT_PADDING))}: ${l[t]}`
            )
            .join("\n");
    return console.log(
        `\n${chalk[i](horizontalLine(TERMINAL_WIDTH, o))}\n${chalk[i](
            figlet.textSync(t, n)
        )}\n${chalk[i](
            horizontalLine(TERMINAL_WIDTH, o)
        )}\n\n${chalk.yellow.bold("◧ Info Script :")}\n${chalk.green(
            "Version :"
        )} Syy78 ${config.version}\n${chalk.green(
            "API Key :"
        )} ${s}\n${chalk.yellow.bold(
            "------------------"
        )}\n${chalk.yellow.bold("◧ Server Specifications :")}\n${u}\n\n${chalk[
            i
        ](horizontalLine(TERMINAL_WIDTH, o))}\n${chalk[i].bold(
            " ◧ Thank you for using this script! ◧ "
        )}\n${chalk[i](horizontalLine(TERMINAL_WIDTH, o))}\n`
    );
}

async function start_app() {

    await showServerInfo();
    
    connectToWhatsApp();
    
}

module.exports = { showServerInfo, start_app, getServerSpecs };
