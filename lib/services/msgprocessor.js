const path = require("path");
const logger = require("@lib/logger");
const serializeMessage = require("@lib/serialize");
const { ensureJsonFile } = require("@lib/fileHelper");
const Fuse = require("fuse.js");
const rateLimiter = require("@lib/security/rateLimiter");
const antiSpam = require("@lib/security/antiSpam");
const blocklist = require("@lib/security/blocklist");

const notifiedUsers = new Set();
const NOTIFY_LIMIT = 5000; // max cache

function preInjectNativeFlow(rawMessage) {
  try {
    const nativeFlow = rawMessage?.message?.interactiveResponseMessage?.nativeFlowResponseMessage;
    if (!nativeFlow?.paramsJson) return rawMessage;

    const parsed = JSON.parse(nativeFlow.paramsJson);
    const command = parsed?.id;

    if (!command || typeof command !== "string") {
      logger.debug("📋 Tidak ada 'id' valid di nativeFlow.paramsJson");
      return rawMessage;
    }

    logger.info(`🔘 NativeFlow button pressed dengan command: "${command}"`);
    rawMessage.message.extendedTextMessage = { text: command };
    delete rawMessage.message.interactiveResponseMessage;
    return rawMessage;
  } catch (err) {
    logger.warn("⚠️ Gagal inject nativeFlow:", err.message);
    return rawMessage;
  }
}

