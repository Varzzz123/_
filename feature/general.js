const cfg = require("../config");

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}j ${m}m ${s}d`;
}

function menuText() {
    return (
        `╔═━━━✥◈✥━━━═╗\n` +
        `       ${cfg.BOT_NAME.toUpperCase()}\n` +
        `╚═━━━✥◈✥━━━═╝\n\n` +
        `✦ Status : Online\n` +
        `✦ Uptime : ${formatUptime(process.uptime())}\n\n` +
        `〔 MAIN 〕\n` +
        `➤ ${cfg.PREFIX}menu\n` +
        `➤ ${cfg.PREFIX}menfess [nomor] [pesan]\n` +
        `➤ ${cfg.PREFIX}s — buat stiker\n` +
        `➤ ${cfg.PREFIX}toimg — stiker ke gambar\n` +
        `➤ ${cfg.PREFIX}stext [teks] — stiker teks`
    );
}

async function handleGeneral(ctx) {
    const { sock, msg, from, command } = ctx;
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    switch (command) {
        case `${cfg.PREFIX}menu`:
        case `${cfg.PREFIX}help`:
            await reply(menuText());
            break;
        default:
            break;
    }
}

module.exports = { handleGeneral };