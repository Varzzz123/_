const { exec } = require("child_process");
const fs       = require("fs");
const path     = require("path");
const os       = require("os");
const cfg      = require("../config");

const run = (cmd) =>
    new Promise((resolve, reject) =>
        exec(cmd, (err, stdout, stderr) =>
            err ? reject(stderr || err.message) : resolve(stdout)
        )
    );

const tmpDir = () => {
    const dir = path.join(os.tmpdir(), `stext_${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const cleanup = (dir) => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

async function handleStext(ctx) {
    const { sock, msg, from, command } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });

    if (command !== `${cfg.PREFIX}stext`) return;

    const raw =
        msg.message?.extendedTextMessage?.text ||
        msg.message?.conversation              ||
        "";

    const teks = raw
        .replace(new RegExp(`^\\${cfg.PREFIX}stext\\s*`, "i"), "")
        .trim()
        .replace(/\|/g, "\n");

    if (!teks) {
        return reply(
            `❌ Format salah!\n\n` +
            `Gunakan:\n${cfg.PREFIX}stext [teks]\n\n` +
            `Contoh:\n` +
            `${cfg.PREFIX}stext halo lur\n` +
            `${cfg.PREFIX}stext baris1|baris2|baris3`
        );
    }

    if (teks.length > 200) return reply("❌ Teks terlalu panjang (max 200 karakter).");

    await reply("⏳ Membuat stiker...");
    const dir = tmpDir();

    try {
        const pngPath  = path.join(dir, "text.png");
        const webpPath = path.join(dir, "text.webp");

        const escaped = teks
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"');

        await run(
            `convert ` +
            `-background white ` +
            `pango:"<span font='DejaVu Sans Bold 48' foreground='black'>${escaped}</span>" ` +
            `-gravity center ` +
            `-resize 460x460 ` +
            `-extent 512x512 ` +
            `"${pngPath}"`
        );

        await run(
            `ffmpeg -i "${pngPath}" ` +
            `-vcodec libwebp -q:v 80 -preset picture ` +
            `-loop 0 -an -vsync 0 ` +
            `"${webpPath}" -y`
        );

        await sock.sendMessage(from, { sticker: fs.readFileSync(webpPath) }, { quoted: msg });

    } catch (err) {
        console.error("[STEXT ERROR]:", err);
        await reply("❌ Gagal buat stiker.");
    } finally {
        cleanup(dir);
    }
}

module.exports = { handleStext };