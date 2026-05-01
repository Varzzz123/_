const cfg              = require("../config");
const { isOwner, isGroupAdmin, formatUptime } = require("../lib/helper");

const p = cfg.PREFIX;

function menuText() {
    return (
        `╔═━━━✥◈✥━━━═╗\n` +
        `       ${cfg.BOT_NAME.toUpperCase()}\n` +
        `╚═━━━✥◈✥━━━═╝\n\n` +
        `✦ Status : Online\n` +
        `✦ Uptime : ${formatUptime(process.uptime())}\n\n` +

        `〔 UMUM 〕\n` +
        `${p}menu / ${p}help\n` +
        `${p}menfess [nomor] [pesan]\n\n` +

        `〔 STIKER 〕\n` +
        `${p}s — buat stiker\n` +
        `${p}toimg — stiker ke gambar\n` +
        `${p}stext [teks] — stiker teks\n\n` +

        `〔 MEDIA 〕\n` +
        `${p}ytmp3 [url] — YouTube → MP3\n` +
        `${p}ytmp4 [url] — YouTube → MP4\n` +
        `${p}ytsearch [kata] — Cari YouTube\n` +
        `${p}ttmp3 [url] — TikTok → MP3\n` +
        `${p}ttmp4 [url] — TikTok → MP4\n` +
        `${p}ttsearch [kata] — Cari TikTok\n\n` +

        `〔 GAMES 〕\n` +
        `${p}games — menu games\n\n` +

        `〔 GROUP (admin) 〕\n` +
        `${p}antilink — toggle antilink\n` +
        `${p}antispam — toggle antispam\n` +
        `${p}antivirtex — toggle antivirtex\n` +
        `${p}tutupgrub — kunci grup\n` +
        `${p}bukagrub — buka grup\n` +
        `${p}afk [alasan] — set AFK`
    );
}

async function handleGeneral(ctx) {
    const { sock, msg, from, command } = ctx;
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    switch (command) {
        case `${p}menu`:
        case `${p}help`:
            await reply(menuText());
            break;
        default:
            break;
    }
}

module.exports = { handleGeneral };