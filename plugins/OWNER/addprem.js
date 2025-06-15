const PluginTemplate = require("@start/plugin/pluginTemplate");
const userAccess = require("@lib/shared/users");
const {
    time: { parseDuration, convertToDays, delayWithClock },
    formatter: { toBoldUnicode, formatDateShort },
    log: { safeLog }
} = require("@lib/shared/helpers");

class AddPremiumPlugin extends PluginTemplate {
    constructor() {
        super();
        this.name = "addpremium";
        this.aliases = ["addprem", "tambahpremium", "tambahprem"];
        this.description = "Menambahkan user ke daftar premium dengan durasi";
        this.usage =
            "!addprem <nomor> <durasi>\nDurasi: angka + (h/d/w/m/y)\nContoh: !addprem 628xxxx 7d";
        this.category = "PREMIUM";
        this.ownerOnly = true;
    }

    async register(context) {
        this.context = context;
    }

    async execute(message, socket, context) {
        const { args, senderNumber } = message;
        const { logger } = context;

        logger.info(`🚀 AddPremium plugin dijalankan oleh: ${senderNumber}`);
        logger.debug(`📝 Args: [${args.join(", ")}]`);

        try {
            await delayWithClock(message.m, socket, 2);

            if (args.length < 2) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode("Format salah!")}\n\n` +
                        `📝 ${toBoldUnicode("Penggunaan:")}\n` +
                        `${toBoldUnicode("!addprem <nomor> <durasi>")}\n\n` +
                        `🕐 ${toBoldUnicode("Durasi:")}\n` +
                        `• ${toBoldUnicode("h = jam (contoh: 12h)")}\n` +
                        `• ${toBoldUnicode("d = hari (contoh: 7d)")}\n` +
                        `• ${toBoldUnicode("w = minggu (contoh: 2w)")}\n` +
                        `• ${toBoldUnicode("m = bulan (contoh: 1m)")}\n` +
                        `• ${toBoldUnicode("y = tahun (contoh: 1y)")}\n\n` +
                        `📋 ${toBoldUnicode("Contoh:")}\n` +
                        `${toBoldUnicode("!addprem 628123456789 30d")}\n` +
                        `${toBoldUnicode("!addprem 628987654321 1y")}`
                );
            }

            const target = args[0].replace(/[^0-9]/g, "");
            const durationInput = args[1];
            const { ms, readable, isValid } = parseDuration(durationInput);

            if (!target || !isValid) {
                return await this.safeReply(
                    message,
                    `❌ ${toBoldUnicode(
                        "Format nomor atau durasi tidak valid!"
                    )}\n\n` +
                        `📝 ${toBoldUnicode("Contoh:")}\n${toBoldUnicode(
                            "!addprem 628123456789 7d"
                        )}`
                );
            }

            logger.debug(
                `🎯 Target: ${target}, Duration: ${readable} (${ms}ms)`
            );

            const isPremium = userAccess.isPremiumUser(target);
            if (isPremium) {
                const userData = userAccess.findUser(target);
                const expiryText = userData?.premium
                    ? formatDateShort(new Date(userData.premium))
                    : toBoldUnicode("Permanent");

                return await this.safeReply(
                    message,
                    `⚠️ ${toBoldUnicode("User sudah premium!")}\n\n` +
                        `👤 ${toBoldUnicode("Number:")} ${toBoldUnicode(
                            target
                        )}\n` +
                        `⏰ ${toBoldUnicode("Expires:")} ${expiryText}\n\n` +
                        `💡 ${toBoldUnicode(
                            "Gunakan !delprem untuk menghapus dan tambahkan ulang dengan durasi baru."
                        )}`
                );
            }

            const now = new Date();
            const expiresAt = new Date(now.getTime() + ms);

            userAccess.getOrCreateUser(target);
            userAccess.addPremium(target, convertToDays(ms), "days");

            logger.success(
                "addpremium",
                `✅ ${target} berhasil ditambahkan premium untuk ${readable}`
            );

            const totalDays = convertToDays(ms);
            const endDateFormatted = formatDateShort(expiresAt);

            const responseMessage =
                `• 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬 𝗔𝗗𝗗𝗘𝗗 𝗣𝗥𝗘𝗠𝗜𝗨𝗠\n\n` +
                `┌ ▪︎ 𝗔𝗱𝗱𝗲𝗱 𝘁𝗼: @${toBoldUnicode(target)}\n` +
                `│ ▪︎ 𝗪𝗶𝗹𝗹 𝗲𝗻𝗱 𝗼𝗻: ${endDateFormatted}\n` +
                `└ ▪︎ 𝗡𝘂𝗺𝗯𝗲𝗿 𝗼𝗳 𝗽𝗿𝗲𝗺𝗶𝘂𝗺 𝗱𝗮𝘆𝘀 𝗮𝗱𝗱𝗲𝗱: ${toBoldUnicode(
                    totalDays.toString()
                )}`;

            return await this.safeReply(message, responseMessage);
        } catch (error) {
            safeLog("error", "[addpremium] Exception:", error);
            logger.error("❌ Error dalam addpremium plugin:", error);
            return await this.safeReply(
                message,
                `⚠️ ${toBoldUnicode("Terjadi kesalahan sistem!")}\n\n` +
                    `${toBoldUnicode(
                        "Silakan coba lagi dalam beberapa saat atau hubungi administrator."
                    )}`
            );
        }
    }
}

module.exports = new AddPremiumPlugin();
