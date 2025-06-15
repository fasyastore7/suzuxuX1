/**
 * Rate Limiter untuk WhatsApp Bot
 * Mencegah spam perintah dengan membatasi frekuensi request per user
 */

// Map untuk menyimpan timestamp terakhir setiap user
const userTimestamps = new Map();

// Konfigurasi rate limiting (dalam milidetik)
const RATE_LIMIT_WINDOW = 3000; // 3 detik

/**
 * Mengecek apakah user sedang dalam rate limit atau tidak
 * @param {string} id - ID user (biasanya nomor WhatsApp)
 * @returns {boolean} true jika user dibatasi (rate limited), false jika diizinkan
 */
function isRateLimited(id) {
    const now = Date.now();
    const lastTimestamp = userTimestamps.get(id);
    
    // Jika user belum pernah mengirim perintah sebelumnya
    if (!lastTimestamp) {
        userTimestamps.set(id, now);
        return false; // Izinkan perintah pertama
    }
    
    // Hitung selisih waktu sejak perintah terakhir
    const timeDiff = now - lastTimestamp;
    
    // Jika belum cukup waktu berlalu (masih dalam window rate limit)
    if (timeDiff < RATE_LIMIT_WINDOW) {
        return true; // User dibatasi (rate limited)
    }
    
    // Jika sudah cukup waktu berlalu, perbarui timestamp dan izinkan
    userTimestamps.set(id, now);
    return false; // User tidak dibatasi
}

/**
 * Mendapatkan sisa waktu tunggu untuk user (dalam detik)
 * @param {string} id - ID user
 * @returns {number} Sisa waktu tunggu dalam detik (0 jika tidak ada rate limit)
 */
function getRemainingTime(id) {
    const lastTimestamp = userTimestamps.get(id);
    
    if (!lastTimestamp) {
        return 0; // Tidak ada rate limit
    }
    
    const now = Date.now();
    const timeDiff = now - lastTimestamp;
    const remaining = RATE_LIMIT_WINDOW - timeDiff;
    
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Menghapus data rate limit untuk user tertentu
 * @param {string} id - ID user
 */
function clearUserLimit(id) {
    userTimestamps.delete(id);
}

/**
 * Membersihkan data rate limit yang sudah kadaluarsa
 * Dipanggil secara periodik untuk mencegah memory leak
 */
function cleanupExpiredLimits() {
    const now = Date.now();
    const expiredTime = 60000; // 60 detik - lebih lama dari rate limit window
    
    for (const [id, timestamp] of userTimestamps.entries()) {
        if (now - timestamp > expiredTime) {
            userTimestamps.delete(id);
        }
    }
}

// Cleanup otomatis setiap 5 menit untuk mencegah memory leak
setInterval(cleanupExpiredLimits, 5 * 60 * 1000);

// Export fungsi-fungsi yang dibutuhkan
module.exports = {
    isRateLimited,
    getRemainingTime,
    clearUserLimit,
    cleanupExpiredLimits
};