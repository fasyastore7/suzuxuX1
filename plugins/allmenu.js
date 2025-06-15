const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
  formatter: { toSmallCaps },
  time: { delayWithClock }
} = require("@lib/shared/helpers");
const menuData = require("@DB/menu");

class AllMenuPlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "allmenu";
    this.aliases = [];
    this.description = "Menampilkan semua fitur berdasarkan kategori";
    this.usage = ".allmenu";
    this.category = "OWNER";
    this.ownerOnly = false;
  }

  async register(context) {
    this.context = context;
  }

  async execute(message, socket, context) {
    const { senderNumber, pushName, remoteJid, m } = message;
    const { config } = context;

    await delayWithClock(m, socket, 1);

    const botName = config?.bot_name || "SuzuxuBot";
    const developer = config?.developer || "Fasya";
    const botMode = config?.self_mode ? "sᴇʟғ" : "ᴘᴜʙʟɪᴄ";

    // ℹ️ Informasi user dan bot
    const infoText = [
      `┏═━ [\`${toSmallCaps("ɪɴғᴏ ᴜꜱᴇʀ")}\`] ━━`,
      `║◦${toSmallCaps("ɴᴀᴍᴀ")}: *${pushName}*`,
      `║◦${toSmallCaps("ɴᴏᴍᴏʀ")}: ${senderNumber}`,
      `┗━━━━━━━━━━━━`,
      `┏═━ [\`${toSmallCaps("ɪɴғᴏʀᴍᴀꜱɪ ʙᴏᴛ")}\`] ━━`,
      `║◦${toSmallCaps("ɴᴀᴍᴀ ʙᴏᴛ")}: *${botName}*`,
      `║◦${toSmallCaps("ᴘᴇɴɢᴇᴍʙᴀɴɢ")}: *${developer}*`,
      `║◦${toSmallCaps("ᴍᴏᴅᴇ")}: *${botMode}*`,
      `┗━━━━━━━━━━━━`
    ].join("\n");

    // 📋 Menyusun semua kategori + command
    let menuText = `*ʜᴀʟʟᴏ ${pushName}.* ɴᴀᴍᴀ ꜱᴀʏᴀ *${botName}*, ʏᴀɴɢ ʙɪsᴀ ᴍᴇᴍʙᴀɴᴛᴜ ᴋᴀᴍᴜ\n\n${infoText}\n`;

    for (const [category, commands] of Object.entries(menuData)) {
      menuText += `\n┏═━ [\`${toSmallCaps(category + " ᴍᴇɴᴜ")}\`] ━━\n`;
      for (const cmd of commands) {
        menuText += `║➜ .${toSmallCaps(cmd)}\n`;
      }
      menuText += `┗━━━━━━━⭑\n`;
    }

    menuText += `\n${toSmallCaps("ʜᴀʀᴀᴘ ʙᴇʀɢᴀʙᴜɴɢ ᴅɪ ɢʀᴏᴜᴘ ʙᴏᴛ ᴜɴᴛᴜᴋ ɪɴғᴏ")}`;

    // ✅ Gunakan thumbnail eksternal Telegraph
    const thumbnailUrl = "https://graph.org/file/c8ad47c58a7f88c47ad57-a58d41f02ca4013719.jpg";

    const msgOptions = {
      text: menuText,
      contextInfo: {
        externalAdReply: {
          title: `Menu ${botName}`,
          body: `Developer: ${developer}`,
          sourceUrl: "https://whatsapp.com/channel/0029Vb6N37MHQbS0G2kLYW0o",
          showAdAttribution: true,
          mediaType: 1,
          renderLargerThumbnail: true,
          previewType: "PHOTO",
          thumbnailUrl // ✅ Gunakan thumbnailUrl di sini
        }
      }
    };

    return socket.sendMessage(remoteJid, msgOptions, { quoted: m });
  }
}

module.exports = new AllMenuPlugin();