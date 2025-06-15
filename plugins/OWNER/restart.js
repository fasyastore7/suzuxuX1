const PluginTemplate = require("@start/plugin/pluginTemplate");
const fs = require("fs");
const { restartFlagFile } = require("@start/config/paths");
const { owner_number } = require("@settings/config");

let isRestarting = false;

class RestartPlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "restart";
    this.aliases = ["reboot", "reloadbot"];
    this.description = "Merestart ulang bot (khusus owner)";
    this.usage = ".restart";
    this.category = "OWNER";
    this.ownerOnly = true;
  }

  async execute(msg) {
    if (isRestarting) {
      return msg.reply("♻️ Bot sedang dalam proses restart, harap tunggu...");
    }

    isRestarting = true;

    await msg.reply(
      "🔁 *Bot akan segera di-restart...*\n\n" +
      "_Mohon tunggu beberapa detik hingga bot aktif kembali._"
    );

    const chatId = msg.remoteJid || `${owner_number[0]}@s.whatsapp.net`;
    const data = {
      chatId,
      message: "✅ *Bot berhasil di-restart dan telah aktif kembali.*"
    };

    try {
      fs.writeFileSync(restartFlagFile, JSON.stringify(data, null, 2), "utf-8");
      console.log("📥 Restart flag disimpan di:", restartFlagFile);
    } catch (err) {
      console.warn("⚠️ Gagal menulis restart flag:", err.message);
    }

    setTimeout(() => {
      console.log("♻️ Restarting bot...");
      process.exit(0);
    }, 2000);
  }
}

module.exports = new RestartPlugin();
