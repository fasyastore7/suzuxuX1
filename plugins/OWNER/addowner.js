const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
    time: { delayWithClock },
    formatter: { toBoldUnicode },
    user: { isValidWhatsAppNumber },
    log: { safeLog }
} = require("@lib/shared/helpers");

const userAccess = require("@lib/shared/users");

class AddOwnerPlugin extends PluginTemplate {
    constructor() {
        super();
        this.name = "addowner";
        this.aliases = ["adddev"];
        this.description = "Menambahkan owner baru ke dalam daftar";
        this.usage = "!addowner <nomor>";
        this.category = "OWNER";
        this.ownerOnly = true;
    }

    async register(context) {
        this.context = context;
    }

    async execute(message, socket, context) {
        const { args, senderNumber } = message;
        const { logger } = context;

        logger.info(`🚀 AddOwner plugin dijalankan oleh: ${senderNumber}`);
        logger.debug(`📝 Args: [${args.join(", ")}]`);

        try {
            await delayWithClock(message.m, socket, 2);

            if (!args.length) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode("Nomor tidak boleh kosong!")}\n\n` +
                    `📋 ${toBoldUnicode("Contoh:")}\n${toBoldUnicode("!addowner 628123456789")}`
                );
            }

            const target = args[0].replace(/[^0-9]/g, "");
            if (!isValidWhatsAppNumber(target)) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode("Format nomor tidak valid!")}\n\n` +
                    `📋 ${toBoldUnicode("Contoh:")}\n${toBoldUnicode("!addowner 628123456789")}`
                );
            }

            const jid = `${target}@s.whatsapp.net`;

            // ✅ Gunakan userAccess.isOwner()
            if (userAccess.isOwner(jid)) {
                return await this.safeReply(
                    message,
                    `⚠️ ${toBoldUnicode("User sudah menjadi owner!")}\n\n` +
                    `👤 ${toBoldUnicode("Number:")} ${toBoldUnicode(target)}`
                );
            }

            // ✅ Tambahkan owner via userAccess
            const success = userAccess.addOwner(target, senderNumber);
            if (!success) {
                throw new Error("Gagal menambahkan owner (tidak diketahui)");
            }

            logger.success("addowner", `✅ ${target} berhasil ditambahkan sebagai owner`);

            const response =
                `• 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬 𝗔𝗗𝗗𝗘𝗗 𝗢𝗪𝗡𝗘𝗥\n\n` +
                `┌ ▪︎ 𝗔𝗱𝗱𝗲𝗱 𝘁𝗼: @${toBoldUnicode(target)}\n` +
                `└ ▪︎ 𝗔𝗱𝗱𝗲𝗱 𝗯𝘆: ${toBoldUnicode(senderNumber)}`;

            return await this.safeReply(message, response);

        } catch (err) {
            safeLog("error", "[addowner] Exception:", err);
            logger.error("❌ Error dalam addowner plugin:", err);
            return await this.safeReply(
                message,
                `⚠️ ${toBoldUnicode("Terjadi kesalahan saat menambahkan owner!")}\n\n` +
                `${toBoldUnicode("Silakan coba lagi atau hubungi admin.")}`
            );
        }
    }
}

module.exports = new AddOwnerPlugin();