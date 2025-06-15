const { generateWAMessageFromContent, proto }        = require('baileys');
const logger = require('@lib/logger');

/**
 * MessageSender - Kelas untuk mengirim berbagai jenis pesan WhatsApp
 * 
 * Fitur utama:
 * - Helper internal untuk konsistensi
 * - Validasi JID universal
 * - Fallback otomatis untuk pesan interaktif
 * - Support untuk semua format pesan
 * - Mode dry run untuk testing
 * - Logging dan error handling yang konsisten
 * - Internationalization (i18n) support
 * - Media wrapper dengan quoted support
 */
class MessageSender {
    constructor(sock, options = {}) {
        this.sock = sock;
        this.dryRun = options.dryRun || false;
        this.defaultTimeout = options.timeout || 30000;
        this.enableDeviceDetection = options.enableDeviceDetection || false;
        this.i18n = options.i18n || null; // i18n instance
        
        // Cache untuk device capabilities
        this.deviceCapabilities = new Map();
    }

    // ==================== HELPER FUNCTIONS ====================
    
    /**
     * Helper internal untuk mengirim pesan dengan konsistensi
     * @private
     * @param {string} jid - ID penerima
     * @param {Object} messageContent - Konten pesan
     * @param {Object} options - Opsi pengiriman
     * @param {string} messageType - Jenis pesan untuk logging
     * @returns {Promise<Object|null>} - Response dari WhatsApp atau null jika dry run
     */
    async _send(jid, messageContent, options = {}, messageType = 'message') {
        try {
            // Validasi JID
            if (!this._validateJid(jid)) {
                logger.warn(`Invalid JID format: ${jid}`);
                return null;
            }

            // Mode dry run
            if (this.dryRun) {
                logger.info(`[DRY RUN] Would send ${messageType} to ${jid}:`, 
                    JSON.stringify(messageContent, null, 2));
                return { success: true, dryRun: true };
            }

            // Siapkan options pengiriman
            const sendOptions = { ...options };
            
            // Handle quoted message dari options
            if (options.quoted) {
                sendOptions.quoted = options.quoted;
            }

            // Kirim pesan
            const result = await this.sock.sendMessage(jid, messageContent, sendOptions);
            
            logger.info(`${messageType} sent successfully to ${jid}`);
            return result;

        } catch (error) {
            logger.error(`Failed to send ${messageType} to ${jid}:`, error);
            throw error;
        }
    }

    /**
     * Validasi format JID
     * @private
     * @param {string} jid - JID yang akan divalidasi
     * @returns {boolean} - True jika valid
     */
    _validateJid(jid) {
        if (!jid || typeof jid !== 'string') return false;
        
        // Format JID WhatsApp: nomor@s.whatsapp.net atau grupid@g.us
        const jidPattern = /^[\d\w\-\.]+@(s\.whatsapp\.net|g\.us)$/;
        return jidPattern.test(jid);
    }

    /**
     * Helper untuk mendapatkan teks terjemahan
     * @private
     * @param {string} key - Key terjemahan
     * @param {Object} params - Parameter untuk interpolasi
     * @returns {string} - Teks terjemahan atau key jika tidak ada i18n
     */
    _t(key, params = {}) {
        if (!this.i18n) return key;
        
        try {
            return this.i18n.t(key, params);
        } catch (error) {
            logger.warn(`Translation failed for key: ${key}`, error.message);
            return key;
        }
    }

    /**
     * Deteksi kemampuan device (opsional)
     * @private
     * @param {string} jid - JID target
     * @param {string} feature - Fitur yang ingin dicek ('buttons', 'lists', etc)
     * @returns {boolean} - True jika device mendukung fitur
     */
    async _detectDeviceCapability(jid, feature) {
        if (!this.enableDeviceDetection) return true;
        
        const cacheKey = `${jid}_${feature}`;
        if (this.deviceCapabilities.has(cacheKey)) {
            return this.deviceCapabilities.get(cacheKey);
        }

        // Implementasi deteksi capability (placeholder)
        // Dalam implementasi nyata, bisa menggunakan metadata dari sock
        const isSupported = true; // Default assume supported
        
        this.deviceCapabilities.set(cacheKey, isSupported);
        return isSupported;
    }

