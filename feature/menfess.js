const cfg = require("../config");

function normalizeNomor(raw) {
    if (!raw) return "";
    let n = String(raw).replace(/[^\d+]/g, "");
    if (n.startsWith("+")) n = n.slice(1);
    if (n.startsWith("0")) n = "62" + n.slice(1);
    return n.replace(/\D/g, "");
}

function getRawText(msg) {
    const m = msg?.message || {};
    return (
        m.conversation              ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption     ||
        m.videoMessage?.caption     ||
        ""
    );
}

function formatHelp() {
    return (
        `❌ *Format salah!*\n\n` +
        `Gunakan:\n` +
        `*${cfg.PREFIX}menfess [nomor] [pesan]*\n\n` +
        `Contoh:\n` +
        `${cfg.PREFIX}menfess 628123456789 Hei, aku suka sama kamu 😳\n` +
        `${cfg.PREFIX}menfess 08123456789 Halo apa kabar?`
    );
}

async function handleMenfess(ctx) {
    const { sock, msg, from, command } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    if (command !== `${cfg.PREFIX}menfess`) return;

    const rawText  = getRawText(msg).trim();
    const afterCmd = rawText.replace(new RegExp(`^\\${cfg.PREFIX}menfess\\s+`, "i"), "");

    if (!afterCmd || afterCmd === `${cfg.PREFIX}menfess`) return reply(formatHelp());

    const firstSpace = afterCmd.search(/\s+/);
    if (firstSpace === -1) return reply(formatHelp());

    const nomorRaw   = afterCmd.slice(0, firstSpace);
    const pesan      = afterCmd.slice(firstSpace + 1).trim();

    if (!nomorRaw || !pesan) return reply(formatHelp());

    const nomorBersih = normalizeNomor(nomorRaw);

    if (nomorBersih.length < 10 || nomorBersih.length > 15) {
        return reply(`❌ Nomor *${nomorRaw}* tidak valid.\nGunakan format: \`628123456789\``);
    }

    const botJid = (sock.user?.id || "").split(":")[0].split("@")[0];
    if (botJid && nomorBersih === botJid) {
        return reply("❌ Tidak bisa kirim menfess ke bot sendiri.");
    }

    try {
        const result = await Promise.race([
            sock.onWhatsApp(nomorBersih),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
        ]);

        const exists = Array.isArray(result) ? !!result[0]?.exists : !!result?.exists;
        if (!exists) return reply(`❌ Nomor *${nomorBersih}* tidak terdaftar di WhatsApp.`);

    } catch (err) {
        if (err.message !== "timeout") {
            return reply("❌ Gagal cek nomor. Coba lagi nanti.");
        }
    }

    const targetJid = `${nomorBersih}@s.whatsapp.net`;
    const timestamp = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour12: false,
    });

    const pesanMenfess =
        `╔══════════════════════╗\n` +
        `║   📨 *MENFESS*       ║\n` +
        `╚══════════════════════╝\n\n` +
        `${pesan}\n\n` +
        `──────────────────────\n` +
        `🕐 ${timestamp}\n` +
        `👤 _Anonim_\n\n` +
        `_Balas pesan ini untuk merespon (tetap anonim)._`;

    try {
        await sock.sendMessage(targetJid, { text: pesanMenfess });
        return reply(`✅ Menfess berhasil dikirim ke *${nomorBersih}* secara anonim!`);
    } catch {
        return reply(`❌ Gagal mengirim ke *${nomorBersih}*. Coba lagi nanti.`);
    }
}

module.exports = { handleMenfess };