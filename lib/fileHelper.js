const fs   = require('fs');
const path = require('path');

/**
 * Pastikan file JSON ada. Jika tidak, buat file dengan default value
 * @param {string} filePath - path file JSON
 * @param {any} defaultValue - nilai awal jika file belum ada
 * @returns {any} - data hasil JSON.parse
 */
function ensureJsonFile(filePath, defaultValue = []) {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error(`❌ Gagal membaca file ${filePath}:`, err);
        return defaultValue;
    }
}

/**
 * Simpan data ke dalam file JSON
 * @param {string} filePath - path file JSON
 * @param {any} data - data yang akan disimpan
 */
function saveJsonFile(filePath, data) {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`❌ Gagal menyimpan file ${filePath}:`, err);
    }
}

/**
 * Membaca file (seperti gambar/audio) sebagai buffer
 * @param {string} relativePath - path relatif dari root project
 * @returns {Buffer|null}
 */
function readFileAsBuffer(relativePath) {
    try {
        const fullPath = path.join(process.cwd(), relativePath);
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath);
        } else {
            console.warn(`⚠️ File tidak ditemukan: ${fullPath}`);
            return null;
        }
    } catch (err) {
        console.error(`❌ Gagal membaca buffer dari ${relativePath}:`, err);
        return null;
    }
}

module.exports = {
    ensureJsonFile,
    saveJsonFile,
    readFileAsBuffer
};