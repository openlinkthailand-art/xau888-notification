const config = {
    // Finnhub API
    finnhubApiKey: (process.env.FINNHUB_API_KEY || '').trim(),
    finnhubBaseUrl: 'https://finnhub.io/api/v1',

    // Discord
    discordWebhookUrl: (process.env.DISCORD_WEBHOOK_URL || '').trim(),

    // Cron Secret (to protect the API endpoint)
    cronSecret: (process.env.CRON_SECRET || '').trim(),

    // RSI Thresholds
    rsiOverbought: parseInt(process.env.RSI_OVERBOUGHT, 10) || 70,
    rsiOversold: parseInt(process.env.RSI_OVERSOLD, 10) || 30,

    // Symbol (Finnhub format for gold)
    symbol: 'OANDA:XAU_USD',

    // Timeframes to monitor (Finnhub resolution: 1, 5, 15, 30, 60, D, W, M)
    timeframes: [
        { label: '1min', resolution: '1', barsMinutes: 60 },    // 60 min of 1-min bars
        { label: '5min', resolution: '5', barsMinutes: 300 },   // 300 min of 5-min bars
    ],

    // RSI period
    rsiPeriod: 14,
};

module.exports = { config };
