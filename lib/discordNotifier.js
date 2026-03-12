const axios = require('axios');
const { config } = require('./config');
const { formatRSI, getRSIZone } = require('./rsiAnalyzer');

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
 * Send RSI alert with Divergence info
 */
async function sendRSIAlert({ price, rsi, interval, signal, description, color, emoji, datetime, divergence }) {
    const fields = [
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
            name: '🎯 สัญญาณ RSI',
            value: signal === 'OVERBOUGHT'
                ? '⚠️ ราคาอาจปรับตัวลง - พิจารณา Sell'
                : '💡 ราคาอาจดีดตัวขึ้น - พิจารณา Buy',
            inline: false,
        },
    ];

    // Add Divergence info
    if (divergence) {
        if (divergence.detected) {
            fields.push({
                name: `${divergence.emoji} Divergence (TF 15 นาที)`,
                value: `**${divergence.label}**\n${divergence.description}`,
                inline: false,
            });
            fields.push({
                name: '📐 แนวโน้ม',
                value: `**${divergence.trendThai}** (${divergence.trend})`,
                inline: true,
            });
            fields.push({
                name: '💪 ความแรงสัญญาณ',
                value: divergence.strength === 'strong' ? '🔥 แรง' : '🔶 ปานกลาง',
                inline: true,
            });
        } else {
            fields.push({
                name: '📐 Divergence (TF 15 นาที)',
                value: divergence.message || 'ไม่พบ Divergence',
                inline: false,
            });
        }
    }

    fields.push({
        name: '⏳ Cooldown',
        value: 'แจ้งเตือนครั้งถัดไปอีก 10 นาที',
        inline: false,
    });

    const payload = {
        username: '🪙 XAU888 Gold Alert',
        embeds: [
            {
                title: `${emoji} XAU/USD RSI ${signal}!`,
                description: `**${description}**`,
                color: color,
                fields: fields,
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
