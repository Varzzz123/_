const cfg = require("../../config");
const fs   = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/afk.json");

function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return {}; }
}
function saveDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h} jam ${m % 60} menit`;
    if (m > 0) return `${m} menit ${s % 60} detik`;
    return `${s} detik`;
}

async function handleAfk(ctx) {
    const { sock, msg, from, isGroup, sender, senderName, command, text } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    if (!isGroup) return;

    const db            = loadDB();
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (command === `${cfg.PREFIX}afk`) {
        const alasan = text || "Tidak ada alasan";
        db[sender]   = { alasan, since: Date.now(), name: senderName };
        saveDB(db);
        return reply(`😴 *${senderName}* sekarang AFK\n📝 Alasan: ${alasan}`);
    }

    if (db[sender]) {
        const data   = db[sender];
        const durasi = formatDuration(Date.now() - data.since);
        delete db[sender];
        saveDB(db);
        await sock.sendMessage(from, {
            text: `👋 *${senderName}* sudah kembali!\n⏱ AFK selama: ${durasi}`,
        });
    }

    for (const jid of mentionedJids) {
        if (db[jid]) {
            const data   = db[jid];
            const durasi = formatDuration(Date.now() - data.since);
            await reply(
                `😴 *${data.name}* sedang AFK\n` +
                `📝 Alasan: ${data.alasan}\n` +
                `⏱ Sudah: ${durasi}`
            );
        }
    }
}

module.exports = { handleAfk };