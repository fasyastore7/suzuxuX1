const PluginTemplate = require("@start/plugin/pluginTemplate");
const userAccess = require("@lib/shared/users");
const {
    formatter: { toBoldUnicode, formatDateShort },
    log: { safeLog }
} = require("@lib/shared/helpers");

class ListPremiumPlugin extends PluginTemplate {
    constructor() {
        super();
        this.name = "listpremium";
        this.aliases = ["premusers", "prem", "listprem", "premiumlist"];
        this.description = "Menampilkan daftar user premium";
        this.usage = "!listpremium";
        this.category = "OWNER";
        this.ownerOnly = true;
    }

    async register(context) {
        this.context = context;
    }

    async execute(message, socket, context) {
        const { senderNumber } = message;
        const { logger } = context;

        logger.info(`🚀 ListPremium plugin dijalankan oleh: ${senderNumber}`);

        try {
            const allUsers = userAccess.getAllUsers();
            const premiumUsers = Object.entries(allUsers).filter(([_, user]) =>
                userAccess.isPremiumUser(user)
            );

            if (premiumUsers.length === 0) {
                return await this.safeReply(
                    message,
                    `⚠️ ${toBoldUnicode(
                        "Tidak ada user premium yang terdaftar."
                    )}`
                );
            }

            const formattedList = premiumUsers
                .map(([number, user], i) => {
                    const added = user.added_at
                        ? new Date(user.added_at).toLocaleString("id-ID")
                        : "-";
                    const expires = user.premium
                        ? formatDateShort(user.premium)
                        : toBoldUnicode("Permanent");
                    const status =
                        new Date(user.premium) > new Date()
                            ? toBoldUnicode("Aktif ✅")
                            : toBoldUnicode("Expired ❌");

                    return (
                        `▪︎ ${toBoldUnicode(`${i + 1}.`)} @${toBoldUnicode(
                            number
                        )}\n` +
                        `   ${toBoldUnicode("Status")}: ${status}\n` +
                        `   ${toBoldUnicode("Expires")}: ${expires}\n` +
                        `   ${toBoldUnicode(
                            "Ditambahkan pada"
                        )}: ${toBoldUnicode(added)}`
                    );
                })
                .join("\n\n");

            const response = `💎 ${toBoldUnicode(
                "DAFTAR USER PREMIUM"
            )}\n\n${formattedList}`;

            return await this.safeReply(message, response);
        } catch (error) {
            logger.error("❌ Error dalam listpremium plugin:", error);
            safeLog("error", "[listpremium]", error);
            return await this.safeReply(
                message,
                `⚠️ ${toBoldUnicode(
                    "Terjadi kesalahan saat memuat daftar premium."
                )}`
            );
        }
    }
}

module.exports = new ListPremiumPlugin();