    /**
     * Kirim pesan dengan fallback otomatis
     * @param {string} jid - ID penerima  
     * @param {Object} primaryMessage - Pesan utama (button/list)
     * @param {string} fallbackText - Teks fallback jika gagal
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendWithFallback(jid, primaryMessage, fallbackText, options = {}) {
        try {
            // Coba kirim pesan utama
            return await this._send(jid, primaryMessage, options, 'interactive_message');
        } catch (error) {
            logger.warn(`Primary message failed for ${jid}, using fallback:`, error.message);
            
            // Fallback ke teks biasa
            return await this.sendText(jid, fallbackText, options);
        }
    }

    // ==================== TEXT MESSAGES ====================

    /**
     * Kirim pesan teks biasa
     * @param {string} jid - ID penerima (nomor atau grup ID)
     * @param {string} text - Teks pesan
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendText(jid, text, options = {}) {
        const messageContent = {
            text: text,
            ...options
        };
        
        return await this._send(jid, messageContent, options, 'text');
    }

    /**
     * Kirim balasan pesan
     * @param {string} jid - ID penerima
     * @param {string} text - Teks balasan
     * @param {Object} quotedMsg - Pesan yang dikutip
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendReply(jid, text, quotedMsg, options = {}) {
        const sendOptions = {
            ...options,
            quoted: quotedMsg
        };
        
        return await this.sendText(jid, text, sendOptions);
    }

    /**
     * Kirim pesan dengan mentions
     * @param {string} jid - ID penerima
     * @param {string} text - Teks pesan
     * @param {Array} mentions - Array JID yang di-mention
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendMention(jid, text, mentions, options = {}) {
        const messageContent = {
            text: text,
            mentions: mentions
        };

        return await this._send(jid, messageContent, options, 'mention');
    }

    // ==================== SAFE MESSAGE HELPERS ====================

    /**
     * Kirim pesan error dengan aman
     * @param {Object} message - Objek pesan asli
     * @param {string} text - Pesan error
     * @param {Object} options - Opsi tambahan
     */
    async sendErrorSafe(message, text, options = {}) {
        try {
            const jid = message?.key?.remoteJid;
            if (!jid) return null;

            const errorText = this._t('error.prefix', { message: text }) || `❌ ${text}`;
            return await this.sendReply(jid, errorText, message, options);
        } catch (err) {
            logger.warn("Failed to send error message:", err.message);
            return null;
        }
    }

    /**
     * Kirim pesan sukses dengan aman
     * @param {Object} message - Objek pesan asli
     * @param {string} text - Pesan sukses
     * @param {Object} options - Opsi tambahan
     */
    async sendSuccessSafe(message, text, options = {}) {
        try {
            const jid = message?.key?.remoteJid;
            if (!jid) return null;

            const successText = this._t('success.prefix', { message: text }) || `✅ ${text}`;
            return await this.sendReply(jid, successText, message, options);
        } catch (err) {
            logger.warn("Failed to send success message:", err.message);
            return null;
        }
    }

    /**
     * Kirim pesan usage dengan aman
     * @param {Object} message - Objek pesan asli
     * @param {string} text - Teks usage
     * @param {Object} options - Opsi tambahan
     */
    async sendUsageSafe(message, text, options = {}) {
        try {
            const jid = message?.key?.remoteJid;
            if (!jid) return null;

            const usageText = this._t('usage.prefix', { message: text }) || `ℹ️ ${text}`;
            return await this.sendReply(jid, usageText, message, options);
        } catch (err) {
            logger.warn("Failed to send usage message:", err.message);
            return null;
        }
    }

    /**
     * Kirim pesan info dengan aman (alias ringan)
     * @param {Object} message - Objek pesan asli
     * @param {string} text - Teks info
     * @param {Object} options - Opsi tambahan
     */
    async sendInfoSafe(message, text, options = {}) {
        try {
            const jid = message?.key?.remoteJid;
            if (!jid) return null;

            const infoText = this._t('info.prefix', { message: text }) || `ℹ️ ${text}`;
            return await this.sendReply(jid, infoText, message, options);
        } catch (err) {
            logger.warn("Failed to send info message:", err.message);
            return null;
        }
    }

