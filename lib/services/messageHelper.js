const MessageSender = require('@lib/services/messageSender');

let instance       = null;
let currentSock    = null;
let currentOptions = {};

/**
 * Inisialisasi/refresh instance MessageSender
 * @param {any} sock - Socket WhatsApp aktif
 * @param {Object} options - Opsi tambahan (dryRun, i18n, enableDeviceDetection, etc.)
 */
function setSocket(sock, options = {}) {
    const shouldReplace =
        !instance || currentSock !== sock || JSON.stringify(currentOptions) !== JSON.stringify(options);

    if (shouldReplace) {
        instance = new MessageSender(sock, options);
        currentSock = sock;
        currentOptions = options;
    }
}

/**
 * Paksa re-init (meskipun sock/config sama)
 */
function forceReset(sock, options = {}) {
    instance = new MessageSender(sock, options);
    currentSock = sock;
    currentOptions = options;
}

/**
 * Ambil instance aktif
 */
function getInstance() {
    if (!instance) throw new Error("MessageSender belum diinisialisasi. Panggil setSocket() dulu.");
    return instance;
}

/**
 * Cek apakah sudah terinisialisasi
 */
function isInitialized() {
    return !!instance;
}

/**
 * Dapatkan konfigurasi terakhir
 */
function getLastConfig() {
    return {
        sock: currentSock,
        options: currentOptions
    };
}

module.exports = {
    setSocket,
    forceReset,
    getInstance,
    isInitialized,
    getLastConfig
};