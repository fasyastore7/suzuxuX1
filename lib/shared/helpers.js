/**
 * Utility functions untuk aplikasi
 * @fileoverview Helper functions untuk parsing, formatting, dan utilitas umum
 */

/**
 * Konstanta untuk konversi waktu
 */
const TIME_MULTIPLIERS = {
    h: 60 * 60 * 1000, // jam
    d: 24 * 60 * 60 * 1000, // hari
    w: 7 * 24 * 60 * 60 * 1000, // minggu
    m: 30 * 24 * 60 * 60 * 1000, // bulan (30 hari)
    y: 365 * 24 * 60 * 60 * 1000 // tahun (365 hari)
};

/**
 * Nama unit waktu dalam bahasa Indonesia
 */
const TIME_UNIT_NAMES = {
    h: "jam",
    d: "hari",
    w: "minggu",
    m: "bulan",
    y: "tahun"
};

/**
 * Mapping karakter biasa ke bold Unicode
 */
const BOLD_UNICODE_MAP = {
    // Huruf besar
    A: "𝗔",
    B: "𝗕",
    C: "𝗖",
    D: "𝗗",
    E: "𝗘",
    F: "𝗙",
    G: "𝗚",
    H: "𝗛",
    I: "𝗜",
    J: "𝗝",
    K: "𝗞",
    L: "𝗟",
    M: "𝗠",
    N: "𝗡",
    O: "𝗢",
    P: "𝗣",
    Q: "𝗤",
    R: "𝗥",
    S: "𝗦",
    T: "𝗧",
    U: "𝗨",
    V: "𝗩",
    W: "𝗪",
    X: "𝗫",
    Y: "𝗬",
    Z: "𝗭",

    // Huruf kecil
    a: "𝗮",
    b: "𝗯",
    c: "𝗰",
    d: "𝗱",
    e: "𝗲",
    f: "𝗳",
    g: "𝗴",
    h: "𝗵",
    i: "𝗶",
    j: "𝗷",
    k: "𝗸",
    l: "𝗹",
    m: "𝗺",
    n: "𝗻",
    o: "𝗼",
    p: "𝗽",
    q: "𝗾",
    r: "𝗿",
    s: "𝘀",
    t: "𝘁",
    u: "𝘂",
    v: "𝘃",
    w: "𝘄",
    x: "𝘅",
    y: "𝘆",
    z: "𝘇",

    // Angka
    0: "𝟬",
    1: "𝟭",
    2: "𝟮",
    3: "𝟯",
    4: "𝟰",
    5: "𝟱",
    6: "𝟲",
    7: "𝟳",
    8: "𝟴",
    9: "𝟵"
};

/**
 * Mapping karakter biasa ke monospace Unicode yang kompatibel
 */
const MONOSPACE_UNICODE_MAP = {
    // Huruf besar
    A: "𝙰", B: "𝙱", C: "𝙲", D: "𝙳", E: "𝙴", F: "𝙵", G: "𝙶", H: "𝙷", I: "𝙸", J: "𝙹",
    K: "𝙺", L: "𝙻", M: "𝙼", N: "𝙽", O: "𝙾", P: "𝙿", Q: "𝚀", R: "𝚁", S: "𝚂", T: "𝚃",
    U: "𝚄", V: "𝚅", W: "𝚆", X: "𝚇", Y: "𝚈", Z: "𝚉",
    // Huruf kecil
    a: "𝚊", b: "𝚋", c: "𝚌", d: "𝚍", e: "𝚎", f: "𝚏", g: "𝚐", h: "𝚑", i: "𝚒", j: "𝚓",
    k: "𝚔", l: "𝚕", m: "𝚖", n: "𝚗", o: "𝚘", p: "𝚙", q: "𝚚", r: "𝚛", s: "𝚜", t: "𝚝",
    u: "𝚞", v: "𝚟", w: "𝚠", x: "𝚡", y: "𝚢", z: "𝚣",
    // Angka
    0: "𝟶", 1: "𝟷", 2: "𝟸", 3: "𝟹", 4: "𝟺", 5: "𝟻", 6: "𝟼", 7: "𝟽", 8: "𝟾", 9: "𝟿"
};

/**
 * Mapping karakter biasa ke italic Unicode yang kompatibel
 */
