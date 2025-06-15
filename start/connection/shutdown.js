const hooks    = [];
let isShutdown = false;

/**
 * Registrasikan hook yang akan dijalankan saat aplikasi dimatikan
 * @param {Function} fn - Fungsi async yang akan dipanggil saat shutdown
 * @param {string} [label] - Nama opsional untuk log
 * @param {number} [priority=0] - Urutan prioritas eksekusi (semakin besar, semakin awal)
 */
function registerShutdownHook(fn, label = 'Unnamed Hook', priority = 0) {
    hooks.push({ fn, label, priority });
}

// Fungsi utama shutdown
async function executeShutdown() {
    if (isShutdown) return;
    isShutdown = true;

    console.log('\n🛑 [Shutdown] Menjalankan cleanup...');

    // Urutkan berdasarkan prioritas (desc)
    hooks.sort((a, b) => b.priority - a.priority);

    for (const { fn, label } of hooks) {
        try {
            console.log(`🔧 Menjalankan hook: ${label}`);
            await fn();
        } catch (err) {
            console.error(`❌ Gagal menjalankan ${label}: ${err.message}`);
        }
    }

    console.log('✅ Semua hook selesai. Keluar dengan aman.');
    process.exit(0);
}

// Tangani berbagai sinyal
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
    process.on(signal, () => {
        console.log(`📥 Menerima sinyal ${signal}`);
        executeShutdown();
    });
});

// Tangani error tak tertangani
process.on('uncaughtException', err => {
    console.error('❌ Uncaught Exception:', err);
    executeShutdown();
});

process.on('unhandledRejection', err => {
    console.error('❌ Unhandled Rejection:', err);
    executeShutdown();
});

module.exports = {
    registerShutdownHook
};