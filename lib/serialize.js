const config = require("@config");
const { removeSpace, isQuotedMessage, getMessageType } = require("@lib/utils");
const { getContentType } = require("@whiskeysockets/baileys");

const debug = true;

// Inisialisasi Map untuk menyimpan data pesan
const messageMap = new Map();

/**
 * Fungsi untuk logging dengan timestamp
 */
function logWithTimestamp(...messages) {
    const now = new Date();
    const time = now.toTimeString().split(" ")[0];
    
    const safeMessages = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg, null, 2);
            } catch (e) {
                return '[Complex Object]';
            }
        }
        return msg;
    });
    
    console.log(`[${time}]`, ...safeMessages);
}

/**
 * Fungsi untuk insert data ke dalam Map
 */
function insertMessage(id, participant, messageTimestamp, remoteId) {
    if (!id) return;
    
    messageMap.set(id, {
        participant: participant || '',
        messageTimestamp: messageTimestamp || Date.now(),
        remoteId: remoteId || ''
    });
}

/**
 * Fungsi untuk update data partial dalam Map
 */
function updateMessagePartial(id, partialData = {}) {
    if (!id) return;
    
    if (messageMap.has(id)) {
        const current = messageMap.get(id);
        messageMap.set(id, { ...current, ...partialData });
    } else {
        if (debug) logWithTimestamp(`Data dengan id ${id} tidak ditemukan.`);
    }
}

/**
 * Ekstraksi NativeFlow dengan berbagai nested format
 */
function extractNativeFlowContent(message) {
    if (!message?.message) return null;
    
    const paths = [
        // Direct path
        'message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson',
        // Nested dalam viewOnceMessage
        'message.viewOnceMessage.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson',
        // Nested dalam ephemeralMessage
        'message.ephemeralMessage.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson'
    ];
    
    for (const path of paths) {
        try {
            const value = path.split('.').reduce((obj, key) => obj?.[key], message);
            if (value && typeof value === 'string') {
                const parsed = JSON.parse(value);
                if (parsed?.id && typeof parsed.id === 'string') {
                    if (debug) logWithTimestamp("✅ NativeFlow extracted from:", path, "Content:", parsed.id);
                    return parsed.id.trim();
                }
            }
        } catch (e) {
            // Silent fail, coba path berikutnya
            continue;
        }
    }
    
    return null;
}

/**
 * Ekstraksi content dari button responses
 */
function extractButtonResponse(message) {
    if (!message?.message) return null;
    
    const msg = message.message;
    
    // Template button reply
    if (msg.templateButtonReplyMessage?.selectedId) {
        return msg.templateButtonReplyMessage.selectedId.trim();
    }
    
    // List response
    if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) {
        return msg.listResponseMessage.singleSelectReply.selectedRowId.trim();
    }
    
    // Button response message
    if (msg.buttonsResponseMessage?.selectedButtonId) {
        return msg.buttonsResponseMessage.selectedButtonId.trim();
    }
    
    return null;
}

/**
 * Ekstraksi content dari media dengan caption
 */
function extractMediaContent(message) {
    if (!message?.message) return null;
    
    const msg = message.message;
    const mediaTypes = [
        'imageMessage',
        'videoMessage',
        'documentMessage',
        'audioMessage'
    ];
    
    for (const type of mediaTypes) {
        if (msg[type]?.caption) {
            return msg[type].caption.trim();
        }
    }
    
    return null;
}

/**
 * Ekstraksi content dari viewOnce messages
 */
function extractViewOnceContent(message) {
    if (!message?.message?.viewOnceMessage?.message) return null;
    
    const viewOnceMsg = message.message.viewOnceMessage.message;
    
    // Rekursif untuk viewOnce content
    const fakeMessage = { message: viewOnceMsg };
    return extractMediaContent(fakeMessage) || 
           extractButtonResponse(fakeMessage) || 
           (viewOnceMsg.conversation?.trim()) ||
           (viewOnceMsg.extendedTextMessage?.text?.trim());
}

/**
 * Fungsi utama untuk extract content dari berbagai tipe pesan
 */
