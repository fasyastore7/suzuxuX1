const axios = require("axios");
const PluginTemplate = require("@start/plugin/pluginTemplate");
const { version: localVersion } = require("@DB/version.json");

// Ganti sesuai repositori GitHub kamu
const LATEST_URL = "https://raw.githubusercontent.com/fasyastore7/suzuxuX1/main/start/database/latest.json";

class UpdateCheckPlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "update";
    this.aliases = ["cekupdate", "checkupdate"];
    this.description = "Cek apakah ada pembaruan bot";
    this.usage = ".update";
    this.category = "OWNER";
    this.ownerOnly = true;
  }

  async execute(msg) {
    try {
      const res = await axios.get(LATEST_URL);
      const latest = res.data;

      if (!latest || typeof latest !== "object" || !latest.version) {
        return msg.reply("❌ Format pembaruan dari server tidak valid.");
      }

      if (latest.version === localVersion) {
        return msg.reply(`⚠️ _Script sudah menggunakan versi terbaru._\n\n_Version : ${localVersion}_`);
      }

      const updatedFiles = latest.files || [];
      const fileList = updatedFiles.length
        ? updatedFiles.map((file, i) => `${i + 1}. ${file}`).join("\n")
        : "_Tidak ada file yang tercantum_";

      return msg.reply(
        `*📦 Update tersedia!*\n\n` +
        `*Version:* ${latest.version}\n\n` +
        `*List update file:*\n${fileList}`
      );
    } catch (err) {
      return msg.reply("❌ Gagal memeriksa pembaruan dari server: " + err.message);
    }
  }
}

module.exports = new UpdateCheckPlugin();
