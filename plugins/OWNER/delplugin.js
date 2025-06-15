const fs = require("fs");
const path = require("path");
const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
  time: { delayWithClock },
  formatter: { toBoldUnicode },
  log: { safeLog },
} = require("@lib/shared/helpers");
const {
  generatedPluginsDir,
  generatedPluginsList,
  pluginLogFile,
} = require("@start/config/paths");

class DeletePlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "delplugin";
    this.aliases = ["deleteplugin", "removeplugin"];
    this.description = "Menghapus plugin yang ditambahkan secara dinamis";
    this.usage = "!deleteplugin <nama_plugin>";
    this.category = "OWNER";
    this.ownerOnly = true;
  }

  async register(context) {
    this.context = context;
  }

  async execute(message, socket, context) {
    const { args, senderNumber } = message;
    const { logger } = context;

    await delayWithClock(message.m, socket, 2);

    if (!args.length) {
      return this.safeReply(
        message,
        `❌ ${toBoldUnicode("Nama plugin harus disertakan!\n\nContoh:")}\n${toBoldUnicode("!deleteplugin namaplugin")}`
      );
    }

    let rawName = args[0].trim().replace(/^!?\w+\s+/i, "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (rawName.endsWith(".js")) rawName = rawName.slice(0, -3);
    const fileName = rawName + ".js";
    const pluginPath = path.join(generatedPluginsDir, fileName);

    if (!fs.existsSync(pluginPath)) {
      return this.safeReply(
        message,
        `❌ Plugin \`${fileName}\` tidak ditemukan di direktori \`FEATURES_ADD\`.\n\nGunakan *!listplugins* untuk melihat daftar plugin yang tersedia.`
      );
    }

    try {
      fs.unlinkSync(pluginPath);

      let pluginList = [];
      if (fs.existsSync(generatedPluginsList)) {
        pluginList = JSON.parse(fs.readFileSync(generatedPluginsList));
        pluginList = pluginList.filter(p => p.name !== fileName);
        fs.writeFileSync(generatedPluginsList, JSON.stringify(pluginList, null, 2));
      }

      fs.appendFileSync(
        pluginLogFile,
        `[${new Date().toISOString()}] ${senderNumber} menghapus ${fileName}\n`
      );

      const jam = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      const response =
        "```PLUGIN DELETED```\n" +
        "```Nama     : " + fileName + "```\n" +
        "```Oleh     : @" + senderNumber + "```\n" +
        "```Status   : Dihapus ✅```\n" +
        "```Waktu    : " + jam + "```\n" +
        "\n```ɪɴғᴏʀᴍᴀsɪ ᴘʟᴜɢɪɴ ʙʏ SuzuxuX1```";

      return this.safeReply(message, response, { mentions: [senderNumber + "@s.whatsapp.net"] });
    } catch (err) {
      safeLog("error", "[deleteplugin] exception:", err);
      logger.error("❌ Gagal menghapus plugin:", err);
      return this.safeReply(
        message,
        `❌ Terjadi kesalahan saat menghapus plugin. Cek log konsol.`
      );
    }
  }
}

module.exports = new DeletePlugin();