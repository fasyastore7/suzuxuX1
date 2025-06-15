const PluginTemplate = require("@start/plugin/pluginTemplate");
const pkg = require("baileys/package.json");
const { version: botVersion } = require("@DB/version.json");

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
    const baileysVersion = pkg.version;

    const replyText =
      `*VERSI BOT & LIBRARY*\n\n` +
      `◧ ᴠᴇʀꜱɪ ꜱᴄ : ${botVersion}\n` +
      `◧ ʙᴀɪʟᴇʏꜱ   : v${baileysVersion}`;

    await message.reply(replyText);
  }
}

module.exports = new CekVersionPlugin();