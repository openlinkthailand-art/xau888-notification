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
 * Send RSI alert notification
 */
async function sendRSIAlert({ price, rsi, interval, signal, description, color, emoji, datetime }) {
    const timeframeLabel = interval === '1min' ? '1 นาที' : '5 นาที';

    const payload = {
        username: '🪙 XAU888 Gold Alert',
        embeds: [
            {
                title: `${emoji} XAU/USD RSI ${signal} Alert!`,
                description: `**${description}**`,
                color: color,
                fields: [
                    {
                        name: '💰 ราคาทอง',
                        value: `**$${price ? price.toFixed(2) : 'N/A'}**`,
                        inline: true,
                    },
                    {
                        name: '📊 RSI',
                        value: `**${formatRSI(rsi)}**`,
                        inline: true,
                    },
                    {
                        name: '⏰ Timeframe',
                        value: `**${timeframeLabel}**`,
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

/**
 * Send status update (no alert, just current data)
 */
async function sendStatusUpdate(rsiData, price) {
    const fields = [];

    if (price) {
        fields.push({
            name: '💰 ราคา XAU/USD',
            value: `$${price.toFixed(2)}`,
            inline: true,
        });
    }

    for (const [interval, data] of Object.entries(rsiData)) {
        const tfLabel = interval === '1min' ? '1 นาที' : '5 นาที';
        fields.push({
            name: `📊 RSI ${tfLabel}`,
            value: `${formatRSI(data.rsi)} (${getRSIZone(data.rsi)})`,
            inline: true,
        });
    }

    const payload = {
        username: '🪙 XAU888 Gold Alert',
        embeds: [
            {
                title: '📋 XAU/USD Status',
                color: 0x2196F3,
                fields: fields,
                footer: { text: 'XAU888 Notification System' },
                timestamp: new Date().toISOString(),
            },
        ],
    };

    return sendDiscordMessage(payload);
}

module.exports = { sendRSIAlert, sendStatusUpdate };
