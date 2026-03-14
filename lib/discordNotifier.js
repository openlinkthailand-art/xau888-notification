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
 * Build divergence fields for Discord embed
 */
function buildDivergenceFields(divergences) {
    const fields = [];

    const tfLabels = { '5min': '5 นาที', '15min': '15 นาที', '1h': '1 ชั่วโมง' };

    for (const [tf, div] of Object.entries(divergences)) {
        const label = tfLabels[tf] || tf;
        if (div && div.detected) {
            fields.push({
                name: `${div.emoji} Divergence TF ${label}`,
                value: `**${div.label}**\n${div.description}\n📐 แนวโน้ม: **${div.trendThai}**`,
                inline: false,
            });
        } else {
            fields.push({
                name: `⚖️ Divergence TF ${label}`,
                value: 'ไม่พบ Divergence',
                inline: true,
            });
        }
    }

    return fields;
}

/**
 * Send RSI alert with multi-TF Divergence info
 */
async function sendRSIAlert({ price, rsi, signal, description, color, emoji, datetime, divergences }) {
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

    // Add divergence from all TFs
    if (divergences && Object.keys(divergences).length > 0) {
        fields.push(...buildDivergenceFields(divergences));

        // Overall trend summary
        const detected = Object.values(divergences).filter(d => d && d.detected);
        if (detected.length > 0) {
            const bullish = detected.filter(d => d.trend === 'UP').length;
            const bearish = detected.filter(d => d.trend === 'DOWN').length;
            let summary = '';
            if (bullish > bearish) summary = '📈 สัญญาณ Divergence ส่วนใหญ่ชี้ **ขาขึ้น**';
            else if (bearish > bullish) summary = '📉 สัญญาณ Divergence ส่วนใหญ่ชี้ **ขาลง**';
            else summary = '⚖️ สัญญาณ Divergence **ขัดแย้งกัน** — ระวัง!';

            fields.push({
                name: '🧭 สรุป Divergence',
                value: summary,
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
                footer: { text: `XAU888 | ${datetime || new Date().toISOString()}` },
                timestamp: new Date().toISOString(),
            },
        ],
    };

    return sendDiscordMessage(payload);
}

module.exports = { sendRSIAlert };
