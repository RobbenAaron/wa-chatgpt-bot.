import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import P from 'pino';
import fetch from 'node-fetch';
import fs from 'fs';
import 'dotenv/config';

const config = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  prefix: "!"
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async mUpdate => {
    const m = mUpdate.messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const msg = m.message.conversation ||
      m.message.extendedTextMessage?.text || '';

    if (!msg.startsWith(config.prefix)) return;
    const command = msg.split(' ')[0].toLowerCase();

    if (command === '!help') {
      const txt = `*Daftar Command Bot:*\n
!infogroup - Info grup
!admin - Daftar admin grup
!online - Lihat yang online (grup)
!terakhironline - Terakhir online owner
!tanya [pertanyaan] - Tanya ke ChatGPT`;
      return sock.sendMessage(from, { text: txt }, { quoted: m });
    }

    if (command === '!infogroup' && from.endsWith('@g.us')) {
      const meta = await sock.groupMetadata(from);
      const txt = `*Nama Grup:* ${meta.subject}\n*Peserta:* ${meta.participants.length}\n*Deskripsi:* ${meta.desc || 'Tidak ada deskripsi'}`;
      return sock.sendMessage(from, { text: txt }, { quoted: m });
    }

    if (command === '!admin' && from.endsWith('@g.us')) {
      const meta = await sock.groupMetadata(from);
      const admins = meta.participants
        .filter(p => p.admin)
        .map(p => `- @${p.id.split('@')[0]}`).join('\n');
      return sock.sendMessage(from, { text: `*Admin Grup:*\n${admins}` }, { quoted: m });
    }

    if (command === '!online' && from.endsWith('@g.us')) {
      return sock.sendMessage(from, { text: 'Fitur cek online belum tersedia (terbatas oleh WhatsApp Web API).' }, { quoted: m });
    }

    if (command === '!terakhironline') {
      return sock.sendMessage(from, { text: `Owner terakhir online: ${new Date().toLocaleString()}` }, { quoted: m });
    }

    if (command === '!tanya') {
      const query = msg.slice(7).trim();
      if (!query) return sock.sendMessage(from, { text: '❌ Format salah!\nContoh: !tanya Siapa presiden Indonesia?' }, { quoted: m });
      const res = await askChatGPT(query);
      return sock.sendMessage(from, { text: res }, { quoted: m });
    }
  });
}

async function askChatGPT(text) {
  try {
    const req = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: text }],
        max_tokens: 200
      })
    });
    const json = await req.json();
    return json.choices?.[0]?.message?.content || '⚠️ Gagal dapet jawaban.';
  } catch (e) {
    console.error(e);
    return '⚠️ Error komunikasi ke ChatGPT.';
  }
}

startBot();
