const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const path                    = require("path");
const fs                      = require("fs");
const chalk                   = require("chalk");
const qrcode                  = require("qrcode-terminal");
const { Boom }                = require("@hapi/boom");
const pino                    = require("pino");

const logger                  = require("@lib/logger");
const config                  = require("@config");
const { sleep }               = require("@lib/utils");
const messageSenderHelper     = require("@lib/services/messageHelper");
const { handleMessageUpsert } = require("@start/handlers/message");

const {
    initializePlugins,
    enableAllPlugins,
    getPluginList
} = require("@start/plugin");

const SESSIONS_DIR = path.join(process.cwd(), "session");

async function connectToWhatsApp(folder = "session") {
    const sessionDir = path.join(SESSIONS_DIR, folder);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (
        !sock.authState.creds.registered &&
        config.type_connection.toLowerCase() === "pairing"
    ) {
        if (folder !== "session") {
            logger.logWithTime(
                "Jadibot",
                `Koneksi "${folder}" terputus`,
                "red"
            );
            return false;
        }

        const phoneNumber = config.phone_number_bot;
        await sleep(4000);

        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(chalk.blue("PHONE NUMBER:"), chalk.yellow(phoneNumber));
        console.log(chalk.blue("CODE PAIRING:"), chalk.yellow(code));
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async update => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            logger.info("Scan QR dengan WhatsApp:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            logger.success("Connection", "Berhasil terhubung ke WhatsApp!");

            try {
                // Set socket di helper
                messageSenderHelper.setSocket(sock);

                // Global context
                const context = {
                    config,
                    logger,
                    socket: sock,
                    messageSender: messageSenderHelper.getInstance()
                };

                // Inisialisasi dan aktifkan plugin
                const loadedPlugins = await initializePlugins({ autoReload: true }, context);
                await enableAllPlugins(context);
                context.plugins = loadedPlugins;
                global.plugins = loadedPlugins; // optional: jika kamu butuh global akses

                // Tampilkan daftar plugin yang berhasil diload
                const pluginNames = getPluginList().map(p => p.name).join(', ');
                logger.info(`✅ Plugin loaded: ${pluginNames}`);

                // Tangani pesan masuk
                sock.ev.on("messages.upsert", async (upsert) => {
                    try {
                        logger.debug("✅ Menerima messages.upsert:");
                        logger.debug("🔍 Struktur pesan:", {
                            type: upsert?.type,
                            messagesLength: upsert?.messages?.length
                        });

                        if (upsert?.type !== "notify" || !Array.isArray(upsert.messages)) {
                            logger.debug("❌ messages.upsert tidak valid atau kosong");
                            return;
                        }

                        await handleMessageUpsert(sock, upsert, context);

                    } catch (err) {
                        logger.error("❌ Error di handler messages.upsert:", err);
                    }
                });

            } catch (err) {
                logger.error("❌ Gagal inisialisasi plugin setelah koneksi:", err);
            }
        }

        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

            switch (reason) {
                case DisconnectReason.badSession:
                case DisconnectReason.connectionClosed:
                case DisconnectReason.connectionLost:
                case DisconnectReason.timedOut:
                case DisconnectReason.restartRequired:
                    logger.warn("⚠️ Koneksi terputus, mencoba menyambung ulang...");
                    return await connectToWhatsApp(folder);

                case DisconnectReason.loggedOut:
                    logger.danger("❌ Logged out", "Sesi telah keluar. Hapus folder session untuk login ulang.");
                    break;

                default:
                    logger.error("❌ DisconnectReason tidak diketahui:", reason);
                    break;
            }
        }
    });

    return sock;
}

module.exports = { connectToWhatsApp };