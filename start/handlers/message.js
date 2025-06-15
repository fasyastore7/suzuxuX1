const logger             = require("@lib/logger");
const { processMessage } = require("@lib/services/msgprocessor");

/**
 * Handler utama untuk messages.upsert dari Baileys
 * @param {import("baileys").WASocket} sock 
 * @param {object} upsert 
 * @param {object} context 
 */
async function handleMessageUpsert(sock, upsert, context) {
    try {
        logger.debug("✅ Menerima messages.upsert:");

        const messages = Array.isArray(upsert.messages)
            ? upsert.messages
            : [upsert];

        for (const msg of messages) {
            if (!msg || !msg.message) {
                logger.debug("❌ Pesan kosong atau tidak memiliki properti message.");
                continue;
            }

            // Kirim pesan mentah ke processor — serialisasi dilakukan di dalam
            await processMessage(msg, context);
        }
    } catch (err) {
        logger.error("❌ handleMessageUpsert error:", err);
    }
}

module.exports = {
    handleMessageUpsert
};