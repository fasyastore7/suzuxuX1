const PluginTemplate = require("@start/plugin/pluginTemplate");
const path = require("path");
const fs = require("fs");
const { version: localVersion } = require("@DB/version.json");

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
      const latestPath = path.join(process.cwd(), "start", "database", "latest.json");
      if (!fs.existsSync(latestPath)) {
        return msg.reply("⚠️ _Tidak dapat memeriksa pembaruan. File `latest.json` tidak ditemukan._");
      }

      const latestData = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
      const latestVersion = latestData.version || "unknown";
      const updatedFiles = latestData.files || [];

      if (latestVersion === localVersion) {
        return msg.reply(
          `⚠️ _Script sudah menggunakan versi terbaru._\n\n_Version : ${localVersion}_`
        );
      }

      let fileList = updatedFiles.length
        ? updatedFiles.map((file, i) => `${i + 1}. ${file}`).join("\n")
        : "_Tidak ada file yang tercantum_";

      return msg.reply(
        `*📦 Update tersedia!*\n\n` +
        `*Version:* ${latestVersion}\n\n` +
        `*List update file:*\n${fileList}`
      );
    } catch (err) {
      return msg.reply("❌ Gagal memeriksa pembaruan: " + err.message);
    }
  }
}

module.exports = new UpdateCheckPlugin();