    /**
     * Kirim pesan warning dengan aman
     * @param {Object} message - Objek pesan asli
     * @param {string} text - Teks warning
     * @param {Object} options - Opsi tambahan
     */
    async sendWarningSafe(message, text, options = {}) {
        try {
            const jid = message?.key?.remoteJid;
            if (!jid) return null;

            const warningText = this._t('warning.prefix', { message: text }) || `⚠️ ${text}`;
            return await this.sendReply(jid, warningText, message, options);
        } catch (err) {
            logger.warn("Failed to send warning message:", err.message);
            return null;
        }
    }

    // ==================== MEDIA MESSAGES ====================

    /**
     * Kirim media universal dengan quoted support
     * @param {string} type - Tipe media ('image', 'video', 'audio', 'document', 'sticker')
     * @param {string} jid - ID penerima
     * @param {Buffer|string} content - Buffer media atau path file
     * @param {string} caption - Caption media (untuk image/video)
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendMedia(type, jid, content, caption = '', options = {}) {
        const supportedTypes = ['image', 'video', 'audio', 'document', 'sticker'];
        if (!supportedTypes.includes(type)) {
            throw new Error(`Unsupported media type: ${type}`);
        }

        const messageContent = { [type]: content };

        // Tambahkan caption untuk image/video
        if (['image', 'video'].includes(type) && caption) {
            messageContent.caption = caption;
        }

        // Tambahkan mimetype jika ada
        if (options.mimetype) {
            messageContent.mimetype = options.mimetype;
        }

        // Khusus untuk audio
        if (type === 'audio' && options.ptt !== undefined) {
            messageContent.ptt = options.ptt;
        }

        // Khusus untuk document
        if (type === 'document') {
            if (options.filename) messageContent.fileName = options.filename;
            if (options.mimetype) messageContent.mimetype = options.mimetype;
        }

        return await this._send(jid, messageContent, options, type);
    }

    /**
     * Kirim gambar
     * @param {string} jid - ID penerima
     * @param {Buffer|string} image - Buffer gambar atau path file
     * @param {string} caption - Caption gambar
     * @param {Object} options - Opsi tambahan (termasuk quoted)
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendImage(jid, image, caption = '', options = {}) {
        const defaultOptions = { mimetype: 'image/jpeg', ...options };
        return await this.sendMedia('image', jid, image, caption, defaultOptions);
    }

    /**
     * Kirim video
     * @param {string} jid - ID penerima
     * @param {Buffer|string} video - Buffer video atau path file
     * @param {string} caption - Caption video
     * @param {Object} options - Opsi tambahan (termasuk quoted)
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendVideo(jid, video, caption = '', options = {}) {
        const defaultOptions = { mimetype: 'video/mp4', ...options };
        return await this.sendMedia('video', jid, video, caption, defaultOptions);
    }

    /**
     * Kirim audio
     * @param {string} jid - ID penerima
     * @param {Buffer|string} audio - Buffer audio atau path file
     * @param {Object} options - Opsi tambahan (termasuk quoted dan ptt)
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendAudio(jid, audio, options = {}) {
        const defaultOptions = { mimetype: 'audio/mpeg', ptt: false, ...options };
        return await this.sendMedia('audio', jid, audio, '', defaultOptions);
    }

    /**
     * Kirim sticker
     * @param {string} jid - ID penerima
     * @param {Buffer|string} sticker - Buffer sticker atau path file
     * @param {Object} options - Opsi tambahan (termasuk quoted)
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendSticker(jid, sticker, options = {}) {
        return await this.sendMedia('sticker', jid, sticker, '', options);
    }

    /**
     * Kirim dokumen/file
     * @param {string} jid - ID penerima
     * @param {Buffer|string} document - Buffer dokumen atau path file
     * @param {string} filename - Nama file
     * @param {string} mimetype - MIME type file
     * @param {Object} options - Opsi tambahan (termasuk quoted)
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendDocument(jid, document, filename, mimetype, options = {}) {
        const documentOptions = { filename, mimetype, ...options };
        return await this.sendMedia('document', jid, document, '', documentOptions);
    }

    // ==================== INTERACTIVE MESSAGES ====================

    /**
     * Kirim button message dengan fallback otomatis
     * @param {string} jid - ID penerima
     * @param {string} text - Teks utama
     * @param {string} footer - Footer text
     * @param {Array} buttons - Array button
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendButton(jid, text, footer, buttons, options = {}) {
        // Pesan button utama
        const buttonMessage = {
            text: text,
            footer: footer,
            buttons: buttons.map((btn, index) => ({
                buttonId: btn.id || `btn_${index}`,
                buttonText: { displayText: btn.text },
                type: 1
            })),
            headerType: 1
        };

        // Fallback text
        const fallbackText = `${text}\n\n${footer}\n\n` + 
                           buttons.map((btn, i) => `${i + 1}. ${btn.text}`).join('\n');

        // Cek device capability
        const supportsButtons = await this._detectDeviceCapability(jid, 'buttons');
        
        if (supportsButtons) {
            return await this.sendWithFallback(jid, buttonMessage, fallbackText, options);
        } else {
            return await this.sendText(jid, fallbackText, options);
        }
    }

    // ==================== SPECIFIC MESSAGES ====================

    /**
     * Kirim lokasi
     * @param {string} jid - ID penerima
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendLocation(jid, latitude, longitude, options = {}) {
        const messageContent = {
            location: {
                degreesLatitude: latitude,
                degreesLongitude: longitude,
                name: options.name || '',
                address: options.address || ''
            }
        };

        return await this._send(jid, messageContent, options, 'location');
    }

    /**
     * Kirim kontak
     * @param {string} jid - ID penerima
     * @param {Object} contact - Data kontak
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendContact(jid, contact, options = {}) {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL;type=CELL;type=VOICE;waid=${contact.number}:${contact.phone}\nEND:VCARD`;
        
        const messageContent = {
            contacts: {
                displayName: contact.name,
                contacts: [{ vcard }]
            }
        };

        return await this._send(jid, messageContent, options, 'contact');
    }

    // ==================== ADVANCED MESSAGES ====================

    /**
     * Forward pesan
     * @param {string} jid - ID penerima
     * @param {Object} message - Pesan yang akan di-forward
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async forwardMessage(jid, message, options = {}) {
        const forwardOptions = {
            ...options,
            forward: true
        };

        return await this._send(jid, message, forwardOptions, 'forward');
    }

    /**
     * Edit pesan
     * @param {string} jid - ID chat
     * @param {Object} messageKey - Key pesan yang akan diedit
     * @param {string} newText - Teks baru
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async editMessage(jid, messageKey, newText, options = {}) {
        const messageContent = {
            text: newText,
            edit: messageKey
        };

        return await this._send(jid, messageContent, options, 'edit');
    }

    /**
     * Hapus pesan
     * @param {string} jid - ID chat
     * @param {Object} messageKey - Key pesan yang akan dihapus
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async deleteMessage(jid, messageKey, options = {}) {
        const messageContent = { delete: messageKey };
        return await this._send(jid, messageContent, options, 'delete');
    }

    /**
     * Kirim reaction ke pesan
     * @param {string} jid - ID chat
     * @param {Object} messageKey - Key pesan yang direaksi
     * @param {string} emoji - Emoji reaction
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendReaction(jid, messageKey, emoji, options = {}) {
        const messageContent = {
            react: {
                text: emoji,
                key: messageKey
            }
        };

        return await this._send(jid, messageContent, options, 'reaction');
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * Kirim typing indicator
     * @param {string} jid - ID chat
     * @param {boolean} isTyping - Status typing (true/false)
     * @returns {Promise<void>}
     */
    async sendTyping(jid, isTyping = true) {
        try {
            if (this.dryRun) {
                logger.info(`[DRY RUN] Would send typing ${isTyping ? 'start' : 'stop'} to ${jid}`);
                return;
            }

            await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
            logger.debug(`Typing status ${isTyping ? 'started' : 'stopped'} for ${jid}`);
        } catch (error) {
            logger.error(`Failed to send typing status to ${jid}:`, error);
            throw error;
        }
    }

