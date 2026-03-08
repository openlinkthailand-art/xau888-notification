const axios = require('axios');
const { config } = require('./config');
const { formatRSI, getRSIZone } = require('./rsiAnalyzer');

/**
 * Send Discord message via webhook
 */
async function sendDiscordMessage(payload) {
    try {
        await axios.post(config.discordWebhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 8000,
        });
        return true;
    } catch (error) {
        console.error(`Discord error: ${error.message}`);
        return false;
    }
}

/**
 * Send RSI alert — ONLY when overbought or oversold!
 * This is the ONLY function that sends to Discord.
 */
async function sendRSIAlert({ price, rsi, interval, signal, description, color, emoji, datetime }) {
    const payload = {
        username: '🪙 XAU888 Gold Alert',
        embeds: [
            {
                title: `${emoji} XAU/USD RSI ${signal}!`,
                description: `**${description}**`,
                color: color,
                fields: [
                    {
                        name: '💰 ราคาทอง',
                        value: `**$${price ? price.toFixed(2) : 'N/A'}**`,
                        inline: true,
                    },
                    {
                        name: '📊 RSI (1 นาที)',
                        value: `**${formatRSI(rsi)}**`,
                        inline: true,
                    },
                    {
                        name: '📍 Zone',
                        value: getRSIZone(rsi),
                        inline: true,
                    },
                    {
                        name: '🎯 สัญญาณ',
                        value: signal === 'OVERBOUGHT'
                            ? '⚠️ ราคาอาจปรับตัวลง - พิจารณา Sell'
                            : '💡 ราคาอาจดีดตัวขึ้น - พิจารณา Buy',
                        inline: false,
                    },
                    {
                        name: '⏳ Cooldown',
                        value: 'แจ้งเตือนครั้งถัดไปอีก 10 นาที',
                        inline: false,
                    },
                ],
                footer: {
                    text: `XAU888 | ${datetime || new Date().toISOString()}`,
                },
                timestamp: new Date().toISOString(),
            },
        ],
    };

    return sendDiscordMessage(payload);
}

module.exports = { sendRSIAlert };
