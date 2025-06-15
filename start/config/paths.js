const path = require('path');

// 📁 Lokasi root dari file ini (diasumsikan berada di start/config/)
const rootDir = path.resolve(__dirname, '..'); // menuju start/

// 📁 Direktori database di dalam folder start
const dbPath = path.join(rootDir, 'database');

// 📁 Direktori plugin utama di root project
const pluginsDir = path.resolve(rootDir, '../plugins');

// 📁 Direktori khusus plugin hasil `addplugins`
const generatedPluginsDir = path.join(pluginsDir, 'FEATURES_ADD');

// 📄 File tracking dan log
const pluginLogFile = path.join(dbPath, 'addplugin.log');
const generatedPluginsList = path.join(dbPath, 'generated_plugins.json');

module.exports = {
  dbPath,
  pluginsDir,
  generatedPluginsDir,
  pluginLogFile,
  generatedPluginsList,

  ownerFile: path.join(dbPath, 'owner.json'),
  usersFile: path.join(dbPath, 'users.json'),
  premiumFile: path.join(dbPath, 'premium.json'),
  versionFile: path.join(dbPath, 'version.json')
};