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

class AddPlugins extends PluginTemplate {
  constructor() {
    super();
    this.name = "addplugins";
    this.aliases = ["addplugin"];
    this.description = "Menambahkan plugin baru secara dinamis";
    this.usage = "!addplugins <nama> | <kode plugin>";
    this.category = "OWNER";
    this.ownerOnly = true;
  }

  async register(context) {
    this.context = context;
  }

  async execute(message, socket, context) {
    const { args, fullText, senderNumber, pushName } = message;
    const { logger } = context;

    logger.info("📦 addplugins command invoked by", senderNumber);

    await delayWithClock(message.m, socket, 2);

    if (!fullText.includes("|")) {
      return this.safeReply(
        message,
        "❌ Format tidak valid. Gunakan: !addplugins namaplugin | <kode>"
      );
    }

    const [rawNameRaw, ...bodyParts] = fullText.split("|");
    const rawName = rawNameRaw.trim().replace(/^!?\w+\s+/i, "");
    const pluginName = rawName.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = pluginName.endsWith(".js") ? pluginName : pluginName + ".js";
    const codeBody = bodyParts.join("|").trim();

    if (!/^[a-zA-Z0-9_-]+\.js$/.test(fileName)) {
      return this.safeReply(
        message,
        "❌ Nama plugin tidak valid. Gunakan hanya huruf, angka, -, _"
      );
    }

    if (!codeBody.includes("module.exports")) {
      return this.safeReply(
        message,
        "❌ Plugin harus mengandung `module.exports` untuk dikenali sistem."
      );
    }

    const filePath = path.join(generatedPluginsDir, fileName);

    if (fs.existsSync(filePath)) {
      return this.safeReply(
        message,
        `⚠️ Plugin dengan nama *${fileName}* sudah ada. Gunakan nama lain.`
      );
    }

    try {
      fs.mkdirSync(generatedPluginsDir, { recursive: true });
      fs.writeFileSync(filePath, codeBody);

      let pluginList = [];
      if (fs.existsSync(generatedPluginsList)) {
        pluginList = JSON.parse(fs.readFileSync(generatedPluginsList));
      }
      pluginList.push({ name: fileName, added_by: senderNumber, at: Date.now() });
      fs.writeFileSync(generatedPluginsList, JSON.stringify(pluginList, null, 2));

      fs.appendFileSync(
        pluginLogFile,
        `[${new Date().toISOString()}] ${senderNumber} menambahkan ${fileName}\n`
      );

      const jam = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      const response =
        "```PLUGIN REGISTERED```\n" +
        "```Nama     : " + pluginName + "```\n" +
        "```Oleh     : @" + senderNumber + "```\n" +
        "```Status   : Sukses ✅```\n" +
        "```Waktu    : " + jam + "```\n" +
        "\n```ɪɴғᴏʀᴍᴀsɪ ᴘʟᴜɢɪɴ ʙʏ SuzuxuX1```";

      return this.safeReply(message, response, { mentions: [senderNumber + "@s.whatsapp.net"] });
    } catch (err) {
      safeLog("error", "[addplugins] exception:", err);
      logger.error("❌ Gagal menambahkan plugin:", err);
      return this.safeReply(
        message,
        `❌ Terjadi kesalahan saat menyimpan plugin. Cek konsol log.`
      );
    }
  }
}

module.exports = new AddPlugins();