    /**
     * Kirim read receipt
     * @param {string} jid - ID chat
     * @param {Array} messageKeys - Array key pesan yang dibaca
     * @returns {Promise<void>}
     */
    async sendReadReceipt(jid, messageKeys) {
        try {
            if (this.dryRun) {
                logger.info(`[DRY RUN] Would send read receipt for ${jid}:`, messageKeys);
                return;
            }

            await this.sock.readMessages(messageKeys);
            logger.debug(`Read receipt sent for ${jid}`);
        } catch (error) {
            logger.error(`Failed to send read receipt for ${jid}:`, error);
            throw error;
        }
    }

    /**
     * Kirim pesan dengan delay
     * @param {string} jid - ID penerima
     * @param {string} text - Teks pesan
     * @param {number} delay - Delay dalam ms
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendWithDelay(jid, text, delay, options = {}) {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    const result = await this.sendText(jid, text, options);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, delay);
        });
    }

    // ==================== I18N HELPER METHODS ====================

    /**
     * Set i18n instance
     * @param {Object} i18nInstance - Instance i18n
     */
    setI18n(i18nInstance) {
        this.i18n = i18nInstance;
        logger.info('i18n instance configured for MessageSender');
    }

    /**
     * Kirim pesan dengan terjemahan otomatis
     * @param {string} jid - ID penerima
     * @param {string} translationKey - Key terjemahan
     * @param {Object} params - Parameter untuk interpolasi
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendTranslated(jid, translationKey, params = {}, options = {}) {
        const translatedText = this._t(translationKey, params);
        return await this.sendText(jid, translatedText, options);
    }

    /**
     * Kirim balasan dengan terjemahan otomatis
     * @param {string} jid - ID penerima
     * @param {string} translationKey - Key terjemahan
     * @param {Object} quotedMsg - Pesan yang dikutip
     * @param {Object} params - Parameter untuk interpolasi
     * @param {Object} options - Opsi tambahan
     * @returns {Promise<Object>} - Response dari WhatsApp
     */
    async sendReplyTranslated(jid, translationKey, quotedMsg, params = {}, options = {}) {
        const translatedText = this._t(translationKey, params);
        return await this.sendReply(jid, translatedText, quotedMsg, options);
    }

