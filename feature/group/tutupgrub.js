const cfg                          = require("../../config");
const { isGroupAdmin, isBotAdmin } = require("../../lib/helper");

async function handleTutupGrub(ctx) {
    const { sock, msg, from, isGroup, sender, command } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    if (!isGroup) return;

    const p = cfg.PREFIX;
    if (command !== `${p}tutupgrub` && command !== `${p}bukagrub`) return;

    const isAdmin = await isGroupAdmin(sock, from, sender);
    if (!isAdmin) return reply("❌ Hanya admin yang bisa menggunakan perintah ini.");

    const botAdmin = await isBotAdmin(sock, from);
    if (!botAdmin) return reply("❌ Bot harus menjadi admin terlebih dahulu.");

    if (command === `${p}tutupgrub`) {
        await sock.groupSettingUpdate(from, "announcement");
        return reply("🔒 Grup ditutup! Hanya admin yang bisa mengirim pesan.");
    }

    await sock.groupSettingUpdate(from, "not_announcement");
    return reply("🔓 Grup dibuka! Semua anggota bisa mengirim pesan.");
}

module.exports = { handleTutupGrub };