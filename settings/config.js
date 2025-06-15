const moment               = require('moment-timezone');
const { version: VERSION } = require('@DB/version.json');

// 🎯 Raw config object
const raw = {
    APIKEY          : '',

    phone_number_bot: '6285601883748',
    owner_name      : 'SuzuxuX1',
    owner_email     : 'fasyamr78@gmail.com',
    owner_website   : '',
    region          : 'Indonesia',

    type_connection : 'pairing',         // 'qr' | 'pairing'
    mode            : 'production',
    bot_destination : 'private',           // 'group' | 'private' | 'both'
    autoread        : false,
    lang            : 'id',
    
    version: VERSION,

    prefix          : ['.', '!', '#'],
    status_prefix   : true,

    // 👑 Permissions
    owner_number    : ['6285601883748'],
    premium         : [],
    
  enable_rate_limit: false,
  enable_anti_spam: false
};

// 🔁 Wrapper untuk support .get() → mendukung fallback & validasi
const config = {
    ...raw,

    /**
     * Mengambil konfigurasi berdasarkan key
     * @param {string} key 
     * @param {any} fallback - nilai default jika tidak ditemukan
     * @returns {any}
     */
    get(key, fallback = undefined) {
        return raw[key] !== undefined ? raw[key] : fallback;
    }
};

module.exports = config;