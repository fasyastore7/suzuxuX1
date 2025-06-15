const chalk  = require("chalk");
const moment = require("moment");

/**
 * Menghapus spasi, tab, newline berlebih dari teks
 * @param {string} input
 * @returns {string}
 */
function removeSpace(input = "") {
    return typeof input === "string"
        ? input.replace(/\s+/g, " ").trim()
        : input;
}

/**
 * Mengecek apakah sebuah pesan adalah quoted message
 * @param {object} message - pesan WhatsApp mentah
 * @returns {object|false}
 */
function isQuotedMessage(message) {
    if (
        message?.message?.extendedTextMessage?.contextInfo?.quotedMessage &&
        message?.message?.extendedTextMessage?.contextInfo?.participant
    ) {
        const quoted =
            message.message.extendedTextMessage.contextInfo.quotedMessage;
        const sender =
            message.message.extendedTextMessage.contextInfo.participant;
        const rawMessageType = Object.keys(quoted)[0];
        const viewOnce = containsViewOnce(message?.message) ? true : null;
        let messageType = getMessageType(rawMessageType);
        if (viewOnce) messageType = "viewonce";
        const content =
            quoted[`${messageType}Message`] || quoted[rawMessageType];
        const text = quoted[rawMessageType]?.text || content || "";
        const id =
            message.message.extendedTextMessage.contextInfo.stanzaId || null;

        return {
            sender,
            content,
            type: messageType,
            text,
            id,
            rawMessageType
        };
    }
    return false;
}

/**
 * Cek apakah pesan mengandung viewOnce
 * @param {object} msg
 * @returns {boolean}
 */
function containsViewOnce(msg) {
    return (
        msg?.viewOnceMessage ||
        msg?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage
    );
}

/**
 * Mengembalikan nama tipe message yang disederhanakan
 * @param {string} rawType - tipe dari Baileys
 * @returns {string}
 */
function getMessageType(rawType = "") {
    const map = {
        conversation: "text",
        extendedTextMessage: "text",
        imageMessage: "image",
        videoMessage: "video",
        stickerMessage: "sticker",
        audioMessage: "audio",
        documentMessage: "document",
        reactionMessage: "reaction",
        pollUpdateMessage: "poll",
        viewOnceMessage: "viewOnce",
        buttonsMessage: "buttons",
        templateButtonReplyMessage: "template",
        contactMessage: "contact",
        protocolMessage: "protocol",
        senderKeyDistributionMessage: "skd"
    };

    return map[rawType] || rawType;
}

/**
 * Mengirim pesan dengan mention (tanpa mengutip)
 * @param {object} sock - socket dari Baileys
 * @param {string} jid - JID tujuan
 * @param {string} text - isi pesan
 * @param {array} [mentions] - array JID yang ingin dimention
 */
async function sendMessageWithMentionNotQuoted(sock, jid, text, mentions = []) {
    if (!sock || !jid || !text) return;

    if (!mentions.length) {
        const regex = /@(\d{5,})/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const jidMention = `${match[1]}@s.whatsapp.net`;
            if (!mentions.includes(jidMention)) mentions.push(jidMention);
        }
    }

    await sock.sendMessage(jid, {
        text,
        mentions
    });
}

/**
 * Fungsi sleep / delay async
 * @param {number} ms - waktu dalam milidetik
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Memformat text dengan style dan warna menggunakan chalk
 * @param {string} text - teks yang akan diformat
 * @param {string|object} style - style yang diinginkan (string atau object)
 * @returns {string} - teks yang sudah diformat
 * 
 * Contoh penggunaan:
 * style("Hello World", "red")
 * style("Hello World", "bold.red")
 * style("Hello World", { color: "red", background: "bgBlue", style: "bold" })
 */
function style(text = "", style = "") {
    if (!text || typeof text !== "string") return text;
    
    try {
        if (typeof style === "string") {
            // Format: "red", "bold.red", "bgBlue.white.bold"
            const styles = style.split(".");
            let result = chalk;
            
            for (const s of styles) {
                if (typeof result[s] === "function") {
                    result = result[s];
                }
            }
            
            return typeof result === "function" ? result(text) : text;
        } else if (typeof style === "object") {
            // Format object: { color: "red", background: "bgBlue", style: "bold" }
            let result = chalk;
            
            // Apply style (bold, italic, underline, etc.)
            if (style.style && typeof result[style.style] === "function") {
                result = result[style.style];
            }
            
            // Apply color
            if (style.color && typeof result[style.color] === "function") {
                result = result[style.color];
            }
            
            // Apply background
            if (style.background && typeof result[style.background] === "function") {
                result = result[style.background];
            }
            
            return typeof result === "function" ? result(text) : text;
        }
    } catch (error) {
        console.error("Error in style function:", error);
        return text;
    }
    
    return text;
}

/**
 * Memotong teks panjang dan menambahkan "Read More" dengan batas karakter
 * @param {string} text - teks yang akan dipotong
 * @param {number} [limit=500] - batas karakter sebelum dipotong
 * @param {string} [readMoreText="... Read More"] - teks "Read More"
 * @param {boolean} [preserveWords=true] - apakah mempertahankan kata utuh
 * @returns {object} - { text: string, isTruncated: boolean, originalLength: number }
 */