const ITALIC_UNICODE_MAP = {
    // Huruf besar
    A: "𝐴", B: "𝐵", C: "𝐶", D: "𝐷", E: "𝐸", F: "𝐹", G: "𝐺", H: "𝐻", I: "𝐼", J: "𝐽",
    K: "𝐾", L: "𝐿", M: "𝑀", N: "𝑁", O: "𝑂", P: "𝑃", Q: "𝑄", R: "𝑅", S: "𝑆", T: "𝑇",
    U: "𝑈", V: "𝑉", W: "𝑊", X: "𝑋", Y: "𝑌", Z: "𝑍",
    // Huruf kecil
    a: "𝑎", b: "𝑏", c: "𝑐", d: "𝑑", e: "𝑒", f: "𝑓", g: "𝑔", h: "ℎ", i: "𝑖", j: "𝑗",
    k: "𝑘", l: "𝑙", m: "𝑚", n: "𝑛", o: "𝑜", p: "𝑝", q: "𝑞", r: "𝑟", s: "𝑠", t: "𝑡",
    u: "𝑢", v: "𝑣", w: "𝑤", x: "𝑥", y: "𝑦", z: "𝑧"
};

/**
 * Nama hari dalam bahasa Inggris (singkat)
 */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Nama bulan dalam bahasa Inggris (singkat)
 */
const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
];

/**
 * Safe logging function untuk menghindari error jika logger tidak tersedia
 * @param {string} level - Level log (info, warn, error)
 * @param {...any} args - Arguments untuk di-log
 */
function safeLog(level, ...args) {
    if (typeof console !== "undefined" && console[level]) {
        console[level](...args);
    }
}

/**
 * Parse durasi dari string ke milliseconds
 * @param {string} duration - Format: angka + unit (h/d/w/m/y)
 * @returns {object} - {ms: number, readable: string, isValid: boolean}
 * @example
 * parseDuration('7d') // {ms: 604800000, readable: '7 hari', isValid: true}
 * parseDuration('invalid') // {ms: 0, readable: '', isValid: false}
 */
function parseDuration(duration) {
    // Validasi input
    if (!duration || typeof duration !== "string") {
        return { ms: 0, readable: "", isValid: false };
    }

    // Parse format: angka + unit
    const match = duration.trim().match(/^(\d+)([hdwmy])$/i);
    if (!match) {
        return { ms: 0, readable: "", isValid: false };
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    // Validasi amount
    if (amount <= 0 || amount > 999999) {
        return { ms: 0, readable: "", isValid: false };
    }

    // Hitung milliseconds
    const ms = amount * TIME_MULTIPLIERS[unit];
    const readable = `${amount} ${TIME_UNIT_NAMES[unit]}`;

    return { ms, readable, isValid: true };
}

/**
 * Convert teks biasa ke bold Unicode
 * @param {string} text - Teks yang akan dikonversi
 * @returns {string} - Teks dengan karakter bold Unicode
 * @example
 * toBoldUnicode('Hello123') // '𝗛𝗲𝗹𝗹𝗼𝟭𝟮𝟯'
 */
function toBoldUnicode(text) {
    if (!text || typeof text !== "string") {
        return "";
    }

    return text
        .split("")
        .map(char => BOLD_UNICODE_MAP[char] || char)
        .join("");
}

/**
 * Convert teks biasa ke monospace Unicode yang kompatibel dengan WhatsApp
 * @param {string} text - Teks yang akan dikonversi
 * @returns {string} - Teks dengan karakter monospace Unicode
 * @example
 * toMonospaceUnicode('Hello123') // '𝙷𝚎𝚕𝚕𝚘𝟷𝟸𝟹'
 */
function toMonospaceUnicode(text = "") {
    if (!text || typeof text !== "string") {
        return "";
    }

    return text
        .split("")
        .map(char => MONOSPACE_UNICODE_MAP[char] || char)
        .join("");
}

/**
 * Convert teks biasa ke italic Unicode yang kompatibel dengan WhatsApp
 * @param {string} text - Teks yang akan dikonversi
 * @returns {string} - Teks dengan karakter italic Unicode
 * @example
 * toItalicUnicode('Hello') // '𝐻𝑒𝑙𝑙𝑜'
 */
function toItalicUnicode(text = "") {
    if (!text || typeof text !== "string") {
        return "";
    }

    return text
        .split("")
        .map(char => ITALIC_UNICODE_MAP[char] || char)
        .join("");
}

/**
 * Alternatif menggunakan markdown syntax WhatsApp (lebih kompatibel)
 */
function toMonospaceMarkdown(text = "") {
    return `\`${text}\``;
}

function toItalicMarkdown(text = "") {
    return `_${text}_`;
}

function toBoldMarkdown(text = "") {
    return `*${text}*`;
}

function toStrikethroughMarkdown(text = "") {
    return `~${text}~`;
}

function toSmallCaps(text = "") {
  const normal = "abcdefghijklmnopqrstuvwxyz";
  const smallCaps = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";
  return text
    .split("")
    .map(char => {
      const i = normal.indexOf(char.toLowerCase());
      return i >= 0 ? smallCaps[i] : char;
    })
    .join("");
}

/**
 * Format teks dengan berbagai style sekaligus
 * @param {string} text - Teks yang akan diformat
 * @param {object} options - Opsi formatting
 * @param {boolean} options.bold - Apakah menggunakan bold
 * @param {boolean} options.italic - Apakah menggunakan italic
 * @param {boolean} options.monospace - Apakah menggunakan monospace
 * @param {boolean} options.strikethrough - Apakah menggunakan strikethrough
 * @param {boolean} options.useMarkdown - Gunakan markdown syntax (default: false)
 * @returns {string} - Teks yang sudah diformat
 * @example
 * formatText('Hello', {bold: true, italic: true}) // '𝗛𝗲𝗹𝗹𝗼' dalam bold+italic
 * formatText('Hello', {bold: true, useMarkdown: true}) // '*Hello*'
 */
function formatText(text, options = {}) {
    if (!text || typeof text !== "string") {
        return "";
    }

    let result = text;
    const useMarkdown = options.useMarkdown || false;

    if (options.monospace) {
        result = useMarkdown ? toMonospaceMarkdown(result) : toMonospaceUnicode(result);
    }
    
    if (options.italic) {
        result = useMarkdown ? toItalicMarkdown(result) : toItalicUnicode(result);
    }
    
    if (options.bold) {
        result = useMarkdown ? toBoldMarkdown(result) : toBoldUnicode(result);
    }
    
    if (options.strikethrough && useMarkdown) {
        result = toStrikethroughMarkdown(result);
    }
    
    return result;
}

/**
 * Format tanggal ke format singkat dengan bold Unicode
 * @param {Date|string|number} date - Tanggal yang akan diformat
 * @returns {string} - Format: "Day Mon\nDD YYYY" dalam bold Unicode
 * @example
 * formatDateShort(new Date()) // "𝗦𝘂𝗻 𝗝𝗮𝗻\n𝟭𝟱 𝟮𝟬𝟮𝟱"
 */
function formatDateShort(date) {
    let dateObj;

    // Konversi input ke Date object
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === "string" || typeof date === "number") {
        dateObj = new Date(date);
    } else {
        dateObj = new Date();
    }

    // Validasi date
    if (isNaN(dateObj.getTime())) {
        return toBoldUnicode("Invalid Date");
    }

    const dayName = DAY_NAMES[dateObj.getDay()];
    const monthName = MONTH_NAMES[dateObj.getMonth()];
    const day = String(dateObj.getDate()).padStart(2, "0");
    const year = dateObj.getFullYear();

    return `${toBoldUnicode(dayName)} ${toBoldUnicode(
        monthName
    )}\n${toBoldUnicode(day)} ${toBoldUnicode(year.toString())}`;
}

