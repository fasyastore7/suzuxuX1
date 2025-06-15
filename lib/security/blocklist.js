/**
 * Blocklist Management untuk WhatsApp Bot
 * Menangani daftar pengguna yang diblokir dengan penyimpanan persisten
 */

const fs = require("fs");
const path = require("path");
const { dbPath } = require("@start/config/paths");

const BLOCKLIST_FILE = path.join(dbPath, "blocklist.json");

// Cache in-memory
let blocklistCache = new Set();
let isInitialized = false;

/**
 * Inisialisasi sistem blocklist
 */
function initializeBlocklist() {
  try {
    if (!fs.existsSync(BLOCKLIST_FILE)) {
      // Buat file jika belum ada
      fs.writeFileSync(BLOCKLIST_FILE, "[]", "utf8");
      console.log("📄 File blocklist.json dibuat");
    }

    const data = fs.readFileSync(BLOCKLIST_FILE, "utf8").trim();

    // Jika kosong, isi dengan array kosong
    const json = data ? JSON.parse(data) : [];
    if (!Array.isArray(json)) throw new Error("Format blocklist tidak valid");

    blocklistCache = new Set(json);
    console.log(`🔒 Blocklist dimuat (${blocklistCache.size} user diblokir)`);
    isInitialized = true;
  } catch (err) {
    console.error("❌ Gagal inisialisasi blocklist:", err.message);
    blocklistCache = new Set(); // fallback
    isInitialized = true;
  }
}

function saveBlocklistToFile() {
  try {
    const arr = [...blocklistCache];
    fs.writeFileSync(BLOCKLIST_FILE, JSON.stringify(arr, null, 2));
    return true;
  } catch (err) {
    console.error("❌ Gagal menyimpan blocklist:", err.message);
    return false;
  }
}

function normalize(id) {
  return (id || "").toString().trim().replace(/[^\d]/g, "");
}

function isBlocked(id) {
  if (!isInitialized) initializeBlocklist();
  return blocklistCache.has(normalize(id));
}

function addBlock(id) {
  if (!isInitialized) initializeBlocklist();
  const norm = normalize(id);
  if (!norm) return false;

  if (blocklistCache.has(norm)) return false;

  blocklistCache.add(norm);
  return saveBlocklistToFile();
}

function removeBlock(id) {
  if (!isInitialized) initializeBlocklist();
  const norm = normalize(id);
  if (!blocklistCache.has(norm)) return false;

  blocklistCache.delete(norm);
  return saveBlocklistToFile();
}

function getBlocklist() {
  if (!isInitialized) initializeBlocklist();
  return [...blocklistCache];
}

function getBlockedCount() {
  if (!isInitialized) initializeBlocklist();
  return blocklistCache.size;
}

function clearBlocklist() {
  if (!isInitialized) initializeBlocklist();
  const count = blocklistCache.size;
  blocklistCache.clear();
  if (saveBlocklistToFile()) {
    console.log(`🗑️ Blocklist dikosongkan (${count} user)`);
    return true;
  }
  return false;
}

function reloadBlocklist() {
  isInitialized = false;
  initializeBlocklist();
  return true;
}

function getStats() {
  if (!isInitialized) initializeBlocklist();
  const exists = fs.existsSync(BLOCKLIST_FILE);
  return {
    totalBlocked: blocklistCache.size,
    filePath: BLOCKLIST_FILE,
    fileExists: exists,
    lastModified: exists ? fs.statSync(BLOCKLIST_FILE).mtime : null,
  };
}

// Inisialisasi saat load
initializeBlocklist();

module.exports = {
  isBlocked,
  addBlock,
  removeBlock,
  getBlocklist,
  getBlockedCount,
  clearBlocklist,
  reloadBlocklist,
  getStats,
};