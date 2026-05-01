const cfg = require("../config");
const { getRawText } = require("../lib/helper");

const sessions = new Map();

function normalizeNomor(raw) {
    if (!raw) return "";
    let n = String(raw).replace(/[^\d+]/g, "");
    if (n.startsWith("+")) n = n.slice(1);
    if (n.startsWith("0")) n = "62" + n.slice(1);
    return n.replace(/\D/g, "");
}

function formatHelp() {
    return (
        `❌ *Format salah!*\n\n` +
        `Gunakan:\n*${cfg.PREFIX}menfess [nomor] [pesan]*\n\n` +
        `Contoh:\n` +
        `${cfg.PREFIX}menfess 628123456789 Hei aku suka kamu 😳\n` +
        `${cfg.PREFIX}menfess 08123456789 Halo apa kabar?`
    );
}

function buildPesan(teks, ts) {
    return (
        `╔══════════════════════╗\n` +
        `║   📨 *MENFESS*       ║\n` +
        `╚══════════════════════╝\n\n` +
        `${teks}\n\n` +
        `──────────────────────\n` +
        `🕐 ${ts}\n👤 _Anonim_\n\n` +
        `_Reply pesan ini untuk membalas secara anonim._`
    );
}

function buildBalasan(teks, ts) {
    return (
        `╔══════════════════════╗\n` +
        `║   💬 *BALASAN*       ║\n` +
        `╚══════════════════════╝\n\n` +
        `${teks}\n\n` +
        `──────────────────────\n` +
        `🕐 ${ts}\n👤 _Anonim_\n\n` +
        `_Reply pesan ini untuk membalas secara anonim._`
    );
}

function getTs() {
    return new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false });
}

async function handleMenfess(ctx) {
    const { sock, msg, from, sender, command } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
    const isReply   = !!quotedCtx?.quotedMessage;

    if (isReply) {
        const quotedId = quotedCtx.stanzaId;
        const session  = sessions.get(quotedId);

        if (session) {
            const rawText = getRawText(msg).trim();
            if (!rawText) return;

            const ts      = getTs();
            const balasan = buildBalasan(rawText, ts);

            try {
                const sentMsg = await sock.sendMessage(session.targetJid, { text: balasan });
                const newId   = sentMsg?.key?.id;

                if (newId) {
                    sessions.set(newId, { targetJid: from });
                    setTimeout(() => sessions.delete(newId), 24 * 60 * 60 * 1000);
                }

                await reply("✅ Balasan anonim berhasil dikirim!");
            } catch {
                await reply("❌ Gagal mengirim balasan.");
            }
            return;
        }
    }

    if (command !== `${cfg.PREFIX}menfess`) return;

    const rawText  = getRawText(msg).trim();
    const afterCmd = rawText.replace(new RegExp(`^\\${cfg.PREFIX}menfess\\s+`, "i"), "").trim();

    if (!afterCmd) return reply(formatHelp());

    const firstSpace = afterCmd.search(/\s+/);
    if (firstSpace === -1) return reply(formatHelp());

    const nomorRaw    = afterCmd.slice(0, firstSpace);
    const pesan       = afterCmd.slice(firstSpace + 1).trim();
    const nomorBersih = normalizeNomor(nomorRaw);

    if (!pesan || nomorBersih.length < 10 || nomorBersih.length > 15) return reply(formatHelp());

    const botJid = (sock.user?.id || "").split(":")[0].split("@")[0];
    if (botJid && nomorBersih === botJid) return reply("❌ Tidak bisa kirim menfess ke bot sendiri.");

    try {
        const result = await Promise.race([
            sock.onWhatsApp(nomorBersih),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
        ]);
        const exists = Array.isArray(result) ? !!result[0]?.exists : !!result?.exists;
        if (!exists) return reply(`❌ Nomor *${nomorBersih}* tidak terdaftar di WhatsApp.`);
    } catch (err) {
        if (err.message !== "timeout") return reply("❌ Gagal cek nomor. Coba lagi nanti.");
    }

    const targetJid = `${nomorBersih}@s.whatsapp.net`;
    const ts        = getTs();
    const pesanFull = buildPesan(pesan, ts);

    try {
        const sentMsg = await sock.sendMessage(targetJid, { text: pesanFull });
        const msgId   = sentMsg?.key?.id;

        if (msgId) {
            sessions.set(msgId, { targetJid: from });
            setTimeout(() => sessions.delete(msgId), 24 * 60 * 60 * 1000);
        }

        await reply(`✅ Menfess terkirim ke *${nomorBersih}* secara anonim!`);
    } catch {
        await reply(`❌ Gagal mengirim ke *${nomorBersih}*. Coba lagi nanti.`);
    }
}

module.exports = { handleMenfess };