function extractContent(message) {
    if (!message?.message) {
        if (debug) logWithTimestamp("🔍 Message.message tidak ada");
        return '';
    }
    
    const msg = message.message;
    
    if (debug) {
        logWithTimestamp("🔍 Available message keys:", Object.keys(msg));
    }
    
    // Prioritas ekstraksi content berdasarkan urutan kepentingan
    const extractors = [
        () => extractNativeFlowContent(message),
        () => extractButtonResponse(message),
        () => msg.conversation?.trim(),
        () => msg.extendedTextMessage?.text?.trim(),
        () => extractMediaContent(message),
        () => extractViewOnceContent(message)
    ];
    
    for (const extractor of extractors) {
        try {
            const content = extractor();
            if (content && typeof content === 'string' && content.length > 0) {
                if (debug) logWithTimestamp(`✅ Content extracted:`, content);
                return content;
            }
        } catch (error) {
            if (debug) logWithTimestamp(`❌ Extractor error:`, error.message);
            continue;
        }
    }
    
    if (debug) logWithTimestamp("❌ Tidak ada content yang ditemukan");
    return '';
}

/**
 * Fungsi untuk extract message type dengan lebih akurat
 */
function extractMessageType(message) {
    if (!message?.message) return '';
    
    const msg = message.message;
    const contentType = getContentType(msg);
    
    // Handle special cases dengan prioritas
    const specialTypes = [
        { check: () => msg.interactiveResponseMessage?.nativeFlowResponseMessage, type: 'nativeFlowResponse' },
        { check: () => msg.templateButtonReplyMessage, type: 'templateButtonReply' },
        { check: () => msg.listResponseMessage, type: 'listResponse' },
        { check: () => msg.buttonsResponseMessage, type: 'buttonsResponse' },
        { check: () => msg.stickerMessage, type: 'stickerMessage' },
        { check: () => msg.audioMessage, type: 'audioMessage' },
        { check: () => msg.reactionMessage, type: 'reactionMessage' },
        { check: () => msg.pollResultSnapshotMessage, type: 'pollResultSnapshotMessage' },
        { check: () => msg.pollCreationMessageV3, type: 'pollCreationMessage' },
        { check: () => msg.protocolMessage?.type === 0, type: 'deletedMessage' },
        { check: () => msg.protocolMessage?.type === 14, type: 'editedMessage' },
        { check: () => msg.pinInChatMessage, type: 'pinInChatMessage' },
        { check: () => msg.albumMessage, type: 'albumMessage' },
        { check: () => msg.viewOnceMessage, type: 'viewOnceMessage' },
        { check: () => msg.documentMessage, type: 'documentMessage' },
        { check: () => msg.groupStatusMentionMessage, type: 'groupStatusMentionMessage' }
    ];
    
    for (const { check, type } of specialTypes) {
        if (check()) {
            if (debug) logWithTimestamp(`✅ Special message type detected: ${type}`);
            return type;
        }
    }
    
    return contentType || 'unknown';
}

/**
 * Fungsi untuk mengecek apakah pesan valid untuk diproses
 */
function isValidMessage(m) {
    if (!m) {
        if (debug) logWithTimestamp("❌ Parameter m tidak ada");
        return false;
    }

    if (debug) {
        logWithTimestamp("🔍 Struktur pesan yang diterima:");
        logWithTimestamp("- Type:", m.type);
        logWithTimestamp("- Keys:", Object.keys(m));
        logWithTimestamp("- Messages length:", m.messages?.length);
    }

    // Format lama (dengan messages array)
    if (m.messages && Array.isArray(m.messages) && m.messages.length > 0) {
        if (debug) logWithTimestamp("✅ Format lama terdeteksi (dengan messages array)");
        return true;
    }

    // Format baru (direct message object)
    if (m.key && (m.message || m.message?.message)) {
        if (debug) logWithTimestamp("✅ Format baru terdeteksi (direct message object)");
        return true;
    }

    if (debug) logWithTimestamp("❌ Format pesan tidak dikenali");
    return false;
}

/**
 * Fungsi untuk parse command dan prefix
 */
