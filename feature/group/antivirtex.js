const cfg                          = require("../../config");
const { isGroupAdmin, isBotAdmin } = require("../../lib/helper");
const fs   = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/antivirtex.json");

function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return {}; }
}
function saveDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function isVirtex(msg) {
    const m    = msg?.message || {};
    const text = m.conversation || m.extendedTextMessage?.text || "";
    if (text.length > 5000) return true;
    if (/[\u202E\u202D]/.test(text)) return true;
    if (/[\u200B-\u200D\uFEFF]{5,}/.test(text)) return true;
    return false;
}

async function handleAntivirtex(ctx) {
    const { sock, msg, from, isGroup, sender, command } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    if (!isGroup) return;

    const db      = loadDB();
    const isAdmin = await isGroupAdmin(sock, from, sender);

    if (command === `${cfg.PREFIX}antivirtex`) {
        if (!isAdmin) return reply("❌ Hanya admin yang bisa menggunakan perintah ini.");
        db[from] = !db[from];
        saveDB(db);
        return reply(`✅ Anti-virtex *${db[from] ? "diaktifkan" : "dinonaktifkan"}* di grup ini.`);
    }

    if (!db[from] || isAdmin) return;

    if (isVirtex(msg)) {
        const botAdmin = await isBotAdmin(sock, from);
        if (!botAdmin) return;
        await sock.sendMessage(from, { delete: msg.key });
        await sock.sendMessage(from, {
            text: `⚠️ @${sender.split("@")[0]} pesan terdeteksi sebagai virtex dan dihapus!`,
            mentions: [sender],
        });
    }
}

module.exports = { handleAntivirtex };