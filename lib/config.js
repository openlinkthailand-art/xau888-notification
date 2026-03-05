const config = {
    // Twelve Data API
    twelveDataApiKey: process.env.TWELVE_DATA_API_KEY,
    twelveDataBaseUrl: 'https://api.twelvedata.com',

    // Discord
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,

    // Cron Secret (to protect the API endpoint)
    cronSecret: process.env.CRON_SECRET || '',

    // RSI Thresholds
    rsiOverbought: parseInt(process.env.RSI_OVERBOUGHT, 10) || 70,
    rsiOversold: parseInt(process.env.RSI_OVERSOLD, 10) || 30,

    // Symbol
    symbol: 'XAU/USD',

    // Timeframes to monitor
    timeframes: ['1min', '5min'],

    // RSI period
    rsiPeriod: 14,
};

module.exports = { config };
