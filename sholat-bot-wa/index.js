// index.js
import express from "express";
import { createBot, createProvider, createFlow, addKeyword } from '@bot-whatsapp/bot';
import BaileysProvider from '@bot-whatsapp/provider/baileys';
import JsonFileAdapter from '@bot-whatsapp/database/json';
import axios from 'axios';
import schedule from 'node-schedule';
import dotenv from 'dotenv';

dotenv.config();

const OWNER = process.env.OWNER_NUMBER || '628xxxxxx';
const LOCATION = process.env.LOCATION || 'Jakarta';

const getPrayerTimes = async () => {
    try {
        const date = new Date();
        const response = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${LOCATION}&country=Indonesia&method=11`);
        return response.data.data.timings;
    } catch (err) {
        console.error('Gagal ambil jadwal sholat:', err.message);
        return null;
    }
};

const sendReminder = async (bot, prayerName, time) => {
    await bot.sendMessage(OWNER, `🕌 Sudah masuk waktu ${prayerName} (${time}) di ${LOCATION}. Yuk sholat!`);
};

const flow = createFlow([
    addKeyword(["halo", "hi", "assalamualaikum"])
        .addAnswer("Assalamualaikum! Bot ini akan otomatis mengingatkan kamu waktu sholat 😊")
]);

const main = async () => {
    const provider = createProvider(BaileysProvider);
    const adapterDB = new JsonFileAdapter();

    const { state, bot } = await createBot({
        flow,
        provider,
        database: adapterDB,
    });

    const times = await getPrayerTimes();

    if (times) {
        const jadwal = {
            Subuh: times.Fajr,
            Dzuhur: times.Dhuhr,
            Ashar: times.Asr,
            Maghrib: times.Maghrib,
            Isya: times.Isha,
        };

        for (const [nama, waktu] of Object.entries(jadwal)) {
            const [jam, menit] = waktu.split(":").map(Number);
            schedule.scheduleJob({ hour: jam, minute: menit }, async () => {
                await sendReminder(bot, nama, waktu);
            });
        }
    }

    // endpoint untuk uptime robot
    const app = express();
    app.get("/ping", (_, res) => res.send("OK"));
    app.listen(process.env.PORT || 3000, () => console.log("Bot aktif dan listening..."));
};

main();
