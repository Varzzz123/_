const cfg = require("../config");

function isOwner(sender) {
    const num = sender.replace(/@s\.whatsapp\.net|@g\.us/g, "").split(":")[0];
    return num === cfg.OWNER_NUMBER;
}

async function isGroupAdmin(sock, groupId, sender) {
    try {
        const meta   = await sock.groupMetadata(groupId);
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        return admins.includes(sender);
    } catch {
        return false;
    }
}

async function isBotAdmin(sock, groupId) {
    try {
        const meta   = await sock.groupMetadata(groupId);
        const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        const me     = meta.participants.find(p => p.id === botJid);
        return me?.admin != null;
    } catch {
        return false;
    }
}

function getRawText(msg) {
    const m = msg?.message || {};
    return (
        m.conversation              ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption     ||
        m.videoMessage?.caption     ||
        ""
    );
}

function formatUptime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = Math.floor(s % 60);
    return `${h}j ${m}m ${sc}d`;
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { isOwner, isGroupAdmin, isBotAdmin, getRawText, formatUptime, randomItem };