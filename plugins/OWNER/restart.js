const PluginTemplate = require("@start/plugin/pluginTemplate");

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
      return msg.reply("♻️ Bot sedang dalam proses restart, harap tunggu sebentar...");
    }

    isRestarting = true;

    await msg.reply(
      "🔁 *Bot akan segera di-restart...*\n\n" +
      "_Mohon tunggu beberapa detik hingga bot aktif kembali._"
    );

    // Tambahkan delay singkat agar pesan sempat terkirim
    setTimeout(() => {
      console.log("✅ Restarting bot...");
      process.exit(0);
    }, 2000); // 2 detik
  }
}

module.exports = new RestartPlugin();
