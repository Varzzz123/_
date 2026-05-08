const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { exec }  = require("child_process");
const fs        = require("fs");
const path      = require("path");
const os        = require("os");

const run = (cmd) =>
    new Promise((resolve, reject) =>
        exec(cmd, { maxBuffer: 1024 * 1024 * 200 }, (err, stdout, stderr) =>
            err ? reject(stderr || err.message) : resolve(stdout)
        )
    );

const tmpDir = () => {
    const dir = path.join(os.tmpdir(), `stk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const cleanup = (dir) => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

const silentLogger = {
    level: "silent",
    child: () => silentLogger,
    info: () => {}, error: () => {},
    warn: () => {}, debug: () => {},
    trace: () => {}, fatal: () => {},
};

const MAX_SIZE = 900 * 1024; // 900KB batas aman WA

// Deteksi format file dari magic bytes
function detectFormat(buffer) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return "jpg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
    if (buffer[0] === 0x47 && buffer[1] === 0x49) return "gif";
    if (buffer[0] === 0x52 && buffer[4] === 0x57) return "webp";
    if (buffer[0] === 0x00 && buffer[4] === 0x66) return "mp4";
    // Cek apakah mp4/video dengan ftyp box
    const hex = buffer.slice(0, 12).toString("hex");
    if (hex.includes("66747970")) return "mp4";
    return "jpg"; // fallback
}

// Convert gambar apapun → WebP statis yang kecil
async function imageToSticker(inputPath, outputPath) {
    const qualities = [80, 60, 40, 25, 15];
    for (const q of qualities) {
        try {
            await run(
                `ffmpeg -i "${inputPath}" ` +
                `-vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=rgba" ` +
                `-vframes 1 ` +
                `-vcodec libwebp -lossless 0 -q:v ${q} ` +
                `-preset drawing -loop 0 -an "${outputPath}" -y`
            );
            const size = fs.statSync(outputPath).size;
            if (size <= MAX_SIZE) return true;
        } catch {
            // Coba pendekatan alternatif
            try {
                await run(
                    `ffmpeg -i "${inputPath}" ` +
                    `-vf "scale=512:512,format=yuv420p" ` +
                    `-vframes 1 ` +
                    `-vcodec libwebp -lossless 0 -q:v ${q} "${outputPath}" -y`
                );
                const size = fs.statSync(outputPath).size;
                if (size <= MAX_SIZE) return true;
            } catch {}
        }
    }
    return false;
}

// Convert GIF/video → WebP animasi
async function videoToSticker(inputPath, outputPath, isGif = false) {
    const qualities = [60, 40, 25, 15];
    const fps       = isGif ? 15 : 10;
    const duration  = isGif ? "" : "-t 8";

    for (const q of qualities) {
        try {
            await run(
                `ffmpeg -i "${inputPath}" ${duration} ` +
                `-vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=${fps}" ` +
                `-vcodec libwebp -lossless 0 -compression_level 6 -q:v ${q} ` +
                `-loop 0 -preset picture -an -vsync 0 "${outputPath}" -y`
            );
            const size = fs.statSync(outputPath).size;
            if (size <= MAX_SIZE) return true;
        } catch {}
    }
    return false;
}

async function handleSticker(ctx) {
    const { sock, msg, from, body } = ctx;
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    const cmd           = body.trim().toLowerCase();
    const isMakeSticker = [".s", "!s", ".sticker", "!sticker"].includes(cmd);
    const isToImg       = [".toimg", "!toimg"].includes(cmd);

    if (!isMakeSticker && !isToImg) return;

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const directMsg = msg.message;
    const mediaMsg  = quotedMsg || directMsg;

    const isImage   = !!mediaMsg?.imageMessage;
    const isVideo   = !!mediaMsg?.videoMessage;
    const isSticker = !!mediaMsg?.stickerMessage;
    const isGif     = !!mediaMsg?.imageMessage?.gifPlayback;

    const getBuffer = async () => {
        const target = quotedMsg
            ? { message: quotedMsg, key: msg.key }
            : { message: directMsg, key: msg.key };
        return downloadMediaMessage(
            target, "buffer", {},
            { logger: silentLogger, reuploadRequest: sock.updateMediaMessage }
        );
    };

    // ── BUAT STIKER ────────────────────────────────────────────────────────────
    if (isMakeSticker) {
        if (!isImage && !isVideo && !isSticker) {
            return reply(
                `❌ Tidak ada media!\n\n` +
                `Cara pakai:\n` +
                `• Reply gambar/video/gif → ketik *${cmd}*\n` +
                `• Kirim gambar dengan caption *${cmd}*`
            );
        }

        await reply("⏳ Membuat stiker...");
        const dir = tmpDir();

        try {
            const buffer     = await getBuffer();
            const fmt        = detectFormat(buffer);
            const inputPath  = path.join(dir, `input.${fmt}`);
            const outputPath = path.join(dir, "sticker.webp");

            fs.writeFileSync(inputPath, buffer);

            let ok = false;

            if (isVideo) {
                ok = await videoToSticker(inputPath, outputPath, false);
            } else if (isGif) {
                ok = await videoToSticker(inputPath, outputPath, true);
            } else {
                // Gambar biasa (jpg/png/webp/gif static)
                ok = await imageToSticker(inputPath, outputPath);

                // Fallback: kalau imageToSticker gagal, coba via gif route
                if (!ok) {
                    ok = await videoToSticker(inputPath, outputPath, true);
                }
            }

            if (!ok || !fs.existsSync(outputPath)) {
                return reply("❌ Gagal membuat stiker. Coba dengan gambar yang lebih kecil/sederhana.");
            }

            const finalSize = fs.statSync(outputPath).size;
            if (finalSize > MAX_SIZE) {
                return reply(`❌ Ukuran stiker terlalu besar (${(finalSize/1024).toFixed(0)}KB). Coba gambar yang lebih sederhana.`);
            }

            await sock.sendMessage(from, { sticker: fs.readFileSync(outputPath) }, { quoted: msg });

        } catch (err) {
            console.error("[STICKER ERROR]", err);
            await reply(`❌ Gagal buat stiker: ${err.message || err}`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    // ── STIKER → GAMBAR ────────────────────────────────────────────────────────
    if (isToImg) {
        if (!isSticker) {
            return reply(`❌ Tidak ada stiker!\n\nReply stiker lalu ketik *${cmd}*`);
        }

        await reply("⏳ Convert ke gambar...");
        const dir = tmpDir();

        try {
            const buffer     = await getBuffer();
            const inputPath  = path.join(dir, "input.webp");
            const outputPath = path.join(dir, "output.png");

            fs.writeFileSync(inputPath, buffer);

            try {
                await run(`ffmpeg -i "${inputPath}" -vframes 1 "${outputPath}" -y`);
            } catch {
                await run(`ffmpeg -i "${inputPath}" "${outputPath}" -y`);
            }

            if (!fs.existsSync(outputPath)) throw new Error("Output tidak dihasilkan.");

            await sock.sendMessage(from, {
                image  : fs.readFileSync(outputPath),
                caption: "🖼️ Hasil convert stiker",
            }, { quoted: msg });

        } catch (err) {
            console.error("[TOIMG ERROR]", err);
            await reply(`❌ Gagal convert: ${err.message || err}`);
        } finally {
            cleanup(dir);
        }
    }
}

module.exports = { handleSticker };