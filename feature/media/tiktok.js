const { exec } = require("child_process");
const https    = require("https");
const http     = require("http");
const fs       = require("fs");
const path     = require("path");
const os       = require("os");
const cfg      = require("../../config");

const TT_FLAGS = `--no-check-certificate`;

const run = (cmd) =>
    new Promise((resolve, reject) =>
        exec(cmd, { maxBuffer: 1024 * 1024 * 200 }, (err, stdout, stderr) =>
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
    return /tiktok\.com|vm\.tiktok\.com/.test(url);
}

// Download file dari URL ke path
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith("https") ? https : http;
        const file  = fs.createWriteStream(dest);
        proto.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close();
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on("finish", () => file.close(resolve));
        }).on("error", (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

// Ambil info video/gambar TikTok pakai yt-dlp JSON
async function getTtInfo(url) {
    const raw = await run(`yt-dlp ${TT_FLAGS} --dump-json --no-playlist "${url}"`);
    return JSON.parse(raw);
}

// TikTok search pakai ytsearch-style
async function searchTiktok(query) {
    const raw = await run(
        `yt-dlp ${TT_FLAGS} --dump-json --playlist-items 1-5 --flat-playlist ` +
        `"https://www.tiktok.com/search/video?q=${encodeURIComponent(query)}"`
    );
    const lines   = raw.split("\n").filter(Boolean);
    const results = [];
    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            if (obj.id && obj.title) {
                results.push({
                    title: obj.title,
                    url  : obj.url || `https://www.tiktok.com/@${obj.uploader}/video/${obj.id}`,
                    id   : obj.id,
                });
            }
        } catch {}
    }
    return results;
}

