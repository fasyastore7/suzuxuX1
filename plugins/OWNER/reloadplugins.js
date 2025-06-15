const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
  time: { delayWithClock },
  formatter: { toBoldUnicode },
  log: { safeLog },
} = require("@lib/shared/helpers");
const { reloadAll } = require("@start/plugin");

class ReloadPlugins extends PluginTemplate {
  constructor() {
    super();
    this.name = "reloadplugins";
    this.aliases = ["pluginreload", "refreshplugins"];
    this.description = "Memuat ulang semua plugin dari filesystem tanpa restart bot.";
    this.usage = "!reloadplugins";
    this.category = "OWNER";
    this.ownerOnly = true;
  }

  async register(context) {
    this.context = context;
  }

  async execute(message, socket, context) {
    const { logger } = context;
    const { senderNumber } = message;

    await delayWithClock(message.m, socket, 1);

    try {
      logger.info("🔁 Reloading plugins by:", senderNumber);
      const reloadedCount = await reloadAll();

      const response =
        "```PLUGINS RELOADED```\n" +
        `\`\`\`Jumlah    : ${reloadedCount}\`\`\`\n` +
        `\`\`\`Status    : Sukses ✅\`\`\`\n` +
        `\`\`\`Oleh      : @${senderNumber}\`\`\`\n` +
        `\`\`\`Waktu     : ${new Date().toLocaleString('id-ID')}\`\`\`\n` +
        "\n```ɪɴғᴏʀᴍᴀsɪ ᴘʟᴜɢɪɴ ʙʏ SuzuxuX1```";

      return this.safeReply(message, response, { mentions: [senderNumber + "@s.whatsapp.net"] });
    } catch (err) {
      safeLog("error", "[reloadplugins] exception:", err);
      logger.error("❌ Gagal reload plugin:", err);
      return this.safeReply(
        message,
        `❌ Terjadi kesalahan saat reload plugin. Periksa konsol log.`
      );
    }
  }
}

module.exports = new ReloadPlugins();