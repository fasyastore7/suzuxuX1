const fs = require("fs");
const path = require("path");
const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
  time: { delayWithClock },
  formatter: { toBoldUnicode },
  log: { safeLog },
} = require("@lib/shared/helpers");
const {
  pluginsDir,
} = require("@start/config/paths");

function toSmallCaps(text) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const smallcaps = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
  return text.toLowerCase().split('').map(char => {
    const idx = alphabet.indexOf(char);
    return idx >= 0 ? smallcaps[idx] : char;
  }).join('');
}

class ListPlugins extends PluginTemplate {
  constructor() {
    super();
    this.name = "listplugins";
    this.aliases = ["pluginslist", "showplugins"];
    this.description = "Menampilkan semua plugin dari direktori plugins/ sesuai kategorinya.";
    this.usage = "!listplugins [kategori] [halaman]";
    this.category = "OWNER";
    this.ownerOnly = true;
    this.pluginsPerPage = 5;
  }

  async register(context) {
    this.context = context;
  }

  async execute(message, socket, context) {
    const { senderNumber, args } = message;
    const { logger } = context;

    if (!this.context) this.context = context;
    await delayWithClock(message.m, socket, 1);

    try {
      if (!fs.existsSync(pluginsDir)) {
        return this.safeReply(message, "📭 Direktori plugins tidak ditemukan.");
      }

      const categories = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const requestedCategory = (args[0] || '').toLowerCase();
      const pageArg = parseInt(args[1]) || 1;
      const selectedCategories = requestedCategory && categories.includes(requestedCategory.toUpperCase())
        ? [requestedCategory.toUpperCase()]
        : categories;

      const outputParts = [];

      for (const category of selectedCategories) {
        const categoryPath = path.join(pluginsDir, category);
        const pluginFiles = fs.readdirSync(categoryPath).filter(f => f.endsWith(".js"));

        if (!pluginFiles.length) continue;

        const totalPages = Math.ceil(pluginFiles.length / this.pluginsPerPage);
        const page = Math.min(Math.max(pageArg, 1), totalPages);
        const startIndex = (page - 1) * this.pluginsPerPage;
        const paginated = pluginFiles.slice(startIndex, startIndex + this.pluginsPerPage);

        let section = `\n┏━⊷ ${toSmallCaps(category)}/ (ᴛᴏᴛᴀʟ: ${pluginFiles.length}, ʜᴀʟᴀᴍᴀɴ ${page}/${totalPages})\n`;

        for (const file of paginated) {
          const filePath = path.join(categoryPath, file);
          let status = "❓";

          try {
            delete require.cache[require.resolve(filePath)];
            const plugin = require(filePath);
            status = plugin.disabled ? "ɴᴏɴᴀᴋᴛɪꜰ" : "ᴀᴋᴛɪꜰ";
          } catch {
            status = "ᴇʀʀᴏʀ";
          }

          section += `┃ • ${toSmallCaps(file)} → ${status}\n`;
        }

        outputParts.push(section);
      }

      if (outputParts.length === 0) {
        return this.safeReply(message, "📭 Tidak ada plugin yang ditemukan.");
      }

      let output = outputParts.join("\n");
      output += "\n```ɪɴғᴏʀᴍᴀsɪ ᴘʟᴜɢɪɴ ʙʏ SuzuxuX1```";

      return this.safeReply(message, output);
    } catch (err) {
      safeLog("error", "[listplugins] exception:", err);
      logger.error("❌ Gagal membaca plugin:", err);
      return this.safeReply(
        message,
        "❌ Terjadi kesalahan saat membaca direktori plugin."
      );
    }
  }
}

module.exports = new ListPlugins();