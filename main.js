const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
} = require("@whiskeysockets/baileys");
const { Boom }   = require("@hapi/boom");
const pino       = require("pino");
const readline   = require("readline");

const { BOT_NAME } = require("./config");
const { handleGeneral } = require("./feature/general");
const { handleMenfess } = require("./feature/menfess");
const { handleSticker } = require("./feature/sticker");
const { handleStext }   = require("./feature/tstiker");

const logger   = pino({ level: "silent" });
const rl       = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
    const { version }          = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        getMessage: async () => ({ conversation: "hello" }),
        shouldIgnoreJid: (jid) => isJidBroadcast(jid),
    });

    if (!sock.authState.creds.registered) {
        console.log("\n╔══════════════════════════════════╗");
        console.log("║      Pilih Metode Login          ║");
        console.log("║  1. QR Code                      ║");
        console.log("║  2. Pairing Code (nomor HP)      ║");
        console.log("╚══════════════════════════════════╝\n");

        const pilihan = (await question("Pilih metode [1/2]: ")).trim();

        if (pilihan === "1") {
            const qrSock = makeWASocket({
                version,
                logger,
                printQRInTerminal: true,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                browser: ["Ubuntu", "Chrome", "20.0.04"],
                getMessage: async () => ({ conversation: "hello" }),
                shouldIgnoreJid: (jid) => isJidBroadcast(jid),
            });

            console.log("\n📷 Scan QR Code di atas dengan WhatsApp kamu.\n");

            qrSock.ev.on("creds.update", saveCreds);
            qrSock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
                if (connection === "open") {
                    console.log(`✅ ${BOT_NAME} terhubung via QR Code!`);
                    qrSock.ev.removeAllListeners();
                    startBot();
                } else if (connection === "close") {
                    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    if (reason === DisconnectReason.loggedOut) {
                        console.log("🚪 Logged out.");
                    }
                }
            });
            return;

        } else if (pilihan === "2") {
            await new Promise((r) => setTimeout(r, 3000));

            let phoneNumber = await question("Masukkan nomor WA (628xxx): ");
            phoneNumber = phoneNumber.trim().replace(/[^0-9]/g, "");

            const code      = await sock.requestPairingCode(phoneNumber);
            const formatted = code?.match(/.{1,4}/g)?.join("-") || code;

            console.log("\n╔══════════════════════════════════╗");
            console.log(`║  Pairing Code: ${formatted.padEnd(16)}  ║`);
            console.log("╚══════════════════════════════════╝");
            console.log("\nMasukkan kode di WA → Perangkat Tertaut → Tautkan dengan Nomor Telepon\n");

        } else {
            console.log("❌ Pilihan tidak valid. Restart bot dan pilih 1 atau 2.");
            process.exit(0);
        }
    }

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log("❌ Terputus, kode:", reason);
            if (reason !== DisconnectReason.loggedOut) {
                startBot();
            } else {
                console.log("🚪 Logged out. Hapus auth_info lalu jalankan ulang.");
            }
        } else if (connection === "open") {
            console.log(`✅ ${BOT_NAME} terhubung ke WhatsApp!`);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const ctx = buildContext(msg, sock);

            await handleGeneral(ctx);
            await handleMenfess(ctx);
            await handleSticker(ctx);
            await handleStext(ctx);
        }
    });

    return sock;
}

function buildContext(msg, sock) {
    const from    = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");

    const body = (
        msg.message?.extendedTextMessage?.text ||
        msg.message?.conversation              ||
        msg.message?.imageMessage?.caption     ||
        msg.message?.videoMessage?.caption     ||
        msg.message?.stickerMessage?.caption   ||
        ""
    ).trim();

    const sender     = msg.key.participant || msg.key.remoteJid;
    const senderName = msg.pushName || "Seseorang";
    const args       = body.split(/\s+/);
    const command    = args[0]?.toLowerCase();
    const text       = args.slice(1).join(" ");

    return { sock, msg, from, isGroup, body, sender, senderName, args, command, text };
}

startBot().catch(console.error);