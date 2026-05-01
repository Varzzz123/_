const cfg            = require("../../config");
const { randomItem } = require("../../lib/helper");
const fs   = require("fs");
const path = require("path");

const sessions = new Map();
const DB_PATH  = path.join(__dirname, "../../data/games.json");
const p        = cfg.PREFIX;

function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return {}; }
}
function saveDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const GAME_CMDS = [
    `${p}tebakkata`, `${p}tebakangka`, `${p}trivia`,
    `${p}suit`, `${p}matematika`, `${p}hangman`,
    `${p}tebakemoji`, `${p}skor`, `${p}games`,
];

const TEBAK_KATA = [
    { soal: "Hewan berkaki empat, menggonggong, setia menemani manusia. Apa itu?", jawab: "anjing" },
    { soal: "Aku selalu lapar dan harus diberi makan, tapi kalau minum aku mati. Apa aku?", jawab: "api" },
    { soal: "Makin diisi makin ringan, makin dikuras makin berat. Apa itu?", jawab: "balon" },
    { soal: "Ada kepala tak punya rambut, ada ekor tak punya badan. Apa itu?", jawab: "koin" },
    { soal: "Semakin tua semakin muda. Apa itu?", jawab: "lilin" },
    { soal: "Punya lidah tapi tidak bisa bicara. Apa itu?", jawab: "sepatu" },
    { soal: "Rumahku berjalan bersamaku ke mana pun aku pergi. Apa aku?", jawab: "siput" },
    { soal: "Aku bisa terbang tanpa sayap, menangis tanpa mata. Apa aku?", jawab: "awan" },
    { soal: "Kita lihat setiap hari tapi tidak bisa disentuh. Apa itu?", jawab: "pelangi" },
    { soal: "Semakin banyak kamu ambil, semakin besar aku. Apa aku?", jawab: "lubang" },
];

const TRIVIA = [
    { soal: "Ibu kota Indonesia?", jawab: "jakarta" },
    { soal: "Planet terbesar di tata surya?", jawab: "jupiter" },
    { soal: "Berapa jumlah provinsi Indonesia (2024)?", jawab: "38" },
    { soal: "Siapa penemu telepon?", jawab: "alexander graham bell" },
    { soal: "Negara terluas di dunia?", jawab: "rusia" },
    { soal: "Gunung tertinggi di dunia?", jawab: "everest" },
    { soal: "Berapa warna bendera Indonesia?", jawab: "2" },
    { soal: "Bahasa resmi Brasil?", jawab: "portugis" },
    { soal: "Berapa sisi kubus?", jawab: "6" },
    { soal: "Siapa yang pakai perisai vibranium di Avengers?", jawab: "captain america" },
];

const SUIT_CHOICES = ["batu", "gunting", "kertas"];
const SUIT_WIN     = { batu: "gunting", gunting: "kertas", kertas: "batu" };

const MATH_OPS = [
    { op: "+", fn: (a, b) => a + b },
    { op: "-", fn: (a, b) => a - b },
    { op: "×", fn: (a, b) => a * b },
];

const HANGMAN_WORDS = [
    "javascript", "android", "termux", "baileys", "whatsapp",
    "indonesia", "komputer", "keyboard", "monitor", "internet",
    "program", "coding", "developer", "github", "database",
];

const TEBAK_EMOJI_LIST = [
    { soal: "🌊🏄", jawab: "surfing" },
    { soal: "🍎💻", jawab: "apple" },
    { soal: "🌙⭐", jawab: "bintang" },
    { soal: "🐍🎮", jawab: "snake" },
    { soal: "🦁👑", jawab: "raja hutan" },
    { soal: "🚀🌕", jawab: "bulan" },
    { soal: "🎵🎶", jawab: "musik" },
    { soal: "📱💬", jawab: "whatsapp" },
];

const hangmanDisplay = (word, guessed) =>
    word.split("").map(c => (guessed.includes(c) ? c : "_")).join(" ");

async function handleGames(ctx) {
    const { sock, msg, from, sender, senderName, command, text, body } = ctx;

    const sessionKey    = `${from}_${sender}`;
    const activeSession = sessions.get(sessionKey);

    // Kalau ada sesi aktif dan bukan command baru → jawab
    if (activeSession && !GAME_CMDS.includes(command)) {
        return handleAnswer(ctx, activeSession, sessionKey);
    }

    switch (command) {
        case `${p}tebakkata`:  return startTebakKata(ctx, sessionKey);
        case `${p}tebakangka`: return startTebakAngka(ctx, sessionKey);
        case `${p}trivia`:     return startTrivia(ctx, sessionKey);
        case `${p}suit`:       return handleSuit(ctx);
        case `${p}matematika`: return startMatematika(ctx, sessionKey);
        case `${p}hangman`:    return startHangman(ctx, sessionKey);
        case `${p}tebakemoji`: return startTebakEmoji(ctx, sessionKey);
        case `${p}skor`:       return showSkor(ctx);
        case `${p}games`:      return showMenuGames(ctx);
        default: break;
    }
}

