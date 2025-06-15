const fs                         = require("fs");
const { versionFile }            = require("@start/config/paths");
const { updateVersionInStrings } = require("@start/handlers/update");

let versionData = { version: "unknown" };

try {
    versionData = JSON.parse(fs.readFileSync(versionFile, "utf-8"));
} catch (err) {
    console.error("❌ Gagal membaca version.json:", err.message);
}

global.version = versionData.version;

// Jalankan pembaruan versi jika dibutuhkan
updateVersionInStrings();
