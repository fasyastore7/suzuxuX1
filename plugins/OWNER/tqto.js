const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
  formatter: { toSmallCaps }
} = require("@lib/shared/helpers");

class ThanksToPlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "tqto";
    this.aliases = ["thanks", "credit"];
    this.description = "Menampilkan ucapan terima kasih dari developer bot";
    this.usage = ".tqto";
    this.category = "OWNER";
    this.ownerOnly = false;
  }

  async execute(message, socket, context) {
    const { m, remoteJid, pushName } = message;
    const developer = context.config?.developer || "Fasya";
    const botName = context.config?.bot_name || "SuzuxuBot";

    const text = [
      `┏═━ [\`${toSmallCaps("ᴛʜᴀɴᴋꜱ ᴛᴏ / ᴄʀᴇᴅɪᴛ")}\`] ━━`,
      `║➜ ${toSmallCaps("ʟɪʙʀᴀʀʏ")}: Baileys by @whiskeysockets`,
      `║➜ ${toSmallCaps("ʙᴀꜱᴇ ᴄᴏᴅᴇ")}: Community Contributors`,
      `║➜ ${toSmallCaps("ᴍᴀɪɴᴛᴀɪɴᴇʀ")}: ${developer}`,
      `║➜ ${toSmallCaps("ʀᴜɴᴛɪᴍᴇ")}: Node.js Environment`,
      `║➜ ${toSmallCaps("ᴛᴇꜱᴛᴇʀꜱ")}: Developer Team`,
      `║➜ ${toSmallCaps("ꜱᴜᴘᴘᴏʀᴛ")}: ${pushName}`,
      `┗━━━━━━━⭑`
    ].join("\n");

    return socket.sendMessage(
      remoteJid,
      {
        text,
        contextInfo: {
          externalAdReply: {
            title: `Thanks To by ${botName}`,
            body: "Ucapan terima kasih dari developer",
            thumbnailUrl:
              "https://graph.org/file/c8ad47c58a7f88c47ad57-a58d41f02ca4013719.jpg",
            sourceUrl: "https://whatsapp.com/channel/0029Vb6N37MHQbS0G2kLYW0o",
            showAdAttribution: true,
            mediaType: 1,
            renderLargerThumbnail: true,
            previewType: "PHOTO"
          }
        }
      },
      { quoted: m }
    );
  }
}

module.exports = new ThanksToPlugin();