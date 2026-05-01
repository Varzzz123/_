const cfg                      = require("../../config");
const { isGroupAdmin, isBotAdmin } = require("../../lib/helper");
const fs   = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/antilink.json");

function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return {}; }
}

function saveDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const LINK_REGEX = /(https?:\/\/|www\.|chat\.whatsapp\.com)[^\s]*/i;

async function handleAntilink(ctx) {
    const { sock, msg, from, isGroup, sender, body, command } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    if (!isGroup) return;

    const db      = loadDB();
    const p       = cfg.PREFIX;
    const isAdmin = await isGroupAdmin(sock, from, sender);

    if (command === `${p}antilink`) {
        if (!isAdmin) return reply("❌ Hanya admin yang bisa menggunakan perintah ini.");
        const botAdmin = await isBotAdmin(sock, from);
        if (!botAdmin) return reply("❌ Bot harus menjadi admin terlebih dahulu.");

        db[from]   = !db[from];
        saveDB(db);
        return reply(`✅ Antilink *${db[from] ? "diaktifkan" : "dinonaktifkan"}* di grup ini.`);
    }

    if (db[from] && LINK_REGEX.test(body) && !isAdmin) {
        const botAdmin = await isBotAdmin(sock, from);
        if (!botAdmin) return;

        await sock.sendMessage(from, { delete: msg.key });
        await reply(`⚠️ @${sender.split("@")[0]} tidak boleh mengirim link di grup ini!`, { mentions: [sender] });
    }
}

module.exports = { handleAntilink };