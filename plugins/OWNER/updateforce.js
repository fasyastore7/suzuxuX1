const fs = require("fs");
const path = require("path");
const axios = require("axios");
const PluginTemplate = require("@start/plugin/pluginTemplate");
const { versionFile } = require("@start/config/paths");

const LATEST_URL = "https://raw.githubusercontent.com/fasyastore7/suzuxuX1/main/start/database/latest.json";
const BASE_FILE_URL = "https://raw.githubusercontent.com/fasyastore7/suzuxuX1/main/";

class UpdateForcePlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "updateforce";
    this.description = "Memaksa update otomatis dari developer";
    this.usage = ".updateforce";
    this.category = "OWNER";
    this.ownerOnly = true;
  }

  async run(msg) {
    const versionPath = path.resolve(versionFile);
    let localVersion = "0.0.0";

    try {
      const content = fs.readFileSync(versionPath, "utf-8");
      localVersion = JSON.parse(content)?.version || "0.0.0";
    } catch (err) {
      await msg.reply("❌ Gagal membaca version.json lokal.");
      return;
    }

    let latest;
    try {
      const res = await axios.get(LATEST_URL);
      latest = res.data;
    } catch (err) {
      return msg.reply("❌ Gagal mengambil data pembaruan dari GitHub.");
    }

    if (!latest || typeof latest !== "object" || !latest.version) {
      return msg.reply("❌ Format pembaruan tidak valid.");
    }

    if (latest.version === localVersion) {
      return msg.reply(`⚠️ _Script sudah menggunakan versi terbaru._\n\n_Version : ${localVersion}_`);
    }

    const files = latest.files || [];
    if (!files.length) {
      return msg.reply("⚠️ Tidak ada file yang perlu diperbarui.");
    }

    const updated = [];

    for (const file of files) {
      const rawUrl = `${BASE_FILE_URL}${file}`;
      const localPath = path.resolve(process.cwd(), file);

      try {
        const response = await axios.get(rawUrl);
        const dir = path.dirname(localPath);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(localPath, response.data, "utf-8");
        updated.push(file);
      } catch (err) {
        await msg.reply(`❌ Gagal memperbarui *${file}*`);
        return;
      }
    }

    // update version.json
    fs.writeFileSync(versionPath, JSON.stringify({ version: latest.version }, null, 2));

    return msg.reply(
      `✅ _Pembaruan berhasil dilakukan!_\n\n` +
      `*Versi terbaru:* ${latest.version}\n` +
      `*File diperbarui:*\n${updated.map(f => `- ${f}`).join("\n")}\n\n` +
      `_Silakan restart server anda atau ketik *.restart*_`
    );
  }
}

module.exports = new UpdateForcePlugin();
