const fs              = require('fs');
const { execSync }    = require('child_process');
const { versionFile } = require('@start/config/paths');

// Fungsi untuk memperbarui versi di version.json
function updateVersionInStrings(newVersion = '1.0.1') {
  if (!fs.existsSync(versionFile)) {
    console.error(`❌ File version.json tidak ditemukan di: ${versionFile}`);
    return false;
  }

  const versionData = { version: newVersion };
  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2), 'utf-8');

  console.log(`✅ Versi berhasil diperbarui ke ${newVersion} di version.json`);
  return true;
}

// Fungsi untuk mengecek dan menginstal modul yang dibutuhkan
async function checkAndInstallModules(modules = []) {
  const missing = [];

  for (const mod of modules) {
    try {
      require.resolve(mod);
    } catch {
      missing.push(mod);
    }
  }

  if (missing.length === 0) return;

  console.log(`📦 Menginstal modul yang hilang: ${missing.join(', ')}`);
  try {
    execSync(`npm install ${missing.join(' ')}`, { stdio: 'inherit' });
    console.log(`✅ Modul berhasil diinstall`);
  } catch (err) {
    console.error(`❌ Gagal menginstal modul:`, err.message);
    throw err;
  }
}

module.exports = {
  updateVersionInStrings,
  checkAndInstallModules
};