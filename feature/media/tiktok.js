const { exec } = require("child_process");
const fs       = require("fs");
const path     = require("path");
const os       = require("os");
const https    = require("https");
const cfg      = require("../../config");

const run = (cmd) =>
    new Promise((resolve, reject) =>
        exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) =>
            err ? reject(stderr || err.message) : resolve(stdout.trim())
        )
    );

const tmpDir = () => {
    const dir = path.join(os.tmpdir(), `tt_${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const cleanup = (dir) => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

function isTtUrl(url) {
    return /tiktok\.com/.test(url);
}

async function handleTiktok(ctx) {
    const { sock, msg, from, command, text } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
    const p = cfg.PREFIX;

    if (command === `${p}ttmp4`) {
        if (!text) return reply(`❌ Masukkan URL TikTok!\nContoh: ${p}ttmp4 https://tiktok.com/...`);
        if (!isTtUrl(text)) return reply("❌ URL tidak valid. Gunakan link TikTok.");

        await reply("⏳ Mengunduh video TikTok...");
        const dir = tmpDir();

        try {
            await run(`yt-dlp --no-check-certificate -o "${dir}/%(title)s.%(ext)s" "${text}"`);
            const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp4"));
            if (!files.length) throw new Error("File tidak ditemukan");

            const filePath = path.join(dir, files[0]);
            const stat     = fs.statSync(filePath);

            if (stat.size > 64 * 1024 * 1024) return reply("❌ File terlalu besar (max 64MB).");

            await sock.sendMessage(from, {
                video   : fs.readFileSync(filePath),
                mimetype: "video/mp4",
                caption : `🎵 ${files[0].replace(".mp4", "")}`,
            }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal unduh: ${err.message || err}`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    if (command === `${p}ttmp3`) {
        if (!text) return reply(`❌ Masukkan URL TikTok!\nContoh: ${p}ttmp3 https://tiktok.com/...`);
        if (!isTtUrl(text)) return reply("❌ URL tidak valid. Gunakan link TikTok.");

        await reply("⏳ Mengunduh audio TikTok...");
        const dir = tmpDir();

        try {
            await run(`yt-dlp --no-check-certificate -x --audio-format mp3 -o "${dir}/%(title)s.%(ext)s" "${text}"`);
            const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3"));
            if (!files.length) throw new Error("File tidak ditemukan");

            const filePath = path.join(dir, files[0]);

            await sock.sendMessage(from, {
                audio   : fs.readFileSync(filePath),
                mimetype: "audio/mpeg",
                fileName: files[0],
                ptt     : false,
            }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal unduh: ${err.message || err}`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    if (command === `${p}ttsearch`) {
        if (!text) return reply(`❌ Masukkan kata kunci!\nContoh: ${p}ttsearch dance trending`);

        await reply("🔍 Mencari di TikTok...");

        try {
            const out   = await run(`yt-dlp "https://www.tiktok.com/search?q=${encodeURIComponent(text)}" --get-title --get-url --playlist-items 1-5 --no-check-certificate`);
            const lines = out.split("\n").filter(Boolean);

            if (!lines.length) return reply("❌ Tidak ada hasil.");

            const results = [];
            for (let i = 0; i < lines.length; i += 2) {
                if (lines[i] && lines[i + 1]) {
                    results.push({ title: lines[i], url: lines[i + 1] });
                }
            }

            const txt = results.map((r, i) =>
                `${i + 1}. *${r.title}*\n   🔗 ${r.url}`
            ).join("\n\n");

            await reply(`🎵 *Hasil Pencarian TikTok*\n\n${txt || "Tidak ada hasil."}`);

        } catch (err) {
            await reply(`❌ Gagal mencari: ${err.message || err}`);
        }
        return;
    }
}

module.exports = { handleTiktok };