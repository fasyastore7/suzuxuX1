const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
    time: { delayWithClock },
    formatter: { toBoldUnicode },
    user: { isValidWhatsAppNumber }
} = require("@lib/shared/helpers");

const userAccess = require("@lib/shared/users");

class DelPremiumPlugin extends PluginTemplate {
    constructor() {
        super();
        this.name = "delprem";
        this.aliases = ["delpremium", "rmpremium", "hapuspremium"];
        this.description = "Menghapus user dari daftar premium";
        this.usage = "!delprem <nomor>";
        this.category = "PREMIUM";
        this.ownerOnly = true;
    }

    async register(context) {
        this.context = context;
    }

    async execute(message, socket, context) {
        const { args, senderNumber } = message;
        const { logger } = context;

        logger.info(`🚀 DelPremium plugin dijalankan oleh: ${senderNumber}`);
        logger.debug(`📝 Args: [${args.join(", ")}]`);

        try {
            await delayWithClock(message.m, socket, 2);

            if (!args.length) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode("Format salah!")}\n\n` +
                    `📝 ${toBoldUnicode("Penggunaan:")} ${toBoldUnicode("!delprem <nomor>")}\n\n` +
                    `📋 ${toBoldUnicode("Contoh:")} ${toBoldUnicode("!delprem 628123456789")}`
                );
            }

            const target = args[0].replace(/[^0-9]/g, "");

            if (!isValidWhatsAppNumber(target)) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode("Format nomor tidak valid!")}\n\n` +
                    `📋 ${toBoldUnicode("Contoh:")} ${toBoldUnicode("!delprem 628123456789")}`
                );
            }

            logger.debug(`🎯 Target number: ${target}`);

            if (!userAccess.isPremiumUser(target)) {
                return await this.safeReply(
                    message,
                    `⚠️ ${toBoldUnicode("User tidak ditemukan dalam daftar premium!")}\n\n` +
                    `👤 ${toBoldUnicode("Number:")} ${toBoldUnicode(target)}`
                );
            }

            const removed = userAccess.removePremium(target);
            if (!removed) {
                throw new Error("Gagal menghapus status premium");
            }

            logger.success("delpremium", `✅ ${target} berhasil dihapus dari premium`);

            const response =
                `• 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬 𝗥𝗘𝗠𝗢𝗩𝗘𝗗 𝗣𝗥𝗘𝗠𝗜𝗨𝗠\n\n` +
                `┌ ▪︎ 𝗥𝗲𝗺𝗼𝘃𝗲𝗱 𝗳𝗿𝗼𝗺: @${toBoldUnicode(target)}\n` +
                `└ ▪︎ 𝗥𝗲𝗺𝗼𝘃𝗲𝗱 𝗯𝘆: ${toBoldUnicode(senderNumber)}`;

            return await this.safeReply(message, response);

        } catch (error) {
            logger.error("❌ Error dalam delpremium plugin:", error);
            return await this.safeReply(
                message,
                `⚠️ ${toBoldUnicode("Terjadi kesalahan sistem!")}\n\n` +
                `${toBoldUnicode("Silakan coba lagi atau hubungi admin.")}`
            );
        }
    }
}

module.exports = new DelPremiumPlugin();