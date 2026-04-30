const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { exec } = require("child_process");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const run = (cmd) =>
    new Promise((resolve, reject) =>
        exec(cmd, (err, stdout, stderr) =>
            err ? reject(stderr || err.message) : resolve(stdout)
        )
    );

const tmpDir = () => {
    const dir = path.join(os.tmpdir(), `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
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

    const getBuffer = async () => {
        const msgToDownload = quotedMsg
            ? { message: quotedMsg, key: msg.key }
            : { message: directMsg, key: msg.key };
        return downloadMediaMessage(
            msgToDownload, "buffer", {},
            { logger: silentLogger, reuploadRequest: sock.updateMediaMessage }
        );
    };

    if (isMakeSticker) {
        if (!isImage && !isVideo && !isSticker) {
            return reply(
                `❌ Tidak ada media!\n\n` +
                `• Reply gambar lalu ketik ${cmd}\n` +
                `• Atau kirim gambar dengan caption ${cmd}`
            );
        }

        await reply("⏳ Membuat stiker...");
        const dir = tmpDir();

        try {
            const buffer     = await getBuffer();
            const outputPath = path.join(dir, "sticker.webp");

            if (isImage || isSticker) {
                const ext       = isSticker ? "webp" : "jpg";
                const inputPath = path.join(dir, `input.${ext}`);
                fs.writeFileSync(inputPath, buffer);

                await run(
                    `ffmpeg -i "${inputPath}" ` +
                    `-vf "scale=512:512:force_original_aspect_ratio=decrease,` +
                    `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" ` +
                    `-vcodec libwebp -lossless 1 -q:v 75 -preset default ` +
                    `-loop 0 -an -vsync 0 "${outputPath}" -y`
                );
            } else if (isVideo) {
                const inputPath = path.join(dir, "input.mp4");
                fs.writeFileSync(inputPath, buffer);

                await run(
                    `ffmpeg -i "${inputPath}" ` +
                    `-vf "scale=512:512:force_original_aspect_ratio=decrease,` +
                    `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15" ` +
                    `-vcodec libwebp -lossless 0 -compression_level 6 -q:v 50 ` +
                    `-loop 0 -preset picture -an -t 10 -vsync 0 "${outputPath}" -y`
                );
            }

            await sock.sendMessage(from, { sticker: fs.readFileSync(outputPath) }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal buat stiker\n${err.message || err}`);
        } finally {
            cleanup(dir);
        }
        return;
    }

    if (isToImg) {
        if (!isSticker) {
            return reply(`❌ Tidak ada stiker!\n\nReply stiker lalu ketik ${cmd}`);
        }

        await reply("⏳ Convert ke gambar...");
        const dir = tmpDir();

        try {
            const buffer     = await getBuffer();
            const inputPath  = path.join(dir, "input.webp");
            const outputPath = path.join(dir, "output.png");

            fs.writeFileSync(inputPath, buffer);
            await run(`ffmpeg -i "${inputPath}" "${outputPath}" -y`);

            await sock.sendMessage(from, {
                image: fs.readFileSync(outputPath),
                caption: "🖼️ Hasil convert",
            }, { quoted: msg });

        } catch (err) {
            await reply(`❌ Gagal convert\n${err.message || err}`);
        } finally {
            cleanup(dir);
        }
    }
}

module.exports = { handleSticker };