const PluginTemplate = require("@start/plugin/pluginTemplate");
const { version: botVersion } = require("@DB/version.json");

let baileysVersion = "unknown";
try {
  baileysVersion = require("baileys/package.json").version;
} catch (err) {
  console.warn("⚠️ Gagal membaca versi Baileys:", err.message);
}

class CekVersionPlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "cekversion";
    this.aliases = ["version", "versi"];
    this.description = "Cek versi bot dan Baileys";
    this.usage = ".cekversion";
    this.category = "OWNER";
  }

  async execute(message) {
    const replyText =
      `*VERSI BOT & LIBRARY*\n\n` +
      `◧ ᴠᴇʀꜱɪ ꜱᴄ : ${botVersion}\n` +
      `◧ ʙᴀɪʟᴇʏꜱ   : v${baileysVersion}`;

    await message.reply(replyText);
  }
}

module.exports = new CekVersionPlugin();
