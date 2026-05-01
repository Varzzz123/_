const { exec } = require("child_process");
const fs       = require("fs");
const path     = require("path");
const os       = require("os");
const cfg      = require("../../config");

// Cari path node otomatis untuk --js-runtimes
const NODE_PATH = process.execPath;
const YT_FLAGS  = `--js-runtimes node:${NODE_PATH} --no-check-certificate --no-playlist`;

const run = (cmd) =>
    new Promise((resolve, reject) =>
        exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (err, stdout, stderr) =>
            err ? reject(stderr || err.message) : resolve(stdout.trim())
        )
    );

const tmpDir = () => {
    const dir = path.join(os.tmpdir(), `yt_${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const cleanup = (dir) => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

function isYtUrl(url) {
    return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
}

async function handleYoutube(ctx) {
    const { sock, msg, from, command, text } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
    const p     = cfg.PREFIX;

    if (command === `${p}ytmp3`) {
        if (!text) return reply(`❌ Masukkan URL YouTube!\nContoh: ${p}ytmp3 https://youtu.be/xxxx`);
        if (!isYtUrl(text)) return reply("❌ URL tidak valid. Gunakan link YouTube.");

        await reply("⏳ Mengunduh audio, mohon tunggu...");
        const dir = tmpDir();

        try {
            await run(
                `yt-dlp ${YT_FLAGS} -x --audio-format mp3 --audio-quality 0 ` +
                `-o "${dir}/%(title)s.%(ext)s" "${text}"`
            );

            const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3"));
            if (!files.length) throw new Error("File tidak ditemukan setelah download.");

            const filePath = path.join(dir, files[0]);
            if (fs.statSync(filePath).size > 64 * 1024 * 1024) {
                return reply("❌ File terlalu besar (max 64MB).");
            }

            await sock.sendMessage(from, {
                audio   : fs.readFileSync(filePath),
                mimetype: "audio/mpeg",
                fileName: files[0],
                ptt     : false,
            }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal unduh audio:\n${err.toString().split("\n").slice(0, 3).join("\n")}`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    if (command === `${p}ytmp4`) {
        if (!text) return reply(`❌ Masukkan URL YouTube!\nContoh: ${p}ytmp4 https://youtu.be/xxxx`);
        if (!isYtUrl(text)) return reply("❌ URL tidak valid. Gunakan link YouTube.");

        await reply("⏳ Mengunduh video, mohon tunggu...");
        const dir = tmpDir();

        try {
            await run(
                `yt-dlp ${YT_FLAGS} ` +
                `-f "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]" ` +
                `--merge-output-format mp4 ` +
                `-o "${dir}/%(title)s.%(ext)s" "${text}"`
            );

            const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp4"));
            if (!files.length) throw new Error("File tidak ditemukan setelah download.");

            const filePath = path.join(dir, files[0]);
            if (fs.statSync(filePath).size > 64 * 1024 * 1024) {
                return reply("❌ File terlalu besar (max 64MB). Coba video yang lebih pendek.");
            }

            await sock.sendMessage(from, {
                video   : fs.readFileSync(filePath),
                mimetype: "video/mp4",
                caption : `🎬 ${files[0].replace(".mp4", "")}`,
            }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal unduh video:\n${err.toString().split("\n").slice(0, 3).join("\n")}`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    if (command === `${p}ytsearch`) {
        if (!text) return reply(`❌ Masukkan kata kunci!\nContoh: ${p}ytsearch alan walker faded`);

        await reply("🔍 Mencari di YouTube...");

        try {
            const out   = await run(
                `yt-dlp ${YT_FLAGS} "ytsearch5:${text}" --get-title --get-id`
            );
            const lines   = out.split("\n").filter(Boolean);
            const results = [];

            for (let i = 0; i < lines.length; i += 2) {
                const title = lines[i];
                const id    = lines[i + 1];
                if (title && id) results.push({ title, url: `https://youtu.be/${id}` });
            }

            if (!results.length) return reply("❌ Tidak ada hasil ditemukan.");

            const txt = results.map((r, i) =>
                `${i + 1}. *${r.title}*\n   🔗 ${r.url}`
            ).join("\n\n");

            await reply(`🎵 *Hasil Pencarian YouTube*\n\n${txt}`);

        } catch (err) {
            await reply(`❌ Gagal mencari:\n${err.toString().split("\n").slice(0, 3).join("\n")}`);
        }
        return;
    }
}

module.exports = { handleYoutube };