async function handleAnswer(ctx, session, sessionKey) {
    const { sock, msg, from, sender, senderName, body } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
    const db    = loadDB();

    if (["tebakkata", "trivia", "tebakemoji"].includes(session.type)) {
        const jawab = body.trim().toLowerCase();
        if (jawab === session.jawab) {
            sessions.delete(sessionKey);
            db[sender] = (db[sender] || 0) + 10;
            saveDB(db);
            return reply(`✅ *Benar!* 🎉\nJawaban: *${session.jawab}*\n+10 poin untuk *${senderName}*\nTotal: ${db[sender]} poin`);
        }
        session.attempts = (session.attempts || 0) + 1;
        if (session.attempts >= 3) {
            sessions.delete(sessionKey);
            return reply(`❌ Salah 3x! Jawaban: *${session.jawab}*`);
        }
        sessions.set(sessionKey, session);
        return reply(`❌ Salah! Sisa kesempatan: ${3 - session.attempts}x`);
    }

    if (session.type === "tebakangka") {
        const tebak = parseInt(body.trim());
        if (isNaN(tebak)) return reply("❌ Masukkan angka yang valid!");
        if (tebak === session.jawab) {
            sessions.delete(sessionKey);
            db[sender] = (db[sender] || 0) + 15;
            saveDB(db);
            return reply(`✅ *Tepat!* 🎉 Angkanya adalah *${session.jawab}*\n+15 poin untuk *${senderName}*`);
        }
        return reply(tebak < session.jawab ? "📈 Terlalu kecil! Coba lagi." : "📉 Terlalu besar! Coba lagi.");
    }

    if (session.type === "matematika") {
        const jawab = parseInt(body.trim());
        if (isNaN(jawab)) return reply("❌ Masukkan angka!");
        sessions.delete(sessionKey);
        if (jawab === session.jawab) {
            db[sender] = (db[sender] || 0) + 5;
            saveDB(db);
            return reply(`✅ *Benar!* Jawaban: *${session.jawab}* +5 poin`);
        }
        return reply(`❌ Salah! Jawaban: *${session.jawab}*`);
    }

    if (session.type === "hangman") {
        const huruf = body.trim().toLowerCase();
        if (huruf.length !== 1 || !/[a-z]/.test(huruf)) return reply("❌ Tebak satu huruf saja!");
        if (session.guessed.includes(huruf)) return reply(`⚠️ Huruf *${huruf}* sudah pernah ditebak!`);

        session.guessed.push(huruf);
        if (!session.word.includes(huruf)) session.wrong++;

        const display = hangmanDisplay(session.word, session.guessed);
        const solved  = !display.includes("_");

        if (solved) {
            sessions.delete(sessionKey);
            db[sender] = (db[sender] || 0) + 20;
            saveDB(db);
            return reply(`✅ *Berhasil!* Kata: *${session.word}* +20 poin`);
        }
        if (session.wrong >= 6) {
            sessions.delete(sessionKey);
            return reply(`💀 Game over! Kata: *${session.word}*`);
        }

        sessions.set(sessionKey, session);
        const nyawa = ["😀","😐","😟","😨","😱","💀"];
        return sock.sendMessage(from, {
            text:
                `${nyawa[session.wrong]} Nyawa: ${6 - session.wrong}/6\n` +
                `Kata: ${display}\n` +
                `Salah: ${session.guessed.filter(g => !session.word.includes(g)).join(", ") || "-"}\n` +
                `Tebak satu huruf!`,
        }, { quoted: msg });
    }
}

async function startTebakKata(ctx, sessionKey) {
    const { sock, msg, from } = ctx;
    const soal = randomItem(TEBAK_KATA);
    sessions.set(sessionKey, { type: "tebakkata", jawab: soal.jawab, attempts: 0 });
    setTimeout(() => sessions.delete(sessionKey), 60000);
    await sock.sendMessage(from, {
        text: `🤔 *TEBAK KATA*\n\n${soal.soal}\n\n_Ketik jawabanmu! (60 detik)_`,
    }, { quoted: msg });
}

async function startTebakAngka(ctx, sessionKey) {
    const { sock, msg, from } = ctx;
    const angka = Math.floor(Math.random() * 100) + 1;
    sessions.set(sessionKey, { type: "tebakangka", jawab: angka });
    setTimeout(() => sessions.delete(sessionKey), 120000);
    await sock.sendMessage(from, {
        text: `🔢 *TEBAK ANGKA*\n\nAku punya angka antara 1 - 100\nCoba tebak! (120 detik)`,
    }, { quoted: msg });
}

