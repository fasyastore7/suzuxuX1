const PluginTemplate = require("@start/plugin/pluginTemplate");

class OwnerPlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "owner";
    this.description = "Menampilkan kontak owner bot";
    this.usage = ".owner";
    this.category = "OWNER";
    this.ownerOnly = false;
  }

  async register(context) {
    this.context = context;
  }

  async execute(message, socket, ctx) {
    const { config } = ctx;
    const { m, remoteJid, pushName } = message;

    const botName = config?.bot_name || "SuzuxuBot";
    const developer = config?.developer || "Fasya";

    // Ambil owner dari config
    const owners = Array.isArray(config.owner_number)
      ? config.owner_number
      : [config.owner_number];

    if (!owners || owners.length === 0) {
      return this.safeReply(message, "❌ Owner belum disetel di konfigurasi bot.");
    }

    // Buat VCARD contact
    const vCards = owners.map((num, idx) => ({
      displayName: `Owner ${idx + 1}`,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Owner ${idx + 1}\nTEL;waid=${num}:${num}\nEND:VCARD`
    }));

    const contactMsg = {
      contacts: {
        displayName: `Owner ${botName}`,
        contacts: vCards
      }
    };

    const externalAdReply = {
      showAdAttribution: true,
      title: `${botName} Official`,
      body: `Hubungi langsung untuk support`,
      thumbnailUrl: "https://telegra.ph/file/fbfe4dcf9c103b5ae7312.jpg", // ganti dengan URL thumbnailmu
      sourceUrl: "https://wa.me/" + owners[0],
      mediaType: 1,
      renderLargerThumbnail: true
    };

    await socket.sendMessage(remoteJid, contactMsg, {
      quoted: m,
      contextInfo: {
        mentionedJid: owners.map(num => `${num}@s.whatsapp.net`),
        externalAdReply
      }
    });
  }
}

module.exports = new OwnerPlugin();