/**
 * Convert durasi milliseconds ke hari untuk display
 * @param {number} ms - Milliseconds
 * @returns {number} - Jumlah hari (dibulatkan ke atas)
 * @example
 * convertToDays(86400000) // 1 (1 hari)
 * convertToDays(90000000) // 2 (1.04 hari -> 2 hari)
 */
function convertToDays(ms) {
    if (typeof ms !== "number" || ms < 0) {
        return 0;
    }

    return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Delay execution dengan reaction jam
 * @param {object} m - Objek pesan dari WhatsApp
 * @param {object} socket - Socket WhatsApp
 * @param {number} seconds - Durasi delay dalam detik (default: 2)
 * @returns {Promise<void>}
 * @example
 * await delayWithClock(m, socket, 3); // Delay 3 detik dengan reaction jam
 */
async function delayWithClock(m, socket, seconds = 2) {
    try {
        // Validasi input
        if (!socket || !m?.remoteJid || !m?.key) {
            safeLog("warn", "[delayWithClock] Message atau socket tidak valid");
            return;
        }

        // Validasi seconds
        const delaySeconds = Math.max(0, Math.min(60, Number(seconds) || 2));

        // Kirim reaction jam
        await socket.sendMessage(m.remoteJid, {
            react: { text: "⏰", key: m.key }
        });

        // Delay
        if (delaySeconds > 0) {
            await new Promise(resolve =>
                setTimeout(resolve, delaySeconds * 1000)
            );
        }
    } catch (err) {
        safeLog(
            "error",
            "[delayWithClock] Gagal mengirim reaction:",
            err.message || err
        );
    }
}

/**
 * Cek apakah user premium masih aktif
 * @param {object} user - Object user dengan property expires_at
 * @returns {boolean} - true jika aktif, false jika expired
 * @example
 * isUserActive({expires_at: '2025-12-31'}) // true jika belum expired
 * isUserActive({}) // true (permanent user)
 */
function isUserActive(user) {
    if (!user || typeof user !== "object") {
        return false;
    }

    // Permanent user jika tidak ada expiry
    if (!user.expires_at) {
        return true;
    }

    try {
        const expiryDate = new Date(user.expires_at);
        const currentDate = new Date();

        // Validasi tanggal
        if (isNaN(expiryDate.getTime())) {
            return false;
        }

        return currentDate < expiryDate;
    } catch (err) {
        safeLog(
            "error",
            "[isUserActive] Error parsing date:",
            err.message || err
        );
        return false;
    }
}

/**
 * Cleanup expired users dari daftar premium
 * @param {Array} premiumList - Array berisi object user
 * @returns {Array} - Array user yang masih aktif
 * @example
 * cleanupExpiredUsers([{id: 1, expires_at: '2025-12-31'}, {id: 2, expires_at: '2020-01-01'}])
 * // Returns: [{id: 1, expires_at: '2025-12-31'}]
 */
function cleanupExpiredUsers(premiumList) {
    if (!Array.isArray(premiumList)) {
        safeLog("warn", "[cleanupExpiredUsers] premiumList bukan array");
        return [];
    }

    try {
        return premiumList.filter(user => isUserActive(user));
    } catch (err) {
        safeLog(
            "error",
            "[cleanupExpiredUsers] Error filtering users:",
            err.message || err
        );
        return [];
    }
}

/**
 * Format waktu dari milliseconds ke format yang mudah dibaca
 * @param {number} ms - Milliseconds
 * @returns {string} - Format yang mudah dibaca
 * @example
 * formatDuration(3600000) // "1 jam"
 * formatDuration(90061000) // "1 hari 1 jam 1 menit"
 */
function formatDuration(ms) {
    if (typeof ms !== "number" || ms < 0) {
        return "0 detik";
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} tahun${years > 1 ? "" : ""}`;
    if (months > 0) return `${months} bulan${months > 1 ? "" : ""}`;
    if (weeks > 0) return `${weeks} minggu${weeks > 1 ? "" : ""}`;
    if (days > 0) return `${days} hari${days > 1 ? "" : ""}`;
    if (hours > 0) return `${hours} jam${hours > 1 ? "" : ""}`;
    if (minutes > 0) return `${minutes} menit${minutes > 1 ? "" : ""}`;

    return `${seconds} detik${seconds > 1 ? "" : ""}`;
}

/**
 * Validasi format nomor WhatsApp
 * @param {string} number - Nomor WhatsApp
 * @returns {boolean} - true jika valid
 * @example
 * isValidWhatsAppNumber('6281234567890') // true
 * isValidWhatsAppNumber('invalid') // false
 */
function isValidWhatsAppNumber(number) {
    if (!number || typeof number !== "string") {
        return false;
    }

    // Format: minimal 8 digit, maksimal 15 digit, hanya angka
    const cleanNumber = number.replace(/\D/g, "");
    return /^\d{8,15}$/.test(cleanNumber);
}

// Export semua functions
module.exports = {
    time: {
        parseDuration,
        formatDuration,
        convertToDays,
        delayWithClock
    },
    formatter: {
        toBoldUnicode,
        toMonospaceUnicode,
        toItalicUnicode,
        formatDateShort,
        // Tambahan fungsi markdown
        toMonospaceMarkdown,
        toItalicMarkdown,
        toBoldMarkdown,
        toStrikethroughMarkdown,
        toSmallCaps,
        formatText
    },
    user: {
        isUserActive,
        cleanupExpiredUsers,
        isValidWhatsAppNumber
    },
    log: {
        safeLog
    },
    constants: {
        TIME_MULTIPLIERS,
        TIME_UNIT_NAMES,
        DAY_NAMES,
        MONTH_NAMES,
        BOLD_UNICODE_MAP,
        MONOSPACE_UNICODE_MAP,
        ITALIC_UNICODE_MAP
    },
    // Backward compatibility exports
    parseDuration,
    toBoldUnicode,
    toMonospaceUnicode,
    toItalicUnicode,
    toSmallCaps,
    formatDateShort,
    convertToDays,
    delayWithClock,
    isUserActive,
    cleanupExpiredUsers,
    isValidWhatsAppNumber,
    safeLog,
    // Tambahan exports
    toMonospaceMarkdown,
    toItalicMarkdown,
    toBoldMarkdown,
    toStrikethroughMarkdown,
    formatText
};