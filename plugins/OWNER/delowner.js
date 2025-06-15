const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
    time: { delayWithClock },
    formatter: { toBoldUnicode },
    user: { isValidWhatsAppNumber },
    log: { safeLog }
} = require("@lib/shared/helpers");

const userAccess = require("@lib/shared/users");

class DelOwnerPlugin extends PluginTemplate {
    constructor() {
        super();
        this.name = "delowner";
        this.aliases = ["rmowner"];
        this.description = "Menghapus owner dari daftar";
        this.usage = "!delowner <nomor>";
        this.category = "OWNER";
        this.ownerOnly = true;
    }

    async register(context) {
        this.context = context;
    }

    async execute(message, socket, context) {
        const { args, senderNumber } = message;
        const { logger } = context;

        logger.info(`🚀 DelOwner plugin dijalankan oleh: ${senderNumber}`);
        logger.debug(`📝 Args: [${args.join(", ")}]`);

        try {
            await delayWithClock(message.m, socket, 2);

            if (!args.length) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode("Nomor tidak boleh kosong!")}\n\n` +
                    `📝 ${toBoldUnicode("Contoh:")} ${toBoldUnicode("!delowner 628123456789")}`
                );
            }

            const target = args[0].replace(/[^0-9]/g, "");
            if (!isValidWhatsAppNumber(target)) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode("Format nomor tidak valid!")}\n\n` +
                    `📝 ${toBoldUnicode("Contoh:")} ${toBoldUnicode("!delowner 628123456789")}`
                );
            }

            const jid = `${target}@s.whatsapp.net`;

            if (!userAccess.isOwner(jid)) {
                return await this.safeReply(
                    message,
                    `⚠️ ${toBoldUnicode("User tidak ditemukan dalam daftar owner!")}\n\n` +
                    `👤 ${toBoldUnicode("Number:")} ${toBoldUnicode(target)}`
                );
            }

            const success = userAccess.removeOwner(target);
            if (!success) {
                return await this.safeReply(
                    message,
                    `⚠️ ${toBoldUnicode("Gagal menghapus user dari daftar owner.")}`
                );
            }

            logger.success("delowner", `✅ ${target} berhasil dihapus dari daftar owner`);

            const response =
                `• 𝗢𝗪𝗡𝗘𝗥 𝗥𝗘𝗠𝗢𝗩𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬\n\n` +
                `┌ ▪︎ 𝗥𝗲𝗺𝗼𝘃𝗲𝗱 𝗳𝗿𝗼𝗺: @${toBoldUnicode(target)}\n` +
                `└ ▪︎ 𝗥𝗲𝗺𝗼𝘃𝗲𝗱 𝗯𝘆: ${toBoldUnicode(senderNumber)}`;

            return await this.safeReply(message, response);

        } catch (err) {
            safeLog("error", "[delowner] Exception:", err);
            logger.error("❌ Error dalam delowner plugin:", err);
            return await this.safeReply(
                message,
                `⚠️ ${toBoldUnicode("Terjadi kesalahan saat menghapus owner!")}\n\n` +
                `${toBoldUnicode("Silakan coba lagi atau hubungi admin.")}`
            );
        }
    }
}

module.exports = new DelOwnerPlugin();