async function handleTiktok(ctx) {
    const { sock, msg, from, command, text } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
    const p     = cfg.PREFIX;

    // ── .ttmp4 → Download video ──────────────────────────────────────────────
    if (command === `${p}ttmp4`) {
        if (!text) return reply(`❌ Masukkan URL TikTok!\nContoh: ${p}ttmp4 https://vm.tiktok.com/xxx`);
        if (!isTtUrl(text)) return reply("❌ URL tidak valid. Gunakan link TikTok.");

        await reply("⏳ Mengunduh video TikTok...");
        const dir = tmpDir();

        try {
            // Cek dulu apakah post ini video atau foto/slideshow
            const info = await getTtInfo(text);

            // Post foto/slideshow → redirect ke .ttimg
            if (info.images && info.images.length > 0) {
                await reply("📸 Post ini berisi gambar, mengunduh sebagai foto...");
                await downloadTtImages(sock, msg, from, info, dir);
                return;
            }

            // Video biasa
            await run(
                `yt-dlp ${TT_FLAGS} --no-playlist ` +
                `-f "bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best" ` +
                `-o "${dir}/%(title).50s.%(ext)s" "${text}"`
            );

            const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp4") || f.endsWith(".webm"));
            if (!files.length) throw new Error("File tidak ditemukan.");

            const filePath = path.join(dir, files[0]);
            if (fs.statSync(filePath).size > 64 * 1024 * 1024) {
                return reply("❌ File terlalu besar (max 64MB).");
            }

            await sock.sendMessage(from, {
                video   : fs.readFileSync(filePath),
                mimetype: "video/mp4",
                caption : `🎵 ${info.title || files[0].replace(".mp4", "")}`,
            }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal unduh video TikTok.\n_${String(err).split("\n")[0]}_`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    // ── .ttimg → Download gambar/slideshow ───────────────────────────────────
    if (command === `${p}ttimg`) {
        if (!text) return reply(`❌ Masukkan URL TikTok!\nContoh: ${p}ttimg https://vm.tiktok.com/xxx`);
        if (!isTtUrl(text)) return reply("❌ URL tidak valid. Gunakan link TikTok.");

        await reply("⏳ Mengunduh gambar TikTok...");
        const dir = tmpDir();

        try {
            const info = await getTtInfo(text);

            if (!info.images || info.images.length === 0) {
                await reply("⚠️ Post ini adalah video, bukan slideshow. Mengunduh sebagai video...");
                await run(
                    `yt-dlp ${TT_FLAGS} --no-playlist -o "${dir}/%(title).50s.%(ext)s" "${text}"`
                );
                const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp4"));
                if (!files.length) throw new Error("File tidak ditemukan.");
                const filePath = path.join(dir, files[0]);
                await sock.sendMessage(from, {
                    video   : fs.readFileSync(filePath),
                    mimetype: "video/mp4",
                    caption : `🎵 ${info.title || "TikTok"}`,
                }, { quoted: msg });
                return;
            }

            await downloadTtImages(sock, msg, from, info, dir);

        } catch (err) {
            await reply(`❌ Gagal unduh gambar TikTok.\n_${String(err).split("\n")[0]}_`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    // ── .ttmp3 → Download audio ──────────────────────────────────────────────
    if (command === `${p}ttmp3`) {
        if (!text) return reply(`❌ Masukkan URL TikTok!\nContoh: ${p}ttmp3 https://vm.tiktok.com/xxx`);
        if (!isTtUrl(text)) return reply("❌ URL tidak valid. Gunakan link TikTok.");

        await reply("⏳ Mengunduh audio TikTok...");
        const dir = tmpDir();

        try {
            await run(
                `yt-dlp ${TT_FLAGS} --no-playlist -x --audio-format mp3 --audio-quality 0 ` +
                `-o "${dir}/%(title).50s.%(ext)s" "${text}"`
            );

            const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3"));
            if (!files.length) throw new Error("File tidak ditemukan.");

            const filePath = path.join(dir, files[0]);
            await sock.sendMessage(from, {
                audio   : fs.readFileSync(filePath),
                mimetype: "audio/mpeg",
                fileName: files[0],
                ptt     : false,
            }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal unduh audio TikTok.\n_${String(err).split("\n")[0]}_`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    // ── .ttsearch → Cari video TikTok ───────────────────────────────────────
    if (command === `${p}ttsearch`) {
        if (!text) return reply(`❌ Masukkan kata kunci!\nContoh: ${p}ttsearch dance trending`);

        await reply("🔍 Mencari di TikTok...");

        try {
            // Pakai ytsearch via yt-dlp dengan extractor tiktok
            const raw = await run(
                `yt-dlp ${TT_FLAGS} --flat-playlist --dump-json --playlist-items 1-5 ` +
                `"https://www.tiktok.com/search/video?q=${encodeURIComponent(text)}"`
            );

            const lines   = raw.split("\n").filter(Boolean);
            const results = [];

            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    if (obj.title || obj.description) {
                        results.push({
                            title: (obj.title || obj.description || "Tanpa judul").slice(0, 60),
                            url  : obj.url || obj.webpage_url || `https://www.tiktok.com/@${obj.uploader}/video/${obj.id}`,
                        });
                    }
                } catch {}
            }

            if (!results.length) {
                return reply(
                    `❌ Tidak ada hasil untuk *${text}*.\n\n` +
                    `_TikTok search via yt-dlp kadang tidak stabil. Coba kata kunci lain._`
                );
            }

            const txt = results.map((r, i) =>
                `${i + 1}. *${r.title}*\n   🔗 ${r.url}`
            ).join("\n\n");

            await reply(`🎵 *Hasil Pencarian TikTok*\n\n${txt}`);

        } catch (err) {
            // Fallback: kasih pesan informatif
            await reply(
                `❌ Pencarian TikTok gagal.\n\n` +
                `TikTok membatasi akses bot untuk pencarian langsung.\n` +
                `Coba cari manual di TikTok lalu kirim linknya dengan:\n` +
                `*${p}ttmp4 [link]*`
            );
        }
        return;
    }
}

// Helper: kirim semua gambar slideshow satu per satu
async function downloadTtImages(sock, msg, from, info, dir) {
    const images = info.images || [];
    const title  = info.title || "TikTok Slideshow";

    await sock.sendMessage(from, {
        text: `📸 *${title}*\n\nMengirim ${images.length} gambar...`,
    }, { quoted: msg });

    let sent = 0;
    for (let i = 0; i < images.length; i++) {
        const imgUrl  = typeof images[i] === "string" ? images[i] : images[i].url;
        const imgPath = path.join(dir, `img_${i + 1}.jpg`);

        try {
            await downloadFile(imgUrl, imgPath);
            if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 0) {
                await sock.sendMessage(from, {
                    image  : fs.readFileSync(imgPath),
                    caption: `🖼️ ${i + 1}/${images.length}`,
                });
                sent++;
            }
        } catch {}
    }

    if (sent === 0) throw new Error("Semua gambar gagal diunduh.");

    await sock.sendMessage(from, {
        text: `✅ Selesai! ${sent}/${images.length} gambar berhasil dikirim.`,
    });
}

module.exports = { handleTiktok };