async function processMessage(rawMessage, context) {
  const { plugins, config, messageSender, socket } = context;
  const injectedMessage = preInjectNativeFlow(rawMessage);
  const msg = await serializeMessage(injectedMessage, socket);
  if (!msg) {
    logger.warn("❌ serializeMessage mengembalikan null — pesan diabaikan");
    return;
  }

  const { isCmd, command } = msg;
  if (!isCmd || !command) {
    logger.debug("📭 Bukan command");
    return;
  }

  const mainOwners = config.owner_number || [];
  const isMainOwner = mainOwners.includes(msg.senderNumber);

  // 🔒 Blocklist
  if (blocklist.isBlocked(msg.senderNumber)) {
    logger.info(`🚫 Pengguna ${msg.senderNumber} diblokir`);
    return;
  }

  // ⏳ Rate Limit
  if (config.enable_rate_limit !== false && !isMainOwner) {
    if (rateLimiter.isRateLimited(msg.senderNumber)) {
      const wait = rateLimiter.getRemainingTime(msg.senderNumber);
      return msg.reply(`⏳ Tunggu ${wait} detik sebelum mengirim perintah lagi.`);
    }
  }

  // 🚨 Anti Spam
  if (config.enable_anti_spam !== false && !isMainOwner) {
    if (antiSpam.isSpamming(msg.senderNumber)) {
      const cooldown = antiSpam.getSpamCooldown(msg.senderNumber);
      return msg.reply(`🚫 Terlalu banyak pesan. Tunggu ${cooldown} detik.`);
    }
  }

  // 📛 Mode bot_destination (group/private)
  const dest = config.bot_destination || "both";
  const isPrivate = !msg.isGroup;
  const allowed =
    dest === "both" ||
    (dest === "private" && isPrivate) ||
    (dest === "group" && msg.isGroup) ||
    isMainOwner;

  if (!allowed) {
  const notifyKey = msg.isGroup ? msg.remoteJid : msg.senderNumber;
      
  if (!notifiedUsers.has(notifyKey)) {
    notifiedUsers.add(notifyKey);
    const label = dest === "private" ? "chat pribadi" : "grup";
    await msg.reply(`⚠️ Bot saat ini hanya menerima perintah melalui *${label}*. Silakan hubungi owner.`);

      // Otomatis bersihkan jika cache terlalu besar
      if (notifiedUsers.size > NOTIFY_LIMIT) {
        notifiedUsers.clear();
        logger.warn("♻️ Cache notifiedUsers dibersihkan karena melebihi limit");
      }
    }
    return;
  }

  // 🧠 Tambahkan msg.reply jika belum ada
  if (!msg.reply) {
    msg.reply = async (text, options = {}) => {
      try {
        const base = msg.m || msg.message || msg.raw;
        if (!base) throw new Error("Base message tidak ditemukan");
        return await messageSender.sendReply(msg.remoteJid, text, base, options);
      } catch {
        logger.warn("⚠️ Gagal quoted reply, fallback ke sendText");
        return messageSender.sendText(msg.remoteJid, text, options);
      }
    };
  }

  // 🔍 Temukan plugin
  const pluginEntry = [...plugins.entries()].find(([_, plugin]) => {
    const main = plugin.name || plugin.command;
    const aliases = plugin.aliases || [];
    return [main, ...aliases].includes(command);
  });

  if (!pluginEntry) {
    const allCommands = [...plugins.values()].flatMap(p => [p.name, ...(p.aliases || [])].filter(Boolean));
    const fuse = new Fuse(allCommands, { includeScore: true, threshold: 0.4 });
    const suggestion = fuse.search(command)?.[0]?.item;

    await msg.reply(
      `❌ Perintah _*.${command}*_ tidak ditemukan.` +
      (suggestion ? `\n\nMungkin maksud kamu _*.${suggestion}*_?` : "")
    );
    return;
  }

  const [pluginName, plugin] = pluginEntry;
  logger.success(`✅ Plugin ditemukan: ${pluginName}`);

  // 👑 Validasi owner & premium
  const { ownerFile } = require("@start/config/paths");
  await ensureJsonFile(ownerFile, []);
  delete require.cache[require.resolve(ownerFile)];
  const ownerList = require(ownerFile);
  const allOwners = [...mainOwners, ...ownerList.map(o => o.number)];

  const isOwner = allOwners.includes(msg.senderNumber);
  const isPremium = msg.isPremium || false;

  if ((plugin.ownerOnly || plugin.owner) && !isOwner) {
    logger.warn(`🚫 ${msg.senderNumber} mencoba akses plugin owner: ${pluginName}`);
    return msg.reply("❌ Perintah ini hanya untuk *owner*.");
  }

  if ((plugin.premiumOnly || plugin.premium) && !isPremium && !isOwner) {
    logger.warn(`🚫 ${msg.senderNumber} mencoba akses plugin premium: ${pluginName}`);
    return msg.reply("❌ Perintah ini hanya untuk pengguna *premium*.");
  }

  // 🚀 Eksekusi plugin
  const pluginContext = {
    config,
    logger,
    messageSender,
    socket,
    sender: msg.sender,
    args: msg.args,
    command: msg.command,
    fullText: msg.text,
    isGroup: msg.isGroup,
    chatId: msg.remoteJid,
    pushName: msg.pushName,
    m: msg
  };

  try {
    if (plugin.constructor?.name === "PluginTemplate") {
      await plugin.execute(rawMessage, socket, pluginContext);
    } else if (typeof plugin.run === "function") {
      await plugin.run(msg, socket, pluginContext);
    } else if (typeof plugin.execute === "function") {
      await plugin.execute(msg, socket, pluginContext);
    } else {
      logger.error(`❌ Plugin ${pluginName} tidak memiliki method yang bisa dijalankan`);
      return msg.reply("⚠️ Plugin tidak dapat dijalankan.");
    }

    logger.success(`✅ Plugin ${pluginName} selesai dijalankan`);
  } catch (err) {
    logger.error(`❌ Error saat menjalankan plugin ${pluginName}:`, err);
    await msg.reply("⚠️ Terjadi kesalahan saat menjalankan plugin.");
  }
}

// ♻️ Auto-clear cache setiap 30 menit
setInterval(() => {
  notifiedUsers.clear();
  logger.info("♻️ [Auto Reset] Cache notifiedUsers dibersihkan setiap 30 menit");
}, 1000 * 60 * 30);

module.exports = {
  processMessage,
  preInjectNativeFlow
};