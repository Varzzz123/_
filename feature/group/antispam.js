const cfg                          = require("../../config");
const { isGroupAdmin, isBotAdmin } = require("../../lib/helper");
const fs   = require("fs");
const path = require("path");

const DB_PATH   = path.join(__dirname, "../../data/antispam.json");
const spamTrack = new Map();

const SPAM_LIMIT    = 5;
const SPAM_INTERVAL = 5000;

function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return {}; }
}

function saveDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function handleAntispam(ctx) {
    const { sock, msg, from, isGroup, sender, command } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    if (!isGroup) return;

    const db      = loadDB();
    const p       = cfg.PREFIX;
    const isAdmin = await isGroupAdmin(sock, from, sender);

    if (command === `${p}antispam`) {
        if (!isAdmin) return reply("❌ Hanya admin yang bisa menggunakan perintah ini.");
        db[from] = !db[from];
        saveDB(db);
        return reply(`✅ Anti-spam *${db[from] ? "diaktifkan" : "dinonaktifkan"}* di grup ini.`);
    }

    if (!db[from] || isAdmin) return;

    const key   = `${from}_${sender}`;
    const now   = Date.now();
    const track = spamTrack.get(key) || { count: 0, first: now };

    if (now - track.first > SPAM_INTERVAL) {
        spamTrack.set(key, { count: 1, first: now });
        return;
    }

    track.count++;
    spamTrack.set(key, track);

    if (track.count >= SPAM_LIMIT) {
        spamTrack.delete(key);
        const botAdmin = await isBotAdmin(sock, from);
        if (!botAdmin) return;

        await sock.sendMessage(from, { delete: msg.key });
        await sock.sendMessage(from, {
            text: `⚠️ @${sender.split("@")[0]} terdeteksi spam dan diperingatkan!`,
            mentions: [sender],
        });
    }
}

module.exports = { handleAntispam };