    // ==================== CONFIGURATION METHODS ====================

    /**
     * Set mode dry run
     * @param {boolean} enabled - Status dry run
     */
    setDryRun(enabled) {
        this.dryRun = enabled;
        logger.info(`Dry run mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set default timeout
     * @param {number} timeout - Timeout dalam ms
     */
    setTimeout(timeout) {
        this.defaultTimeout = timeout;
        logger.info(`Default timeout set to ${timeout}ms`);
    }

    /**
     * Enable/disable device detection
     * @param {boolean} enabled - Status device detection
     */
    setDeviceDetection(enabled) {
        this.enableDeviceDetection = enabled;
        logger.info(`Device detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Clear device capabilities cache
     */
    clearDeviceCache() {
        this.deviceCapabilities.clear();
        logger.info('Device capabilities cache cleared');
    }

    /**
     * Get current configuration
     * @returns {Object} - Current configuration
     */
    getConfig() {
        return {
            dryRun: this.dryRun,
            defaultTimeout: this.defaultTimeout,
            enableDeviceDetection: this.enableDeviceDetection,
            deviceCacheSize: this.deviceCapabilities.size,
            hasI18n: !!this.i18n
        };
    }
    
    /**
 * Kirim list message dengan fallback otomatis
 * @param {string} jid - ID penerima
 * @param {string} text - Teks utama
 * @param {string} buttonText - Teks tombol list
 * @param {Array} sections - Daftar section dan rows
 * @param {Object} options - Opsi tambahan (footer, title, quoted)
 */
async sendList(jid, text, buttonText, sections, options = {}) {
    // Validasi dan auto rowId
    sections.forEach((section) => {
        if (section.rows && Array.isArray(section.rows)) {
            section.rows.forEach((row, index) => {
                if (!row.rowId) row.rowId = `row_${index}_${Date.now()}`;
            });
        }
    });

    const listMessage = {
        text,
        footer: options.footer || '',
        title: options.title || '',
        buttonText: buttonText || 'Lihat Pilihan',
        sections
    };

    // Buat fallback text jika gagal
    const fallbackText = `*${options.title || 'List'}*\n\n` + 
        sections.map((section, si) => {
            const rows = section.rows.map((row, ri) => `• ${row.title}${row.description ? ` - ${row.description}` : ''}`);
            return `${si + 1}. ${section.title}\n` + rows.join("\n");
        }).join("\n\n");

    try {
        return await this._send(jid, listMessage, { quoted: options.quoted }, 'list');
    } catch (error) {
        logger.warn(`Gagal mengirim list ke ${jid}, fallback ke teks.`, error.message);
        return await this.sendText(jid, fallbackText, { quoted: options.quoted });
    }
}
}

module.exports = MessageSender;