async function startTrivia(ctx, sessionKey) {
    const { sock, msg, from } = ctx;
    const soal = randomItem(TRIVIA);
    sessions.set(sessionKey, { type: "trivia", jawab: soal.jawab, attempts: 0 });
    setTimeout(() => sessions.delete(sessionKey), 60000);
    await sock.sendMessage(from, {
        text: `📚 *TRIVIA*\n\n${soal.soal}\n\n_Ketik jawabanmu! (60 detik)_`,
    }, { quoted: msg });
}

async function handleSuit(ctx) {
    const { sock, msg, from, text, senderName } = ctx;
    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
    const pilihan = text?.toLowerCase().trim();

    if (!SUIT_CHOICES.includes(pilihan)) {
        return reply(`✊✌️🖐️ *SUIT*\n\nPilih: batu / gunting / kertas\nContoh: ${p}suit batu`);
    }

    const botPilih = randomItem(SUIT_CHOICES);
    let hasil;
    if (pilihan === botPilih)          hasil = "🤝 *Seri!*";
    else if (SUIT_WIN[pilihan] === botPilih) hasil = `🎉 *${senderName} menang!*`;
    else                               hasil = "🤖 *Bot menang!*";

    return reply(`✊✌️🖐️ *SUIT*\n\nKamu: ${pilihan}\nBot: ${botPilih}\n\n${hasil}`);
}

async function startMatematika(ctx, sessionKey) {
    const { sock, msg, from } = ctx;
    const op  = randomItem(MATH_OPS);
    const a   = Math.floor(Math.random() * 50) + 1;
    const b   = Math.floor(Math.random() * 50) + 1;
    const ans = op.fn(a, b);
    sessions.set(sessionKey, { type: "matematika", jawab: ans });
    setTimeout(() => sessions.delete(sessionKey), 30000);
    await sock.sendMessage(from, {
        text: `🧮 *MATEMATIKA CEPAT*\n\n*${a} ${op.op} ${b} = ?*\n\n_Jawab dalam 30 detik!_`,
    }, { quoted: msg });
}

async function startHangman(ctx, sessionKey) {
    const { sock, msg, from } = ctx;
    const word = randomItem(HANGMAN_WORDS);
    sessions.set(sessionKey, { type: "hangman", word, guessed: [], wrong: 0 });
    setTimeout(() => sessions.delete(sessionKey), 180000);
    const display = hangmanDisplay(word, []);
    await sock.sendMessage(from, {
        text:
            `💀 *HANGMAN*\n\n😀 Nyawa: 6/6\n` +
            `Kata: ${display}\n` +
            `Huruf: ${word.length} karakter\n\n` +
            `_Tebak satu huruf tiap pesan! (180 detik)_`,
    }, { quoted: msg });
}

async function startTebakEmoji(ctx, sessionKey) {
    const { sock, msg, from } = ctx;
    const soal = randomItem(TEBAK_EMOJI_LIST);
    sessions.set(sessionKey, { type: "tebakemoji", jawab: soal.jawab, attempts: 0 });
    setTimeout(() => sessions.delete(sessionKey), 60000);
    await sock.sendMessage(from, {
        text: `🎭 *TEBAK EMOJI*\n\n${soal.soal}\n\nApa yang dimaksud? (60 detik)`,
    }, { quoted: msg });
}

async function showSkor(ctx) {
    const { sock, msg, from, sender } = ctx;
    const db   = loadDB();
    const skor = db[sender] || 0;
    const sorted = Object.entries(db)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([jid, poin], i) => `${i + 1}. ${jid.split("@")[0]} — ${poin} poin`)
        .join("\n");
    await sock.sendMessage(from, {
        text: `🏆 *SKOR*\n\nSkormu: *${skor} poin*\n\n📊 Top 5:\n${sorted || "Belum ada skor"}`,
    }, { quoted: msg });
}

async function showMenuGames(ctx) {
    const { sock, msg, from } = ctx;
    await sock.sendMessage(from, {
        text:
            `╔═━━━✥◈✥━━━═╗\n` +
            `      🎮 GAMES\n` +
            `╚═━━━✥◈✥━━━═╝\n\n` +
            `${p}tebakkata   — Tebak kata/teka-teki\n` +
            `${p}tebakangka  — Tebak angka 1-100\n` +
            `${p}trivia      — Pertanyaan pengetahuan\n` +
            `${p}suit [pilihan] — Suit vs bot\n` +
            `${p}matematika  — Matematika cepat\n` +
            `${p}hangman     — Tebak kata huruf demi huruf\n` +
            `${p}tebakemoji  — Tebak arti emoji\n\n` +
            `${p}skor        — Lihat poin kamu`,
    }, { quoted: msg });
}

module.exports = { handleGames };