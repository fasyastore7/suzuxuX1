/**
 * Anti-Spam Module untuk WhatsApp Bot
 * Mencegah spam pesan berlebihan dengan mendeteksi frekuensi pesan per user
 */

// Map untuk menyimpan riwayat aktivitas setiap user
// Struktur: userId -> Array of timestamps
const userActivity = new Map();

// Konfigurasi anti-spam
const SPAM_CONFIG = {
    MAX_MESSAGES: 5,      // Maksimal 5 pesan
    TIME_WINDOW: 10000,   // Dalam 10 detik (10000 ms)
    CLEANUP_INTERVAL: 5 * 60 * 1000  // Cleanup setiap 5 menit
};

/**
 * Mengecek apakah user sedang melakukan spam atau tidak
 * @param {string} id - ID user (nomor WhatsApp atau user ID)
 * @returns {boolean} true jika user sedang spam, false jika normal
 */
function isSpamming(id) {
    const now = Date.now();
    
    // Ambil riwayat aktivitas user, atau buat array kosong jika belum ada
    let userTimestamps = userActivity.get(id) || [];
    
    // Filter timestamps yang masih dalam time window (hapus yang sudah expired)
    userTimestamps = userTimestamps.filter(timestamp => 
        now - timestamp < SPAM_CONFIG.TIME_WINDOW
    );
    
    // Tambahkan timestamp saat ini
    userTimestamps.push(now);
    
    // Update riwayat aktivitas user
    userActivity.set(id, userTimestamps);
    
    // Cek apakah jumlah pesan melebihi batas maksimal
    if (userTimestamps.length > SPAM_CONFIG.MAX_MESSAGES) {
        return true; // User sedang spam
    }
    
    return false; // User tidak spam
}

/**
 * Mendapatkan jumlah pesan user dalam time window saat ini
 * @param {string} id - ID user
 * @returns {number} Jumlah pesan dalam time window
 */
function getMessageCount(id) {
    const now = Date.now();
    const userTimestamps = userActivity.get(id) || [];
    
    // Hitung pesan yang masih dalam time window
    const activeMessages = userTimestamps.filter(timestamp => 
        now - timestamp < SPAM_CONFIG.TIME_WINDOW
    );
    
    return activeMessages.length;
}

/**
 * Mendapatkan sisa waktu hingga user tidak lagi dianggap spam
 * @param {string} id - ID user
 * @returns {number} Sisa waktu dalam detik (0 jika tidak spam)
 */
function getSpamCooldown(id) {
    const userTimestamps = userActivity.get(id) || [];
    
    if (userTimestamps.length <= SPAM_CONFIG.MAX_MESSAGES) {
        return 0; // Tidak dalam status spam
    }
    
    // Ambil timestamp tertua dalam window
    const now = Date.now();
    const validTimestamps = userTimestamps.filter(timestamp => 
        now - timestamp < SPAM_CONFIG.TIME_WINDOW
    );
    
    if (validTimestamps.length === 0) {
        return 0;
    }
    
    // Hitung sisa waktu berdasarkan timestamp tertua
    const oldestTimestamp = Math.min(...validTimestamps);
    const remainingTime = SPAM_CONFIG.TIME_WINDOW - (now - oldestTimestamp);
    
    return remainingTime > 0 ? Math.ceil(remainingTime / 1000) : 0;
}

/**
 * Membersihkan data aktivitas untuk user tertentu
 * @param {string} id - ID user yang akan dibersihkan
 */
function clearUser(id) {
    userActivity.delete(id);
    console.log(`Anti-spam data cleared for user: ${id}`);
}

/**
 * Membersihkan semua data aktivitas yang sudah expired
 * Dipanggil secara otomatis untuk mencegah memory leak
 */
function cleanupExpiredData() {
    const now = Date.now();
    let cleanupCount = 0;
    
    for (const [userId, timestamps] of userActivity.entries()) {
        // Filter timestamps yang masih valid
        const validTimestamps = timestamps.filter(timestamp => 
            now - timestamp < SPAM_CONFIG.TIME_WINDOW
        );
        
        if (validTimestamps.length === 0) {
            // Hapus user jika tidak ada aktivitas valid
            userActivity.delete(userId);
            cleanupCount++;
        } else if (validTimestamps.length !== timestamps.length) {
            // Update dengan timestamps yang valid saja
            userActivity.set(userId, validTimestamps);
        }
    }
    
    if (cleanupCount > 0) {
        console.log(`Anti-spam cleanup: Removed ${cleanupCount} inactive users`);
    }
}

/**
 * Mendapatkan statistik anti-spam
 * @returns {object} Statistik sistem anti-spam
 */
function getStats() {
    const totalUsers = userActivity.size;
    let totalMessages = 0;
    let spammingUsers = 0;
    
    for (const [userId, timestamps] of userActivity.entries()) {
        const now = Date.now();
        const activeMessages = timestamps.filter(timestamp => 
            now - timestamp < SPAM_CONFIG.TIME_WINDOW
        );
        
        totalMessages += activeMessages.length;
        
        if (activeMessages.length > SPAM_CONFIG.MAX_MESSAGES) {
            spammingUsers++;
        }
    }
    
    return {
        totalUsers,
        totalMessages,
        spammingUsers,
        maxMessages: SPAM_CONFIG.MAX_MESSAGES,
        timeWindow: SPAM_CONFIG.TIME_WINDOW / 1000 // dalam detik
    };
}

/**
 * Mengubah konfigurasi anti-spam
 * @param {object} newConfig - Konfigurasi baru
 */
function updateConfig(newConfig) {
    if (newConfig.maxMessages) {
        SPAM_CONFIG.MAX_MESSAGES = newConfig.maxMessages;
    }
    if (newConfig.timeWindow) {
        SPAM_CONFIG.TIME_WINDOW = newConfig.timeWindow * 1000; // convert ke ms
    }
    
    console.log('Anti-spam config updated:', SPAM_CONFIG);
}

// Setup auto cleanup untuk mencegah memory leak
setInterval(cleanupExpiredData, SPAM_CONFIG.CLEANUP_INTERVAL);

// Export fungsi-fungsi yang dibutuhkan
module.exports = {
    isSpamming,
    getMessageCount,
    getSpamCooldown,
    clearUser,
    cleanupExpiredData,
    getStats,
    updateConfig
};