function readMore(text = "", limit = 500, readMoreText = "... Read More", preserveWords = true) {
    if (!text || typeof text !== "string") {
        return {
            text: text,
            isTruncated: false,
            originalLength: 0
        };
    }
    
    const originalLength = text.length;
    
    // Jika teks tidak melebihi batas, kembalikan as is
    if (originalLength <= limit) {
        return {
            text: text,
            isTruncated: false,
            originalLength: originalLength
        };
    }
    
    let truncatedText = text.substring(0, limit);
    
    // Jika preserveWords true, cari spasi terakhir untuk tidak memotong kata
    if (preserveWords) {
        const lastSpaceIndex = truncatedText.lastIndexOf(" ");
        if (lastSpaceIndex > limit * 0.8) { // Minimal 80% dari limit
            truncatedText = truncatedText.substring(0, lastSpaceIndex);
        }
    }
    
    // Hapus karakter yang tidak diinginkan di akhir
    truncatedText = truncatedText.replace(/[.,;:!?\-\s]+$/, "");
    
    return {
        text: truncatedText + readMoreText,
        isTruncated: true,
        originalLength: originalLength
    };
}

/**
 * Memformat angka dengan pemisah ribuan
 * @param {number|string} number - angka yang akan diformat
 * @param {string} [separator="."] - pemisah ribuan
 * @returns {string}
 */
function formatNumber(number, separator = ".") {
    if (typeof number === "string") number = parseFloat(number);
    if (isNaN(number)) return "0";
    
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Memformat ukuran file dalam bytes menjadi format yang mudah dibaca
 * @param {number} bytes - ukuran dalam bytes
 * @param {number} [decimals=2] - jumlah desimal
 * @returns {string}
 */
function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Menghasilkan string acak dengan panjang tertentu
 * @param {number} [length=8] - panjang string
 * @param {string} [chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"] - karakter yang digunakan
 * @returns {string}
 */
function generateRandomString(length = 8, chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Memvalidasi apakah string adalah nomor WhatsApp yang valid
 * @param {string} number - nomor yang akan divalidasi
 * @returns {boolean}
 */
function isValidWhatsAppNumber(number) {
    if (!number || typeof number !== "string") return false;
    
    // Hapus karakter non-digit
    const cleanNumber = number.replace(/\D/g, "");
    
    // Cek panjang nomor (minimal 10 digit, maksimal 15 digit)
    if (cleanNumber.length < 10 || cleanNumber.length > 15) return false;
    
    // Cek apakah dimulai dengan angka yang valid (tidak dimulai dengan 0)
    if (cleanNumber.startsWith("0")) return false;
    
    return true;
}

/**
 * Mengkonversi nomor ke format JID WhatsApp
 * @param {string} number - nomor telepon
 * @returns {string} - JID format
 */
function toJID(number) {
    if (!number) return "";
    
    // Hapus karakter non-digit
    const cleanNumber = number.replace(/\D/g, "");
    
    // Jika sudah dalam format JID, kembalikan as is
    if (cleanNumber.includes("@")) return cleanNumber;
    
    // Tambahkan @s.whatsapp.net jika belum ada
    return `${cleanNumber}@s.whatsapp.net`;
}

/**
 * Mengkonversi JID ke nomor biasa
 * @param {string} jid - JID WhatsApp
 * @returns {string} - nomor telepon
 */
function fromJID(jid) {
    if (!jid) return "";
    
    return jid.replace(/@.*$/, "");
}

/**
 * Memformat waktu dalam milidetik menjadi format yang mudah dibaca
 * @param {number} ms - waktu dalam milidetik
 * @returns {string}
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const parts = [];
    
    if (days > 0) parts.push(`${days} hari`);
    if (hours % 24 > 0) parts.push(`${hours % 24} jam`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60} menit`);
    if (seconds % 60 > 0) parts.push(`${seconds % 60} detik`);
    
    return parts.length > 0 ? parts.join(", ") : "0 detik";
}

function getCurrentDate() {
    const now = moment().tz("Asia/Jakarta"); // Set zona waktu ke WIB
    const day = now.date();
    const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const month = monthNames[now.month()]; // Nama bulan
    const year = now.year();
    
    return `${day} ${month} ${year}`;
}

/**
 * Membersihkan teks dari karakter yang tidak diinginkan
 * @param {string} text - teks yang akan dibersihkan
 * @param {object} [options] - opsi pembersihan
 * @returns {string}
 */
function cleanText(text, options = {}) {
    if (!text || typeof text !== "string") return "";
    
    const defaultOptions = {
        removeEmojis: false,
        removeUrls: false,
        removeMentions: false,
        removeHashtags: false,
        removeExtraSpaces: true,
        toLowerCase: false
    };
    
    const opts = { ...defaultOptions, ...options };
    let result = text;
    
    // Hapus emoji
    if (opts.removeEmojis) {
        result = result.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "");
    }
    
    // Hapus URL
    if (opts.removeUrls) {
        result = result.replace(/https?:\/\/[^\s]+/g, "");
    }
    
    // Hapus mention
    if (opts.removeMentions) {
        result = result.replace(/@\w+/g, "");
    }
    
    // Hapus hashtag
    if (opts.removeHashtags) {
        result = result.replace(/#\w+/g, "");
    }
    
    // Hapus spasi berlebih
    if (opts.removeExtraSpaces) {
        result = result.replace(/\s+/g, " ").trim();
    }
    
    // Konversi ke lowercase
    if (opts.toLowerCase) {
        result = result.toLowerCase();
    }
    
    return result;
}

module.exports = {
    // Existing functions
    removeSpace,
    isQuotedMessage,
    getMessageType,
    sendMessageWithMentionNotQuoted,
    sleep,
    containsViewOnce,
    
    // New utility functions
    style,
    readMore,
    formatNumber,
    formatFileSize,
    generateRandomString,
    isValidWhatsAppNumber,
    toJID,
    fromJID,
    formatUptime,
    getCurrentDate,
    cleanText
};