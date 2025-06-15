console.log(`[✔] Start App ...`);

// Wajib Node.js versi 18, 19, 20, 21, atau 22
const [major] = process.versions.node.split(".").map(Number);

if (major < 18 || major > 22) {
    console.error(
        `❌ Script ini hanya kompatibel dengan Node.js versi 18.x hingga 22.x`
    );
    console.error(`📌 Versi Node.js Anda saat ini: ${process.version}`);
    console.error(
        `ℹ️  Jika kamu menjalankan script ini melalui panel, buka menu *Startup*, lalu ubah *Docker Image* ke versi Node.js 18-22`
    );

    // Tunggu 60 detik sebelum keluar
    setTimeout(() => {
        process.exit(1);
    }, 60_000);
    return;
}

process.env.TZ = "Asia/Jakarta"; // Lokasi Timezone utama

require("module-alias/register");
require("@lib/version");

const { checkAndInstallModules } = require("@start/handlers/update");

(async () => {
    try {
        // Cek dan install semua module yang diperlukan
        await checkAndInstallModules(["@whiskeysockets/baileys"]);

        const { start_app } = require("@start/connection/startup");
        await start_app();
    } catch (err) {
        console.error("❌ Error dalam proses start_app:", err.message);
    }
})();