function parseCommand(content) {
    if (!content || typeof content !== 'string') {
        return { 
            command: '', 
            usedPrefix: '', 
            contentWithoutCommand: '',
            args: [],
            isCmd: false 
        };
    }
    
    const trimmedContent = content.trim();
    if (!trimmedContent) {
        return { 
            command: '', 
            usedPrefix: '', 
            contentWithoutCommand: '',
            args: [],
            isCmd: false 
        };
    }
    
    // Pastikan config.prefix ada
    const allPrefix = Array.isArray(config.prefix) ? config.prefix : [config.prefix || '!'];
    const usedPrefix = allPrefix.find(p => trimmedContent.startsWith(p));
    
    let command = '';
    let contentWithoutCommand = '';
    let args = [];
    let isCmd = false;
    
    if (usedPrefix) {
        // Ada prefix yang cocok
        const afterPrefix = trimmedContent.slice(usedPrefix.length).trim();
        const parts = afterPrefix.split(/\s+/);
        command = parts[0] || '';
        contentWithoutCommand = parts.slice(1).join(' ').trim();
        args = parts.slice(1).filter(arg => arg.trim() !== '');
        isCmd = command.length > 0;
    } else if (!config.status_prefix) {
        // Tidak ada prefix, tapi bot tidak memerlukan prefix
        const parts = trimmedContent.split(/\s+/);
        command = parts[0] || '';
        contentWithoutCommand = parts.slice(1).join(' ').trim();
        args = parts.slice(1).filter(arg => arg.trim() !== '');
        isCmd = command.length > 0;
    }
    
    return {
        command: command.toLowerCase(),
        usedPrefix: usedPrefix || '',
        contentWithoutCommand,
        args,
        isCmd
    };
}

/**
 * Fungsi untuk extract quoted message
 */
function extractQuotedMessage(message) {
    if (!isQuotedMessage(message)) return null;
    
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo) return null;
    
    return {
        text: contextInfo.quotedMessage?.conversation || 
              contextInfo.quotedMessage?.extendedTextMessage?.text || '',
        sender: contextInfo.participant || '',
        id: contextInfo.stanzaId || ''
    };
}

/**
 * Fungsi untuk extract edited message info
 */
function extractEditedInfo(message) {
    const editedMessage = message?.message?.protocolMessage?.editedMessage;
    const isEditType = message?.message?.protocolMessage?.type === 14;
    
    if (!editedMessage && !isEditType) return { status: false };
    
    const messageId = message?.message?.protocolMessage?.key?.id;
    const editedText = editedMessage?.extendedTextMessage?.text || 
                       editedMessage?.conversation || 
                       message?.message?.editedMessage;
    
    return {
        status: true,
        id: messageId || null,
        text: editedText || ''
    };
}

/**
 * Fungsi untuk memproses dan menyisipkan nativeFlow content
 */
function processNativeFlowInjection(message) {
    if (!message?.message) return message;
    
    const nativeFlowContent = extractNativeFlowContent(message);
    if (!nativeFlowContent) return message;
    
    // Clone message untuk menghindari mutasi langsung
    const processedMessage = JSON.parse(JSON.stringify(message));
    
    // Inject ke berbagai field agar terdeteksi dengan baik
    if (!processedMessage.message.conversation) {
        processedMessage.message.conversation = nativeFlowContent;
    }
    
    if (!processedMessage.message.extendedTextMessage) {
        processedMessage.message.extendedTextMessage = { text: nativeFlowContent };
    } else if (!processedMessage.message.extendedTextMessage.text) {
        processedMessage.message.extendedTextMessage.text = nativeFlowContent;
    }
    
    if (debug) {
        logWithTimestamp("✅ NativeFlow content injected:", nativeFlowContent);
    }
    
    return processedMessage;
}

/**
 * Fungsi utama untuk serialize message
 */
