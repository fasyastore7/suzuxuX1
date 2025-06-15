const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
    formatter: { toBoldUnicode },
    log: { safeLog }
} = require("@lib/shared/helpers");

const userAccess = require("@lib/shared/users");

class ListOwnerPlugin extends PluginTemplate {
    constructor() {
        super();
        this.name = "listowner";
        this.aliases = ["owners", "daftarowner", "ownerlist"];
        this.description = "Menampilkan daftar owner aktif";
        this.usage = "!listowner";
        this.category = "OWNER";
        this.ownerOnly = true;
    }

    async register(context) {
        this.context = context;
    }

    async execute(message, socket, context) {
        const { senderNumber } = message;
        const { logger } = context;

        logger.info(`🚀 ListOwner plugin dijalankan oleh: ${senderNumber}`);

        try {
            const ownerList = userAccess.getAllOwners();

            if (!ownerList || ownerList.length === 0) {
                return await this.safeReply(
                    message,
                    `⚠️ ${toBoldUnicode("Tidak ada owner yang terdaftar.")}`
                );
            }

            const formattedList = ownerList.map((owner, i) => {
                const number = owner.number;
                const time = owner.added_at
                    ? new Date(owner.added_at).toLocaleString("id-ID")
                    : "-";
                const by = owner.added_by || "system";
                const source = owner.type === "config" ? "config.js" : "database";

                return `▪︎ ${toBoldUnicode(`${i + 1}.`)} @${toBoldUnicode(number)}\n` +
                       `   ${toBoldUnicode("Sumber")}: ${toBoldUnicode(source)}\n` +
                       `   ${toBoldUnicode("Ditambahkan oleh")}: ${toBoldUnicode(by)}\n` +
                       `   ${toBoldUnicode("Waktu")}: ${toBoldUnicode(time)}`;
            }).join("\n\n");

            const response = `👑 ${toBoldUnicode("DAFTAR OWNER AKTIF")}\n\n${formattedList}`;

            return await this.safeReply(message, response);
        } catch (error) {
            logger.error("❌ Error dalam listowner plugin:", error);
            safeLog("error", "[listowner]", error);
            return await this.safeReply(
                message,
                `⚠️ ${toBoldUnicode("Terjadi kesalahan saat memuat daftar owner.")}`
            );
        }
    }
}

module.exports = new ListOwnerPlugin();