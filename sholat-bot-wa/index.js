// index.js
import makeWASocket, { useSingleFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { scheduleJob } from 'node-schedule';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

const { state, saveState } = useSingleFileAuthState('./auth_info.json');
const ownerNumber = process.env.OWNER_NUMBER || '628xxxxxxxxxx';
const location = process.env.LOCATION || 'Jakarta';

async function getPrayerTimes(city) {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://api.aladhan.com/v1/timingsByCity/${today}?city=${city}&country=Indonesia&method=11`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data.timings;
}

function schedulePrayerTimes(sock, timings) {
  const labels = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  labels.forEach(label => {
    const [hour, minute] = timings[label].split(":").map(Number);
    const rule = new scheduleJob.RecurrenceRule();
    rule.hour = hour;
    rule.minute = minute;
    scheduleJob(rule, () => {
      const message = `🕌 Sudah masuk waktu ${label} di ${location}. Yuk sholat!`;
      sock.sendMessage(`${ownerNumber}@s.whatsapp.net`, { text: message });
      console.log("Kirim pengingat:", message);
    });
  });
}

async function startBot() {
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveState);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        && (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
      console.log('Koneksi terputus. Reconnect:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot terkoneksi ke WhatsApp');
      const timings = await getPrayerTimes(location);
      schedulePrayerTimes(sock, timings);
    }
  });
}

startBot();