function serializeMessage(m, sock) {
    try {
        if (!isValidMessage(m)) return null;

        let message;
        if (m.messages && Array.isArray(m.messages) && m.messages.length > 0) {
            message = m.messages[0];
            if (debug) logWithTimestamp("📦 Menggunakan format lama (messages array)");
        } else {
            message = m;
            if (debug) logWithTimestamp("📦 Menggunakan format baru (direct message)");
        }

        // Process nativeFlow injection sebelum ekstraksi content
        message = processNativeFlowInjection(message);

        const key = message.key || {};
        const remoteJid = key.remoteJid || "";
        const fromMe = key.fromMe || false;
        const id = key.id || "";
        const participant = key.participant || message.participant || "";
        const pushName = message.pushName || "";
        const messageTimestamp = message.messageTimestamp || Date.now();

        if (debug) {
            logWithTimestamp("🔍 Basic info extracted:");
            logWithTimestamp("- ID:", id);
            logWithTimestamp("- Remote JID:", remoteJid);
            logWithTimestamp("- From Me:", fromMe);
            logWithTimestamp("- Participant:", participant);
            logWithTimestamp("- Push Name:", pushName);
        }

        if (!id) return null;

        const isGroup = remoteJid.endsWith("@g.us");
        const isBroadcast = remoteJid.endsWith("status@broadcast");
        let sender = isGroup ? participant : remoteJid;

        const content = extractContent(message);
        const messageType = extractMessageType(message);

        if (debug) {
            logWithTimestamp("🔍 Content and type:");
            logWithTimestamp("- Content:", content);
            logWithTimestamp("- Message Type:", messageType);
        }

        const ignoredTypes = ['senderKeyDistributionMessage', 'pollUpdateMessage'];
        if (ignoredTypes.includes(messageType) && !content) return null;

        const { command, usedPrefix, contentWithoutCommand, args, isCmd } = parseCommand(content);

        if (debug) {
            logWithTimestamp("🔍 Command parsing result:");
            logWithTimestamp("- Original content:", content);
            logWithTimestamp("- Command:", command);
            logWithTimestamp("- Used prefix:", usedPrefix);
            logWithTimestamp("- Content without command:", contentWithoutCommand);
            logWithTimestamp("- Args:", args);
            logWithTimestamp("- Is Command:", isCmd);
        }

        if (!content && !['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(messageType)) {
            return null;
        }

        const isQuoted = isQuotedMessage(message);
        const quotedMessage = extractQuotedMessage(message);
        const editedInfo = extractEditedInfo(message);

        const isBot = (id?.startsWith("3EB0") && id.length === 22) ||
            (message?.message && Object.keys(message.message).some(key =>
                ["templateMessage", "interactiveMessage", "buttonsMessage"].includes(key)
            ));

        const isForwarded = message.message?.[getContentType(message.message)]?.contextInfo?.isForwarded === true;
        const antitagsw = !!(message?.message?.groupStatusMentionMessage ||
            message?.message?.groupStatusMentionMessage?.message?.protocolMessage?.type === "STATUS_MENTION_MESSAGE");

        const mentionedJid = message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isDeleted = message?.message?.protocolMessage?.type === 0;
        const senderNumber = sender.replace(/@s\.whatsapp\.net$/, "");

        insertMessage(id, participant, messageTimestamp, remoteJid);

        const serializedMessage = {
            id,
            timestamp: messageTimestamp,
            sender,
            senderNumber,
            pushName,
            isGroup,
            isBroadcast,
            fromMe,
            remoteJid,
            type: getMessageType(messageType),
            messageType,

            text: content,
            content: contentWithoutCommand,
            fullText: content,
            prefix: usedPrefix,
            command,
            args,
            isCmd,

            message,
            isTagSw: antitagsw,
            isQuoted,
            quotedMessage,
            mentionedJid,
            isBot,
            isForwarded,
            isDeleted,
            isEdited: editedInfo,

            reply: null, // akan di-inject di bawah

            m: {
                remoteJid,
                key,
                message,
                sock,
                isDeleted,
                isEdited: editedInfo
            },

            raw: m
        };

        // Inject .reply() function
        serializedMessage.reply = async (text, options = {}) => {
            try {
                const content = typeof text === 'string' ? { text } : text;
                const quotedMsg = (serializedMessage.message?.key && serializedMessage.message.message)
                    ? serializedMessage.message
                    : undefined;

                await sock.sendMessage(
                    remoteJid,
                    content,
                    {
                        quoted: quotedMsg,
                        ...options
                    }
                );
            } catch (err) {
                console.error("❌ Gagal kirim balasan:", err);
            }
        };

        if (debug && command) {
            logWithTimestamp(`✅ Command berhasil diproses: ${command}`);
            logWithTimestamp(`✅ Serialized message created with ID: ${id}`);
        }

        return serializedMessage;

    } catch (error) {
        if (debug) {
            logWithTimestamp("❌ Error dalam serialisasi:", error.message);
            logWithTimestamp("Stack trace:", error.stack);
        }
        return null;
    }
}

module.exports = serializeMessage;